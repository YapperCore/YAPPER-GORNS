import os
import uuid
import json
import eventlet
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from transcribe import chunked_transcribe_audio

# Disable Eventlet's green DNS, then patch standard library
os.environ['EVENTLET_NO_GREENDNS'] = '1'
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

DOC_STORE_FILE = 'doc_store.json'

# We'll keep an in-memory doc store, but also load/save it from doc_store.json
# doc format:
# {
#   "id": "...",
#   "name": "...",
#   "content": "...",
#   "audioFilename": "...",
#   "audioTrashed": false
# }
doc_store = {}
doc_counter = 0

def load_doc_store():
    global doc_store, doc_counter
    if os.path.exists(DOC_STORE_FILE):
        try:
            with open(DOC_STORE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                doc_store.update(data.get('docs', {}))
                doc_counter = data.get('counter', 0)
        except:
            pass

def save_doc_store():
    global doc_store, doc_counter
    data = {
        'docs': doc_store,
        'counter': doc_counter
    }
    try:
        with open(DOC_STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except:
        pass

load_doc_store()

@app.route('/')
def index():
    return "Backend with doc store, chunk-based transcription, and trash system."

####################################
# Upload audio => Create doc => Transcribe
####################################
@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    global doc_counter
    if 'audio' not in request.files:
        app.logger.error("No audio file found in request.")
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    ext = audio_file.filename.rsplit('.', 1)[-1].lower()
    unique_name = f"{uuid.uuid4()}.{ext}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    if os.path.exists(save_path):
        return jsonify({"error": "File already exists"}), 400

    try:
        audio_file.save(save_path)
        app.logger.info(f"Saved file to: {save_path}")
    except Exception as e:
        app.logger.error(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    # Also create a doc referencing this file
    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = f"Doc{doc_counter}"
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": "",
        "audioFilename": unique_name,
        "audioTrashed": False
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()

    # Start background transcription
    socketio.start_background_task(background_transcription, save_path, doc_id)

    return jsonify({
        "message": "File received and doc created",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_transcription(file_path, doc_id):
    try:
        chunk_buffer = []
        # Process each transcribed chunk
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            # when we have 5, emit them
            if len(chunk_buffer) >= 5:
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': chunk_buffer
                })
                socketio.sleep(0.1)
                append_to_doc(doc_id, chunk_buffer)
                chunk_buffer = []
        # leftover <5
        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {
                'doc_id': doc_id,
                'chunks': chunk_buffer
            })
            socketio.sleep(0.1)
            append_to_doc(doc_id, chunk_buffer)

        # done
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        })
    except Exception as e:
        app.logger.error(f"Error during transcription: {e}")

def append_to_doc(doc_id, chunk_list):
    # Add chunk text to doc content
    global doc_store
    doc = doc_store.get(doc_id)
    if not doc: return
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += " " + chunk["text"]
    doc["content"] = combined_text
    save_doc_store()

####################################
# Move file to trash (soft delete)
####################################
@app.route('/delete_file/<filename>', methods=['DELETE'])
def delete_file(filename):
    """
    Moves file from uploads/ to trash/.
    Also marks doc's audioTrashed = True if it references this file.
    """
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    trash_path = os.path.join(TRASH_FOLDER, filename)

    if os.path.exists(file_path):
        os.rename(file_path, trash_path)
        app.logger.info(f"Moved file to trash: {file_path}")
        mark_doc_audio_trashed(filename, True)
        return jsonify({"message": "File moved to trash"}), 200
    else:
        return jsonify({"message": "File not found"}), 404

def mark_doc_audio_trashed(filename, is_trashed):
    global doc_store
    changed = False
    for d in doc_store.values():
        if d.get("audioFilename") == filename:
            d["audioTrashed"] = is_trashed
            changed = True
    if changed:
        save_doc_store()

####################################
# Trash management
####################################
@app.route('/trash-files', methods=['GET'])
def get_trash_files():
    try:
        return jsonify({"files": os.listdir(TRASH_FOLDER)}), 200
    except Exception as e:
        app.logger.error(f"Error listing trash folder: {e}")
        return jsonify({"error": "Failed"}), 500

@app.route('/restore_file/<filename>', methods=['GET'])
def restore_file(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(trash_path):
        os.rename(trash_path, upload_path)
        mark_doc_audio_trashed(filename, False)
        app.logger.info(f"Restored file: {filename}")
        return jsonify({"message": "File restored"}), 200
    else:
        return jsonify({"message": "File not found in trash"}), 404

@app.route('/permanent_delete/<filename>', methods=['DELETE'])
def permanent_delete(filename):
    """
    Permanently removes file from trash/ folder.
    """
    trash_path = os.path.join(TRASH_FOLDER, filename)
    if os.path.exists(trash_path):
        try:
            os.remove(trash_path)
            app.logger.info(f"Permanently removed {trash_path}")
            return jsonify({"message": "File permanently deleted"}), 200
        except Exception as e:
            app.logger.error(f"Error removing file: {e}")
            return jsonify({"error": "Removal failed"}), 500
    else:
        return jsonify({"error": "File not found in trash"}), 404

####################################
# Doc management (for demonstration)
####################################
@app.route('/api/docs', methods=['GET'])
def list_docs():
    return jsonify(list(doc_store.values())), 200

@app.route('/api/docs/<doc_id>', methods=['GET'])
def get_doc(doc_id):
    doc = doc_store.get(doc_id)
    if not doc:
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(doc), 200

####################################
# Socket.io doc editing example
####################################
@socketio.on('join_doc')
def handle_join_doc(data):
    doc_id = data.get('doc_id')
    join_room(doc_id)
    doc = doc_store.get(doc_id)
    if doc:
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': doc['content']
        })

@socketio.on('edit_doc')
def handle_edit_doc(data):
    doc_id = data.get('doc_id')
    content = data.get('content')
    doc = doc_store.get(doc_id)
    if doc:
        doc['content'] = content
        save_doc_store()
    emit('doc_content_update', {
        'doc_id': doc_id,
        'content': content
    }, room=doc_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

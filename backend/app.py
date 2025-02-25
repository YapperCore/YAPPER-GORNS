import os
import uuid
import json
import eventlet
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from transcribe import chunked_transcribe_audio

os.environ['EVENTLET_NO_GREENDNS'] = '1'
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
DOC_STORE_FILE = 'doc_store.json'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

# In-memory doc store with persistence.
# Each doc is stored as:
# {
#   "id": <doc id>,
#   "name": <doc name>,
#   "content": <text content>,
#   "audioFilename": <unique filename used for storage>,
#   "originalFilename": <original file name from upload>,
#   "audioTrashed": <boolean>
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
    return "Backend with doc store, chunked transcription, and trash integration."

########################################
# UPLOAD AUDIO => CREATE DOC => TRANSCRIBE
########################################
@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    global doc_counter
    if 'audio' not in request.files:
        app.logger.error("No audio file found in request.")
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    # Get the original file name for display purposes
    original_filename = audio_file.filename
    # Generate a unique name by prepending a UUID
    unique_name = f"{uuid.uuid4()}_{original_filename}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    if os.path.exists(save_path):
        return jsonify({"error": "File already exists"}), 400

    try:
        audio_file.save(save_path)
        app.logger.info(f"Saved file to: {save_path}")
    except Exception as e:
        app.logger.error(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = f"Doc{doc_counter}"
    # Create doc referencing the audio file:
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": "",
        "audioFilename": unique_name,      # Unique name used in filesystem
        "originalFilename": original_filename,  # For UI display if needed
        "audioTrashed": False
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()

    # Start background transcription (chunked)
    socketio.start_background_task(background_transcription, save_path, doc_id)

    return jsonify({
        "message": "File received and doc created",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_transcription(file_path, doc_id):
    try:
        chunk_buffer = []
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            if len(chunk_buffer) >= 5:
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': chunk_buffer
                })
                socketio.sleep(0.1)
                append_to_doc(doc_id, chunk_buffer)
                chunk_buffer = []
        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {
                'doc_id': doc_id,
                'chunks': chunk_buffer
            })
            socketio.sleep(0.1)
            append_to_doc(doc_id, chunk_buffer)

        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        })
    except Exception as e:
        app.logger.error(f"Error during transcription: {e}")

def append_to_doc(doc_id, chunk_list):
    doc = doc_store.get(doc_id)
    if not doc:
        return
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += " " + chunk["text"]
    doc["content"] = combined_text
    save_doc_store()

########################################
# DOC MANAGEMENT ROUTES
########################################
@app.route('/api/docs', methods=['GET'])
def list_docs():
    return jsonify(list(doc_store.values())), 200

@app.route('/api/docs/<doc_id>', methods=['GET'])
def get_doc(doc_id):
    d = doc_store.get(doc_id)
    if not d:
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(d), 200

@app.route('/api/docs', methods=['POST'])
def create_doc():
    global doc_counter
    data = request.json or {}
    doc_counter += 1
    doc_id = str(uuid.uuid4())
    name = data.get('name', f"Doc{doc_counter}")
    content = data.get('content', '')
    doc_obj = {
        "id": doc_id,
        "name": name,
        "content": content,
        "audioFilename": None,
        "audioTrashed": False
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()
    return jsonify(doc_obj), 201

@app.route('/api/docs/<doc_id>', methods=['PUT'])
def update_doc(doc_id):
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc:
        return jsonify({"error": "Doc not found"}), 404
    doc["name"] = data.get("name", doc["name"])
    doc["content"] = data.get("content", doc["content"])
    save_doc_store()
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['DELETE'])
def delete_doc(doc_id):
    d = doc_store.get(doc_id)
    if not d:
        return jsonify({"message": "Doc not found"}), 404

    # If doc has an audio file that is not yet trashed, move it to trash.
    filename = d.get("audioFilename")
    if filename and not d.get("audioTrashed"):
        src_path = os.path.join(UPLOAD_FOLDER, filename)
        dst_path = os.path.join(TRASH_FOLDER, filename)
        if os.path.exists(src_path):
            os.rename(src_path, dst_path)
            d["audioTrashed"] = True
            app.logger.info(f"Moved file to trash: {src_path}")

    # Remove doc from store.
    del doc_store[doc_id]
    save_doc_store()
    return jsonify({"message": "Doc deleted"}), 200

########################################
# TRASH & FILE MANAGEMENT ROUTES
########################################
@app.route('/trash-files', methods=['GET'])
def get_trash_files():
    try:
        files = os.listdir(TRASH_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

@app.route('/restore_file/<filename>', methods=['GET'])
def restore_file(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(trash_path):
        os.rename(trash_path, upload_path)
        # Update any doc that referenced this file (if necessary)
        mark_doc_audio_trashed(filename, False)
        app.logger.info(f"Restored file: {filename}")
        return jsonify({"message": "File restored"}), 200
    else:
        return jsonify({"message": "File not found in trash"}), 404

@app.route('/permanent_delete/<filename>', methods=['DELETE'])
def permanent_delete(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    if not os.path.exists(trash_path):
        return jsonify({"message": "File not found in trash"}), 404
    try:
        os.remove(trash_path)
        return jsonify({"message": "File permanently deleted"}), 200
    except Exception as e:
        return jsonify({"message": f"Error permanently deleting file: {e}"}), 500

@app.route('/upload-files', methods=['GET'])
def get_upload_files():
    try:
        files = os.listdir(UPLOAD_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error listing uploads: {e}")
        return jsonify({"error": "Error listing uploads"}), 500

def mark_doc_audio_trashed(filename, is_trashed):
    global doc_store
    changed = False
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            doc["audioTrashed"] = is_trashed
            changed = True
    if changed:
        save_doc_store()

########################################
# SOCKET.IO FOR DOC EDITING
########################################
@socketio.on('join_doc')
def handle_join_doc_evt(data):
    doc_id = data.get('doc_id')
    join_room(doc_id)
    doc = doc_store.get(doc_id)
    if doc:
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': doc['content']
        }, room=doc_id)

@socketio.on('edit_doc')
def handle_edit_doc_evt(data):
    doc_id = data.get('doc_id')
    new_content = data.get('content')
    doc = doc_store.get(doc_id)
    if doc:
        doc['content'] = new_content
        save_doc_store()
    emit('doc_content_update', {
        'doc_id': doc_id,
        'content': new_content
    }, room=doc_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)


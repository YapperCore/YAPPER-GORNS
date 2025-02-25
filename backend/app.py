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
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

DOC_STORE_FILE = 'doc_store.json'

# We'll keep an in-memory doc store, but also load/save to doc_store.json
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

# Load from file once at startup
load_doc_store()

@app.route('/')
def index():
    return "Backend with integrated doc store and single-line chunk transcripts."

########################################
#  UPLOAD AUDIO => CREATE DOC => START TRANSCRIBE
########################################
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

    # Create a new doc
    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = f"Doc{doc_counter}"
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": ""
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
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            # Send partial if >=5 chunks
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
    # single-line chunk appending with space
    global doc_store
    doc = doc_store.get(doc_id)
    if not doc:
        return
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += " " + chunk["text"]
    doc["content"] = combined_text
    save_doc_store()

########################################
#  DELETE FILE => MOVE TO TRASH
########################################
@app.route('/delete_file/<filename>', methods=['DELETE'])
def delete_file(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    trash_path = os.path.join(TRASH_FOLDER, filename)

    if os.path.exists(file_path):
        os.rename(file_path, trash_path)
        app.logger.info(f"Moved file to trash: {file_path}")
        return jsonify({"message": "File moved to trash"}), 200
    else:
        return jsonify({"message": "File not found"}), 404

########################################
#  TRASH
########################################
@app.route('/trash-files', methods=['GET'])
def get_trash_files():
    try:
        files = os.listdir(TRASH_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed"}), 500

@app.route('/restore_file/<filename>', methods=['GET'])
def restore_file(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(trash_path):
        os.rename(trash_path, upload_path)
        app.logger.info(f"Restored file: {filename}")
        return jsonify({"message": "File restored"}), 200
    else:
        return jsonify({"message": "File not found in trash"}), 404

########################################
#  LIST UPLOADS
########################################
@app.route('/upload-files', methods=['GET'])
def get_upload_files():
    try:
        files = os.listdir(UPLOAD_FOLDER)
        return jsonify({"files": files}), 200
    except:
        return jsonify({"error": "Error listing uploads"}), 500

########################################
#  DOC MGMT
########################################
@app.route('/api/docs', methods=['GET'])
def list_docs():
    return jsonify(list(doc_store.values())), 200

@app.route('/api/docs', methods=['POST'])
def create_doc():
    global doc_counter
    data = request.json or {}
    doc_counter += 1
    name = data.get('name', f"Doc{doc_counter}")
    content = data.get('content', '')
    doc_id = str(uuid.uuid4())
    doc_obj = {
        "id": doc_id,
        "name": name,
        "content": content
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()
    return jsonify(doc_obj), 201

@app.route('/api/docs/<doc_id>', methods=['GET'])
def get_doc(doc_id):
    doc = doc_store.get(doc_id)
    if not doc:
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['PUT'])
def update_doc(doc_id):
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc:
        # create if not found
        doc = {
            "id": doc_id,
            "name": data.get('name', "DocX"),
            "content": data.get('content', "")
        }
        doc_store[doc_id] = doc

    doc['name'] = data.get('name', doc['name'])
    doc['content'] = data.get('content', doc['content'])
    save_doc_store()
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['DELETE'])
def delete_doc(doc_id):
    if doc_id in doc_store:
        del doc_store[doc_id]
    save_doc_store()
    return jsonify({"message": "Doc deleted"}), 200

########################################
#   SOCKET.IO (DOC EDIT)
########################################
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

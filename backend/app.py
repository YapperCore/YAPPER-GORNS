import os
import uuid
import json
import eventlet
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from pydub import AudioSegment
from transcribe import chunked_transcribe_audio
from Firestore_implementation import upload_file, save_to_firestore


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

# Our doc store now supports soft-deletion.
# Each doc is stored as:
# {
#   "id": <doc id>,
#   "name": <doc name>,
#   "content": <text content>,
#   "audioFilename": <unique filename used on disk>,
#   "originalFilename": <original file name>,
#   "audioTrashed": <bool>,
#   "deleted": <bool>     # false for active docs; true for soft-deleted docs
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
    return "Backend with doc store (soft-delete), chunk transcription, and trash integration."

@app.route('/uploads/<filename>', methods=['GET'])
def get_audio_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

########################################
# UPLOAD AUDIO => CREATE DOC => TRANSCRIBE
########################################
@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    global doc_counter
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    unique_name = f"{uuid.uuid4()}_{original_filename}"

    try:
        app.logger.info(f"Uploading file: {original_filename}")

        # Upload file to Firebase
        file_url = upload_file(audio_file)  # No need to pass stream separately
        app.logger.info(f"File uploaded successfully: {file_url}")

        # Increment document counter
        doc_counter += 1
        doc_id = str(uuid.uuid4())
        doc_name = f"Doc{doc_counter}"

        # Store document metadata
        doc_obj = {
            "id": doc_id,
            "name": doc_name,
            "content": "",
            "audioUrl": file_url,  # Store the Firebase URL instead of a local file path
            "originalFilename": original_filename,
            "audioTrashed": False,
            "deleted": False
        }
        doc_store[doc_id] = doc_obj
        save_doc_store()

        # Start transcription in the background using Firebase URL
        socketio.start_background_task(background_transcription, file_url, doc_id)

        return jsonify({
            "message": "Upload successful",
            "doc_id": doc_id,
            "file_url": file_url
        }), 200

    except Exception as e:
        app.logger.error(f"Error in upload process: {str(e)}", exc_info=True)
        return jsonify({
            "error": f"File upload failed: {str(e)}"
        }), 500

def convert_audio_to_wav(file_path):
    audio = AudioSegment.from_file(file_path)
    wav_path = file_path.rsplit('.', 1)[0] + '.wav'
    audio.export(wav_path, format='wav')
    return wav_path

def background_transcription(file_url, doc_id):
    try:
        # Download and save file locally
        response = requests.get(file_url, stream=True)
        if response.status_code != 200:
            raise Exception(f"Failed to download file from {file_url}")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    temp_audio.write(chunk)
            temp_audio_path = temp_audio.name

        chunk_buffer = []

        for i, total, text in chunked_transcribe_audio(temp_audio_path):
            chunk_buffer.append({"chunk_index": i, "total_chunks": total, "text": text})

            if len(chunk_buffer) >= 5:
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': chunk_buffer
                })
                socketio.sleep(0.1)
                save_to_firestore(doc_id, file_url, chunk_buffer)  # Save partial results
                chunk_buffer = []

        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {
                'doc_id': doc_id,
                'chunks': chunk_buffer
            })
            socketio.sleep(0.1)
            save_to_firestore(doc_id, file_url, chunk_buffer)

        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        })

        save_to_firestore(doc_id, file_url, chunk_buffer, final=True)  # Mark final transcript in Firestore

    except Exception as e:
        app.logger.error(f"Error during transcription: {e}")
        socketio.emit('transcription_error', {'doc_id': doc_id, 'error': str(e)})


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
    # Return only docs that are not marked as deleted.
    active_docs = [d for d in doc_store.values() if not d.get("deleted", False)]
    return jsonify(active_docs), 200

@app.route('/api/docs/<doc_id>', methods=['GET'])
def get_doc(doc_id):
    d = doc_store.get(doc_id)
    if not d or d.get("deleted"):
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
        "originalFilename": None,
        "audioTrashed": False,
        "deleted": False
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()
    return jsonify(doc_obj), 201

@app.route('/api/docs/<doc_id>', methods=['PUT'])
def update_doc(doc_id):
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc or doc.get("deleted"):
        return jsonify({"error": "Doc not found"}), 404
    doc["name"] = data.get("name", doc["name"])
    doc["content"] = data.get("content", doc["content"])
    save_doc_store()
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['DELETE'])
def delete_doc(doc_id):
    d = doc_store.get(doc_id)
    if not d or d.get("deleted"):
        return jsonify({"message": "Doc not found"}), 404
    d["deleted"] = True

    filename = d.get("audioFilename")
    if filename and not d.get("audioTrashed"):
        src_path = os.path.join(UPLOAD_FOLDER, filename)
        dst_path = os.path.join(TRASH_FOLDER, filename)
        if os.path.exists(src_path):
            os.rename(src_path, dst_path)
            d["audioTrashed"] = True
            app.logger.info(f"Moved file to trash: {src_path}")
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
        mark_doc_audio_trashed(filename, False)
        # Also, if a doc referenced this file and was marked as deleted,
        # we can restore it (set deleted = False) so it shows in docs.
        for doc in doc_store.values():
            if doc.get("audioFilename") == filename:
                doc["deleted"] = False
                doc["audioTrashed"] = False
        save_doc_store()
        app.logger.info(f"Restored file: {filename}")
        return jsonify({"message": "File restored"}), 200
    else:
        return jsonify({"message": "File not found in trash"}), 404

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
    if doc and not doc.get("deleted"):
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': doc['content']
        }, room=doc_id)

@socketio.on('edit_doc')
def handle_edit_doc_evt(data):
    doc_id = data.get('doc_id')
    new_content = data.get('content')
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        doc['content'] = new_content
        save_doc_store()
    emit('doc_content_update', {
        'doc_id': doc_id,
        'content': new_content
    }, room=doc_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)


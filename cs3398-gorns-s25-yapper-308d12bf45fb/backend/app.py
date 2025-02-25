import os
import uuid
import json
import eventlet
from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from transcribe import chunked_transcribe_audio

# Patch eventlet
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

# In-memory doc store, also persisted
# doc example:
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
        "docs": doc_store,
        "counter": doc_counter
    }
    try:
        with open(DOC_STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except:
        pass

load_doc_store()

@app.route('/')
def index():
    return "Backend for integrated Yapper with doc store + chunk transcription + trash."

########################################
# UPLOAD => CREATE DOC => TRANSCRIBE
########################################
@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    global doc_counter
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    ext = audio_file.filename.rsplit('.', 1)[-1].lower()
    unique_name = f"{uuid.uuid4()}.{ext}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    try:
        audio_file.save(save_path)
        app.logger.info(f"Saved file: {save_path}")
    except Exception as e:
        app.logger.error(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = f"Doc{doc_counter}"
    # create doc referencing audio
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": "",
        "audioFilename": unique_name,
        "audioTrashed": False
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()

    # Start chunk-based transcription
    socketio.start_background_task(background_transcription, save_path, doc_id)

    return jsonify({
        "message": "File received, doc created",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_transcription(file_path, doc_id):
    try:
        chunk_buffer = []
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                "chunk_index": i,
                "total_chunks": total,
                "text": text
            })
            if len(chunk_buffer) >= 5:
                socketio.emit("partial_transcript_batch", {
                    "doc_id": doc_id,
                    "chunks": chunk_buffer
                })
                socketio.sleep(0.1)
                append_chunks_to_doc(doc_id, chunk_buffer)
                chunk_buffer = []
        if chunk_buffer:
            socketio.emit("partial_transcript_batch", {
                "doc_id": doc_id,
                "chunks": chunk_buffer
            })
            socketio.sleep(0.1)
            append_chunks_to_doc(doc_id, chunk_buffer)

        socketio.emit("final_transcript", {
            "doc_id": doc_id,
            "done": True
        })
    except Exception as e:
        app.logger.error(f"Transcription error: {e}")

def append_chunks_to_doc(doc_id, chunk_list):
    doc = doc_store.get(doc_id)
    if not doc: return
    combined = doc["content"]
    for c in chunk_list:
        combined += " " + c["text"]
    doc["content"] = combined
    save_doc_store()

########################################
# DOC MGMT: LIST, GET, UPDATE, DELETE
########################################
@app.route('/api/docs', methods=['GET'])
def list_docs():
    return jsonify(list(doc_store.values())), 200

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
        return jsonify({"error": "Doc not found"}), 404

    doc["name"] = data.get("name", doc["name"])
    doc["content"] = data.get("content", doc["content"])
    save_doc_store()
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['DELETE'])
def delete_doc(doc_id):
    """
    Deleting a doc means removing it from the doc store AND
    moving its audio file to trash if not already trashed.
    """
    doc = doc_store.get(doc_id)
    if not doc:
        return jsonify({"message": "Doc not found"}), 404

    filename = doc.get("audioFilename")
    if filename and not doc.get("audioTrashed"):
        # Move file to trash
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        trash_path = os.path.join(TRASH_FOLDER, filename)
        if os.path.exists(file_path):
            os.rename(file_path, trash_path)
            app.logger.info(f"Moved file to trash: {file_path}")
        doc["audioTrashed"] = True

    # now remove doc from the store
    del doc_store[doc_id]
    save_doc_store()
    return jsonify({"message": "Doc deleted"}), 200

########################################
# TRASH (RESTORE, PERM DELETE)
########################################
@app.route('/trash-files', methods=['GET'])
def trash_files():
    try:
        return jsonify({"files": os.listdir(TRASH_FOLDER)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/restore_file/<filename>', methods=['GET'])
def restore_file(filename):
    """
    Moves file from trash => uploads, but doc is no longer in store
    if it was previously deleted. So the doc is gone. But physically we can restore the file.
    (If you wanted to re-create a doc, you'd do so manually.)
    """
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(trash_path):
        return jsonify({"message": "File not found"}), 404
    try:
        os.rename(trash_path, upload_path)
        # no doc to un-trash, doc is gone
        return jsonify({"message": "File restored"}), 200
    except Exception as e:
        return jsonify({"message": f"Restore error: {e}"}), 500

@app.route('/permanent_delete/<filename>', methods=['DELETE'])
def permanent_delete(filename):
    """
    Removes file from trash folder completely
    """
    trash_path = os.path.join(TRASH_FOLDER, filename)
    if not os.path.exists(trash_path):
        return jsonify({"message": "File not found in trash"}), 404
    try:
        os.remove(trash_path)
        return jsonify({"message": "File permanently deleted"}), 200
    except Exception as e:
        return jsonify({"message": f"Perm delete error: {e}"}), 500

########################################
# LIST UPLOADED FILES
########################################
@app.route('/upload-files', methods=['GET'])
def list_uploaded_files():
    try:
        return jsonify({"files": os.listdir(UPLOAD_FOLDER)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

########################################
# OPTIONAL DOC EDIT WEBSOCKETS
########################################
@socketio.on('join_doc')
def join_doc(data):
    doc_id = data.get('doc_id')
    socketio.join_room(doc_id)
    doc = doc_store.get(doc_id)
    if doc:
        socketio.emit('doc_content_update', {
            'doc_id': doc_id,
            'content': doc['content']
        }, room=doc_id)

@socketio.on('edit_doc')
def edit_doc(data):
    doc_id = data.get('doc_id')
    content = data.get('content')
    doc = doc_store.get(doc_id)
    if doc:
        doc['content'] = content
        save_doc_store()
    socketio.emit('doc_content_update', {
        'doc_id': doc_id,
        'content': content
    }, room=doc_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

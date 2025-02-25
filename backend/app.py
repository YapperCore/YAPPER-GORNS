import os
import uuid
import json
import eventlet
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from transcribe import chunked_transcribe_audio

# Disable Eventlet's green DNS and patch the stdlib
os.environ['EVENTLET_NO_GREENDNS'] = '1'
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Folders for uploads and trash
UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

# For doc management (in-memory)
doc_store = {}
doc_counter = 0

###################################################
#     BASIC / HELLO
###################################################
@app.route('/')
def index():
    return "Backend running with integrated doc mgmt and chunked transcription."

###################################################
#     UPLOAD AUDIO => CREATE DOC => START TRANSCRIBE
###################################################
@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    global doc_counter

    if 'audio' not in request.files:
        app.logger.error("No audio file found in request.")
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    file_ext = audio_file.filename.rsplit('.', 1)[-1].lower()
    unique_name = f"{uuid.uuid4()}.{file_ext}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    # Save
    try:
        if os.path.exists(save_path):
            return jsonify({"error": "File already exists"}), 400
        audio_file.save(save_path)
        app.logger.info(f"Saved file to: {save_path}")
    except Exception as e:
        app.logger.error(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    # Create a doc automatically, store in doc_store
    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = f"Doc{doc_counter}"
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": "",
    }
    doc_store[doc_id] = doc_obj

    # Start chunked transcription in background
    socketio.start_background_task(background_transcription, save_path, doc_id)

    return jsonify({
        "message": "File received and doc created",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_transcription(file_path, doc_id):
    try:
        chunk_buffer = []
        # We call chunked_transcribe_audio generator
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            # If we have 5 chunks, emit partial
            if len(chunk_buffer) >= 5:
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': chunk_buffer
                })
                socketio.sleep(0.1)
                # Also append them to doc content
                append_to_doc(doc_id, chunk_buffer)
                chunk_buffer = []

        # leftover
        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {
                'doc_id': doc_id,
                'chunks': chunk_buffer
            })
            socketio.sleep(0.1)
            append_to_doc(doc_id, chunk_buffer)

        # final
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        })

    except Exception as e:
        app.logger.error(f"Error during transcription: {e}")

def append_to_doc(doc_id, chunk_list):
    """Append chunk texts into doc_store[doc_id]['content']. """
    doc = doc_store.get(doc_id)
    if not doc:
        return
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += "\n" + chunk["text"]
    doc["content"] = combined_text

###################################################
#    DELETE FILE => MOVE TO TRASH
###################################################
@app.route('/delete_file/<filename>', methods=['DELETE'])
def delete_file(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    trash_path = os.path.join(TRASH_FOLDER, filename)

    if os.path.exists(file_path):
        os.rename(file_path, trash_path)
        app.logger.info(f"Deleted file => moved to trash: {file_path}")
        return jsonify({"message": "File moved to trash"}), 200
    else:
        return jsonify({"message": "File not found"}), 404

###################################################
#    LIST TRASH
###################################################
@app.route('/trash-files', methods=['GET'])
def get_trash_files():
    try:
        files = os.listdir(TRASH_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

###################################################
#    RESTORE FILE
###################################################
@app.route('/restore_file/<filename>', methods=['GET'])
def restore_file(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)

    try:
        if os.path.exists(trash_path):
            os.rename(trash_path, upload_path)
            app.logger.info(f"Restored file: {trash_path}")
            return jsonify({"message": "File restored"}), 200
        else:
            return jsonify({"message": "File not found in trash"}), 404
    except Exception as e:
        app.logger.error(f"Error restoring file: {e}")
        return jsonify({"message": f"Error restoring file: {str(e)}"}), 500

###################################################
#    LIST UPLOAD FILES
###################################################
@app.route('/upload-files', methods=['GET'])
def get_upload_files():
    try:
        files = os.listdir(UPLOAD_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error fetching upload files: {e}")
        return jsonify({"error": "Failed to fetch upload files"}), 500

###################################################
#    DOC MANAGEMENT
###################################################
@app.route('/api/docs', methods=['GET'])
def list_docs():
    return jsonify(list(doc_store.values())), 200

@app.route('/api/docs', methods=['POST'])
def create_doc():
    global doc_counter
    data = request.json or {}
    doc_counter += 1
    default_name = f"Doc{doc_counter}"

    name = data.get('name', default_name)
    content = data.get('content', '')
    doc_id = str(uuid.uuid4())

    doc_obj = {
        "id": doc_id,
        "name": name,
        "content": content
    }
    doc_store[doc_id] = doc_obj

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
        # create it if not found
        doc = {
            "id": doc_id,
            "name": data.get('name', 'DocX'),
            "content": data.get('content', '')
        }
        doc_store[doc_id] = doc

    doc['name'] = data.get('name', doc['name'])
    doc['content'] = data.get('content', doc['content'])
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['DELETE'])
def delete_doc(doc_id):
    if doc_id in doc_store:
        del doc_store[doc_id]
    return jsonify({"message": "Doc deleted"}), 200

###################################################
#   SOCKET.IO for Real-Time Doc Editing
###################################################
@socketio.on('join_doc')
def handle_join_doc(data):
    doc_id = data.get('doc_id')
    join_room(doc_id)
    doc = doc_store.get(doc_id)
    if doc:
        # Send current content
        emit('doc_content_update', {
            "doc_id": doc_id,
            "content": doc['content']
        })

@socketio.on('edit_doc')
def handle_edit_doc(data):
    doc_id = data.get('doc_id')
    content = data.get('content')
    doc = doc_store.get(doc_id)
    if doc:
        doc['content'] = content
    emit('doc_content_update', {
        "doc_id": doc_id,
        "content": content
    }, room=doc_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

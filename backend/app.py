import os
import uuid
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
from pydub import AudioSegment
from transcribe import transcribe_audio
from auth import verify_firebase_token, is_admin
from Firestore_implementation import upload_file_by_path, get_signed_url, move_file
from services.storage import save_doc_store, doc_store, doc_counter

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
DOC_STORE_FILE = 'doc_store.json'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

# In-memory doc store and counter
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
        except Exception as e:
            print(f"Error loading doc store: {e}")

def save_doc_store_app():
    global doc_store, doc_counter
    data = {
        'docs': doc_store,
        'counter': doc_counter
    }
    try:
        with open(DOC_STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving doc store: {e}")

load_doc_store()

@app.route('/')
def index():
    return "Yapper Backend with Whisper integration"

@app.route('/local-audio/<filename>')
@verify_firebase_token
def serve_local_audio(filename):
    """
    Serve the locally stored audio file if the user owns it (or is admin).
    The front end will fetch this route, get a raw audio file, and create a Blob URL.
    """
    # Find the doc that references this filename
    for doc_id, doc in doc_store.items():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            # If all good, serve the file from uploads folder
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(file_path):
                return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)
            else:
                return jsonify({"error": "File not found locally"}), 404
    return jsonify({"error": "Doc not found for that filename"}), 404

@app.route('/upload-audio', methods=['POST'])
@verify_firebase_token
def upload_audio():
    global doc_counter
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    unique_name = f"{uuid.uuid4()}_{original_filename}"
    local_save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    if os.path.exists(local_save_path):
        return jsonify({"error": "File already exists"}), 400

    # Save file locally
    try:
        audio_file.save(local_save_path)
        print(f"Saved file locally to: {local_save_path}")
    except Exception as e:
        print(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    # Optionally upload to Firebase Storage as well for backup
    uid = request.uid
    firebase_path = f"users/{uid}/uploads/{unique_name}"
    firebase_url = None
    try:
        upload_file_by_path(local_save_path, firebase_path)
        firebase_url = get_signed_url(firebase_path)
    except Exception as e:
        print(f"Error uploading file to Firebase: {e}")
        # Not fatal if cloud upload fails, but we can return an error if you prefer
        # return jsonify({"error": "Firebase upload failed", "details": str(e)}), 500

    # Create a doc entry
    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = f"Doc{doc_counter}"
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": "",
        "audioFilename": unique_name,
        "originalFilename": original_filename,
        "audioTrashed": False,
        "deleted": False,
        "owner": uid,
        "firebaseUrl": firebase_url  # optional
    }
    doc_store[doc_id] = doc_obj
    save_doc_store_app()

    # Kick off transcription in background
    socketio.start_background_task(background_transcription, local_save_path, doc_id)

    return jsonify({
        "message": "File received, doc created, local & optional cloud storage done",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_transcription(file_path, doc_id):
    try:
        text = transcribe_audio(file_path)
        doc = doc_store.get(doc_id)
        if doc:
            doc["content"] = text
            save_doc_store_app()

            # Notify front end that transcription is complete
            socketio.emit('final_transcript', {
                'doc_id': doc_id,
                'text': text,
                'done': True
            })
    except Exception as e:
        print(f"Error during transcription: {e}")

# Existing route for "uploads/<filename>" is no longer strictly needed for playback,
# but you can keep it if you want to serve a signed URL from Firebase.
# We'll keep it for reference or fallback.
@app.route('/uploads/<filename>')
@verify_firebase_token
def get_audio_file_from_firebase(filename):
    """
    Return a JSON {url: "..."} for this user's file in Firebase storage
    (only if you want to keep the old approach).
    """
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            uid = doc["owner"]
            firebase_path = f"users/{uid}/uploads/{filename}"
            try:
                url = get_signed_url(firebase_path)
                return jsonify({"url": url}), 200
            except Exception as e:
                return jsonify({"error": "Could not get file from Firebase", "details": str(e)}), 500
    return jsonify({"error": "File not found"}), 404

@app.route('/api/docs', methods=['GET'])
@verify_firebase_token
def list_docs():
    active_docs = [
        d for d in doc_store.values()
        if not d.get("deleted", False)
           and (d.get("owner") == request.uid or is_admin(request.uid))
    ]
    return jsonify(active_docs), 200

@app.route('/api/docs/<doc_id>', methods=['GET'])
@verify_firebase_token
def get_doc(doc_id):
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(d), 200

@app.route('/api/docs', methods=['POST'])
@verify_firebase_token
def create_doc():
    global doc_counter
    data = request.json or {}
    doc_counter += 1
    doc_id = str(uuid.uuid4())
    name = data.get("name", f"Doc{doc_counter}")
    content = data.get("content", "")
    doc_obj = {
        "id": doc_id,
        "name": name,
        "content": content,
        "audioFilename": None,
        "originalFilename": None,
        "audioTrashed": False,
        "deleted": False,
        "owner": request.uid
    }
    doc_store[doc_id] = doc_obj
    save_doc_store_app()
    return jsonify(doc_obj), 201

@app.route('/api/docs/<doc_id>', methods=['PUT'])
@verify_firebase_token
def update_doc(doc_id):
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc or doc.get("deleted") or (doc.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"error": "Doc not found"}), 404

    doc["name"] = data.get("name", doc["name"])
    doc["content"] = data.get("content", doc["content"])
    save_doc_store_app()
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['DELETE'])
@verify_firebase_token
def delete_doc(doc_id):
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"message": "Doc not found"}), 404

    d["deleted"] = True
    filename = d.get("audioFilename")
    if filename and not d.get("audioTrashed"):
        uid = d.get("owner")
        source_path = os.path.join(UPLOAD_FOLDER, filename)
        trash_path = os.path.join(TRASH_FOLDER, filename)
        # Move locally to trash
        if os.path.exists(source_path):
            os.rename(source_path, trash_path)
            d["audioTrashed"] = True
            print(f"Moved file to local trash: {source_path} -> {trash_path}")
        # Optionally also handle Firebase move
        firebase_source = f"users/{uid}/uploads/{filename}"
        firebase_dest = f"users/{uid}/trash/{filename}"
        try:
            move_file(firebase_source, firebase_dest)
        except Exception as e:
            print(f"Error moving file in Firebase: {e}")

    save_doc_store_app()
    return jsonify({"message": "Doc deleted"}), 200

@app.route('/trash-files', methods=['GET'])
@verify_firebase_token
def get_trash_files():
    trashed_files = [
        d["audioFilename"] for d in doc_store.values()
        if d.get("audioTrashed")
           and (d.get("owner") == request.uid or is_admin(request.uid))
    ]
    return jsonify({"files": trashed_files}), 200

@app.route('/restore_file/<filename>', methods=['GET'])
@verify_firebase_token
def restore_file(filename):
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            # Move from local trash -> local uploads
            local_trash_path = os.path.join(TRASH_FOLDER, filename)
            local_upload_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(local_trash_path):
                os.rename(local_trash_path, local_upload_path)
                doc["deleted"] = False
                doc["audioTrashed"] = False
                # Also restore in Firebase if needed
                uid = doc.get("owner")
                firebase_trash = f"users/{uid}/trash/{filename}"
                firebase_upload = f"users/{uid}/uploads/{filename}"
                try:
                    move_file(firebase_trash, firebase_upload)
                except Exception as e:
                    print(f"Error restoring file in Firebase: {e}")
                save_doc_store_app()
                return jsonify({"message": "File restored"}), 200
            else:
                return jsonify({"error": "File not found in local trash"}), 404
    return jsonify({"error": "File not found in doc store"}), 404

@app.route('/upload-files', methods=['GET'])
@verify_firebase_token
def get_upload_files():
    upload_files = [
        d["audioFilename"] for d in doc_store.values()
        if not d.get("audioTrashed")
           and (d.get("owner") == request.uid or is_admin(request.uid))
    ]
    return jsonify({"files": upload_files}), 200

@socketio.on('join_doc')
def handle_join_doc_evt(data):
    doc_id = data.get('doc_id')
    socketio.server.enter_room(request.sid, doc_id)
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        socketio.emit('doc_content_update', {
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
        save_doc_store_app()
    socketio.emit('doc_content_update', {
        'doc_id': doc_id,
        'content': new_content
    }, room=doc_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)


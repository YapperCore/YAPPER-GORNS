# -*- coding: utf-8 -*-
#!/usr/bin/env python
"""
Robust and complete app.py for a Flask application that integrates with Whisper,
Firebase, and SocketIO. This version is compatible with Windows thanks to a monkey-
patch for ctypes.util.find_library to ensure that Whisper loads the correct C runtime.

All non-ASCII punctuation has been replaced with ASCII equivalents.
"""

# --- Monkey Patch for Windows Compatibility ---
import ctypes.util

# Save the original find_library function
_original_find_library = ctypes.util.find_library

def patched_find_library(name):
    ret = _original_find_library(name)
    # On Windows, if searching for the C library returns None, use 'msvcrt'
    if ret is None and name == "c":
        return "msvcrt"
    return ret

# Override the original function with the patched version
ctypes.util.find_library = patched_find_library

# --- Imports ---
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

# --- Flask, CORS, and SocketIO Setup ---
app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# --- Global Settings and Directories ---
UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
DOC_STORE_FILE = 'doc_store.json'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

# Initialize in-memory doc store and counter (override any imported values)
doc_store = {}
doc_counter = 0

def load_doc_store():
    """Load persisted document store data from disk."""
    global doc_store, doc_counter
    if os.path.exists(DOC_STORE_FILE):
        try:
            with open(DOC_STORE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                doc_store.update(data.get('docs', {}))
                doc_counter = data.get('counter', 0)
        except Exception as e:
            print("Error loading doc store: {}".format(e))

def save_doc_store_app():
    """Persist the in-memory document store and counter to disk."""
    global doc_store, doc_counter
    data = {
        'docs': doc_store,
        'counter': doc_counter
    }
    try:
        with open(DOC_STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error saving doc store: {}".format(e))

load_doc_store()

# --- Routes ---
@app.route('/')
def index():
    return "Yapper Backend with Whisper integration"

@app.route('/local-audio/<filename>')
@verify_firebase_token
def serve_local_audio(filename):
    """
    Serve the locally stored audio file if the user owns it (or is admin).
    The front end will use this endpoint to create a Blob URL for playback.
    """
    for doc_id, doc in doc_store.items():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(file_path):
                return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False)
            else:
                return jsonify({"error": "File not found locally"}), 404
    return jsonify({"error": "Doc not found for that filename"}), 404

@app.route('/upload-audio', methods=['POST'])
@verify_firebase_token
def upload_audio():
    """
    Upload an audio file via POST.
    Saves the file locally, optionally uploads to Firebase, creates a doc entry,
    and starts background transcription.
    """
    global doc_counter
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    unique_name = "{}_{}".format(uuid.uuid4(), original_filename)
    local_save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    if os.path.exists(local_save_path):
        return jsonify({"error": "File already exists"}), 400

    try:
        audio_file.save(local_save_path)
        print("Saved file locally to: {}".format(local_save_path))
    except Exception as e:
        print("Error saving file: {}".format(e))
        return jsonify({"error": "File saving failed"}), 500

    uid = request.uid
    firebase_path = "users/{}/uploads/{}".format(uid, unique_name)
    firebase_url = None
    try:
        upload_file_by_path(local_save_path, firebase_path)
        firebase_url = get_signed_url(firebase_path)
    except Exception as e:
        print("Error uploading file to Firebase: {}".format(e))

    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = "Doc{}".format(doc_counter)
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": "",
        "audioFilename": unique_name,
        "originalFilename": original_filename,
        "audioTrashed": False,
        "deleted": False,
        "owner": uid,
        "firebaseUrl": firebase_url
    }
    doc_store[doc_id] = doc_obj
    save_doc_store_app()

    # Start background transcription task
    socketio.start_background_task(background_transcription, local_save_path, doc_id)

    return jsonify({
        "message": "File received, doc created, local & optional cloud storage done",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_transcription(file_path, doc_id):
    """
    Background task to transcribe the given audio file using Whisper.
    Updates the doc store with the transcription and notifies the client via SocketIO.
    """
    try:
        text = transcribe_audio(file_path)
        doc = doc_store.get(doc_id)
        if doc:
            doc["content"] = text
            save_doc_store_app()
            socketio.emit('final_transcript', {
                'doc_id': doc_id,
                'text': text,
                'done': True
            })
    except Exception as e:
        print("Error during transcription: {}".format(e))

@app.route('/uploads/<filename>')
@verify_firebase_token
def get_audio_file_from_firebase(filename):
    """
    Return a JSON signed URL for an audio file stored on Firebase.
    This endpoint is a fallback if local file serving is not used.
    """
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            uid = doc["owner"]
            firebase_path = "users/{}/uploads/{}".format(uid, filename)
            try:
                url = get_signed_url(firebase_path)
                return jsonify({"url": url}), 200
            except Exception as e:
                return jsonify({"error": "Could not get file from Firebase", "details": str(e)}), 500
    return jsonify({"error": "File not found"}), 404

@app.route('/api/docs', methods=['GET'])
@verify_firebase_token
def list_docs():
    """
    List all non-deleted documents for the user (or for an admin).
    """
    active_docs = [
        d for d in doc_store.values()
        if not d.get("deleted", False) and (d.get("owner") == request.uid or is_admin(request.uid))
    ]
    return jsonify(active_docs), 200

@app.route('/api/docs/<doc_id>', methods=['GET'])
@verify_firebase_token
def get_doc(doc_id):
    """
    Retrieve a specific document by its ID.
    """
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(d), 200

@app.route('/api/docs', methods=['POST'])
@verify_firebase_token
def create_doc():
    """
    Create a new document without an associated audio file.
    """
    global doc_counter
    data = request.json or {}
    doc_counter += 1
    doc_id = str(uuid.uuid4())
    name = data.get("name", "Doc{}".format(doc_counter))
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
    """
    Update an existing document's name and/or content.
    """
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
    """
    Mark a document as deleted.
    Moves any associated audio file to the trash and triggers a Firebase move.
    """
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"message": "Doc not found"}), 404

    d["deleted"] = True
    filename = d.get("audioFilename")
    if filename and not d.get("audioTrashed"):
        uid = d.get("owner")
        source_path = os.path.join(UPLOAD_FOLDER, filename)
        trash_path = os.path.join(TRASH_FOLDER, filename)
        if os.path.exists(source_path):
            os.rename(source_path, trash_path)
            d["audioTrashed"] = True
            print("Moved file to local trash: {} -> {}".format(source_path, trash_path))
        firebase_source = "users/{}/uploads/{}".format(uid, filename)
        firebase_dest = "users/{}/trash/{}".format(uid, filename)
        try:
            move_file(firebase_source, firebase_dest)
        except Exception as e:
            print("Error moving file in Firebase: {}".format(e))
    save_doc_store_app()
    return jsonify({"message": "Doc deleted"}), 200

@app.route('/trash-files', methods=['GET'])
@verify_firebase_token
def get_trash_files():
    """
    List filenames of trashed audio files for the user.
    """
    trashed_files = [
        d["audioFilename"] for d in doc_store.values()
        if d.get("audioTrashed") and (d.get("owner") == request.uid or is_admin(request.uid))
    ]
    return jsonify({"files": trashed_files}), 200

@app.route('/restore_file/<filename>', methods=['GET'])
@verify_firebase_token
def restore_file(filename):
    """
    Restore a trashed audio file from the trash folder to uploads.
    Also restore in Firebase if applicable.
    """
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            local_trash_path = os.path.join(TRASH_FOLDER, filename)
            local_upload_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(local_trash_path):
                os.rename(local_trash_path, local_upload_path)
                doc["deleted"] = False
                doc["audioTrashed"] = False
                uid = doc.get("owner")
                firebase_trash = "users/{}/trash/{}".format(uid, filename)
                firebase_upload = "users/{}/uploads/{}".format(uid, filename)
                try:
                    move_file(firebase_trash, firebase_upload)
                except Exception as e:
                    print("Error restoring file in Firebase: {}".format(e))
                save_doc_store_app()
                return jsonify({"message": "File restored"}), 200
            else:
                return jsonify({"error": "File not found in local trash"}), 404
    return jsonify({"error": "File not found in doc store"}), 404

@app.route('/upload-files', methods=['GET'])
@verify_firebase_token
def get_upload_files():
    """
    List all audio filenames in the uploads folder that are not trashed.
    """
    upload_files = [
        d["audioFilename"] for d in doc_store.values()
        if not d.get("audioTrashed") and (d.get("owner") == request.uid or is_admin(request.uid))
    ]
    return jsonify({"files": upload_files}), 200

# --- SocketIO Events ---
@socketio.on('join_doc')
def handle_join_doc_evt(data):
    """
    Allow a client to join a document room for real-time edits.
    """
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
    """
    Process a document edit event, update the server copy, and broadcast the update.
    """
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

# --- App Runner ---
if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)


#!/usr/bin/env python
"""
Cross-platform compatible Flask application for Yapper with Whisper transcription,
Firebase integration, and SocketIO for real-time updates.
"""

# --- Platform Detection and Configuration ---
import platform
import sys
import os

# Detect platform
IS_WINDOWS = platform.system() == "Windows"
IS_WSL = "microsoft" in platform.uname().release.lower()
PLATFORM_NAME = f"{platform.system()} {'(WSL)' if IS_WSL else ''}"

# --- Monkey Patch for Windows Compatibility ---
if IS_WINDOWS:
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

# --- Path Handling Compatibility ---
def safe_path_join(*args):
    """
    Platform-independent path joining that ensures consistent
    forward slash usage even on Windows.
    """
    path = os.path.join(*args)
    # Normalize to forward slashes for consistency across platforms
    if IS_WINDOWS:
        path = path.replace('\\', '/')
    return path

# --- Imports ---
import uuid
import json
import logging
import tempfile
import shutil
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_socketio import SocketIO, join_room, emit
from flask_cors import CORS
from waitress import serve

# --- App-specific imports ---
try:
    # Use relative imports if running as module
    from .config import UPLOAD_FOLDER, TRASH_FOLDER, DOC_STORE_FILE, ADMIN_UIDS
    from .transcribe import chunked_transcribe_audio, transcribe_audio
    from .services.storage import save_doc_store, doc_store, doc_counter
    from .services.socketio_instance import socketio
    from .auth import verify_firebase_token, is_admin
    from .Firestore_implementation import (
        upload_file_by_path, 
        get_signed_url, 
        move_file, 
        delete_file_by_path
    )
except ImportError:
    # Use absolute imports if running as script
    from config import UPLOAD_FOLDER, TRASH_FOLDER, DOC_STORE_FILE, ADMIN_UIDS
    from transcribe import chunked_transcribe_audio, transcribe_audio
    from services.storage import save_doc_store, doc_store, doc_counter
    from services.socketio_instance import socketio
    from auth import verify_firebase_token, is_admin
    from Firestore_implementation import (
        upload_file_by_path, 
        get_signed_url, 
        move_file, 
        delete_file_by_path
    )

# --- Logging Configuration ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(safe_path_join(tempfile.gettempdir(), 'yapper.log'))
    ]
)
logger = logging.getLogger(__name__)

# Log platform information
logger.info(f"Starting on platform: {PLATFORM_NAME}")
logger.info(f"Python version: {sys.version}")

# --- Flask & CORS Setup ---
app = Flask(__name__)
CORS(app, supports_credentials=True)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'yapper_secret_key')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max upload

# Attach SocketIO to Flask app
socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')

# --- Ensure necessary directories exist ---
Path(UPLOAD_FOLDER).mkdir(exist_ok=True, parents=True)
Path(TRASH_FOLDER).mkdir(exist_ok=True, parents=True)

logger.info(f"Upload folder: {UPLOAD_FOLDER}")
logger.info(f"Trash folder: {TRASH_FOLDER}")
logger.info(f"Doc store file: {DOC_STORE_FILE}")

# --- Load document store ---
def load_doc_store():
    global doc_store, doc_counter
    try:
        doc_store_path = Path(DOC_STORE_FILE)
        if doc_store_path.exists():
            with open(doc_store_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                doc_store.update(data.get('docs', {}))
                doc_counter = data.get('counter', 0)
            logger.info(f"Loaded {len(doc_store)} documents from store")
        else:
            logger.info(f"Doc store file not found at {DOC_STORE_FILE}, starting with empty store")
    except Exception as e:
        logger.error(f"Error loading doc store: {e}")
        # Create backup of corrupted file if it exists
        if Path(DOC_STORE_FILE).exists():
            backup_path = f"{DOC_STORE_FILE}.bak.{datetime.now().strftime('%Y%m%d%H%M%S')}"
            try:
                shutil.copy2(DOC_STORE_FILE, backup_path)
                logger.info(f"Created backup of corrupted doc store at {backup_path}")
            except Exception as backup_err:
                logger.error(f"Failed to create backup: {backup_err}")

load_doc_store()

# --- Helper Functions ---
def ensure_platform_path(path):
    """Ensure path is correctly formatted for the current platform."""
    return Path(path).as_posix() if IS_WINDOWS else path

def safe_file_operation(operation, src, dst=None):
    """
    Perform a file operation safely with platform-specific error handling.
    
    Args:
        operation: 'move', 'copy', 'delete'
        src: Source path
        dst: Destination path (for move/copy)
    
    Returns:
        bool: Success status
        str: Error message if failed
    """
    try:
        src_path = Path(src)
        
        if not src_path.exists():
            return False, f"Source file {src} does not exist"
        
        if operation == 'move':
            dst_path = Path(dst)
            dst_path.parent.mkdir(exist_ok=True, parents=True)
            shutil.move(src_path, dst_path)
        elif operation == 'copy':
            dst_path = Path(dst)
            dst_path.parent.mkdir(exist_ok=True, parents=True)
            shutil.copy2(src_path, dst_path)
        elif operation == 'delete':
            os.remove(src_path)
        else:
            return False, f"Unknown operation: {operation}"
        
        return True, None
    except Exception as e:
        logger.error(f"File operation {operation} failed: {e}")
        
        # Additional handling for Windows-specific errors
        if IS_WINDOWS:
            import errno
            if isinstance(e, OSError) and e.errno in (errno.EACCES, errno.EPERM):
                return False, "File access denied. It may be open in another program."
        
        return False, str(e)

# --- Basic Routes ---
@app.route('/')
def index():
    return jsonify({
        "service": "Yapper Backend API",
        "status": "running",
        "platform": PLATFORM_NAME,
        "version": "1.0.0"
    })

@app.route('/healthcheck')
def healthcheck():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "platform": PLATFORM_NAME
    }), 200

# --- Authentication Routes ---
@app.route('/auth/check', methods=['GET'])
@verify_firebase_token
def check_auth():
    return jsonify({
        "authenticated": True,
        "uid": request.uid,
        "is_admin": is_admin(request.uid)
    })

# --- Document Management Routes ---
@app.route('/api/docs', methods=['GET'])
@verify_firebase_token
def list_docs():
    """List all non-deleted documents for the authenticated user."""
    active_docs = [
        d for d in doc_store.values()
        if not d.get("deleted", False) and (d.get("owner") == request.uid or is_admin(request.uid))
    ]
    return jsonify(active_docs), 200

@app.route('/api/docs/<doc_id>', methods=['GET'])
@verify_firebase_token
def get_doc(doc_id):
    """Retrieve a specific document by its ID."""
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(d), 200

@app.route('/api/docs', methods=['POST'])
@verify_firebase_token
def create_doc():
    """Create a new document."""
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
    save_doc_store()
    return jsonify(doc_obj), 201

@app.route('/api/docs/<doc_id>', methods=['PUT'])
@verify_firebase_token
def update_doc(doc_id):
    """Update an existing document."""
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc or doc.get("deleted") or (doc.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"error": "Doc not found"}), 404
    
    doc["name"] = data.get("name", doc["name"])
    doc["content"] = data.get("content", doc["content"])
    save_doc_store()
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['DELETE'])
@verify_firebase_token
def delete_doc(doc_id):
    """Mark a document as deleted and move its associated file to trash."""
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"message": "Doc not found"}), 404

    d["deleted"] = True
    filename = d.get("audioFilename")
    
    if filename and not d.get("audioTrashed"):
        # Move local file to trash if it exists
        source_path = safe_path_join(UPLOAD_FOLDER, filename)
        trash_path = safe_path_join(TRASH_FOLDER, filename)
        
        # Try to move local file
        if Path(source_path).exists():
            success, error = safe_file_operation('move', source_path, trash_path)
            if success:
                logger.info(f"Moved file to local trash: {source_path} -> {trash_path}")
            else:
                logger.error(f"Error moving file to local trash: {error}")
                
        # Move file in Firebase
        uid = d.get("owner")
        firebase_source = f"users/{uid}/uploads/{filename}"
        firebase_dest = f"users/{uid}/trash/{filename}"
        try:
            move_file(firebase_source, firebase_dest)
            d["audioTrashed"] = True
            logger.info(f"Moved file to Firebase trash: {firebase_source} -> {firebase_dest}")
        except Exception as e:
            logger.error(f"Error moving file in Firebase: {e}")
    
    save_doc_store()
    return jsonify({"message": "Doc deleted"}), 200

# --- Audio File Upload & Transcription Routes ---
@app.route('/local-audio/<filename>')
@verify_firebase_token
def serve_local_audio(filename):
    """
    Serve a locally stored audio file if the user owns it.
    Falls back to Firebase signed URL if local file doesn't exist.
    """
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            # First try to serve from local file
            file_path = safe_path_join(UPLOAD_FOLDER, filename)
            if Path(file_path).exists():
                return send_from_directory(
                    UPLOAD_FOLDER, 
                    filename, 
                    as_attachment=False,
                    mimetype="audio/mpeg"  # Set appropriate MIME type
                )
                
            # Fall back to Firebase signed URL
            uid = doc.get("owner")
            firebase_path = f"users/{uid}/uploads/{filename}"
            try:
                url = get_signed_url(firebase_path)
                return jsonify({"url": url}), 200
            except Exception as e:
                logger.error(f"Error getting signed URL: {e}")
                return jsonify({"error": "File not found in storage"}), 404
    
    return jsonify({"error": "File not found"}), 404

@app.route('/upload-audio', methods=['POST'])
@verify_firebase_token
def upload_audio():
    """Upload an audio file and start transcription."""
    global doc_counter
    
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    unique_name = f"{uuid.uuid4()}_{original_filename}"
    local_save_path = safe_path_join(UPLOAD_FOLDER, unique_name)

    if Path(local_save_path).exists():
        return jsonify({"error": "File already exists"}), 400

    try:
        # Ensure the upload directory exists
        Path(local_save_path).parent.mkdir(exist_ok=True, parents=True)
        audio_file.save(local_save_path)
        logger.info(f"Saved file locally to: {local_save_path}")
    except Exception as e:
        logger.error(f"Error saving file locally: {e}")
        return jsonify({"error": "File saving failed", "details": str(e)}), 500

    # Upload to Firebase Storage
    uid = request.uid
    firebase_path = f"users/{uid}/uploads/{unique_name}"
    firebase_url = None
    
    try:
        upload_file_by_path(local_save_path, firebase_path)
        firebase_url = get_signed_url(firebase_path)
        logger.info(f"Uploaded file to Firebase: {firebase_path}")
    except Exception as e:
        logger.error(f"Error uploading to Firebase: {e}")
        # Continue even if Firebase upload fails, as we have the local file

    # Create document for the transcription
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
        "firebaseUrl": firebase_url
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()

    # Start chunked transcription in background
    socketio.start_background_task(
        background_chunked_transcription, 
        local_save_path, 
        doc_id
    )

    return jsonify({
        "message": "File received and transcription started",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_chunked_transcription(file_path, doc_id):
    """Process audio in chunks and emit partial results."""
    try:
        chunk_buffer = []
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            
            # Emit chunks in batches for efficiency
            if len(chunk_buffer) >= 5:
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': chunk_buffer
                })
                socketio.sleep(0.1)  # Small delay to prevent flooding
                
                # Update document content
                append_to_doc(doc_id, chunk_buffer)
                chunk_buffer = []
        
        # Handle any remaining chunks
        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {
                'doc_id': doc_id,
                'chunks': chunk_buffer
            })
            append_to_doc(doc_id, chunk_buffer)

        # Signal completion
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        })
        
        logger.info(f"Transcription completed for document {doc_id}")
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        socketio.emit('transcription_error', {
            'doc_id': doc_id,
            'error': str(e)
        })

def append_to_doc(doc_id, chunk_list):
    """Append transcription chunks to document content."""
    doc = doc_store.get(doc_id)
    if not doc:
        return
        
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += " " + chunk["text"]
    
    doc["content"] = combined_text
    save_doc_store()

# --- Trash Management Routes ---
@app.route('/trash-files', methods=['GET'])
@verify_firebase_token
def get_trash_files():
    """List all trashed audio files for the authenticated user."""
    try:
        trashed_files = [
            doc["audioFilename"] for doc in doc_store.values()
            if doc.get("audioTrashed") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        return jsonify({"files": trashed_files}), 200
    except Exception as e:
        logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files", "details": str(e)}), 500

@app.route('/restore_file/<filename>', methods=['GET'])
@verify_firebase_token
def restore_file(filename):
    """Restore a file from trash back to uploads."""
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            # Restore in local filesystem if applicable
            local_trash_path = safe_path_join(TRASH_FOLDER, filename)
            local_upload_path = safe_path_join(UPLOAD_FOLDER, filename)
            
            if Path(local_trash_path).exists():
                success, error = safe_file_operation('move', local_trash_path, local_upload_path)
                if success:
                    logger.info(f"Restored local file: {local_trash_path} -> {local_upload_path}")
                else:
                    logger.error(f"Error restoring local file: {error}")
            
            # Restore in Firebase
            uid = doc.get("owner")
            firebase_trash = f"users/{uid}/trash/{filename}"
            firebase_upload = f"users/{uid}/uploads/{filename}"
            try:
                move_file(firebase_trash, firebase_upload)
                # Update document status
                doc["audioTrashed"] = False
                doc["deleted"] = False
                
                # Update Firebase URL
                file_url = get_signed_url(firebase_upload)
                doc["firebaseUrl"] = file_url
                
                save_doc_store()
                logger.info(f"Restored file in Firebase: {firebase_trash} -> {firebase_upload}")
                return jsonify({"message": "File restored"}), 200
            except Exception as e:
                logger.error(f"Error restoring file in Firebase: {e}")
                return jsonify({"error": "Failed to restore file", "details": str(e)}), 500
    
    return jsonify({"error": "File not found in trash"}), 404

@app.route('/perm_delete_files/<filename>', methods=['DELETE'])
@verify_firebase_token
def perm_delete_file(filename):
    """Permanently delete a file from trash."""
    try:
        for doc_id, doc in list(doc_store.items()):
            if doc.get("audioFilename") == filename:
                if doc.get("owner") != request.uid and not is_admin(request.uid):
                    return jsonify({"error": "Access denied"}), 403
                    
                # Delete from local trash if it exists
                local_trash_path = safe_path_join(TRASH_FOLDER, filename)
                if Path(local_trash_path).exists():
                    success, error = safe_file_operation('delete', local_trash_path)
                    if success:
                        logger.info(f"Deleted local trash file: {local_trash_path}")
                    else:
                        logger.error(f"Error deleting local trash file: {error}")
                
                # Delete from Firebase
                uid = doc.get("owner")
                firebase_path = f"users/{uid}/trash/{filename}"
                try:
                    delete_file_by_path(firebase_path)
                    
                    # Remove document from store
                    del doc_store[doc_id]
                    save_doc_store()
                    
                    logger.info(f"Permanently deleted file: {filename}")
                    return jsonify({"message": "File permanently deleted"}), 200
                except Exception as e:
                    logger.error(f"Error deleting file from Firebase: {e}")
                    return jsonify({"error": "Failed to delete file", "details": str(e)}), 500
        
        return jsonify({"error": "File not found in trash"}), 404
    except Exception as e:
        logger.error(f"Unexpected error in permanent delete: {e}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@app.route('/mark_file_trashed/<filename>', methods=['PUT'])
@verify_firebase_token
def mark_file_trashed(filename):
    """Move a file to trash without deleting its document."""
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):  # Fixed syntax error here - removed extra )
                return jsonify({"error": "Access denied"}), 403
                
            # Move file in local filesystem if applicable
            source_path = safe_path_join(UPLOAD_FOLDER, filename)
            trash_path = safe_path_join(TRASH_FOLDER, filename)
            
            if Path(source_path).exists():
                success, error = safe_file_operation('move', source_path, trash_path)
                if success:
                    logger.info(f"Moved file to local trash: {source_path} -> {trash_path}")
                else:
                    logger.error(f"Error moving file to local trash: {error}")
            
            # Move file in Firebase
            uid = doc.get("owner")
            upload_path = f"users/{uid}/uploads/{filename}"
            trash_path = f"users/{uid}/trash/{filename}"
            try:
                move_file(upload_path, trash_path)
                doc["audioTrashed"] = True
                save_doc_store()
                
                logger.info(f"Moved file to Firebase trash: {upload_path} -> {trash_path}")
                return jsonify({"message": "File moved to trash"}), 200
            except Exception as e:
                logger.error(f"Error moving file to Firebase trash: {e}")
                return jsonify({"error": "Failed to move file to trash", "details": str(e)}), 500
    
    return jsonify({"error": "File not found"}), 404

@app.route('/upload-files', methods=['GET'])
@verify_firebase_token
def get_upload_files():
    """List all non-trashed audio files."""
    try:
        upload_files = [
            doc["audioFilename"] for doc in doc_store.values()
            if not doc.get("audioTrashed") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        return jsonify({"files": upload_files}), 200
    except Exception as e:
        logger.error(f"Error listing uploads: {e}")
        return jsonify({"error": "Error listing uploads", "details": str(e)}), 500

# --- SocketIO Events ---
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")

@socketio.on('join_doc')
def handle_join_doc(data):
    """Allow a client to join a document room for real-time collaboration."""
    doc_id = data.get('doc_id')
    if not doc_id:
        return
        
    join_room(doc_id)
    logger.info(f"Client {request.sid} joined document {doc_id}")
    
    # Send current document content
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': doc['content']
        }, room=doc_id)

@socketio.on('edit_doc')
def handle_edit_doc(data):
    """Process document edits and broadcast to all clients in the room."""
    doc_id = data.get('doc_id')
    new_content = data.get('content')
    
    if not doc_id or new_content is None:
        return
        
    # Update doc in memory
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        doc['content'] = new_content
        save_doc_store()
        
        # Broadcast to all clients except sender
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': new_content
        }, room=doc_id, include_self=False)
        
        logger.debug(f"Document {doc_id} updated by client {request.sid}")

# --- Error Handlers ---
@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Bad request"}), 400

@app.errorhandler(401)
def unauthorized(error):
    return jsonify({"error": "Unauthorized"}), 401

@app.errorhandler(403)
def forbidden(error):
    return jsonify({"error": "Forbidden"}), 403

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_server(error):
    return jsonify({"error": "Internal server error"}), 500

# --- Cross-platform application entry point ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Yapper backend on {PLATFORM_NAME}")
    logger.info(f"Port: {port}, Debug mode: {debug_mode}")
    
    if debug_mode:
        # Use Flask's development server with debug mode
        socketio.run(app, debug=debug_mode, host='0.0.0.0', port=port)
    else:
        # Use waitress for production - more stable across platforms
        from waitress import serve
        # First inform about the server
        print(f"Yapper backend running on http://0.0.0.0:{port} (Press CTRL+C to quit)")
        # Use socketio's server which wraps waitress
        socketio.run(app, host='0.0.0.0', port=port)

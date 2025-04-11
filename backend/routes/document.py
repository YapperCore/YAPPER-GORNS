# backend/routes/document.py
import os
import uuid
import json
import logging
from pathlib import Path
from flask import request, jsonify, Blueprint, send_from_directory, Response
from pydub import AudioSegment
from transcribe import chunked_transcribe_audio
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store, doc_counter
from services.socketio_instance import socketio
from auth import verify_firebase_token, is_admin
from Firestore_implementation import upload_file_by_path, get_signed_url

logger = logging.getLogger(__name__)

document_bp = Blueprint('document', __name__)

@document_bp.route('/api/audio/<filename>', methods=['GET'])
@verify_firebase_token
def get_audio_file(filename):
    """Get a secure URL to access an audio file"""
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            # Check if user has permission
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            uid = doc.get("owner")
            firebase_path = f"users/{uid}/uploads/{filename}"
            
            try:
                # Get signed URL with proper permission check
                url = get_signed_url(firebase_path)
                if url:
                    return jsonify({"url": url}), 200
                else:
                    return jsonify({"error": "Could not get file access"}), 403
            except Exception as e:
                logger.error(f"Error getting signed URL: {e}")
                return jsonify({"error": "Could not get file", "details": str(e)}), 500
                
    return jsonify({"error": "File not found"}), 404

@document_bp.route('/local-audio/<filename>')
@verify_firebase_token
def serve_local_audio(filename):
    """
    Serve a locally stored audio file if the user owns it.
    Falls back to Firebase signed URL if local file doesn't exist.
    """
    # First check if the user has permission to access this file
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            # Try to serve from the local file system first
            # Use pathlib for cross-platform compatibility
            upload_path = Path(UPLOAD_FOLDER)
            local_path = upload_path / filename
            
            if local_path.exists():
                try:
                    return send_from_directory(
                        UPLOAD_FOLDER, 
                        filename, 
                        as_attachment=False,
                        mimetype="audio/mpeg"  # Set appropriate MIME type
                    )
                except Exception as e:
                    logger.error(f"Error serving local file: {e}")
                    # Continue to Firebase fallback
                
            # If local file doesn't exist or error occurred, try to get a URL from Firebase
            uid = doc.get("owner")
            firebase_path = f"users/{uid}/uploads/{filename}"
            try:
                url = get_signed_url(firebase_path)
                if url:
                    return jsonify({"url": url}), 200
                else:
                    return jsonify({"error": "Could not access file"}), 403
            except Exception as e:
                logger.error(f"Error getting signed URL: {e}")
                return jsonify({"error": "File not accessible", "details": str(e)}), 500
    
    # If we got here, the file wasn't found or user doesn't have permission
    return jsonify({"error": "File not found or access denied"}), 404

@document_bp.route('/upload-audio', methods=['POST'])
@verify_firebase_token
def upload_audio():
    """Upload an audio file and create a document for transcription"""
    global doc_counter
    
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    
    if not original_filename:
        return jsonify({"error": "Invalid filename"}), 400
        
    # Generate a unique filename
    unique_name = f"{uuid.uuid4()}_{original_filename}"
    
    # Ensure upload directory exists with absolute path
    abs_upload_folder = os.path.abspath(UPLOAD_FOLDER)
    os.makedirs(abs_upload_folder, exist_ok=True)
    logger.info(f"Ensured upload directory exists: {abs_upload_folder}")
    
    # Create a platform-independent path using pathlib
    save_path = Path(abs_upload_folder) / unique_name
    save_path_str = str(save_path)
    
    logger.info(f"Attempting to save file to: {save_path_str}")
    
    try:
        # Create a temporary file first to ensure we can write to the location
        temp_path = save_path.with_suffix('.tmp')
        with open(temp_path, 'wb') as f:
            f.write(b'Test')
        
        # If we get here, we can write to the directory
        temp_path.unlink()  # Remove test file
        
        # Save file locally
        audio_file.save(save_path_str)
        logger.info(f"Successfully saved file locally to: {save_path_str}")
        
        # Verify file was created and has content
        if not save_path.exists():
            raise FileNotFoundError(f"File not created at {save_path_str}")
            
        file_size = save_path.stat().st_size
        if file_size == 0:
            raise ValueError(f"File created but has zero size: {save_path_str}")
            
        logger.info(f"Verified file exists and has size: {file_size} bytes")
        
        # Upload to Firebase under user's directory
        uid = request.uid
        firebase_path = f"users/{uid}/uploads/{unique_name}"
        
        try:
            # Read file data directly to avoid path issues
            file_data = save_path.read_bytes()
            
            # Upload to Firebase
            blob = upload_file_by_path(save_path_str, firebase_path)
            
            # Get a signed URL for access
            file_url = get_signed_url(firebase_path)
            logger.info(f"Uploaded to Firebase: {firebase_path}")
            
            # Create document for transcription
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
                "firebaseUrl": file_url,
                "firebasePath": firebase_path,
                "localPath": save_path_str  # Store local path for reference
            }
            
            doc_store[doc_id] = doc_obj
            save_doc_store()
            
            # Start transcription in background
            socketio.start_background_task(background_transcription, save_path_str, doc_id)
            
            return jsonify({
                "message": "File received, uploaded to Firebase, and doc created",
                "filename": unique_name,
                "doc_id": doc_id
            }), 200
            
        except Exception as firebase_err:
            logger.error(f"Error uploading to Firebase: {firebase_err}")
            import traceback
            logger.error(f"Firebase error details: {traceback.format_exc()}")
            
            # Fallback: if Firebase fails, still create a doc with the local file
            # This provides graceful degradation even if Firebase is unavailable
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
                "firebaseUrl": None,  # No Firebase URL
                "localPath": save_path_str
            }
            
            doc_store[doc_id] = doc_obj
            save_doc_store()
            
            # Start transcription in background
            socketio.start_background_task(background_transcription, save_path_str, doc_id)
            
            return jsonify({
                "message": "File received and doc created (Firebase upload failed but will still transcribe)",
                "filename": unique_name,
                "doc_id": doc_id,
                "warning": "Firebase upload failed, using local file only"
            }), 200
            
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Detailed error: {error_details}")
        
        # Clean up any temporary files
        try:
            if temp_path.exists():
                temp_path.unlink()
        except:
            pass
        
        return jsonify({
            "error": "File upload failed", 
            "details": str(e),
            "path_attempted": save_path_str
        }), 500

def background_transcription(file_path, doc_id):
    """Process audio transcription in background"""
    try:
        # Ensure file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found for transcription: {file_path}")
            
        logger.info(f"Starting transcription for file: {file_path}")
        
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
        
        logger.info(f"Transcription completed for file: {file_path}")
        
        # Don't delete local file after transcription
        # We'll keep it for potential playback and let trash management handle deletion
            
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        import traceback
        logger.error(f"Transcription error details: {traceback.format_exc()}")
        
        socketio.emit('transcription_error', {
            'doc_id': doc_id,
            'error': str(e)
        })

def append_to_doc(doc_id, chunk_list):
    """Append transcription chunks to document content"""
    try:
        doc = doc_store.get(doc_id)
        if not doc:
            logger.warning(f"Document not found for appending transcription: {doc_id}")
            return
            
        combined_text = doc.get("content", "")
        for chunk in chunk_list:
            combined_text += " " + chunk["text"]
        
        doc["content"] = combined_text
        save_doc_store()
        logger.debug(f"Updated document {doc_id} with new transcription content")
    except Exception as e:
        logger.error(f"Error appending to doc {doc_id}: {e}")

def register_document_routes(app):
    """Register document routes with Flask app"""
    app.register_blueprint(document_bp)
    logger.info("Document routes registered successfully")

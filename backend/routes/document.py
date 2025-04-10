# backend/routes/document.py
import os
import uuid
import json
import logging
from flask import request, jsonify, Blueprint
from pydub import AudioSegment
from transcribe import chunked_transcribe_audio
from config import UPLOAD_FOLDER
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
                return jsonify({"error": "Could not get file", "details": str(e)}), 500
                
    return jsonify({"error": "File not found"}), 404

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
    
    # Save locally for transcription (temporary)
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)
    
    try:
        # Create upload directory if it doesn't exist
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        # Save file locally first
        audio_file.save(save_path)
        logger.info(f"Saved file locally to: {save_path}")
        
        # Upload to Firebase under user's directory
        uid = request.uid
        firebase_path = f"users/{uid}/uploads/{unique_name}"
        
        try:
            # Use upload_file_by_path which is fixed to handle metadata correctly
            blob = upload_file_by_path(save_path, firebase_path)
            file_url = get_signed_url(firebase_path)
            
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
                "firebasePath": firebase_path
            }
            
            doc_store[doc_id] = doc_obj
            save_doc_store()
            
            # Start transcription in background
            socketio.start_background_task(background_transcription, save_path, doc_id)
            
            return jsonify({
                "message": "File received, uploaded to Firebase, and doc created",
                "filename": unique_name,
                "doc_id": doc_id
            }), 200
            
        except Exception as e:
            logger.error(f"Error uploading to Firebase: {e}")
            
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
                "firebaseUrl": None  # No Firebase URL
            }
            
            doc_store[doc_id] = doc_obj
            save_doc_store()
            
            # Start transcription in background
            socketio.start_background_task(background_transcription, save_path, doc_id)
            
            return jsonify({
                "message": "File received and doc created (Firebase upload failed but will still transcribe)",
                "filename": unique_name,
                "doc_id": doc_id,
                "warning": "Firebase upload failed, using local file only"
            }), 200
            
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        # Clean up the local file if it was created
        try:
            if os.path.exists(save_path):
                os.remove(save_path)
        except:
            pass
        return jsonify({"error": "File upload failed", "details": str(e)}), 500

def background_transcription(file_path, doc_id):
    """Process audio transcription in background"""
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
        
        # Clean up temporary local file
        try:
            os.remove(file_path)
            logger.info(f"Removed temporary file: {file_path}")
        except Exception as cleanup_err:
            logger.error(f"Failed to clean up temp file: {cleanup_err}")
            
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        socketio.emit('transcription_error', {
            'doc_id': doc_id,
            'error': str(e)
        })

def append_to_doc(doc_id, chunk_list):
    """Append transcription chunks to document content"""
    doc = doc_store.get(doc_id)
    if not doc:
        return
        
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += " " + chunk["text"]
    
    doc["content"] = combined_text
    save_doc_store()

def register_document_routes(app):
    """Register document routes with Flask app"""
    app.register_blueprint(document_bp)

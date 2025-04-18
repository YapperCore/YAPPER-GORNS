# backend/routes/document.py
import os
import uuid
import logging
import re
from pathlib import Path
from flask import request, jsonify, Blueprint, send_from_directory
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store, doc_counter
from services.socketio_instance import socketio
from auth import verify_firebase_token, is_admin
from Firestore_implementation import upload_file_by_path, get_signed_url
from transcribe import chunked_transcribe_audio, get_user_transcription_config

logger = logging.getLogger(__name__)
document_bp = Blueprint('document', __name__)

@document_bp.route('/api/audio/<filename>', methods=['GET'])
@verify_firebase_token
def get_audio_file(filename):
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            uid = doc.get("owner")
            firebase_path = f"users/{uid}/uploads/{filename}"
            
            try:
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
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            upload_path = Path(UPLOAD_FOLDER)
            local_path = upload_path / filename
            
            if local_path.exists():
                try:
                    return send_from_directory(
                        UPLOAD_FOLDER, 
                        filename, 
                        as_attachment=False,
                        mimetype="audio/mpeg"
                    )
                except Exception as e:
                    logger.error(f"Error serving local file: {e}")
                
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
    
    return jsonify({"error": "File not found or access denied"}), 404

@document_bp.route('/upload-audio', methods=['POST'])
@verify_firebase_token
def upload_audio():
    global doc_counter
    
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    
    if not original_filename:
        return jsonify({"error": "Invalid filename"}), 400
        
    unique_name = f"{uuid.uuid4()}_{original_filename}"
    abs_upload_folder = os.path.abspath(UPLOAD_FOLDER)
    os.makedirs(abs_upload_folder, exist_ok=True)
    
    save_path = Path(abs_upload_folder) / unique_name
    save_path_str = str(save_path)
    
    try:
        temp_path = save_path.with_suffix('.tmp')
        with open(temp_path, 'wb') as f:
            f.write(b'Test')
        temp_path.unlink()
        
        audio_file.save(save_path_str)
        
        if not save_path.exists() or save_path.stat().st_size == 0:
            raise ValueError(f"File created but has zero size: {save_path_str}")
        
        uid = request.uid
        firebase_path = f"users/{uid}/uploads/{unique_name}"
        
        try:
            blob = upload_file_by_path(save_path_str, firebase_path)
            file_url = get_signed_url(firebase_path)
            logger.info(f"Uploaded to Firebase: {firebase_path}")
            
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
                "localPath": save_path_str,
                "transcription_prompt": ""
            }
            
            doc_store[doc_id] = doc_obj
            save_doc_store()
            
            socketio.start_background_task(background_transcription, save_path_str, doc_id)
            
            return jsonify({
                "message": "File received, uploaded to Firebase, and doc created",
                "filename": unique_name,
                "doc_id": doc_id
            }), 200
            
        except Exception as firebase_err:
            logger.error(f"Error uploading to Firebase: {firebase_err}")
            
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
                "firebaseUrl": None,
                "localPath": save_path_str,
                "transcription_prompt": ""
            }
            
            doc_store[doc_id] = doc_obj
            save_doc_store()
            
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
        logger.error(f"Upload error details: {traceback.format_exc()}")
        return jsonify({
            "error": "File upload failed", 
            "details": str(e),
            "path_attempted": save_path_str
        }), 500

@document_bp.route('/api/transcribe/<doc_id>', methods=['POST'])
@verify_firebase_token
def start_transcription(doc_id):
    try:
        doc = doc_store.get(doc_id)
        if not doc:
            return jsonify({"error": "Document not found"}), 404
            
        if doc.get("owner") != request.uid and not is_admin(request.uid):
            return jsonify({"error": "Access denied"}), 403
            
        data = request.json or {}
        prompt = data.get("transcription_prompt", "")
        
        doc["transcription_prompt"] = prompt
        save_doc_store()
        
        filename = doc.get("audioFilename")
        if not filename:
            return jsonify({"error": "No audio file associated with this document"}), 400
            
        if doc.get("audioTrashed"):
            return jsonify({"error": "Audio file is in trash"}), 400
            
        file_path = ""
        if "localPath" in doc and os.path.exists(doc["localPath"]):
            file_path = doc["localPath"]
        else:
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            
        if not os.path.exists(file_path):
            return jsonify({"error": "Audio file not found on server"}), 404
            
        doc["content"] = ""
        save_doc_store()
        
        socketio.start_background_task(background_transcription, file_path, doc_id)
        
        return jsonify({"message": "Transcription started"}), 200
    except Exception as e:
        logger.error(f"Error starting transcription: {e}")
        return jsonify({"error": f"Error starting transcription: {str(e)}"}), 500

def background_transcription(file_path, doc_id):
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found for transcription: {file_path}")
            
        logger.info(f"Starting transcription for file: {file_path}")
        
        all_text = ""
        processed_chunks = 0
        total_chunks = 0
        
        doc = doc_store.get(doc_id)
        if not doc:
            raise ValueError(f"Document {doc_id} not found")
        
        user_id = doc.get("owner")
        prompt = doc.get("transcription_prompt", "")
            
        doc["content"] = ""
        save_doc_store()
        
        config = get_user_transcription_config(user_id)
        using_replicate = config.get("mode") == "replicate"
        
        for i, total, text in chunked_transcribe_audio(file_path, user_id, prompt):
            if total > total_chunks:
                total_chunks = total
                
            processed_chunks += 1
            chunk_text = text.strip()
            
            if using_replicate:
                all_text = chunk_text
                doc["content"] = all_text
                save_doc_store()
                
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': [{
                        'chunk_index': i,
                        'total_chunks': total,
                        'text': chunk_text
                    }],
                    'progress': 100
                })
            else:
                if all_text:
                    last_char = all_text[-1] if all_text else ""
                    first_char = chunk_text[0] if chunk_text else ""
                    
                    if first_char in ".,;:!?\"'":
                        all_text += chunk_text
                    elif last_char.isalnum() and first_char.isalnum():
                        all_text += " " + chunk_text
                    else:
                        all_text += chunk_text
                else:
                    all_text = chunk_text
                
                doc["content"] = all_text
                save_doc_store()
                
                progress = round((processed_chunks / total_chunks) * 100) if total_chunks > 0 else 0
                
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': [{
                        'chunk_index': i,
                        'total_chunks': total,
                        'text': chunk_text
                    }],
                    'progress': progress
                })
                
                socketio.sleep(0.05)
        
        final_text = all_text.strip()
        final_text = re.sub(r'\s+', ' ', final_text)
        final_text = re.sub(r'\s+([.,;:!?])', r'\1', final_text)
        
        doc["content"] = final_text
        save_doc_store()
        
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True,
            'content': final_text
        })
        
        logger.info(f"Transcription completed for file: {file_path}")
        
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        import traceback
        logger.error(f"Transcription error details: {traceback.format_exc()}")
        
        socketio.emit('transcription_error', {
            'doc_id': doc_id,
            'error': str(e)
        })

def register_document_routes(app):
    app.register_blueprint(document_bp)
    logger.info("Document routes registered successfully")

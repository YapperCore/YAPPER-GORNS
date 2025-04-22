import os
import uuid
import logging
import re
from pathlib import Path
from flask import request, jsonify, Blueprint, send_from_directory, Response
from pydub import AudioSegment
from transcribe import chunked_transcribe_audio
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store, doc_counter
from services.socketio_instance import socketio
from auth import verify_firebase_token, is_admin
from Firestore_implementation import upload_file_by_path, get_signed_url
from routes.user_settings import user_settings_store
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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
                    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=False, mimetype="audio/mpeg")
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
    logger.info(f"Ensured upload directory exists: {abs_upload_folder}")
    
    save_path = Path(abs_upload_folder) / unique_name
    save_path_str = str(save_path)
    logger.info(f"Attempting to save file to: {save_path_str}")
    
    try:
        # Test write permissions
        temp_path = save_path.with_suffix('.tmp')
        with open(temp_path, 'wb') as f:
            f.write(b'Test')
        temp_path.unlink()
        
        # Save the file
        audio_file.save(save_path_str)
        logger.info(f"Successfully saved file locally to: {save_path_str}")
        
        # Verify file was created correctly
        if not save_path.exists():
            raise FileNotFoundError(f"File not created at {save_path_str}")
        
        file_size = save_path.stat().st_size
        if file_size == 0:
            raise ValueError(f"File created but has zero size: {save_path_str}")
        
        logger.info(f"Verified file exists and has size: {file_size} bytes")
        
        # Get user ID and prepare Firebase path
        uid = request.uid
        firebase_path = f"users/{uid}/uploads/{unique_name}"
        
        try:
            # Upload to Firebase
            blob = upload_file_by_path(save_path_str, firebase_path)
            file_url = get_signed_url(firebase_path)
            logger.info(f"Uploaded to Firebase: {firebase_path}")
            
            # Create new document
            doc_counter += 1
            doc_id = str(uuid.uuid4())
            doc_name = f"Doc{doc_counter}"
            
            # Get user transcription settings
            transcription_config = {}
            if user_settings_store and uid in user_settings_store:
                user_settings = user_settings_store.get(uid, {})
                transcription_config = user_settings.get("transcriptionConfig", {})
            
            # Determine if using Replicate API
            is_replicate = transcription_config.get("mode") == "replicate"
            logger.info(f"Transcription mode detected: {'replicate' if is_replicate else 'local'}")
            
            # Get transcription prompt if provided
            transcription_prompt = request.form.get("transcription_prompt", "")
            requires_prompt = is_replicate and not transcription_prompt
            
            # Create document object
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
                "transcription_status": "pending",
                "is_replicate": is_replicate,
                "requires_prompt": requires_prompt
            }
            
            # Save document to store
            doc_store[doc_id] = doc_obj
            save_doc_store()
            
            # If using Replicate and no prompt provided, request prompt
            if requires_prompt:
                return jsonify({
                    "message": "File uploaded. Provide a prompt to begin transcription.",
                    "filename": unique_name,
                    "doc_id": doc_id,
                    "requires_prompt": True
                }), 200
            
            # Start transcription based on mode
            if is_replicate:
                logger.info(f"Starting Replicate transcription for document {doc_id}")
                
                # Get API key from env or user settings
                api_key = os.environ.get("REPLICATE_API_TOKEN") or transcription_config.get("replicateApiKey", "")
                if not api_key:
                    logger.warning(f"No Replicate API key found for user {uid}. Using empty key.")
                else:
                    logger.info(f"Using Replicate API key (first 5 chars): {api_key[:5]}")
                
                # Prepare settings for transcription job
                user_settings_for_job = {
                    "replicateApiKey": api_key,
                    "whisperModel": transcription_config.get("whisperModel", "medium"),
                    "transcriptionPrompt": transcription_prompt
                }
                
                # Start background transcription task
                socketio.start_background_task(
                    background_replicate_transcription, 
                    save_path_str, 
                    doc_id,
                    user_settings_for_job
                )
            else:
                logger.info(f"Starting local transcription for document {doc_id}")
                socketio.start_background_task(
                    background_transcription, 
                    save_path_str, 
                    doc_id
                )
            
            return jsonify({
                "message": "File received, uploaded to Firebase, and doc created",
                "filename": unique_name,
                "doc_id": doc_id,
                "is_replicate": is_replicate
            }), 200
            
        except Exception as firebase_err:
            logger.error(f"Error uploading to Firebase: {firebase_err}")
            import traceback
            logger.error(f"Firebase error details: {traceback.format_exc()}")
            
            # Still create document if Firebase upload fails
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
                "transcription_status": "pending"
            }
            
            doc_store[doc_id] = doc_obj
            save_doc_store()
            
            # Start local transcription since Firebase failed
            socketio.start_background_task(
                background_transcription, 
                save_path_str, 
                doc_id
            )
            
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
        
        # Clean up temporary file if it exists
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

@document_bp.route('/api/transcribe/<doc_id>', methods=['POST'])
@verify_firebase_token
def transcribe_document(doc_id):
    try:
        doc = doc_store.get(doc_id)
        if not doc:
            return jsonify({"error": "Document not found"}), 404
            
        if doc.get("owner") != request.uid and not is_admin(request.uid):
            return jsonify({"error": "Access denied"}), 403
            
        uid = request.uid
        user_settings = user_settings_store.get(uid, {})
        transcription_config = user_settings.get("transcriptionConfig", {
            "mode": "local-cpu",
            "cpuThreads": 2,
            "whisperModel": "small"
        })
        
        audio_filename = doc.get("audioFilename")
        if not audio_filename or doc.get("audioTrashed", False):
            return jsonify({"error": "No audio file available for transcription"}), 400
            
        # Find the audio file
        if doc.get("localPath") and os.path.exists(doc.get("localPath")):
            file_path = doc.get("localPath")
        else:
            file_path = os.path.join(UPLOAD_FOLDER, audio_filename)
            if not os.path.exists(file_path):
                return jsonify({"error": "Audio file not found on server"}), 404
        
        # Determine transcription mode
        is_replicate = transcription_config.get("mode") == "replicate"
        logger.info(f"Transcription mode: {'replicate' if is_replicate else 'local'}")
        
        # Get request data
        data = request.json or {}
        
        # Update document status
        doc["transcription_status"] = "in_progress"
        doc["content"] = ""
        doc["is_replicate"] = is_replicate
        save_doc_store()
        
        # Start transcription based on mode
        if is_replicate:
            transcription_prompt = data.get("transcription_prompt", "")
            
            # Get API key from env or user settings
            api_key = os.environ.get("REPLICATE_API_TOKEN") or transcription_config.get("replicateApiKey", "")
            
            user_settings_for_job = {
                "replicateApiKey": api_key,
                "whisperModel": transcription_config.get("whisperModel", "medium"),
                "transcriptionPrompt": transcription_prompt
            }
            
            logger.info(f"Starting Replicate transcription for document {doc_id} with API key: {api_key[:5] if api_key else 'None'}...")
            
            socketio.start_background_task(
                background_replicate_transcription, 
                file_path, 
                doc_id,
                user_settings_for_job
            )
            
            return jsonify({
                "message": "Replicate transcription started",
                "doc_id": doc_id,
                "is_replicate": True
            }), 200
        else:
            logger.info(f"Starting local transcription for document {doc_id}")
            
            socketio.start_background_task(
                background_transcription, 
                file_path, 
                doc_id
            )
            
            return jsonify({
                "message": "Local transcription started",
                "doc_id": doc_id,
                "is_replicate": False
            }), 200
            
    except Exception as e:
        logger.error(f"Error starting transcription: {e}")
        import traceback
        logger.error(f"Error details: {traceback.format_exc()}")
        
        return jsonify({"error": f"Failed to start transcription: {str(e)}"}), 500

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
            
        doc["content"] = ""
        doc["transcription_status"] = "in_progress"
        save_doc_store()
        
        for i, total, text in chunked_transcribe_audio(file_path):
            if total > total_chunks:
                total_chunks = total
                
            processed_chunks += 1
            chunk_text = text.strip()
            
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
            }, room=doc_id)
            
            socketio.sleep(0.05)
            
            if i % 5 == 0 or i == total:
                logger.info(f"Transcription progress: {progress}% ({i}/{total} chunks)")
        
        final_text = all_text.strip()
        final_text = re.sub(r'\s+', ' ', final_text)
        final_text = re.sub(r'\s+([.,;:!?])', r'\1', final_text)
        
        doc["content"] = final_text
        doc["transcription_status"] = "completed"
        save_doc_store()
        
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True,
            'content': final_text
        }, room=doc_id)
        
        logger.info(f"Transcription completed for file: {file_path}")
        
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        import traceback
        logger.error(f"Transcription error details: {traceback.format_exc()}")
        
        try:
            if doc_id in doc_store:
                doc_store[doc_id]["transcription_status"] = "failed"
                doc_store[doc_id]["error"] = str(e)
                save_doc_store()
        except:
            pass
            
        socketio.emit('transcription_error', {
            'doc_id': doc_id,
            'error': str(e)
        }, room=doc_id)

def background_replicate_transcription(file_path, doc_id, user_settings):
    try:
        # Import here to avoid circular imports
        from transcribe import transcribe_with_replicate
        
        doc = doc_store.get(doc_id)
        if not doc:
            logger.error(f"Document {doc_id} not found")
            return
            
        # Initialize document status
        doc["content"] = ""
        doc["is_replicate"] = True
        doc["transcription_status"] = "in_progress"
        save_doc_store()
        
        # Send progress updates to client
        socketio.emit("transcription_status", {
            "doc_id": doc_id,
            "status": "Starting Replicate transcription..."
        }, room=doc_id)
        
        socketio.emit("partial_transcript_batch", {
            "doc_id": doc_id,
            "progress": 10,
            "is_replicate": True,
            "chunks": [{"text": "Initializing transcription..."}]
        }, room=doc_id)
        
        # Get API key from settings or environment
        api_key = user_settings.get("replicateApiKey", "")
        if not api_key:
            api_key = os.environ.get("REPLICATE_API_TOKEN", "")
            logger.info(f"Using environment variable for Replicate API key")
            
        if not api_key:
            raise Exception("No Replicate API key provided. Please add your API key in Settings.")
        
        # Log API key presence (first few chars only)
        logger.info(f"Using API key starting with: {api_key[:5]}...")
        
        # Get transcription parameters
        prompt = user_settings.get("transcriptionPrompt", "")
        model_name = user_settings.get("whisperModel", "medium")
        
        logger.info(f"Starting Replicate transcription for document {doc_id} with model {model_name}")
        
        # Update client on progress
        socketio.emit("partial_transcript_batch", {
            "doc_id": doc_id,
            "progress": 20,
            "is_replicate": True,
            "chunks": [{"text": "Connecting to Replicate API..."}]
        }, room=doc_id)
        
        socketio.emit("transcription_status", {
            "doc_id": doc_id,
            "status": "Transcribing with Replicate API (this may take a few minutes)..."
        }, room=doc_id)
        
        socketio.emit("partial_transcript_batch", {
            "doc_id": doc_id,
            "progress": 30,
            "is_replicate": True,
            "chunks": [{"text": "Transcribing audio..."}]
        }, room=doc_id)
        
        # Call the actual transcription function
        logger.info(f"Calling transcribe_with_replicate for file: {file_path}")
        result = transcribe_with_replicate(file_path, api_key, prompt, model_name)
        logger.info(f"Received result from transcribe_with_replicate: {len(result) if result else 0} characters")
        
        if not result or len(result.strip()) == 0:
            raise Exception("Received empty transcription result from Replicate")
        
        # Clean up text
        final_text = result.strip()
        final_text = re.sub(r'\s+', ' ', final_text)
        final_text = re.sub(r'\s+([.,;:!?])', r'\1', final_text)
        
        logger.info(f"Processed transcription, final length: {len(final_text)} characters")
        
        # Update progress
        socketio.emit("partial_transcript_batch", {
            "doc_id": doc_id,
            "progress": 70,
            "is_replicate": True,
            "chunks": [{"text": "Processing transcription results..."}]
        }, room=doc_id)
        
        # Save final result
        doc["content"] = final_text
        doc["transcription_status"] = "completed"
        save_doc_store()
        
        # Send final updates to client
        socketio.emit("partial_transcript_batch", {
            "doc_id": doc_id,
            "progress": 100,
            "is_replicate": True,
            "chunks": [{"text": final_text}]
        }, room=doc_id)
        
        socketio.emit("final_transcript", {
            "doc_id": doc_id,
            "done": True,
            "content": final_text
        }, room=doc_id)
        
        logger.info(f"Replicate transcription completed successfully for document {doc_id}")
    
    except Exception as e:
        logger.error(f"Error in background Replicate transcription: {e}")
        import traceback
        logger.error(f"Detailed error: {traceback.format_exc()}")
        
        # Notify client of error
        socketio.emit("transcription_error", {
            "doc_id": doc_id,
            "error": f"Error in Replicate transcription: {str(e)}"
        }, room=doc_id)
        
        # Update document status
        try:
            if doc_id in doc_store:
                doc_store[doc_id]["transcription_status"] = "failed"
                doc_store[doc_id]["error"] = str(e)
                save_doc_store()
        except:
            pass

def append_to_doc(doc_id, chunk_list):
    try:
        doc = doc_store.get(doc_id)
        if not doc:
            logger.warning(f"Document not found for appending transcription: {doc_id}")
            return
            
        combined_text = doc.get("content", "")
        
        for chunk in chunk_list:
            chunk_text = chunk["text"].strip()
            
            if combined_text:
                last_char = combined_text[-1] if combined_text else ""
                first_char = chunk_text[0] if chunk_text else ""
                
                if first_char in ".,;:!?\"'":
                    combined_text += chunk_text
                elif last_char.isalnum() and first_char.isalnum():
                    combined_text += " " + chunk_text
                else:
                    combined_text += chunk_text
            else:
                combined_text = chunk_text
                
        doc["content"] = combined_text
        save_doc_store()
        logger.debug(f"Updated document {doc_id} with new transcription content")
        
    except Exception as e:
        logger.error(f"Error appending to doc {doc_id}: {e}")

def register_document_routes(app):
    app.register_blueprint(document_bp)
    logger.info("Document routes registered successfully")

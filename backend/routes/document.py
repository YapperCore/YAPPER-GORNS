# backend/routes/document.py
import os
import uuid
import json
import logging
from datetime import datetime
from flask import request, jsonify, send_from_directory
from pydub import AudioSegment
from transcribe import chunked_transcribe_audio
from config import UPLOAD_FOLDER
from services.storage import save_doc_store, doc_store, doc_counter
from services.socketio_instance import socketio
from firebase_helper import upload_file, update_transcription
from auth_middleware import require_auth

logger = logging.getLogger(__name__)

def get_audio_file(filename):
    """Serve audio file from local storage"""
    return send_from_directory(UPLOAD_FOLDER, filename)

@require_auth
def upload_audio(user_id):
    """Upload audio file with user ownership, create document, start transcription"""
    global doc_counter
    
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    
    # Generate a unique filename
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_name = f"{uuid.uuid4()}_{timestamp}_{original_filename}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    # Check for duplicate files
    if os.path.exists(save_path):
        return jsonify({"error": "File already exists"}), 400

    try:
        # Save file locally
        audio_file.save(save_path)
        logger.info(f"Saved file to: {save_path}")
        
        # Upload to Firebase with user ownership
        firebase_result = None
        try:
            with open(save_path, 'rb') as firebase_file:
                firebase_result = upload_file(firebase_file, user_id)
                logger.info(f"Firebase upload result: {firebase_result}")
        except Exception as firebase_err:
            logger.error(f"Firebase upload error: {firebase_err}")
            # Continue with local processing even if Firebase fails
    except Exception as e:
        logger.error(f"Error saving file: {e}")
        # Clean up if file was partially saved
        if os.path.exists(save_path):
            try:
                os.remove(save_path)
            except:
                pass
        return jsonify({"error": f"File saving failed: {e}"}), 500

    # Create document record with user ownership
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
        "createdAt": datetime.now().isoformat(),
        "ownerId": user_id,  # Set the owner ID
        "firebase_url": firebase_result.get("file_url") if firebase_result and firebase_result.get("success") else None,
        "firebase_filename": firebase_result.get("filename") if firebase_result and firebase_result.get("success") else None,
    }
    
    doc_store[doc_id] = doc_obj
    save_doc_store()

    # Start transcription in background
    socketio.start_background_task(background_transcription, save_path, doc_id, user_id)

    return jsonify({
        "message": "File received and document created",
        "filename": unique_name,
        "doc_id": doc_id,
        "firebase_status": "uploaded" if firebase_result and firebase_result.get("success") else "local only"
    }), 200

def background_transcription(file_path, doc_id, user_id=None):
    """Process transcription in background with user context"""
    try:
        chunk_buffer = []
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            
            # Emit updates in batches
            if len(chunk_buffer) >= 5:  # Adjust batch size as needed
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': chunk_buffer
                })
                socketio.sleep(0.1)
                append_to_doc(doc_id, chunk_buffer, user_id)
                chunk_buffer = []
                
        # Process any remaining chunks
        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {
                'doc_id': doc_id,
                'chunks': chunk_buffer
            })
            socketio.sleep(0.1)
            append_to_doc(doc_id, chunk_buffer, user_id)

        # Signal transcription completion
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        })
        logger.info(f"Transcription completed for doc {doc_id}")
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        # Notify frontend of error
        socketio.emit('transcription_error', {
            'doc_id': doc_id,
            'error': str(e)
        })

def append_to_doc(doc_id, chunk_list, user_id=None):
    """Append transcription chunks to document with user context"""
    doc = doc_store.get(doc_id)
    if not doc:
        logger.warning(f"Doc {doc_id} not found for append")
        return
        
    # Append transcription text
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += " " + chunk["text"]
    doc["content"] = combined_text
    save_doc_store()
    
    # Update Firebase transcription if available
    if doc.get("firebase_filename"):
        try:
            update_result = update_transcription(
                doc["firebase_filename"], 
                combined_text,
                user_id
            )
            if not update_result.get("success", False):
                logger.warning(f"Firebase transcription update failed: {update_result.get('message')}")
        except Exception as e:
            logger.error(f"Error updating Firebase transcription: {e}")

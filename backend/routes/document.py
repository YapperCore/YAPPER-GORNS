# backend/routes/document.py
import os
import uuid
import json
import logging
from flask import request, jsonify
from pydub import AudioSegment
from transcribe import chunked_transcribe_audio
from config import UPLOAD_FOLDER
from services.storage import save_doc_store, doc_store, doc_counter
from services.socketio_instance import socketio
from auth import verify_firebase_token, is_admin
from Firestore_implementation import upload_file_by_path, get_signed_url

logger = logging.getLogger(__name__)

@verify_firebase_token
def get_audio_file(filename):
    # Instead of serving from the local directory, serve via a Firebase signed URL.
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            uid = doc.get("owner")
            firebase_path = f"users/{uid}/uploads/{filename}"
            try:
                url = get_signed_url(firebase_path)
                return jsonify({"url": url}), 200
            except Exception as e:
                return jsonify({"error": "Could not get file", "details": str(e)}), 500
    return jsonify({"error": "File not found"}), 404

@verify_firebase_token
def upload_audio():
    global doc_counter
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    unique_name = f"{uuid.uuid4()}_{original_filename}"
    # Save file locally for transcription
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    if os.path.exists(save_path):
        return jsonify({"error": "File already exists"}), 400

    try:
        audio_file.save(save_path)
        logger.info(f"Saved file locally to: {save_path}")
    except Exception as e:
        logger.error(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    # Upload the file to Firebase Storage under the current user's folder
    uid = request.uid
    firebase_path = f"users/{uid}/uploads/{unique_name}"
    try:
        blob = upload_file_by_path(save_path, firebase_path)
        # Generate a signed URL for secure access (do not make public)
        file_url = get_signed_url(firebase_path)
    except Exception as e:
        logger.error(f"Error uploading file to Firebase: {e}")
        return jsonify({"error": "Firebase upload failed", "details": str(e)}), 500

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
        "firebaseUrl": file_url
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()

    socketio.start_background_task(background_transcription, save_path, doc_id)

    return jsonify({
        "message": "File received, uploaded to Firebase, and doc created",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_transcription(file_path, doc_id):
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
    except Exception as e:
        logger.error(f"Error during transcription: {e}")

def append_to_doc(doc_id, chunk_list):
    doc = doc_store.get(doc_id)
    if not doc:
        return
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += " " + chunk["text"]
    doc["content"] = combined_text
    save_doc_store()

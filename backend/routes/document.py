import os
import uuid
import json
import logging
from flask import request, jsonify, send_from_directory
from pydub import AudioSegment
from transcribe import chunked_transcribe_audio
from config import UPLOAD_FOLDER
from services.storage import save_doc_store, doc_store, doc_counter
from socketio_instance import socketio

logger = logging.getLogger(__name__)

########################################
# UPLOAD AUDIO => CREATE DOC => TRANSCRIBE
########################################

def get_audio_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

def upload_audio():
    global doc_counter
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    original_filename = audio_file.filename
    unique_name = f"{uuid.uuid4()}_{original_filename}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    if os.path.exists(save_path):
        return jsonify({"error": "File already exists"}), 400

    try:
        audio_file.save(save_path)
        # Convert audio to desired format (e.g., WAV)
        converted_path = convert_audio_to_wav(save_path)
    except Exception:
        return jsonify({"error": "File saving failed"}), 500

    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = f"Doc{doc_counter}"
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": "",
        "audioFilename": os.path.basename(converted_path),
        "originalFilename": original_filename,
        "audioTrashed": False,
        "deleted": False
    }
    doc_store[doc_id] = doc_obj
    save_doc_store()

    socketio.start_background_task(background_transcription, converted_path, doc_id)

    return jsonify({
        "message": "File received and doc created",
        "filename": os.path.basename(converted_path),
        "doc_id": doc_id
    }), 200

def convert_audio_to_wav(file_path):
    audio = AudioSegment.from_file(file_path)
    wav_path = file_path.rsplit('.', 1)[0] + '.wav'
    audio.export(wav_path, format='wav')
    return wav_path

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
                append_to_doc(doc_id, chunk_buffer)  # Ensure this updates the document content
                chunk_buffer = []
        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {
                'doc_id': doc_id,
                'chunks': chunk_buffer
            })
            socketio.sleep(0.1)
            append_to_doc(doc_id, chunk_buffer)

        # Emit final transcript event
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

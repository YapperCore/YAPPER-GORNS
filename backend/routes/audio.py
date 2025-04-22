# backend/routes/audio_upload.py

from flask import Flask, request, jsonify, g
from werkzeug.exceptions import RequestEntityTooLarge
from backend.transcribe_replicate import optimized_transcribe_with_replicate
from backend.auth import verify_firebase_token
from backend.config import get_user_transcription_config, get_replicate_api_key
import logging
import os

logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/upload-audio', methods=['POST'])
@verify_firebase_token
def upload_audio():
    try:
        # Get the authenticated user ID from the request
        user_id = request.uid

        # Check if a file was uploaded
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file uploaded'}), 400
            
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'Empty filename provided'}), 400
            
        # Check file size early
        file_content = audio_file.read()
        file_size = len(file_content)
        
        # Log file size for debugging
        logger.info(f"Received file: {audio_file.filename}, Size: {file_size/(1024*1024):.2f} MB")
        
        # Reset file pointer to beginning after reading
        audio_file.seek(0)
        
        # Extract parameters from the request
        prompt = request.form.get('transcription_prompt', '')
        use_replicate = request.form.get('use_replicate', 'false').lower() == 'true'
        use_default_replicate_api = request.form.get('default_replicate_api', 'false').lower() == 'true'
        
        if use_replicate:
            # Get API key - this will now try user key, env var, and default key file
            api_key = get_replicate_api_key(user_id)
            
            if not api_key:
                return jsonify({
                    'error': 'No Replicate API key found',
                    'message': 'No Replicate API key provided. Please add your API key in Settings'
                }), 400
                
            # Set the key in environment for this request
            os.environ["REPLICATE_API_TOKEN"] = api_key
            logger.info("Using Replicate API for transcription")
            
            # Continue with transcription using the API key
            result = optimized_transcribe_with_replicate(
                audio_file, 
                user_id, 
                prompt
            )
            return jsonify({'transcription': result}), 200
        
        # Process based on config
        config = get_user_transcription_config(user_id)
        if config['mode'] == 'replicate':
            # For Replicate, use the optimized function for large files
            result = optimized_transcribe_with_replicate(
                audio_file, 
                user_id, 
                prompt
            )
            return jsonify({'transcription': result}), 200
        else:
            # Use standard chunked processing for other modes
            return jsonify({'error': 'Unsupported transcription mode'}), 400
        
    except RequestEntityTooLarge:
        logger.error(f"File upload too large: {request.content_length} bytes")
        return jsonify({
            'error': 'File too large. Maximum upload size is 500MB.',
            'message': 'The audio file exceeds the maximum allowed size.'
        }), 413
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return jsonify({'error': str(e)}), 500
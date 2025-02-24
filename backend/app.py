import os
import uuid
import eventlet
from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from transcribe import chunked_transcribe_audio

# Disable Eventlet's green DNS and patch the standard library
os.environ['EVENTLET_NO_GREENDNS'] = '1'
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'

# Initialize Socket.IO (allow CORS for any origin)
socketio = SocketIO(app, cors_allowed_origins="*")

# Ensure the uploads folder exists
UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return "Backend running."

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        app.logger.error("No audio file found in request.")
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    file_name_with_ext = audio_file.filename
    display_name = os.path.splitext(file_name_with_ext)[0]  # Remove file extension
    save_path = os.path.join(UPLOAD_FOLDER, file_name_with_ext)

    if os.path.exists(save_path):
        app.logger.error("File already exists.")
        return jsonify({"error": "File already exists"}), 400

    try:
        audio_file.save(save_path)
        app.logger.info(f"Saved file to: {save_path}")
        # Start background transcription
        socketio.start_background_task(background_transcription, save_path)
    except Exception as e:
        app.logger.error(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    # Return the actual filename used
    return jsonify({
        "message": "File received",
        "file_path": save_path,
        "filename": file_name_with_ext,
        "displayname": display_name
    })

@app.route('/delete_file/<filename>', methods=['DELETE'])
def delete_file(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    trashsave_path = os.path.join(TRASH_FOLDER, filename)

    try:
        if os.path.exists(file_path):
            os.rename(file_path, trashsave_path)
            app.logger.info(f"Deleted file: {file_path}")
            return jsonify({'message': 'File deleted successfully'}), 200
        else:
            return jsonify({'message': 'File not found'}), 404
    except Exception as e:
        app.logger.error(f"Error deleting file: {e}")
        return jsonify({'message': f'Error deleting file: {str(e)}'}), 500

@app.route('/trash-files', methods=['GET'])
def get_trash_files():
    try:
        files = os.listdir(TRASH_FOLDER)
        return jsonify({'files': files}), 200
    except Exception as e:
        app.logger.error(f"Error fetching trash files: {e}")
        return jsonify({'error': 'Failed to fetch trash files'}), 500

@app.route('/restore_file/<filename>', methods=['GET'])
def restore_file(filename):
    file_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)

    try:
        if os.path.exists(file_path):
            os.rename(file_path, upload_path)
            app.logger.info(f"Restored file: {file_path}")
            return jsonify({'message': 'File restored successfully'}), 200
        else:
            return jsonify({'message': 'File not found'}), 404
    except Exception as e:
        app.logger.error(f"Error restoring file: {e}")
        return jsonify({'message': f'Error restoring file: {str(e)}'}), 500

@app.route('/upload-files', methods=['GET'])
def get_upload_files():
    try:
        files = os.listdir(UPLOAD_FOLDER)
        # Return both displayname and filename
        files_info = [{'displayname': os.path.splitext(file)[0], 'filename': file} for file in files]
        return jsonify({'files': files_info}), 200
    except Exception as e:
        app.logger.error(f"Error fetching upload files: {e}")
        return jsonify({'error': 'Failed to fetch upload files'}), 500
    
def background_transcription(file_path):
    try:
        chunk_buffer = []
        # Process each transcribed chunk
        for i, total, text in chunked_transcribe_audio(file_path):
            app.logger.info(f"Chunk {i} of {total}: {text}")
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            # When we have 5 chunks, emit them immediately
            if len(chunk_buffer) >= 5:
                socketio.emit('partial_transcript_batch', {'chunks': chunk_buffer})
                socketio.sleep(0.1)
                chunk_buffer = []  


        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {'chunks': chunk_buffer})
            socketio.sleep(0.1)

        socketio.emit('final_transcript', {'done': True})
    except Exception as e:
        app.logger.error(f"Error during transcription: {e}")

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)


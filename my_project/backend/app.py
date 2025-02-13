import os
import uuid
import eventlet
from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from transcribe import chunked_transcribe_audio

os.environ['EVENTLET_NO_GREENDNS'] = '1'
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'

socketio = SocketIO(app, cors_allowed_origins="*")

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return "Backend running."

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        app.logger.error("No audio file found in request.")
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    app.logger.info(f"Received file: {audio_file.filename}")
    file_ext = audio_file.filename.rsplit('.', 1)[-1].lower()
    unique_name = f"{uuid.uuid4()}.{file_ext}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    try:
        audio_file.save(save_path)
        app.logger.info(f"Saved file to: {save_path}")
    except Exception as e:
        app.logger.error(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    socketio.start_background_task(target=background_transcription, file_path=save_path)
    return jsonify({"message": "File received", "file_path": save_path})

def background_transcription(file_path):
    try:
        for i, total, text in chunked_transcribe_audio(file_path):
            app.logger.info(f"Chunk {i} of {total}: {text}")
            socketio.emit('partial_transcript', {
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
        socketio.emit('final_transcript', {'done': True})
    except Exception as e:
        app.logger.error(f"Error during transcription: {e}")
    finally:
        try:
            os.remove(file_path)
            app.logger.info(f"Deleted file: {file_path}")
        except Exception as e:
            app.logger.error(f"Error deleting file: {e}")

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)

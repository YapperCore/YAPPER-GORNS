import os
import eventlet
from flask import Flask, request, jsonify, send_from_directory
from config import UPLOAD_FOLDER, TRASH_FOLDER, CORS_ALLOWED_ORIGINS
from services.storage import load_doc_store, save_doc_store, doc_store, doc_counter
from routes.document import get_audio_file, upload_audio  # type: ignore
from socketio_instance import socketio  
from routes.docmanage import list_docs, get_doc, create_doc, update_doc, delete_doc

app = Flask(__name__)
socketio.init_app(app)  # Initialize socketio with the app

os.environ['EVENTLET_NO_GREENDNS'] = '1'
eventlet.monkey_patch()

load_doc_store()

@app.route('/')
def index():
    return "Backend with doc store (soft-delete), chunk transcription, and trash integration."

########################################
# UPLOAD AUDIO => CREATE DOC => TRANSCRIBE
########################################

app.add_url_rule('/uploads/<filename>', 'get_audio_file', get_audio_file, methods=['GET'])
app.add_url_rule('/upload-audio', 'upload_audio', upload_audio, methods=['POST'])

########################################
# DOC MANAGEMENT ROUTES
########################################

app.add_url_rule('/api/docs', view_func=list_docs, methods=['GET'])
app.add_url_rule('/api/docs/<doc_id>', view_func=get_doc, methods=['GET'])
app.add_url_rule('/api/docs', view_func=create_doc, methods=['POST'])
app.add_url_rule('/api/docs/<doc_id>', view_func=update_doc, methods=['PUT'])
app.add_url_rule('/api/docs/<doc_id>', view_func=delete_doc, methods=['DELETE'])

########################################
# TRASH & FILE MANAGEMENT ROUTES
########################################
@app.route('/trash-files', methods=['GET'])
def get_trash_files():
    try:
        files = os.listdir(TRASH_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

@app.route('/restore_file/<filename>', methods=['GET'])
def restore_file(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(trash_path):
        os.rename(trash_path, upload_path)
        mark_doc_audio_trashed(filename, False)
        # Also, if a doc referenced this file and was marked as deleted,
        # we can restore it (set deleted = False) so it shows in docs.
        for doc in doc_store.values():
            if doc.get("audioFilename") == filename:
                doc["deleted"] = False
                doc["audioTrashed"] = False
        save_doc_store()
        app.logger.info(f"Restored file: {filename}")
        return jsonify({"message": "File restored"}), 200
    else:
        return jsonify({"message": "File not found in trash"}), 404

@app.route('/upload-files', methods=['GET'])
def get_upload_files():
    try:
        files = os.listdir(UPLOAD_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error listing uploads: {e}")
        return jsonify({"error": "Error listing uploads"}), 500

def mark_doc_audio_trashed(filename, is_trashed):
    global doc_store
    changed = False
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            doc["audioTrashed"] = is_trashed
            changed = True
    if changed:
        save_doc_store()

########################################
# SOCKET.IO FOR DOC EDITING
########################################
@socketio.on('join_doc')
def handle_join_doc_evt(data):
    doc_id = data.get('doc_id')
    join_room(doc_id)
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        emit('doc_content_update', {
            'doc_id': doc_id,
            'content': doc['content']
        }, room=doc_id)

@socketio.on('edit_doc')
def handle_edit_doc_evt(data):
    doc_id = data.get('doc_id')
    new_content = data.get('content')
    doc = doc_store.get(doc_id)
    if doc and not doc.get("deleted"):
        doc['content'] = new_content
        save_doc_store()
    emit('doc_content_update', {
        'doc_id': doc_id,
        'content': new_content
    }, room=doc_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)


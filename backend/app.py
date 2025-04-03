import os
from gevent import monkey 
from gevent.pywsgi import WSGIServer 
from flask import Flask  # type: ignore
from services.storage import load_doc_store, save_doc_store, doc_store
from routes.document import get_audio_file, upload_audio  # type: ignore
from routes.docmanage import list_docs, get_doc, create_doc, update_doc, delete_doc
from routes.trash_route import get_trash_files, restore_file, get_upload_files
from services.socketio_instance import socketio  # type: ignore

app = Flask(__name__)
socketio.init_app(app)

monkey.patch_all()  # Patch standard library modules to work with gevent's green threads

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

app.add_url_rule('/trash-files', view_func=get_trash_files, methods=['GET'])
app.add_url_rule('/restore_file/<filename>', view_func=restore_file, methods=['GET'])
app.add_url_rule('/upload-files', view_func=get_upload_files, methods=['GET'])

if __name__ == '__main__':  # Use gevent's WSGI server
    http_server = WSGIServer(('0.0.0.0', 5000), app)
    http_server.serve_forever()


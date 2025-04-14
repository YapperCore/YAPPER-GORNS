#!/usr/bin/env python
"""
Cross-platform compatible Flask application for Yapper with Whisper transcription,
Firebase integration, and SocketIO for real-time updates.
"""

import os
import logging
import tempfile
from datetime import datetime
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO

# --- Platform Detection ---
import platform
IS_WINDOWS = platform.system() == "Windows"
IS_WSL = "microsoft" in platform.uname().release.lower() if hasattr(platform, 'uname') else False
PLATFORM_NAME = f"{platform.system()} {'(WSL)' if IS_WSL else ''}"

# --- Windows Patch ---
if IS_WINDOWS:
    import ctypes.util
    _original_find_library = ctypes.util.find_library
    def patched_find_library(name):
        ret = _original_find_library(name)
        if ret is None and name == "c":
            return "msvcrt"
        return ret
    ctypes.util.find_library = patched_find_library

# --- Config and Services ---
from config import UPLOAD_FOLDER, TRASH_FOLDER, DOC_STORE_FILE
from services.storage import load_doc_store
from services.socketio_instance import socketio
from services.firebase_service import initialize_firebase

# --- Routes ---
from routes.docmanage import register_docmanage_routes
from routes.document import register_document_routes
from routes.trash_route import register_trash_routes

# --- Auth ---
from auth import verify_firebase_token, is_admin

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(tempfile.gettempdir(), 'yapper.log'))
    ]
)
logger = logging.getLogger(__name__)

# Log platform information
logger.info(f"Starting on platform: {PLATFORM_NAME}")
logger.info(f"Python version: {platform.python_version()}")

# --- Ensure Directories Exist ---
def ensure_directories():
    """Create necessary directories for uploads and trash"""
    Path(UPLOAD_FOLDER).mkdir(exist_ok=True, parents=True)
    Path(TRASH_FOLDER).mkdir(exist_ok=True, parents=True)
    logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    logger.info(f"Trash folder: {TRASH_FOLDER}")
    logger.info(f"Doc store file: {DOC_STORE_FILE}")

# --- App Initialization ---
def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    CORS(app, supports_credentials=True)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'yapper_secret_key')
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max upload

    # Initialize Firebase
    initialize_firebase()
    
    # Initialize directories and load doc store
    ensure_directories()
    load_doc_store()

    # Register routes
    register_basic_routes(app)
    register_docmanage_routes(app)
    register_document_routes(app)
    register_trash_routes(app)

    # Attach SocketIO to Flask app
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')
    
    # Register error handlers
    register_error_handlers(app)
    
    return app

# --- Basic Routes ---
def register_basic_routes(app):
    """Register basic application routes"""
    @app.route('/')
    def index():
        return jsonify({
            "service": "Yapper Backend API",
            "status": "running",
            "platform": PLATFORM_NAME,
            "version": "1.0.0"
        })

    @app.route('/healthcheck')
    def healthcheck():
        return jsonify({
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "platform": PLATFORM_NAME
        }), 200

    @app.route('/auth/check', methods=['GET'])
    @verify_firebase_token
    def check_auth():
        return jsonify({
            "authenticated": True,
            "uid": request.uid,
            "is_admin": is_admin(request.uid)
        })

# --- Error Handlers ---
def register_error_handlers(app):
    """Register application error handlers"""
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({"error": "Unauthorized"}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({"error": "Forbidden"}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def internal_server(error):
        return jsonify({"error": "Internal server error"}), 500

# --- Application Entry Point ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Yapper backend on {PLATFORM_NAME}")
    logger.info(f"Port: {port}, Debug mode: {debug_mode}")
    
    app = create_app()
    
    if debug_mode:
        # Use Flask's development server with debug mode
        socketio.run(app, debug=debug_mode, host='0.0.0.0', port=port)
    else:
        # Use socketio's production-ready server
        print(f"Yapper backend running on http://0.0.0.0:{port} (Press CTRL+C to quit)")
        socketio.run(app, host='0.0.0.0', port=port)

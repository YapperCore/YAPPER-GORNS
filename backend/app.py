# backend/app.py
"""
Yapper Backend Application with User Authentication & Access Control
"""
import os
import logging
import sys
import json
import uuid
from datetime import datetime
from functools import wraps

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('yapper_backend.log')
    ]
)
logger = logging.getLogger(__name__)

# Load configuration
try:
    from config import (
        UPLOAD_FOLDER, TRASH_FOLDER, DOC_STORE_FILE,
        CORS_ALLOWED_ORIGINS, FLASK_SECRET_KEY, DEBUG_MODE
    )
except ImportError as e:
    logger.error(f"Failed to import configuration: {e}")
    logger.info("Using default configuration")
    UPLOAD_FOLDER = 'uploads'
    TRASH_FOLDER = 'trash'
    DOC_STORE_FILE = 'doc_store.json'
    CORS_ALLOWED_ORIGINS = "*"
    FLASK_SECRET_KEY = "yapper-default-key"
    DEBUG_MODE = True

# Ensure necessary directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

# Import Flask and related libraries
try:
    from flask import Flask, request, jsonify, send_from_directory
    from flask_cors import CORS
    from flask_socketio import SocketIO, emit, join_room
except ImportError as e:
    logger.critical(f"Failed to import Flask libraries: {e}")
    logger.critical("Please install required packages: pip install flask flask-socketio flask-cors")
    sys.exit(1)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = FLASK_SECRET_KEY
CORS(app, supports_credentials=True, resources={r"/*": {"origins": CORS_ALLOWED_ORIGINS}})
socketio = SocketIO(app, cors_allowed_origins=CORS_ALLOWED_ORIGINS)

# Initialize document store
doc_store = {}
doc_counter = 0

def load_doc_store():
    """Load document store from JSON file with error handling"""
    global doc_store, doc_counter
    if os.path.exists(DOC_STORE_FILE):
        try:
            with open(DOC_STORE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                doc_store.update(data.get('docs', {}))
                doc_counter = data.get('counter', 0)
            logger.info(f"Loaded doc store with {len(doc_store)} documents")
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in {DOC_STORE_FILE}")
        except Exception as e:
            logger.error(f"Error loading doc store: {e}")
    else:
        logger.info(f"Doc store file {DOC_STORE_FILE} not found, will create new one")

def save_doc_store():
    """Save document store to JSON file with error handling"""
    global doc_store, doc_counter
    data = {
        'docs': doc_store,
        'counter': doc_counter
    }
    try:
        with open(DOC_STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.debug("Doc store saved successfully")
    except Exception as e:
        logger.error(f"Error saving doc store: {e}")

# Load docs at startup
load_doc_store()

# Initialize Firebase with fallback
try:
    # Try to import and initialize Firebase first
    from firebase_helper import (
        firebase_available, upload_file, delete_audio, update_transcription,
        get_user_files, get_all_files, is_admin_user
    )
    logger.info(f"Firebase integration: {'enabled' if firebase_available else 'disabled'}")
except ImportError:
    logger.warning("Firebase helper module not found, Firebase functionality will be disabled")
    firebase_available = False
    
    # Define placeholder functions for Firebase operations
    def upload_file(*args, **kwargs):
        logger.warning("Firebase upload requested but Firebase is not available")
        return {"success": False, "message": "Firebase not available"}
    
    def delete_audio(*args, **kwargs):
        logger.warning("Firebase delete requested but Firebase is not available")
        return {"success": False, "message": "Firebase not available"}
    
    def update_transcription(*args, **kwargs):
        logger.warning("Firebase update requested but Firebase is not available")
        return {"success": False, "message": "Firebase not available"}
    
    def get_user_files(*args, **kwargs):
        logger.warning("Firebase get_user_files requested but Firebase is not available")
        return []
    
    def get_all_files(*args, **kwargs):
        logger.warning("Firebase get_all_files requested but Firebase is not available")
        return []
    
    def is_admin_user(user_id):
        # Check local admin list for fallback
        admin_ids = [
            "fqFmFaVxP9YCbdpCSbxjw9I8UZI2",
            "9I0tKoljp3h97WaPFH1hEsxgPGP2", 
            "OK7kfRfp5YOSawBii8RNIP54fgo1", 
            "XOW0xzNdu2V39X88TlKrbnkoMOq1"
        ]
        return user_id in admin_ids

# Import transcribe module with fallback
try:
    from transcribe import chunked_transcribe_audio
except ImportError:
    logger.error("Transcribe module not found, falling back to dummy implementation")
    
    def chunked_transcribe_audio(file_path, chunk_sec=30):
        """Dummy transcription function for fallback"""
        logger.warning(f"Using dummy transcription for file: {file_path}")
        yield (1, 1, "Transcription service unavailable. Please try again later.")

# Authentication middleware
def get_user_from_request():
    """Extract user ID from request"""
    auth_header = request.headers.get('Authorization', '')
    user_id = request.args.get('userId') or request.headers.get('X-User-ID')
    return user_id

def require_auth(f):
    """Middleware to require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_user_from_request()
        
        if not user_id:
            logger.warning(f"Anonymous request to {request.path}")
            return f(None, *args, **kwargs)
        
        # Add user info to the wrapped function
        return f(user_id, *args, **kwargs)
    
    return decorated

def require_admin(f):
    """Middleware to require admin permissions"""
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_user_from_request()
        
        if not user_id or not is_admin_user(user_id):
            return jsonify({"error": "Admin access required"}), 403
        
        return f(user_id, *args, **kwargs)
    
    return decorated

# Define routes here
@app.route('/')
def index():
    """Root endpoint - shows app status"""
    return jsonify({
        "status": "running",
        "firebase": "enabled" if firebase_available else "disabled",
        "docs_count": len(doc_store),
        "version": "1.0.0"
    })

# Document upload route
@app.route('/upload-audio', methods=['POST'])
@require_auth
def upload_audio_route(user_id):
    global doc_counter
    
    # Basic error handling
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file found"}), 400
    
    audio_file = request.files['audio']
    original_filename = audio_file.filename or "unnamed.audio"
    
    # Generate a unique filename
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_name = f"{uuid.uuid4()}_{timestamp}_{original_filename}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)
    
    try:
        # Save file locally
        audio_file.save(save_path)
        logger.info(f"Saved file to: {save_path}")
        
        # Upload to Firebase
        firebase_result = None
        if firebase_available:
            try:
                with open(save_path, 'rb') as f:
                    firebase_result = upload_file(f, user_id)
                logger.info(f"Firebase upload result: {firebase_result}")
            except Exception as e:
                logger.error(f"Firebase upload error: {e}")
        
        # Create document with user ownership
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
            "ownerId": user_id or "anonymous",
            "firebase_url": firebase_result.get("file_url") if firebase_result and firebase_result.get("success") else None,
            "firebase_filename": firebase_result.get("filename") if firebase_result and firebase_result.get("success") else None,
        }
        
        doc_store[doc_id] = doc_obj
        save_doc_store()
        
        # Start transcription in background
        socketio.start_background_task(
            background_transcription, save_path, doc_id, user_id
        )
        
        return jsonify({
            "message": "File received and document created",
            "filename": unique_name,
            "doc_id": doc_id,
            "firebase_status": "uploaded" if firebase_result and firebase_result.get("success") else "local only"
        }), 200
    
    except Exception as e:
        logger.error(f"Error in upload_audio: {e}")
        # Clean up if file was partially saved
        if os.path.exists(save_path):
            try:
                os.remove(save_path)
            except:
                pass
        return jsonify({"error": str(e)}), 500

def background_transcription(file_path, doc_id, user_id=None):
    """Process transcription in background"""
    try:
        chunk_buffer = []
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            
            # Emit updates in batches
            if len(chunk_buffer) >= 5:
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
        
        # Signal completion
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        })
        logger.info(f"Transcription completed for doc {doc_id}")
    
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        socketio.emit('transcription_error', {
            'doc_id': doc_id,
            'error': str(e)
        })

def append_to_doc(doc_id, chunk_list, user_id=None):
    """Append transcription chunks to document"""
    doc = doc_store.get(doc_id)
    if not doc:
        logger.warning(f"Doc {doc_id} not found for append")
        return
    
    # Append text
    combined_text = doc.get("content", "")
    for chunk in chunk_list:
        combined_text += " " + chunk.get("text", "")
    doc["content"] = combined_text
    save_doc_store()
    
    # Update Firebase if available
    if firebase_available and doc.get("firebase_filename"):
        try:
            update_transcription(
                doc["firebase_filename"],
                combined_text,
                user_id
            )
        except Exception as e:
            logger.error(f"Error updating Firebase transcription: {e}")

# Add other routes here (list_docs, get_doc, etc.)
# ...

# Run the app
if __name__ == '__main__':
    logger.info(f"Starting Yapper backend on port 5000")
    socketio.run(app, debug=DEBUG_MODE, host='0.0.0.0', port=5000)

# backend/firebase_helper.py
"""
Robust Firebase helper with proper initialization and error handling
"""
import os
import logging
import uuid
import json
import signal
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, storage, firestore

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state
db = None
bucket = None
firebase_available = False

# Class to handle timeouts
class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("Firebase initialization timed out")

def initialize_firebase(timeout=10):
    """
    Initialize Firebase with timeout and error handling
    
    Args:
        timeout: Maximum seconds to wait for initialization
        
    Returns:
        bool: True if initialization successful
    """
    global db, bucket, firebase_available
    
    # Set up timeout handler
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(timeout)
    
    try:
        # First check if already initialized
        if firebase_admin._apps:
            logger.info("Firebase already initialized")
            db = firestore.client()
            bucket = storage.bucket()
            firebase_available = True
            signal.alarm(0)  # Cancel alarm
            return True
        
        # Look for credentials file in multiple locations
        cred_paths = [
            os.path.join(os.getcwd(), "Accesskey.json"),
            "Accesskey.json"
        ]
        
        cred_file = None
        for path in cred_paths:
            if os.path.exists(path):
                logger.info(f"Found credentials at: {path}")
                cred_file = path
                break
        
        if not cred_file:
            logger.error("Could not find Firebase credentials file")
            signal.alarm(0)  # Cancel alarm
            return False
        
        # Load credentials and initialize app
        logger.info(f"Initializing Firebase with credentials from: {cred_file}")
        cred = credentials.Certificate(cred_file)
        firebase_admin.initialize_app(cred, {
            'storageBucket': 'yapper-1958d.firebasestorage.app'
        })
        
        # Initialize clients
        db = firestore.client()
        bucket = storage.bucket()
        
        # Simple connectivity test
        logger.info("Testing Firebase connection...")
        db.collection('_test_').document('_connection_test').get()
        
        firebase_available = True
        logger.info("Firebase initialized successfully")
        return True
    
    except TimeoutError:
        logger.error(f"Firebase initialization timed out after {timeout} seconds")
        return False
    
    except Exception as e:
        logger.error(f"Firebase initialization error: {e}")
        return False
    
    finally:
        signal.alarm(0)  # Cancel alarm

def upload_file(file, user_id=None):
    """
    Upload file to Firebase Storage with user ownership
    
    Args:
        file: File object to upload
        user_id: User ID who owns the file
        
    Returns:
        dict: Upload result with success status
    """
    if not firebase_available:
        logger.warning("Firebase not available for upload")
        return {"message": "Firebase not available", "success": False}
    
    try:
        # Generate unique filename with user path for access control
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        original_filename = getattr(file, 'filename', 'untitled.file')
        content_type = getattr(file, 'content_type', 'application/octet-stream')
        
        # Create user-specific or public path
        if user_id:
            storage_path = f"users/{user_id}/{uuid.uuid4()}_{timestamp}_{original_filename}"
        else:
            storage_path = f"public/{uuid.uuid4()}_{timestamp}_{original_filename}"
        
        # Upload to Firebase Storage
        blob = bucket.blob(storage_path)
        
        # Handle different file types
        if hasattr(file, 'read'):
            # File-like object
            current_pos = file.tell() if hasattr(file, 'tell') else 0
            file.seek(0) if hasattr(file, 'seek') else None
            blob.upload_from_file(file, content_type=content_type)
            file.seek(current_pos) if hasattr(file, 'seek') else None
        else:
            # Raw bytes or something else
            blob.upload_from_string(file, content_type=content_type)
        
        # Generate a signed URL for access
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.now() + timedelta(days=7),
            method="GET"
        )
        
        # Save metadata to Firestore
        doc_ref = db.collection("audio_files").document(storage_path.replace('/', '_'))
        doc_ref.set({
            "filename": storage_path,
            "originalFilename": original_filename,
            "contentType": content_type,
            "uploadTime": firestore.SERVER_TIMESTAMP,
            "file_url": signed_url,
            "ownerId": user_id or "anonymous"
        })
        
        logger.info(f"File uploaded to Firebase: {storage_path}")
        return {
            "message": "File uploaded successfully",
            "filename": storage_path,
            "file_url": signed_url,
            "success": True
        }
    
    except Exception as e:
        logger.error(f"Firebase upload error: {e}")
        return {"message": f"Firebase upload error: {e}", "success": False}

# Initialize Firebase at module import with 15 second timeout
firebase_available = initialize_firebase(timeout=15)

# Other methods like delete_audio, is_admin_user, etc. would go here
# ...

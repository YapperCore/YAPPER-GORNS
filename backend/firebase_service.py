"""
Firebase service for Yapper application
Handles authentication, storage, and user-based access control
"""
import os
import uuid
import logging
import datetime
import firebase_admin
from firebase_admin import credentials, storage, firestore, auth
from firebase_config import FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_STORAGE_BUCKET, ADMIN_USER_IDS

# Configure logging
logger = logging.getLogger(__name__)

# Firebase clients
bucket = None
db = None
firebase_app = None

def initialize_firebase():
    """Initialize Firebase Admin SDK with service account credentials"""
    global bucket, db, firebase_app
    
    if not firebase_admin._apps:
        try:
            # Check if service account key file exists
            if not os.path.exists(FIREBASE_SERVICE_ACCOUNT_KEY):
                logger.error(f"Firebase service account key not found: {FIREBASE_SERVICE_ACCOUNT_KEY}")
                return False
                
            # Initialize with service account
            cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_KEY)
            firebase_app = firebase_admin.initialize_app(cred, {
                'storageBucket': FIREBASE_STORAGE_BUCKET
            })
            
            # Initialize services
            bucket = storage.bucket()
            db = firestore.client()
            
            logger.info("Firebase initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Error initializing Firebase: {e}")
            return False
    else:
        # Already initialized, ensure clients are set
        if not bucket:
            bucket = storage.bucket()
        if not db:
            db = firestore.client()
        return True

def is_admin(user_id):
    """Check if user is an admin"""
    return user_id in ADMIN_USER_IDS

def is_admin_or_owner(user_id, owner_id):
    """Check if user is an admin or the owner of the resource"""
    if not user_id:
        return False
    return user_id == owner_id or is_admin(user_id)

def upload_file(file_data, filename, content_type, user_id=None):
    """
    Upload file to Firebase Storage with user ownership
    
    Args:
        file_data: File data to upload
        filename: Name of the file
        content_type: Content type of the file
        user_id: User ID who owns the file
        
    Returns:
        dict: Upload result with file URL and success status
    """
    if not bucket:
        logger.error("Firebase not initialized. Cannot upload file.")
        return {"success": False, "error": "Firebase not initialized"}
        
    try:
        # Generate a unique path that includes user ID for access control
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())
        
        if user_id:
            # Put file in user's directory
            storage_path = f"users/{user_id}/{unique_id}_{timestamp}_{filename}"
        else:
            # Put in public directory if no user ID
            storage_path = f"public/{unique_id}_{timestamp}_{filename}"
            
        # Create the blob
        blob = bucket.blob(storage_path)
        
        # Upload with metadata including owner
        metadata = {
            'contentType': content_type,
            'ownerId': user_id or 'anonymous',
            'originalFilename': filename,
            'uploadTime': timestamp
        }
        
        # Upload the file
        blob.upload_from_string(
            file_data,
            content_type=content_type,
            metadata=metadata
        )
        
        # Get a signed URL that expires in 7 days (for security)
        # Note: For permanent URLs you would use make_public() instead
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(days=7),
            method="GET"
        )
        
        # Store metadata in Firestore
        doc_ref = db.collection('files').document(storage_path.replace('/', '_'))
        doc_ref.set({
            'filename': filename,
            'storagePath': storage_path,
            'contentType': content_type,
            'ownerId': user_id or 'anonymous',
            'uploadTime': firestore.SERVER_TIMESTAMP,
            'url': signed_url,
            'expiresAt': firestore.Timestamp.from_datetime(
                datetime.datetime.now() + datetime.timedelta(days=7)
            )
        })
        
        logger.info(f"File uploaded successfully: {storage_path}")
        
        return {
            "success": True,
            "filename": filename,
            "storage_path": storage_path,
            "url": signed_url
        }
    except Exception as e:
        logger.error(f"Error uploading file to Firebase: {e}")
        return {"success": False, "error": str(e)}

def get_file_url(storage_path, user_id=None):
    """
    Get a temporary URL for a file with access control
    
    Args:
        storage_path: Storage path of the file
        user_id: User ID requesting access
        
    Returns:
        str or None: Signed URL if user has access, None otherwise
    """
    if not bucket:
        logger.error("Firebase not initialized")
        return None
        
    try:
        # Check ownership in metadata
        blob = bucket.blob(storage_path)
        if not blob.exists():
            logger.warning(f"File not found: {storage_path}")
            return None
            
        # Check ownership
        metadata = blob.metadata or {}
        owner_id = metadata.get('ownerId', 'anonymous')
        
        # Enforce access control - only owner or admin can access
        if user_id and not is_admin_or_owner(user_id, owner_id):
            logger.warning(f"Access denied: User {user_id} is not owner or admin for {storage_path}")
            return None
            
        # Generate a temporary URL
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),
            method="GET"
        )
        
        return signed_url
    except Exception as e:
        logger.error(f"Error getting file URL: {e}")
        return None

def delete_file(storage_path, user_id=None):
    """
    Delete a file with access control
    
    Args:
        storage_path: Storage path of the file
        user_id: User ID requesting deletion
        
    Returns:
        bool: True if deletion succeeded, False otherwise
    """
    if not bucket:
        logger.error("Firebase not initialized")
        return False
        
    try:
        # Check existence
        blob = bucket.blob(storage_path)
        if not blob.exists():
            logger.warning(f"File not found for deletion: {storage_path}")
            return False
            
        # Check ownership
        metadata = blob.metadata or {}
        owner_id = metadata.get('ownerId', 'anonymous')
        
        # Enforce access control - only owner or admin can delete
        if user_id and not is_admin_or_owner(user_id, owner_id):
            logger.warning(f"Delete denied: User {user_id} is not owner or admin for {storage_path}")
            return False
            
        # Delete from Storage
        blob.delete()
        
        # Delete metadata from Firestore
        doc_id = storage_path.replace('/', '_')
        db.collection('files').document(doc_id).delete()
        
        logger.info(f"File deleted: {storage_path}")
        return True
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        return False

def get_user_files(user_id):
    """
    Get all files owned by a user
    
    Args:
        user_id: User ID to fetch files for
        
    Returns:
        list: Files owned by the user
    """
    if not db:
        logger.error("Firebase not initialized")
        return []
        
    try:
        # Query Firestore for files with matching owner ID
        query = db.collection('files').where('ownerId', '==', user_id)
        docs = query.stream()
        
        files = []
        for doc in docs:
            files.append(doc.to_dict())
            
        return files
    except Exception as e:
        logger.error(f"Error fetching user files: {e}")
        return []

def get_all_files(user_id=None):
    """
    Get all files (with access control)
    
    Args:
        user_id: User ID requesting access (must be admin for all files)
        
    Returns:
        list: All files if admin, otherwise empty list
    """
    if not db:
        logger.error("Firebase not initialized")
        return []
        
    # Only admins can list all files
    if not is_admin(user_id):
        logger.warning(f"User {user_id} is not an admin, cannot list all files")
        return []
        
    try:
        # Get all files from Firestore
        docs = db.collection('files').stream()
        
        files = []
        for doc in docs:
            files.append(doc.to_dict())
            
        return files
    except Exception as e:
        logger.error(f"Error fetching all files: {e}")
        return []

def update_transcription(storage_path, transcription, user_id=None):
    """
    Update transcription for a file with access control
    
    Args:
        storage_path: Storage path of the file
        transcription: Transcription text
        user_id: User ID requesting update
        
    Returns:
        bool: True if update succeeded, False otherwise
    """
    if not db:
        logger.error("Firebase not initialized")
        return False
        
    try:
        # Get file document from Firestore
        doc_id = storage_path.replace('/', '_')
        doc_ref = db.collection('files').document(doc_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            logger.warning(f"File not found for transcription update: {storage_path}")
            return False
            
        # Check ownership
        file_data = doc.to_dict()
        owner_id = file_data.get('ownerId', 'anonymous')
        
        # Enforce access control - only owner or admin can update
        if user_id and not is_admin_or_owner(user_id, owner_id):
            logger.warning(f"Update denied: User {user_id} is not owner or admin for {storage_path}")
            return False
            
        # Update the transcription
        doc_ref.update({
            'transcription': transcription,
            'transcriptionTime': firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"Transcription updated for: {storage_path}")
        return True
    except Exception as e:
        logger.error(f"Error updating transcription: {e}")
        return False

def verify_token(id_token):
    """
    Verify Firebase ID token and get user ID
    
    Args:
        id_token: Firebase ID token
        
    Returns:
        str or None: User ID if valid, None otherwise
    """
    if not firebase_app:
        logger.error("Firebase not initialized")
        return None
        
    try:
        # Verify the token
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token.get('uid')
        return user_id
    except Exception as e:
        logger.error(f"Error verifying token: {e}")
        return None

# Initialize Firebase on module import
firebase_available = initialize_firebase()

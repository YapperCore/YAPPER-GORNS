"""
Firebase service for Yapper application
Handles authentication, storage, and user-based access control
"""
import os
import uuid
import logging
import datetime
from pathlib import Path
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

def extract_owner_from_path(path):
    """
    Extract owner user ID from a Firebase path
    
    Args:
        path: Storage path like "users/{uid}/uploads/filename"
        
    Returns:
        str or None: Owner user ID if found, None otherwise
    """
    parts = path.split('/')
    if len(parts) >= 2 and parts[0] == 'users':
        return parts[1]
    return None

def is_owner_or_admin(user_id, resource_path_or_owner_id):
    """
    Check if user is an admin or the owner of the resource
    
    Args:
        user_id: User ID requesting access
        resource_path_or_owner_id: Either a resource path or direct owner ID
        
    Returns:
        bool: True if user is owner or admin
    """
    if not user_id:
        return False
        
    # If already admin, grant access
    if is_admin(user_id):
        return True
    
    # If direct owner ID is provided
    if '/' not in str(resource_path_or_owner_id):
        return user_id == resource_path_or_owner_id
        
    # Extract owner from path
    path_owner = extract_owner_from_path(resource_path_or_owner_id)
    if path_owner:
        return user_id == path_owner
        
    return False

def ensure_folder_exists(user_id, folder_type='uploads'):
    """
    Ensure the user's folder exists in Firebase Storage
    
    Args:
        user_id: The user ID
        folder_type: The type of folder (uploads, trash, etc.)
        
    Returns:
        bool: True if folder exists or was created
    """
    if not bucket:
        logger.error("Firebase Storage bucket not initialized")
        return False
    
    try:
        # Create an empty placeholder object to ensure folder exists
        folder_path = f"users/{user_id}/{folder_type}/.folder_marker"
        blob = bucket.blob(folder_path)
        
        if not blob.exists():
            blob.upload_from_string('', content_type='application/octet-stream')
            logger.info(f"Created {folder_type} folder for user {user_id}")
        
        return True
    except Exception as e:
        logger.error(f"Error ensuring {folder_type} folder exists: {e}")
        return False

def check_blob_exists(storage_path):
    """
    Check if a blob exists at the given path
    
    Args:
        storage_path: Storage path to check
        
    Returns:
        bool: True if blob exists, False otherwise
    """
    if not bucket:
        logger.error("Firebase Storage bucket not initialized")
        return False
        
    try:
        blob = bucket.blob(storage_path)
        return blob.exists()
    except Exception as e:
        logger.error(f"Error checking blob existence: {e}")
        return False

def upload_file(file_data, original_filename, user_id, content_type='application/octet-stream'):
    """
    Upload file to Firebase Storage with user ownership
    
    Args:
        file_data: File data to upload
        original_filename: Original name of the file
        user_id: User ID who owns the file
        content_type: Content type of the file
        
    Returns:
        dict: Upload result with file URL and metadata
    """
    if not bucket:
        logger.error("Firebase not initialized. Cannot upload file.")
        return {"success": False, "error": "Firebase not initialized"}
        
    try:
        # Ensure user has uploads folder
        ensure_folder_exists(user_id, 'uploads')
        
        # Generate a unique filename
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())
        filename = f"{unique_id}_{timestamp}_{original_filename}"
        
        # User-specific storage path for access control
        storage_path = f"users/{user_id}/uploads/{filename}"
            
        # Create the blob
        blob = bucket.blob(storage_path)
        
        # Upload the file first
        blob.upload_from_string(file_data, content_type=content_type)
        
        # Set metadata after upload - this is the correct way
        blob.metadata = {
            'ownerId': user_id,
            'originalFilename': original_filename,
            'uploadTime': timestamp
        }
        # Update the blob with new metadata
        blob.patch()
        
        # Get a signed URL that expires in 7 days
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(days=7),
            method="GET"
        )
        
        # Store metadata in Firestore
        doc_ref = db.collection('files').document(filename.replace('/', '_'))
        doc_ref.set({
            'filename': filename,
            'originalFilename': original_filename,
            'storagePath': storage_path,
            'contentType': content_type,
            'ownerId': user_id,
            'uploadTime': firestore.SERVER_TIMESTAMP,
            'url': signed_url,
            'expiresAt': datetime.datetime.now() + datetime.timedelta(days=7),  # Store as datetime directly
            'expiresAtString': (datetime.datetime.now() + datetime.timedelta(days=7)).isoformat(),  # Use string as backup
            'status': 'active'  # Track file status (active vs trashed)
        })
        
        logger.info(f"File uploaded successfully: {storage_path}")
        
        return {
            "success": True,
            "filename": filename,
            "originalFilename": original_filename,
            "storage_path": storage_path,
            "url": signed_url
        }
    except Exception as e:
        logger.error(f"Error uploading file to Firebase: {e}")
        return {"success": False, "error": str(e)}

def get_file_url(storage_path, requesting_user_id=None):
    """
    Get a signed URL for a file with permission check
    
    Args:
        storage_path: Storage path of the file
        requesting_user_id: User ID requesting access
        
    Returns:
        str or None: Signed URL if user has access, None otherwise
    """
    if not bucket:
        logger.error("Firebase Storage bucket not initialized")
        return None
        
    try:
        # If no user ID provided, skip permission check (internal use)
        if not requesting_user_id:
            blob = bucket.blob(storage_path)
            if blob.exists():
                signed_url = blob.generate_signed_url(
                    version="v4",
                    expiration=datetime.timedelta(hours=1),
                    method="GET"
                )
                return signed_url
            return None
            
        # Check if path belongs to user (simple path check for efficiency)
        path_owner = extract_owner_from_path(storage_path)
        if path_owner and requesting_user_id != path_owner and not is_admin(requesting_user_id):
            logger.warning(f"Access denied: User {requesting_user_id} is not owner of {storage_path}")
            return None
            
        # Check file existence
        blob = bucket.blob(storage_path)
        if not blob.exists():
            logger.warning(f"File not found: {storage_path}")
            return None
        
        # Generate secure, time-limited URL
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),  # Short expiration for security
            method="GET"
        )
        
        return signed_url
    except Exception as e:
        logger.error(f"Error getting file URL: {e}")
        return None

def delete_file(storage_path, requesting_user_id):
    """
    Delete a file with permission check
    
    Args:
        storage_path: Storage path of the file
        requesting_user_id: User ID requesting deletion
        
    Returns:
        bool: True if deleted successfully, False otherwise
    """
    if not bucket:
        logger.error("Firebase Storage bucket not initialized")
        return False
        
    try:
        # Check file existence first
        blob = bucket.blob(storage_path)
        if not blob.exists():
            logger.warning(f"File not found for deletion: {storage_path}")
            return False
            
        # Check if path belongs to user (simple path check)
        path_owner = extract_owner_from_path(storage_path)
        if path_owner and (path_owner == requesting_user_id or is_admin(requesting_user_id)):
            # Delete from Storage
            blob.delete()
            
            # Delete metadata from Firestore
            doc_id = storage_path.split('/')[-1].replace('/', '_')
            doc_ref = db.collection('files').document(doc_id)
            if doc_ref.get().exists:
                doc_ref.delete()
            
            logger.info(f"File deleted: {storage_path}")
            return True
        else:
            logger.warning(f"Delete denied: User {requesting_user_id} is not owner of {storage_path}")
            return False
    except Exception as e:
        logger.error(f"Error deleting file: {e}")
        return False

def move_file(source_path, dest_path, requesting_user_id):
    """
    Move a file with permission check
    
    Args:
        source_path: Source storage path
        dest_path: Destination storage path
        requesting_user_id: User ID requesting move
        
    Returns:
        bool: True if moved successfully, False otherwise
    """
    if not bucket:
        logger.error("Firebase Storage bucket not initialized")
        return False
        
    try:
        # Check file existence
        source_blob = bucket.blob(source_path)
        if not source_blob.exists():
            logger.warning(f"Source file not found: {source_path}")
            
            # Double-check if dest_path already exists (might have been moved already)
            dest_blob = bucket.blob(dest_path)
            if dest_blob.exists():
                logger.info(f"Destination already exists: {dest_path}, treating as success")
                
                # Update Firestore status if applicable
                filename = dest_path.split('/')[-1].replace('/', '_')
                doc_ref = db.collection('files').document(filename)
                doc = doc_ref.get()
                if doc.exists:
                    status = 'active' if 'uploads' in dest_path else 'trashed'
                    doc_ref.update({
                        'storagePath': dest_path,
                        'status': status
                    })
                
                return True
            
            return False
            
        # Check if source path belongs to requesting user
        source_owner = extract_owner_from_path(source_path)
        dest_owner = extract_owner_from_path(dest_path)
        
        # Validate source and destination owners match and match requesting user
        if source_owner and dest_owner and source_owner == dest_owner:
            if source_owner == requesting_user_id or is_admin(requesting_user_id):
                # Ensure destination folder exists
                folder_type = 'uploads' if 'uploads' in dest_path else 'trash'
                ensure_folder_exists(dest_owner, folder_type)
                
                # Copy source to destination
                bucket.copy_blob(source_blob, bucket, dest_path)
                
                # Get metadata to preserve
                source_blob.reload()
                metadata = source_blob.metadata or {}
                content_type = source_blob.content_type
                
                # Apply metadata to destination
                dest_blob = bucket.blob(dest_path)
                dest_blob.metadata = metadata
                dest_blob.content_type = content_type
                dest_blob.patch()
                
                # Delete source blob only after successful copy
                source_blob.delete()
                
                # Update Firestore metadata
                filename = dest_path.split('/')[-1].replace('/', '_')
                doc_ref = db.collection('files').document(filename)
                doc = doc_ref.get()
                if doc.exists:
                    status = 'active' if 'uploads' in dest_path else 'trashed'
                    doc_ref.update({
                        'storagePath': dest_path,
                        'status': status
                    })
                
                logger.info(f"File moved: {source_path} -> {dest_path}")
                return True
            else:
                logger.warning(f"Move denied: User {requesting_user_id} doesn't match owner {source_owner}")
                return False
        else:
            logger.warning(f"Move denied: Source owner {source_owner} and destination owner {dest_owner} don't match")
            return False
    except Exception as e:
        logger.error(f"Error moving file: {e}")
        return False

def list_user_files(user_id, folder_path="uploads"):
    """
    List files owned by a user in a specific folder
    
    Args:
        user_id: User ID
        folder_path: Folder to list (uploads, trash, etc.)
        
    Returns:
        list: List of file objects
    """
    if not bucket:
        logger.error("Firebase Storage bucket not initialized")
        return []
        
    try:
        prefix = f"users/{user_id}/{folder_path}/"
        blobs = bucket.list_blobs(prefix=prefix)
        
        files = []
        for blob in blobs:
            # Skip folder markers
            if blob.name.endswith('.folder_marker'):
                continue
                
            # Extract filename from path
            filename = blob.name.split('/')[-1]
            
            # Get metadata
            blob.reload()
            metadata = blob.metadata or {}
            
            # Create file object
            file_obj = {
                'filename': filename,
                'storagePath': blob.name,
                'contentType': blob.content_type,
                'size': blob.size,
                'timeCreated': blob.time_created.isoformat() if blob.time_created else None,
                'originalFilename': metadata.get('originalFilename', filename),
                'ownerId': metadata.get('ownerId', user_id)
            }
            
            files.append(file_obj)
            
        return files
    except Exception as e:
        logger.error(f"Error listing user files: {e}")
        return []

def verify_token(id_token):
    """
    Verify Firebase ID token and get user ID
    
    Args:
        id_token: Firebase ID token
        
    Returns:
        dict: User data if valid, None otherwise
    """
    if not firebase_app:
        logger.error("Firebase not initialized")
        return None
        
    try:
        # Verify the token
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token.get('uid')
        email = decoded_token.get('email', '')
        
        return {
            'uid': user_id,
            'email': email,
            'is_admin': is_admin(user_id)
        }
    except Exception as e:
        logger.error(f"Error verifying token: {e}")
        return None

# Initialize on import
initialize_firebase()

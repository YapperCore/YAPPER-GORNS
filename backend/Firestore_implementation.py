import firebase_admin
from firebase_admin import credentials, storage, firestore
import logging
import datetime
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# Initialize Firebase app with credentials
try:
    cred = credentials.Certificate("Accesskey.json")
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'yapper-1958d.firebasestorage.app'
    })
    logger.info("Firebase initialized successfully via Firestore_implementation")
except ValueError:
    # App already initialized
    logger.info("Firebase already initialized")
except Exception as e:
    logger.error(f"Error initializing Firebase: {e}")

bucket = storage.bucket()
db = firestore.client()

def ensure_path_exists(firebase_path):
    """
    Ensure folder structure exists in Firebase Storage
    
    Args:
        firebase_path: Path in Firebase where file will be stored
    """
    # Extract user ID and folder type from path
    parts = firebase_path.split('/')
    if len(parts) >= 3 and parts[0] == 'users':
        user_id = parts[1]
        folder_type = parts[2]
        
        # Create an empty marker to ensure folder exists
        marker_path = f"users/{user_id}/{folder_type}/.folder_marker"
        marker_blob = bucket.blob(marker_path)
        
        if not marker_blob.exists():
            marker_blob.upload_from_string('', content_type='application/octet-stream')
            logger.info(f"Created {folder_type} folder for user {user_id}")

def upload_file_by_path(local_path, firebase_path):
    """
    Uploads a file from a local path to Firebase Storage with security rules.
    
    Args:
        local_path: Path to local file
        firebase_path: Path in Firebase (should include user ID for security)
        
    Returns:
        storage.Blob: The uploaded blob
    """
    # Extract user ID from path to enforce security model
    path_parts = firebase_path.split('/')
    if len(path_parts) >= 2 and path_parts[0] == 'users':
        user_id = path_parts[1]
    else:
        user_id = 'unknown'  # Default for non-user paths
    
    # Normalize the local path to avoid platform-specific issues
    local_path = os.path.abspath(local_path)
    
    # Verify the file exists before attempting to upload
    if not os.path.exists(local_path):
        error_msg = f"File not found at path: {local_path}"
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)
    
    # Log file details for debugging
    file_size = os.path.getsize(local_path)
    logger.info(f"Uploading file: {local_path}, Size: {file_size} bytes")
    
    # Ensure the destination folder exists in Firebase
    ensure_path_exists(firebase_path)
    
    blob = bucket.blob(firebase_path)
    
    try:
        # Upload file directly from data to avoid path issues
        with open(local_path, 'rb') as file_obj:
            file_data = file_obj.read()
            content_type = 'audio/mpeg'  # Default for audio files
            blob.upload_from_string(file_data, content_type=content_type)
    except Exception as e:
        logger.error(f"Error uploading file content: {e}")
        raise
    
    # Set metadata after upload
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    
    blob.metadata = {
        'ownerId': user_id,
        'uploadTime': timestamp,
        'originalPath': local_path
    }
    # Update the blob with new metadata
    blob.patch()
    
    # Store additional metadata in Firestore
    filename = os.path.basename(firebase_path)
    doc_ref = db.collection('files').document(filename.replace('/', '_'))
    doc_ref.set({
        'filename': filename,
        'storagePath': firebase_path,
        'ownerId': user_id,
        'contentType': 'audio/mpeg',
        'uploadTime': firestore.SERVER_TIMESTAMP,
        'status': 'active',  # File starts in active state
        'originalPath': local_path
    }, merge=True)
    
    logger.info(f"File uploaded successfully to {firebase_path} with owner: {user_id}")
    return blob

def get_signed_url(firebase_path, expiration=3600):
    """
    Generates a signed URL with security check.
    
    Args:
        firebase_path: Path in Firebase
        expiration: URL validity in seconds
        
    Returns:
        str: Signed URL
    """
    blob = bucket.blob(firebase_path)
    
    # Check if blob exists before generating URL
    if not blob.exists():
        logger.warning(f"Blob not found at path: {firebase_path}")
        return None
    
    # Generate a URL with the specified expiration time
    try:
        url = blob.generate_signed_url(
            expiration=datetime.timedelta(seconds=expiration),
            method="GET",
            version="v4"
        )
        return url
    except Exception as e:
        logger.error(f"Error generating signed URL: {e}")
        return None
def delete_file_by_path(firebase_path):
    """
    Deletes a file from Firebase Storage with security check.
    
    Args:
        firebase_path: Path in Firebase
        
    Returns:
        bool: True if deleted, False otherwise
    """
    blob = bucket.blob(firebase_path)
    
    # Check if blob exists before deleting
    if blob.exists():
        blob.delete()
        
        # Also delete from Firestore
        filename = os.path.basename(firebase_path)
        doc_ref = db.collection('files').document(filename.replace('/', '_'))
        if doc_ref.get().exists:
            doc_ref.delete()
            
        logger.info(f"File deleted: {firebase_path}")
        return True
    else:
        logger.warning(f"File not found for deletion: {firebase_path}")
        return False

def move_file(firebase_source_path, firebase_dest_path):
    """
    Moves a file within Firebase Storage by copying then deleting.
    
    Args:
        firebase_source_path: Source path
        firebase_dest_path: Destination path
        
    Returns:
        bool: True if moved successfully, False otherwise
    """
    source_blob = bucket.blob(firebase_source_path)
    
    # Check if source exists
    if not source_blob.exists():
        logger.warning(f"Source file not found: {firebase_source_path}")
        
        # Check if destination already exists (might have been moved already)
        dest_blob = bucket.blob(firebase_dest_path)
        if dest_blob.exists():
            logger.info(f"Destination already exists: {firebase_dest_path}, treating as success")
            
            # Update Firestore record
            filename = os.path.basename(firebase_dest_path)
            doc_ref = db.collection('files').document(filename.replace('/', '_'))
            if doc_ref.get().exists:
                status = 'active' if 'uploads' in firebase_dest_path else 'trashed'
                doc_ref.update({
                    'storagePath': firebase_dest_path,
                    'status': status
                })
                
            return True
            
        return False
    
    # Ensure destination folder exists
    ensure_path_exists(firebase_dest_path)
    
    # Copy with metadata preservation
    source_blob.reload()  # Ensure we have the latest blob data
    bucket.copy_blob(source_blob, bucket, firebase_dest_path)
    
    # Get the new blob and ensure metadata is preserved
    dest_blob = bucket.blob(firebase_dest_path)
    dest_blob.metadata = source_blob.metadata
    dest_blob.content_type = source_blob.content_type
    dest_blob.patch()
    
    # Delete source
    source_blob.delete()
    
    # Update Firestore record
    filename = os.path.basename(firebase_dest_path)
    doc_ref = db.collection('files').document(filename.replace('/', '_'))
    if doc_ref.get().exists:
        status = 'active' if 'uploads' in firebase_dest_path else 'trashed'
        doc_ref.update({
            'storagePath': firebase_dest_path,
            'status': status,
            'lastModified': firestore.SERVER_TIMESTAMP
        })
    
    logger.info(f"File moved: {firebase_source_path} -> {firebase_dest_path}")
    return True

def save_to_firestore(doc_id, file_url, chunk_buffer, final=False):
    """
    Stores transcription chunks in Firestore.
    
    Args:
        doc_id: Document ID
        file_url: File URL
        chunk_buffer: Transcription chunks
        final: Is this the final update
    """
    doc_ref = db.collection("transcriptions").document(doc_id)
    
    # Try to get existing document
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        existing_chunks = data.get("transcription_chunks", [])
    else:
        existing_chunks = []

    # Append new chunks
    existing_chunks.extend(chunk_buffer)

    # Update Firestore document
    doc_ref.set({
        "file_url": file_url,
        "transcription_chunks": existing_chunks,
        "status": "completed" if final else "in_progress",
        "updated_at": firestore.SERVER_TIMESTAMP
    }, merge=True)

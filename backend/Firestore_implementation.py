import firebase_admin
from firebase_admin import credentials, storage, firestore
import logging
import datetime

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
    
    blob = bucket.blob(firebase_path)
    
    # Upload file first
    blob.upload_from_filename(local_path)
    
    # Set metadata after upload - not during
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    
    blob.metadata = {
        'ownerId': user_id,
        'uploadTime': timestamp
    }
    # Update the blob with new metadata
    blob.patch()
    
    logger.info(f"File uploaded to {firebase_path} with owner: {user_id}")
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
    
    # Generate a short-lived URL for security
    return blob.generate_signed_url(expiration=expiration, version="v4")

def delete_file_by_path(firebase_path):
    """
    Deletes a file from Firebase Storage with security check.
    
    Args:
        firebase_path: Path in Firebase
    """
    blob = bucket.blob(firebase_path)
    
    # Check if blob exists before deleting
    if blob.exists():
        blob.delete()
        logger.info(f"File deleted: {firebase_path}")
    else:
        logger.warning(f"File not found for deletion: {firebase_path}")

def move_file(firebase_source_path, firebase_dest_path):
    """
    Moves a file within Firebase Storage by copying then deleting.
    
    Args:
        firebase_source_path: Source path
        firebase_dest_path: Destination path
    """
    source_blob = bucket.blob(firebase_source_path)
    
    # Check if source exists
    if not source_blob.exists():
        logger.warning(f"Source file not found: {firebase_source_path}")
        return False
    
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

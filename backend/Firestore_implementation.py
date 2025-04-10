import firebase_admin
from firebase_admin import credentials, storage, firestore

# Initialize Firebase app with credentials
cred = credentials.Certificate("Accesskey.json")
firebase_admin.initialize_app(cred, {
    'storageBucket': 'yapper-1958d.firebasestorage.app'
})

bucket = storage.bucket()
db = firestore.client()

def upload_file_by_path(local_path, firebase_path):
    """
    Uploads a file from a local path to Firebase Storage at the specified firebase_path.
    """
    blob = bucket.blob(firebase_path)
    blob.upload_from_filename(local_path)
    # Do not make public; use signed URLs for secure access.
    return blob

def get_signed_url(firebase_path, expiration=3600):
    """
    Generates a signed URL for the file at firebase_path valid for a given number of seconds.
    """
    blob = bucket.blob(firebase_path)
    return blob.generate_signed_url(expiration=expiration)

def delete_file_by_path(firebase_path):
    """
    Deletes a file from Firebase Storage given its path.
    """
    blob = bucket.blob(firebase_path)
    blob.delete()

def move_file(firebase_source_path, firebase_dest_path):
    """
    Moves a file within Firebase Storage from source to destination by copying then deleting.
    """
    source_blob = bucket.blob(firebase_source_path)
    bucket.copy_blob(source_blob, bucket, firebase_dest_path)
    source_blob.delete()

def save_to_firestore(doc_id, file_url, chunk_buffer, final=False):
    """
    Stores transcription chunks in Firestore.
    
    - If `final` is False, appends transcription chunks incrementally.
    - If `final` is True, marks transcription as complete.
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
        "status": "completed" if final else "in_progress"
    }, merge=True)


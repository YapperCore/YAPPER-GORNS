import firebase_admin
from firebase_admin import credentials, storage, firestore




cred = credentials.Certificate("C:/CS3398SWE/yapper/Accesskey.json")
firebase_admin.initialize_app(cred, { 'storageBucket' : 'yapper-1958d.firebasestorage.app' })

bucket = storage.bucket()
db = firestore.client()


def upload_file(audio_file):
    """Uploads file to Firebase Storage without OAuth timeout issues."""
    blob = storage.bucket().blob(f"uploads/{audio_file.filename}")
    blob.upload_from_file(audio_file.stream, content_type=audio_file.content_type)
    blob.make_public()
    return blob.public_url

    


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
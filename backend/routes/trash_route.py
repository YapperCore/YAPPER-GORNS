# backend/routes/trash_route.py
import os
import logging
from flask import jsonify
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store
from firebase_helper import upload_file, delete_audio, is_admin_user
from auth_middleware import require_auth

logger = logging.getLogger(__name__)

@require_auth
def get_trash_files(user_id):
    """Get trash files with user access control"""
    try:
        # Get all files in trash
        all_trash_files = os.listdir(TRASH_FOLDER)
        
        # If user is admin, return all files
        if is_admin_user(user_id):
            return jsonify({"files": all_trash_files}), 200
            
        # For regular users, filter by ownership
        user_files = []
        for filename in all_trash_files:
            # Find which files belong to this user based on doc store
            for doc in doc_store.values():
                if (doc.get("audioFilename") == filename and 
                    doc.get("ownerId") == user_id):
                    user_files.append(filename)
                    break
                    
        return jsonify({"files": user_files}), 200
    except Exception as e:
        logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

@require_auth
def restore_file(user_id, filename):
    """Restore file from trash with ownership check"""
    # Check file ownership
    file_owner = None
    doc_id = None
    
    for doc_id, doc in doc_store.items():
        if doc.get("audioFilename") == filename:
            file_owner = doc.get("ownerId")
            doc_id = doc_id
            break
    
    # Verify ownership or admin status
    if file_owner and file_owner != user_id and not is_admin_user(user_id):
        return jsonify({"error": "Permission denied: You don't own this file"}), 403
    
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)
    
    if os.path.exists(trash_path):
        try:
            # Move file from trash to uploads
            os.rename(trash_path, upload_path)
            mark_doc_audio_trashed(filename, False)
            
            # Restore associated document
            if doc_id:
                doc = doc_store.get(doc_id)
                if doc:
                    doc["deleted"] = False
                    doc["audioTrashed"] = False
                    doc["restoredAt"] = datetime.now().isoformat()
                    doc["restoredBy"] = user_id
            
            save_doc_store()
            logger.info(f"File {filename} restored by user {user_id}")
            
            # Reupload to Firebase if needed
            if doc and doc.get("ownerId"):
                try:
                    with open(upload_path, 'rb') as file:
                        upload_file(file, doc.get("ownerId"))
                except Exception as e:
                    logger.error(f"Error re-uploading to Firebase: {e}")
            
            return jsonify({"message": "File restored"}), 200
        except Exception as e:
            logger.error(f"Error restoring file: {e}")
            return jsonify({"error": "Failed to restore file"}), 500
    else:
        return jsonify({"message": "File not found in trash"}), 404

@require_auth
def get_upload_files(user_id):
    """Get uploaded files with user access control"""
    try:
        # Get all files in uploads folder
        all_upload_files = os.listdir(UPLOAD_FOLDER)
        
        # If user is admin, return all files
        if is_admin_user(user_id):
            return jsonify({"files": all_upload_files}), 200
            
        # For regular users, filter by ownership
        user_files = []
        for filename in all_upload_files:
            # Find which files belong to this user based on doc store
            for doc in doc_store.values():
                if (doc.get("audioFilename") == filename and 
                    doc.get("ownerId") == user_id):
                    user_files.append(filename)
                    break
                    
        return jsonify({"files": user_files}), 200
    except Exception as e:
        logger.error(f"Error listing uploads: {e}")
        return jsonify({"error": "Error listing uploads"}), 500

@require_auth
def perm_delete_files(user_id, filename):
    """Permanently delete a file with ownership check"""
    # Check file ownership
    file_owner = None
    doc_ids = []
    
    for doc_id, doc in doc_store.items():
        if doc.get("audioFilename") == filename:
            file_owner = doc.get("ownerId")
            doc_ids.append(doc_id)
    
    # Verify ownership or admin status
    if file_owner and file_owner != user_id and not is_admin_user(user_id):
        return jsonify({"error": "Permission denied: You don't own this file"}), 403
    
    trash_path = os.path.join(TRASH_FOLDER, filename)
    
    if os.path.exists(trash_path):
        try:
            # Delete local file
            os.remove(trash_path)
            
            # Remove references in doc store
            for doc_id in doc_ids:
                del doc_store[doc_id]
            
            # Delete from Firebase if needed
            firebase_filename = None
            for doc in doc_store.values():
                if doc.get("audioFilename") == filename and doc.get("firebase_filename"):
                    firebase_filename = doc.get("firebase_filename")
                    break
                    
            if firebase_filename:
                delete_audio(firebase_filename, user_id)
            
            save_doc_store()
            logger.info(f"File {filename} permanently deleted by user {user_id}")
            
            return jsonify({"message": "File permanently deleted"}), 200
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return jsonify({"error": "Failed to delete file"}), 500
    else:
        return jsonify({"message": "File not found in trash"}), 404

def mark_doc_audio_trashed(filename, is_trashed):
    """Mark document audio as trashed/not trashed"""
    changed = False
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            doc["audioTrashed"] = is_trashed
            changed = True
    if changed:
        save_doc_store()
# backend/app.py or backend/routes/trash_route.py
@app.route('/delete_file/<filename>', methods=['DELETE'])
def permanently_delete_file(filename):
    """Permanently delete a file from trash"""
    try:
        trash_path = os.path.join(TRASH_FOLDER, filename)
        
        if not os.path.exists(trash_path):
            return jsonify({"message": "File not found in trash"}), 404
            
        # Remove the file
        os.remove(trash_path)
        
        # Remove any references in the doc store
        affected_docs = []
        for doc_id, doc in list(doc_store.items()):
            if doc.get("audioFilename") == filename:
                affected_docs.append(doc_id)
        
        # Delete the documents or just remove references
        for doc_id in affected_docs:
            del doc_store[doc_id]
            
        save_doc_store()
        
        # If Firebase is available, delete from there too
        if firebase_available and 'delete_audio' in globals():
            try:
                delete_audio(filename)
            except Exception as e:
                logger.error(f"Error deleting from Firebase: {e}")
        
        return jsonify({"message": "File permanently deleted"}), 200
    except Exception as e:
        logger.error(f"Error permanently deleting file: {e}")
        return jsonify({"error": f"Error deleting file: {str(e)}"}), 500

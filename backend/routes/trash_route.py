# backend/routes/trash_route.py
import os
import logging
from flask import jsonify, request, Blueprint
<<<<<<< HEAD
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store
from services.firebase_service import move_file, delete_file, get_file_url, check_blob_exists, list_user_files
from auth import verify_firebase_token, is_admin
=======
from backend.config import UPLOAD_FOLDER, TRASH_FOLDER
from backend.services.storage import save_doc_store, doc_store
from backend.services.firebase_service import move_file, delete_file, get_file_url
from backend.auth import verify_firebase_token, is_admin
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui

logger = logging.getLogger(__name__)

trash_bp = Blueprint('trash', __name__)

@trash_bp.route('/trash-files', methods=['GET'])
@verify_firebase_token
def get_trash_files():
    """List files in trash for the authenticated user"""
    try:
<<<<<<< HEAD
        # Get trashed files from Firebase first
        firebase_files = list_user_files(request.uid, "trash")
        firebase_filenames = [file['filename'].split('/')[-1] for file in firebase_files]

        # Also get trashed files from doc_store for this user to ensure we catch everything
        doc_store_trashed = [
            doc["audioFilename"] for doc in doc_store.values() 
            if doc.get("audioTrashed") and doc.get("audioFilename") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]

        # Combine both sources (use set to avoid duplicates)
        all_files = list(set(firebase_filenames + doc_store_trashed))

        # Filter out files that no longer exist in Firebase or locally
        valid_files = [
            file for file in all_files
            if file in firebase_filenames or os.path.exists(os.path.join(TRASH_FOLDER, file))
        ]

        # Update doc_store to ensure consistency
        for doc in doc_store.values():
            if doc.get("audioFilename") in valid_files and not doc.get("audioTrashed"):
                # File is in trash but not marked as trashed in doc_store
                doc["audioTrashed"] = True
                logger.info(f"Updated doc_store to mark {doc.get('audioFilename')} as trashed")

        save_doc_store()
        return jsonify({"files": valid_files}), 200
=======
        # Get trashed files from doc_store for this user
        trashed_files = [
            doc["audioFilename"] for doc in doc_store.values() 
            if doc.get("audioTrashed") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        return jsonify({"files": trashed_files}), 200
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    except Exception as e:
        logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

@trash_bp.route('/restore_file/<filename>', methods=['GET'])
@verify_firebase_token
def restore_file(filename):
    """Restore a file from trash to uploads"""
<<<<<<< HEAD
    found_doc = False
    restored_file = False
    uid = request.uid
    
    # First try to move file in Firebase from trash to uploads
    trash_path = f"users/{uid}/trash/{filename}"
    upload_path = f"users/{uid}/uploads/{filename}"
    
    firebase_moved = False
    local_moved = False
    
    try:
        # Check if file exists in Firebase trash
        if check_blob_exists(trash_path):
            # Move file in Firebase
            firebase_moved = move_file(trash_path, upload_path, uid)
            logger.info(f"Firebase move result for {filename}: {firebase_moved}")
        
        # Try local file restore regardless of Firebase result
        try:
            # Move local file if it exists
            trash_local_path = os.path.join(TRASH_FOLDER, filename)
            upload_local_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(trash_local_path):
                os.makedirs(os.path.dirname(upload_local_path), exist_ok=True)
                os.rename(trash_local_path, upload_local_path)
                local_moved = True
                logger.info(f"Restored file locally: {filename}")
        except Exception as local_err:
            logger.error(f"Error restoring local file: {local_err}")
        
        # Check if file is already in uploads directory (might have been restored already)
        file_in_uploads = check_blob_exists(upload_path) or os.path.exists(os.path.join(UPLOAD_FOLDER, filename))
        
        restored_file = firebase_moved or local_moved or file_in_uploads
        
        # Update all matching documents in doc_store
        for doc in doc_store.values():
            if doc.get("audioFilename") == filename:
                found_doc = True
                
                # Check permission
                if doc.get("owner") != request.uid and not is_admin(request.uid):
                    return jsonify({"error": "Access denied"}), 403
                
                # Update document status if file was restored or is already in uploads
                if restored_file:
                    # Mark file as not trashed
                    doc["audioTrashed"] = False
                    
                    # Also ensure the document is not marked as deleted
                    if doc.get("deleted", False):
                        doc["deleted"] = False
                        logger.info(f"Unmarked doc as deleted for file: {filename}")
                    
                    # Update file URL if in Firebase
                    file_url = get_file_url(upload_path)
                    if file_url:
                        doc["firebaseUrl"] = file_url
                    
                    logger.info(f"Updated doc_store for restored file: {filename}")
        
        # Save doc_store after all updates
        if found_doc and restored_file:
            save_doc_store()
            logger.info(f"Saved doc_store after restoring file: {filename}")
            return jsonify({"message": "File restored"}), 200
        
        # Handle orphaned files (files without associated docs)
        if not found_doc and restored_file:
            # Create a new document entry for the restored orphaned file
            doc_id = str(uuid.uuid4())
            original_filename = filename.split('_', 2)[-1] if '_' in filename else filename  # Try to extract original name
            
            new_doc = {
                "id": doc_id,
                "name": f"Restored-{original_filename}",
                "content": "",
                "audioFilename": filename,
                "originalFilename": original_filename,
                "audioTrashed": False,
                "deleted": False,
                "owner": uid,
                "firebaseUrl": get_file_url(upload_path),
                "firebasePath": upload_path
            }
            
            doc_store[doc_id] = new_doc
            save_doc_store()
            logger.info(f"Created new doc for orphaned restored file: {filename}")
            return jsonify({"message": "File restored and new document created"}), 200
        
        # If file couldn't be found in trash or uploads
        if not restored_file:
            logger.error(f"Failed to restore file: {filename} - File not found in trash or uploads")
            return jsonify({"error": "Failed to restore file - not found in trash"}), 404
            
    except Exception as e:
        logger.error(f"Error restoring file: {e}")
        import traceback
        logger.error(f"Restore error details: {traceback.format_exc()}")
        return jsonify({"error": "Failed to restore file", "details": str(e)}), 500
    
    # Fallback for edge cases
=======
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            # Check permission
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            uid = doc.get("owner")
            trash_path = f"users/{uid}/trash/{filename}"
            upload_path = f"users/{uid}/uploads/{filename}"
            
            try:
                # Always allow users to restore their own files
                if move_file(trash_path, upload_path, request.uid):
                    doc["audioTrashed"] = False
                    
                    # Update file URL
                    file_url = get_file_url(upload_path)
                    if file_url:
                        doc["firebaseUrl"] = file_url
                        
                    # Also restore the document if it was deleted
                    doc["deleted"] = False
                    save_doc_store()
                    
                    logger.info(f"Restored file: {filename}")
                    return jsonify({"message": "File restored"}), 200
                else:
                    logger.error(f"Failed to restore file from Firebase: {filename}")
                    
                    # Fall back to local restore if available
                    try:
                        # Move local file if it exists
                        trash_local_path = os.path.join(TRASH_FOLDER, filename)
                        upload_local_path = os.path.join(UPLOAD_FOLDER, filename)
                        if os.path.exists(trash_local_path):
                            os.makedirs(os.path.dirname(upload_local_path), exist_ok=True)
                            os.rename(trash_local_path, upload_local_path)
                            doc["audioTrashed"] = False
                            doc["deleted"] = False
                            save_doc_store()
                            logger.info(f"Restored file locally: {filename}")
                            return jsonify({"message": "File restored locally"}), 200
                    except Exception as local_err:
                        logger.error(f"Error restoring local file: {local_err}")
                    
                    return jsonify({"error": "Failed to restore file"}), 500
            except Exception as e:
                logger.error(f"Error restoring file: {e}")
                return jsonify({"error": "Failed to restore file", "details": str(e)}), 500
                
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    return jsonify({"message": "File not found in trash"}), 404

@trash_bp.route('/upload-files', methods=['GET'])
@verify_firebase_token
def get_upload_files():
    """List uploaded (non-trashed) files for the authenticated user"""
    try:
<<<<<<< HEAD
        # Get files from Firebase first
        firebase_files = list_user_files(request.uid, "uploads")
        firebase_filenames = [file['filename'] for file in firebase_files]
        
        # Also get files from doc_store for this user
        doc_store_uploads = [
            doc["audioFilename"] for doc in doc_store.values() 
            if not doc.get("audioTrashed") and doc.get("audioFilename") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        
        # Combine both sources (use set to avoid duplicates)
        all_files = list(set(firebase_filenames + doc_store_uploads))
        
        # Ensure consistency between Firebase and doc_store
        for doc in doc_store.values():
            if doc.get("audioFilename") in all_files and doc.get("audioTrashed"):
                # File is in uploads but marked as trashed in doc_store - fix it
                doc["audioTrashed"] = False
                logger.info(f"Updated doc_store to mark {doc.get('audioFilename')} as not trashed")
        
        save_doc_store()
        return jsonify({"files": all_files}), 200
=======
        upload_files = [
            doc["audioFilename"] for doc in doc_store.values() 
            if not doc.get("audioTrashed") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        return jsonify({"files": upload_files}), 200
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    except Exception as e:
        logger.error(f"Error listing uploads: {e}")
        return jsonify({"error": "Error listing uploads"}), 500

def mark_doc_audio_trashed(filename, is_trashed):
    """Mark a document's audio as trashed or not"""
    global doc_store
    changed = False
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            doc["audioTrashed"] = is_trashed
            changed = True
    if changed:
        save_doc_store()

@trash_bp.route('/perm_delete_files/<filename>', methods=['DELETE'])
@verify_firebase_token
def perm_delete_files(filename):
    """Permanently delete a file from trash"""
    try:
<<<<<<< HEAD
        found_doc = False
        uid = request.uid
        trash_path = f"users/{uid}/trash/{filename}"
        
        # Try to delete from Firebase first
        firebase_success = delete_file(trash_path, request.uid)
        
        # Then try to delete local file if it exists
        local_success = False
        try:
            local_trash_path = os.path.join(TRASH_FOLDER, filename)
            if os.path.exists(local_trash_path):
                os.remove(local_trash_path)
                local_success = True
                logger.info(f"Deleted local file: {local_trash_path}")
        except Exception as local_err:
            logger.error(f"Error deleting local file: {local_err}")
        
        # Process all documents that might reference this file
        for doc_id, doc in list(doc_store.items()):
            if doc.get("audioFilename") == filename:
                found_doc = True
                # Check permission
                if doc.get("owner") != request.uid and not is_admin(request.uid):
                    return jsonify({"error": "Access denied"}), 403
                
                # If either deletion was successful, remove from doc store or clear references
                if firebase_success or local_success:
                    # Remove the doc from store
                    del doc_store[doc_id]
                
        # Save changes
        if found_doc and (firebase_success or local_success):
            save_doc_store()
            logger.info(f"Permanently deleted file: {filename}")
            return jsonify({"message": "File permanently deleted"}), 200
        elif firebase_success or local_success:
            # File was deleted but no doc found
            logger.info(f"Deleted orphaned file: {filename}")
            return jsonify({"message": "Orphaned file permanently deleted"}), 200
        else:
            logger.error(f"Failed to delete file: {filename}")
            return jsonify({"error": "Failed to delete file"}), 500
            
    except Exception as e:
        logger.error(f"Error in perm_delete_files: {e}")
        import traceback
        logger.error(f"Delete error details: {traceback.format_exc()}")
=======
        for doc_id, doc in list(doc_store.items()):
            if doc.get("audioFilename") == filename:
                # Check permission
                if doc.get("owner") != request.uid and not is_admin(request.uid):
                    return jsonify({"error": "Access denied"}), 403
                    
                uid = doc.get("owner")
                trash_path = f"users/{uid}/trash/{filename}"
                
                # Try to delete from Firebase first
                firebase_success = delete_file(trash_path, request.uid)
                
                # Then try to delete local file if it exists
                local_success = False
                try:
                    local_trash_path = os.path.join(TRASH_FOLDER, filename)
                    if os.path.exists(local_trash_path):
                        os.remove(local_trash_path)
                        local_success = True
                        logger.info(f"Deleted local file: {local_trash_path}")
                except Exception as local_err:
                    logger.error(f"Error deleting local file: {local_err}")
                
                # If either deletion was successful, remove from doc store
                if firebase_success or local_success:
                    # Remove the doc from store
                    del doc_store[doc_id]
                    save_doc_store()
                    
                    logger.info(f"Permanently deleted file: {filename}")
                    return jsonify({"message": "File permanently deleted"}), 200
                else:
                    return jsonify({"error": "Failed to delete file"}), 500
                    
        return jsonify({"message": "File not found in trash"}), 404
    except Exception as e:
        logger.error(f"Error in perm_delete_files: {e}")
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@trash_bp.route('/mark_file_trashed/<filename>', methods=['PUT'])
@verify_firebase_token
def mark_file_trashed(filename):
    """Move a file to trash"""
<<<<<<< HEAD
    found_doc = False
    uid = request.uid
    upload_path = f"users/{uid}/uploads/{filename}"
    trash_path = f"users/{uid}/trash/{filename}"
    
    # Check if any document references this file and verify permissions
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            found_doc = True
            # Check permission
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
    
    try:
        # Always allow users to trash their own files
        firebase_moved = False
        
        # Check if file exists in Firebase uploads
        if check_blob_exists(upload_path):
            firebase_moved = move_file(upload_path, trash_path, request.uid)
            logger.info(f"Firebase trash result for {filename}: {firebase_moved}")
        
        # Also try to move local file if it exists
        local_moved = False
        try:
            local_upload_path = os.path.join(UPLOAD_FOLDER, filename)
            local_trash_path = os.path.join(TRASH_FOLDER, filename)
            if os.path.exists(local_upload_path):
                os.makedirs(os.path.dirname(local_trash_path), exist_ok=True)
                os.rename(local_upload_path, local_trash_path)
                local_moved = True
                logger.info(f"Moved local file to trash: {filename}")
        except Exception as local_err:
            logger.error(f"Error moving local file to trash: {local_err}")
        
        # Update all document references to this file
        updated_docs = False
        for doc in doc_store.values():
            if doc.get("audioFilename") == filename:
                doc["audioTrashed"] = True
                updated_docs = True
                
        # Save changes if any doc was updated or the file was moved
        if updated_docs:
            save_doc_store()
            
        if firebase_moved or local_moved or updated_docs:
            logger.info(f"Moved file to trash: {filename}")
            return jsonify({"message": "File moved to trash"}), 200
        else:
            # Check if file is already in trash
            if check_blob_exists(trash_path) or os.path.exists(os.path.join(TRASH_FOLDER, filename)):
                # File is already in trash, just update doc_store
                for doc in doc_store.values():
                    if doc.get("audioFilename") == filename:
                        doc["audioTrashed"] = True
                save_doc_store()
                logger.info(f"File already in trash, updated doc_store: {filename}")
                return jsonify({"message": "File already in trash"}), 200
                
            # Log error but don't raise exception
            logger.error(f"Failed to move file to trash: {filename}")
            return jsonify({"error": "Failed to move file to trash"}), 500
    except Exception as e:
        logger.error(f"Error moving file to trash: {e}")
        import traceback
        logger.error(f"Trash error details: {traceback.format_exc()}")
        return jsonify({"error": "Failed to move file to trash", "details": str(e)}), 500
                
    # Fallback for edge cases
=======
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            # Check permission
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            uid = doc.get("owner")
            upload_path = f"users/{uid}/uploads/{filename}"
            trash_path = f"users/{uid}/trash/{filename}"
            
            try:
                # Always allow users to trash their own files
                firebase_moved = move_file(upload_path, trash_path, request.uid)
                
                # Also try to move local file if it exists
                local_moved = False
                try:
                    local_upload_path = os.path.join(UPLOAD_FOLDER, filename)
                    local_trash_path = os.path.join(TRASH_FOLDER, filename)
                    if os.path.exists(local_upload_path):
                        os.makedirs(os.path.dirname(local_trash_path), exist_ok=True)
                        os.rename(local_upload_path, local_trash_path)
                        local_moved = True
                        logger.info(f"Moved local file to trash: {filename}")
                except Exception as local_err:
                    logger.error(f"Error moving local file to trash: {local_err}")
                
                # Update document status if either operation succeeded
                if firebase_moved or local_moved:
                    doc["audioTrashed"] = True
                    save_doc_store()
                    
                    logger.info(f"Moved file to trash: {filename}")
                    return jsonify({"message": "File moved to trash"}), 200
                else:
                    # Log error but don't raise exception so we keep trying to move local file
                    logger.error(f"Failed to move file to trash: {filename}")
                    return jsonify({"error": "Failed to move file to trash"}), 500
            except Exception as e:
                logger.error(f"Error moving file to trash: {e}")
                return jsonify({"error": "Failed to move file to trash", "details": str(e)}), 500
                
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui
    return jsonify({"message": "File not found"}), 404

def register_trash_routes(app):
    """Register trash routes with Flask app"""
    app.register_blueprint(trash_bp)
<<<<<<< HEAD
    
    # Import here to avoid circular imports
    import uuid
=======
>>>>>>> origin/feature/SCRUM-85-implement-chosen-new-ui

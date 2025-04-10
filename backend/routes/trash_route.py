# backend/routes/trash_route.py
import os
import logging
from flask import jsonify, request, Blueprint
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store
from services.firebase_service import move_file, delete_file, get_file_url
from auth import verify_firebase_token, is_admin

logger = logging.getLogger(__name__)

trash_bp = Blueprint('trash', __name__)

@trash_bp.route('/trash-files', methods=['GET'])
@verify_firebase_token
def get_trash_files():
    """List files in trash for the authenticated user"""
    try:
        # Get trashed files from doc_store for this user
        trashed_files = [
            doc["audioFilename"] for doc in doc_store.values() 
            if doc.get("audioTrashed") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        return jsonify({"files": trashed_files}), 200
    except Exception as e:
        logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

@trash_bp.route('/restore_file/<filename>', methods=['GET'])
@verify_firebase_token
def restore_file(filename):
    """Restore a file from trash to uploads"""
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            # Check permission
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            uid = doc.get("owner")
            trash_path = f"users/{uid}/trash/{filename}"
            upload_path = f"users/{uid}/uploads/{filename}"
            
            try:
                # Move in Firebase with permission check
                if move_file(trash_path, upload_path, request.uid):
                    doc["audioTrashed"] = False
                    
                    # Update file URL
                    file_url = get_file_url(upload_path, request.uid)
                    if file_url:
                        doc["firebaseUrl"] = file_url
                        
                    # Also restore the document if it was deleted
                    doc["deleted"] = False
                    save_doc_store()
                    
                    logger.info(f"Restored file: {filename}")
                    return jsonify({"message": "File restored"}), 200
                else:
                    return jsonify({"error": "Permission denied or file not found"}), 403
            except Exception as e:
                logger.error(f"Error restoring file: {e}")
                return jsonify({"error": "Failed to restore file", "details": str(e)}), 500
                
    return jsonify({"message": "File not found in trash"}), 404

@trash_bp.route('/upload-files', methods=['GET'])
@verify_firebase_token
def get_upload_files():
    """List uploaded (non-trashed) files for the authenticated user"""
    try:
        upload_files = [
            doc["audioFilename"] for doc in doc_store.values() 
            if not doc.get("audioTrashed") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        return jsonify({"files": upload_files}), 200
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
        for doc_id, doc in list(doc_store.items()):
            if doc.get("audioFilename") == filename:
                # Check permission
                if doc.get("owner") != request.uid and not is_admin(request.uid):
                    return jsonify({"error": "Access denied"}), 403
                    
                uid = doc.get("owner")
                trash_path = f"users/{uid}/trash/{filename}"
                
                try:
                    # Delete from Firebase with permission check
                    if delete_file(trash_path, request.uid):
                        # Remove the doc from store
                        del doc_store[doc_id]
                        save_doc_store()
                        
                        logger.info(f"Permanently deleted file: {filename}")
                        return jsonify({"message": "File permanently deleted"}), 200
                    else:
                        return jsonify({"error": "Permission denied or file not found"}), 403
                except Exception as e:
                    logger.error(f"Error deleting file: {e}")
                    return jsonify({"error": "Failed to delete file", "details": str(e)}), 500
                    
        return jsonify({"message": "File not found in trash"}), 404
    except Exception as e:
        logger.error(f"Error in perm_delete_files: {e}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@trash_bp.route('/mark_file_trashed/<filename>', methods=['PUT'])
@verify_firebase_token
def mark_file_trashed(filename):
    """Move a file to trash"""
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            # Check permission
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
                
            uid = doc.get("owner")
            upload_path = f"users/{uid}/uploads/{filename}"
            trash_path = f"users/{uid}/trash/{filename}"
            
            try:
                # Move in Firebase with permission check
                if move_file(upload_path, trash_path, request.uid):
                    doc["audioTrashed"] = True
                    save_doc_store()
                    
                    logger.info(f"Moved file to trash: {filename}")
                    return jsonify({"message": "File moved to trash"}), 200
                else:
                    return jsonify({"error": "Permission denied or file not found"}), 403
            except Exception as e:
                logger.error(f"Error moving file to trash: {e}")
                return jsonify({"error": "Failed to move file to trash", "details": str(e)}), 500
                
    return jsonify({"message": "File not found"}), 404

def register_trash_routes(app):
    """Register trash routes with Flask app"""
    app.register_blueprint(trash_bp)

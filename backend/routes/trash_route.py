# backend/routes/trash_route.py
import os
import logging
from flask import jsonify, request
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store
from auth import verify_firebase_token, is_admin
from Firestore_implementation import move_file, delete_file_by_path, get_signed_url

logger = logging.getLogger(__name__)

@verify_firebase_token
def get_trash_files():
    try:
        # List trashed files from doc_store that belong to the authenticated user.
        trashed_files = [
            doc["audioFilename"] for doc in doc_store.values() 
            if doc.get("audioTrashed") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        return jsonify({"files": trashed_files}), 200
    except Exception as e:
        logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

@verify_firebase_token
def restore_file(filename):
    # Restore a file from Firebase trash back to uploads for the user.
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            uid = doc.get("owner")
            trash_path = f"users/{uid}/trash/{filename}"
            upload_path = f"users/{uid}/uploads/{filename}"
            try:
                move_file(trash_path, upload_path)
                doc["audioTrashed"] = False
                # Update firebaseUrl after restore.
                file_url = get_signed_url(upload_path)
                doc["firebaseUrl"] = file_url
                # Also restore the document if it was marked as deleted.
                doc["deleted"] = False
                save_doc_store()
                logger.info(f"Restored file: {filename}")
                return jsonify({"message": "File restored"}), 200
            except Exception as e:
                logger.error(f"Error restoring file: {e}")
                return jsonify({"error": "Failed to restore file", "details": str(e)}), 500
    return jsonify({"message": "File not found in trash"}), 404

@verify_firebase_token
def get_upload_files():
    try:
        # List uploaded (non-trashed) files for the authenticated user.
        upload_files = [
            doc["audioFilename"] for doc in doc_store.values() 
            if not doc.get("audioTrashed") and (doc.get("owner") == request.uid or is_admin(request.uid))
        ]
        return jsonify({"files": upload_files}), 200
    except Exception as e:
        logger.error(f"Error listing uploads: {e}")
        return jsonify({"error": "Error listing uploads"}), 500

@verify_firebase_token
def mark_doc_audio_trashed(filename, is_trashed):
    global doc_store
    changed = False
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            doc["audioTrashed"] = is_trashed
            changed = True
    if changed:
        save_doc_store()

@verify_firebase_token
def perm_delete_files(filename):
    # Permanently delete a file from Firebase trash for the authenticated user.
    try:
        for doc_id, doc in list(doc_store.items()):
            if doc.get("audioFilename") == filename:
                if doc.get("owner") != request.uid and not is_admin(request.uid):
                    return jsonify({"error": "Access denied"}), 403
                uid = doc.get("owner")
                trash_path = f"users/{uid}/trash/{filename}"
                try:
                    delete_file_by_path(trash_path)
                    # Remove the doc from the in‑memory store.
                    del doc_store[doc_id]
                    save_doc_store()
                    logger.info(f"Permanently deleted file: {filename}")
                    return jsonify({"message": "File permanently deleted"}), 200
                except Exception as e:
                    logger.error(f"Error deleting file: {e}")
                    return jsonify({"error": "Failed to delete file", "details": str(e)}), 500
        return jsonify({"message": "File not found in trash"}), 404
    except Exception as e:
        logger.error(f"Error in perm_delete_files: {e}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@verify_firebase_token
def mark_file_trashed(filename):
    """
    Move a file to the trash folder in Firebase Storage.
    """
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            if doc.get("owner") != request.uid and not is_admin(request.uid):
                return jsonify({"error": "Access denied"}), 403
            uid = doc.get("owner")
            upload_path = f"users/{uid}/uploads/{filename}"
            trash_path = f"users/{uid}/trash/{filename}"
            try:
                move_file(upload_path, trash_path)
                doc["audioTrashed"] = True
                save_doc_store()
                logger.info(f"Moved file to trash: {filename}")
                return jsonify({"message": "File moved to trash"}), 200
            except Exception as e:
                logger.error(f"Error moving file to trash: {e}")
                return jsonify({"error": "Failed to move file to trash", "details": str(e)}), 500
    return jsonify({"message": "File not found"}), 404

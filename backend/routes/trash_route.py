import os
import logging
from flask import jsonify # type: ignore
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store

logger = logging.getLogger(__name__)

def get_trash_files():
    try:
        files = os.listdir(TRASH_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500


def restore_file(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(trash_path):
        os.rename(trash_path, upload_path)
        mark_doc_audio_trashed(filename, False)
        # Also, if a doc referenced this file and was marked as deleted,
        # we can restore it (set deleted = False) so it shows in docs.
        for doc in doc_store.values():
            if doc.get("audioFilename") == filename:
                doc["deleted"] = False
                doc["audioTrashed"] = False
        save_doc_store()
        logger.info(f"Restored file: {filename}")
        return jsonify({"message": "File restored"}), 200
    else:
        return jsonify({"message": "File not found in trash"}), 404


def get_upload_files():
    try:
        files = os.listdir(UPLOAD_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        logger.error(f"Error listing uploads: {e}")
        return jsonify({"error": "Error listing uploads"}), 500

def mark_doc_audio_trashed(filename, is_trashed):
    global doc_store
    changed = False
    for doc in doc_store.values():
        if doc.get("audioFilename") == filename:
            doc["audioTrashed"] = is_trashed
            changed = True
    if changed:
        save_doc_store()

def perm_delete_files(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    if os.path.exists(trash_path):
        try:
            os.remove(trash_path)
            
            # Firebase integration: Remove references to the file in the database
            # TODO: Replace this loop with Firebase database deletion logic
            for doc_id, doc in list(doc_store.items()):
                if doc.get("audioFilename") == filename:
                    del doc_store[doc_id]
            
            # TODO: Save changes to Firebase database
            # Replace save_doc_store() with Firebase-specific save logic
            save_doc_store()

            logger.info(f"Permanently deleted file: {filename}")
            return jsonify({"message": "File permanently deleted"}), 200
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return jsonify({"error": "Failed to delete file"}), 500
    else:
        return jsonify({"message": "File not found in trash"}), 404

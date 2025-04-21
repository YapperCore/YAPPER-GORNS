import logging
import uuid
from flask import jsonify, request, Blueprint
from services.firebase_service import move_file, delete_file, check_blob_exists, list_user_files
from auth import verify_firebase_token

logger = logging.getLogger(__name__)

trash_bp = Blueprint('trash', __name__)

@trash_bp.route('/trash-files', methods=['GET'])
@verify_firebase_token
def get_trash_files():
    """List files in trash for the authenticated user"""
    try:
        # Get trashed files from Firebase
        firebase_files = list_user_files(request.uid, "trash")
        firebase_filenames = [file['filename'].split('/')[-1] for file in firebase_files]

        return jsonify({"files": firebase_filenames}), 200
    except Exception as e:
        logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

@trash_bp.route('/restore_file/<filename>', methods=['GET'])
@verify_firebase_token
def restore_file(filename):
    """Restore a file from trash to uploads"""
    uid = request.uid
    trash_path = f"users/{uid}/trash/{filename}"
    upload_path = f"users/{uid}/uploads/{filename}"

    try:
        if check_blob_exists(trash_path):
            restored_file = move_file(trash_path, upload_path, uid)
            if restored_file:
                logger.info(f"File restored to uploads: {upload_path}")
                return jsonify({"message": "File restored"}), 200
            else:
                logger.error(f"Failed to restore file: {filename}")
                return jsonify({"error": "Failed to restore file"}), 500
        else:
            logger.error(f"File not found in trash: {filename}")
            return jsonify({"error": "File not found in trash"}), 404
    except Exception as e:
        logger.error(f"Error restoring file: {e}")
        return jsonify({"error": "Failed to restore file"}), 500

@trash_bp.route('/upload-files', methods=['GET'])
@verify_firebase_token
def get_upload_files():
    """List uploaded (non-trashed) files for the authenticated user"""
    try:
        # Get files from Firebase
        firebase_files = list_user_files(request.uid, "uploads")
        firebase_filenames = [file['filename'] for file in firebase_files]

        return jsonify({"files": firebase_filenames}), 200
    except Exception as e:
        logger.error(f"Error listing uploads: {e}")
        return jsonify({"error": "Error listing uploads"}), 500

@trash_bp.route('/perm_delete_files/<filename>', methods=['DELETE'])
@verify_firebase_token
def perm_delete_files(filename):
    """Permanently delete a file from trash"""
    uid = request.uid
    trash_path = f"users/{uid}/trash/{filename}"

    try:
        if delete_file(trash_path, uid):
            logger.info(f"Permanently deleted file: {filename}")
            return jsonify({"message": "File permanently deleted"}), 200
        else:
            logger.error(f"Failed to delete file: {filename}")
            return jsonify({"error": "Failed to delete file"}), 500
    except Exception as e:
        logger.error(f"Error in perm_delete_files: {e}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

@trash_bp.route('/mark_file_trashed/<filename>', methods=['PUT'])
@verify_firebase_token
def mark_file_trashed(filename):
    """Move a file to trash"""
    uid = request.uid
    upload_path = f"users/{uid}/uploads/{filename}"
    trash_path = f"users/{uid}/trash/{filename}"

    try:
        # Check if file exists in Firebase uploads
        if check_blob_exists(upload_path):
            firebase_moved = move_file(upload_path, trash_path, request.uid)
            if firebase_moved:
                logger.info(f"Moved file to trash: {filename}")
                return jsonify({"message": "File moved to trash"}), 200
            else:
                logger.error(f"Failed to move file to trash: {filename}")
                return jsonify({"error": "Failed to move file to trash"}), 500
        else:
            logger.error(f"File not found in uploads: {filename}")
            return jsonify({"error": "File not found in uploads"}), 404
    except Exception as e:
        logger.error(f"Error moving file to trash: {e}")
        return jsonify({"error": "Failed to move file to trash", "details": str(e)}), 500

def register_trash_routes(app):
    """Register trash routes with Flask app"""
    app.register_blueprint(trash_bp)
    
    # Import here to avoid circular imports
    import uuid

from flask import Blueprint, jsonify, request
from firebase_admin import storage
from auth import verify_firebase_token  # Assuming you already have this
from services.firebase_service import list_user_files  # Use Firebase for all operations
import logging

folders_bp = Blueprint('folders', __name__)
logger = logging.getLogger(__name__)

@folders_bp.route('/api/folders', methods=['POST'])
@verify_firebase_token
def create_folder():
    """Create a folder and a separate .{folder_name} file in Firebase Storage."""
    user_id = request.uid
    data = request.get_json()
    folder_name = data.get('folderName')

    if not folder_name:
        return jsonify({"error": "Folder name is required"}), 400

    try:
        bucket = storage.bucket()
        
        # Correctly prefix the paths with the user-specific path
        folder_path = f"users/{user_id}/folders/{folder_name}/"
        folder_blob = bucket.blob(folder_path)
        folder_blob.upload_from_string("", content_type="text/plain")  # Empty .keep file

        dot_file_path = f"users/{user_id}/folders/.{folder_name}"
        dot_file_blob = bucket.blob(dot_file_path)
        dot_file_blob.upload_from_string("", content_type="text/plain")  # Empty .{folder_name} file

        # Verify that the files were uploaded successfully
        if not folder_blob.exists() or not dot_file_blob.exists():
            raise Exception("Failed to upload files to Firebase Storage.")

        # Add debug logs to verify folder creation
        logger.info(f"Folder created: {folder_path}")
        logger.info(f"Dot file created: {dot_file_path}")

        return jsonify({"message": f"Folder '{folder_name}' and '.{folder_name}' created successfully."}), 201
    except Exception as e:
        logger.error(f"Error creating folder: {e}")
        return jsonify({"error": str(e)}), 500


@folders_bp.route('/api/folders', methods=['GET'])
@verify_firebase_token
def list_folders():
    """List all .dot files in the main 'folders' directory for the authenticated user."""
    user_id = request.uid
    try:
        # List all files in the main 'folders' directory
        files = list_user_files(user_id, "folders/")
        logger.debug(f"All files retrieved for user {user_id}: {files}")
        
        # Filter for .dot files (e.g., .test1) and remove the leading dot
        dot_files = [
            f['filename'].split('/')[-1][1:]  # Extract the file name
            for f in files
            if f['filename'].split('/')[-1].startswith('.')  # Check if the file name starts with a dot
            and not f['filename'].endswith('/')  # Exclude folder markers
        ]

        #logger.info(f"Filtered .dot files for user {user_id}: {dot_files}")
        return jsonify({"dotFiles": dot_files}), 200
    except Exception as e:
        logger.error(f"Error listing dot files for user {user_id}: {e}")
        return jsonify({"error": "Failed to list dot files"}), 500


@folders_bp.route('/api/folders/<folder_name>', methods=['GET'])
@verify_firebase_token
def get_docs_in_folder(folder_name):
    """Get documents in a specific folder in Firebase."""
    user_id = request.uid
    try:
        files = list_user_files(user_id, f"folders/{folder_name}/")
        logger.info(f"Files in folder '{folder_name}': {files}")
        return jsonify(files), 200
    except Exception as e:
        logger.error(f"Error getting docs in folder: {e}")
        return jsonify({"error": str(e)}), 500


@folders_bp.route('/api/folders/<folder_name>/add/<doc_id>', methods=['POST'])
@verify_firebase_token
def add_doc_to_folder(folder_name, doc_id):
    """Move a document to a specific folder in Firebase Storage."""
    user_id = request.uid
    try:
        bucket = storage.bucket()
        source_path = f"users/{user_id}/uploads/{doc_id}"
        dest_path = f"users/{user_id}/folders/{folder_name}/{doc_id}"

        source_blob = bucket.blob(source_path)
        if not source_blob.exists():
            return jsonify({"error": f"File '{doc_id}' does not exist in uploads."}), 404

        bucket.copy_blob(source_blob, bucket, dest_path)
        source_blob.delete()

        return jsonify({"message": f"File '{doc_id}' successfully moved to folder '{folder_name}'."}), 200
    except Exception as e:
        logger.error(f"Error moving file '{doc_id}' to folder '{folder_name}': {e}")
        return jsonify({"error": str(e)}), 500


@folders_bp.route('/api/folders/home/add/<doc_id>', methods=['POST'])
@verify_firebase_token
def move_doc_to_home(doc_id):
    """Move a document back to the home (uploads) directory."""
    user_id = request.uid
    try:
        bucket = storage.bucket()

        # Retrieve the document from the doc_store
        doc = doc_store.get(doc_id)
        if not doc:
            return jsonify({"error": f"Document with ID '{doc_id}' not found."}), 404

        # Use the audioFilename field for file operations
        audio_filename = doc.get("audioFilename")
        if not audio_filename:
            return jsonify({"error": "Document does not have an associated audio file."}), 400

        # Define source and destination paths
        source_path = f"users/{user_id}/folders/{doc.get('folderName', '')}/{audio_filename}"
        dest_path = f"users/{user_id}/uploads/{audio_filename}"

        # Check if the source file exists
        source_blob = bucket.blob(source_path)
        if not source_blob.exists():
            return jsonify({"error": f"Audio file '{audio_filename}' does not exist in the folder."}), 404

        # Copy the file to the uploads directory
        bucket.copy_blob(source_blob, bucket, dest_path)

        # Delete the original file from the folder
        source_blob.delete()

        # Update the document's folderName in doc_store
        doc["folderName"] = None
        save_doc_store()

        return jsonify({"message": f"Document '{doc_id}' successfully moved to home."}), 200
    except Exception as e:
        logger.error(f"Error moving document '{doc_id}' to home: {e}")
        return jsonify({"error": str(e)}), 500


@folders_bp.route('/api/folders/<folder_name>', methods=['DELETE'])
@verify_firebase_token
def delete_folder(folder_name):
    """Delete a folder and its contents from Firebase Storage."""
    user_id = request.uid
    try:
        bucket = storage.bucket()
        folder_path = f"users/{user_id}/folders/{folder_name}/"

        # List all files in the folder
        blobs = list(bucket.list_blobs(prefix=folder_path))
        if not blobs:
            return jsonify({"error": f"Folder '{folder_name}' does not exist."}), 404

        # Delete all files in the folder
        for blob in blobs:
            blob.delete()

        # Delete the dot file associated with the folder
        dot_file_path = f"users/{user_id}/folders/.{folder_name}"
        dot_file_blob = bucket.blob(dot_file_path)
        if dot_file_blob.exists():
            dot_file_blob.delete()

        logger.info(f"Folder '{folder_name}' and its contents deleted successfully.")
        return jsonify({"message": f"Folder '{folder_name}' deleted successfully."}), 200
    except Exception as e:
        logger.error(f"Error deleting folder '{folder_name}': {e}")
        return jsonify({"error": str(e)}), 500

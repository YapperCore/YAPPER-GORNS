@trash_bp.route('/api/trash/restore/<filename>', methods=['POST'])
@verify_firebase_token
def restore_file(filename):
    """Restore a file from trash to the home directory."""
    user_id = request.uid
    try:
        bucket = storage.bucket()
        
        # Source and destination paths
        trash_path = f"users/{user_id}/trash/{filename}"
        home_path = f"users/{user_id}/uploads/{filename}"
        
        # Check if file exists in trash
        trash_blob = bucket.blob(trash_path)
        if not trash_blob.exists():
            return jsonify({"error": f"File {filename} not found in trash."}), 404
            
        # Copy file to home directory
        home_blob = bucket.copy_blob(trash_blob, bucket, home_path)
        if not home_blob:
            return jsonify({"error": "Failed to restore file."}), 500
            
        # Delete file from trash
        trash_blob.delete()
        
        # Update document metadata in doc_store
        updated = False
        for doc_id, doc in doc_store.items():
            if doc.get("audioFilename") == filename and doc.get("owner") == user_id:
                doc["audioTrashed"] = False
                doc["folderName"] = None  # Ensure it goes to home directory
                updated = True
                logger.info(f"Restored document {doc_id} from trash to home")
        
        if updated:
            save_doc_store()
            
        return jsonify({
            "message": f"File {filename} restored successfully.",
            "restoredTo": "home"
        }), 200
        
    except Exception as e:
        logger.error(f"Error restoring file from trash: {str(e)}")
        return jsonify({"error": f"Failed to restore file: {str(e)}"}), 500

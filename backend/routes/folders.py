import os
from backend.config import DOC_STORE_FILE, UPLOAD_FOLDER
from flask import jsonify, request  # type: ignore

def make_folder(folder_name):
    """
    Create a folder with the given name in the UPLOAD_FOLDER.
    """
    try:
        os.makedirs(os.path.join(UPLOAD_FOLDER, folder_name), exist_ok=True)
        return jsonify({"message": f"Folder '{folder_name}' created successfully."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
def add_doc_to_folder(folder_name, doc_id):
    """
    Add a document to a specific folder.
    """
    try:
        folder_path = os.path.join(UPLOAD_FOLDER, folder_name)
        if not os.path.exists(folder_path):
            return jsonify({"error": f"Folder '{folder_name}' does not exist."}), 404
        
        # Assuming doc_store is a dictionary with doc_id as keys
        if doc_id not in DOC_STORE_FILE:
            return jsonify({"error": f"Document with ID '{doc_id}' does not exist."}), 404
        
        # Move the document to the specified folder
        # This is a placeholder; actual implementation may vary
        # shutil.move(doc_store[doc_id]['path'], folder_path)
        
        return jsonify({"message": f"Document '{doc_id}' added to folder '{folder_name}'."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
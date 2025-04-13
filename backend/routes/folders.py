import os
from config import DOC_STORE_FILE, UPLOAD_FOLDER
from flask import jsonify, request, Blueprint  # type: ignore

folders_bp = Blueprint('folders', __name__)

@folders_bp.route('/api/folders', methods=['POST'])
def create_folder():
    """
    Create a folder with the given name in the UPLOAD_FOLDER.
    """
    data = request.get_json()
    folder_name = data.get('folderName')

    if not folder_name:
        return jsonify({"error": "Folder name is required"}), 400

    try:
        folder_path = os.path.join(UPLOAD_FOLDER, folder_name)
        os.makedirs(folder_path, exist_ok=True)
        return jsonify({"message": f"Folder '{folder_name}' created successfully."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@folders_bp.route('/api/folders', methods=['GET'])
def get_folders():
    """
    Get the list of folders in the UPLOAD_FOLDER.
    """
    try:
        # Ensure the UPLOAD_FOLDER exists
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # List all directories in the UPLOAD_FOLDER
        folders = [f for f in os.listdir(UPLOAD_FOLDER) if os.path.isdir(os.path.join(UPLOAD_FOLDER, f))]
        return jsonify(folders), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

@folders_bp.route('/api/folders/<folder_name>', methods=['GET'])
def get_docs_in_folder(folder_name):
    """
    Get documents in a specific folder.
    """
    try:
        folder_path = os.path.join(UPLOAD_FOLDER, folder_name)
        if not os.path.exists(folder_path):
            return jsonify({"error": f"Folder '{folder_name}' does not exist."}), 404

        # Placeholder: Replace with actual logic to fetch docs in the folder
        docs = [doc for doc in DOC_STORE_FILE.values() if doc.get('folder') == folder_name]
        return jsonify(docs), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
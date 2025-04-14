<<<<<<< HEAD
import os
import uuid
import json
import logging
from flask import request, jsonify # type: ignore
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store

# Set up logger
logger = logging.getLogger(__name__)

def list_docs():
    """Return only non-deleted documents."""
    if not doc_store:
        return jsonify([]), 200
    active_docs = [d for d in doc_store.values() if not d.get("deleted", False)]
    return jsonify(active_docs), 200

def get_doc(doc_id):
    """Retrieve a specific document by ID."""
    d = doc_store.get(doc_id)
    if not d or d.get("deleted"):
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(d), 200

def create_doc():
    """Create a new document."""
=======
# backend/routes/docmanage.py
import os
import uuid
import logging
from flask import request, jsonify, Blueprint
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store
from services.firebase_service import move_file, check_blob_exists
from auth import verify_firebase_token, is_admin

logger = logging.getLogger(__name__)

docmanage_bp = Blueprint('docmanage', __name__)

@docmanage_bp.route('/api/docs', methods=['GET'])
@verify_firebase_token
def list_docs():
    """Return only non-deleted documents for the authenticated user"""
    if not doc_store:
        return jsonify([]), 200
        
    active_docs = [
        d for d in doc_store.values() 
        if not d.get("deleted", False) and (d.get("owner") == request.uid or is_admin(request.uid))
    ]
    return jsonify(active_docs), 200

@docmanage_bp.route('/api/docs/<doc_id>', methods=['GET'])
@verify_firebase_token
def get_doc(doc_id):
    """Retrieve a specific document by ID for the authenticated user"""
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(d), 200

@docmanage_bp.route('/api/docs', methods=['POST'])
@verify_firebase_token
def create_doc():
    """Create a new document with ownership information"""
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie
    data = request.json or {}
    doc_id = str(uuid.uuid4())
    name = data.get("name", f"Doc{len(doc_store) + 1}")
    content = data.get("content", "")

    doc_obj = {
        "id": doc_id,
        "name": name,
        "content": content,
        "audioFilename": None,
        "originalFilename": None,
        "audioTrashed": False,
<<<<<<< HEAD
        "deleted": False
=======
        "deleted": False,
        "owner": request.uid
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie
    }

    doc_store[doc_id] = doc_obj
    save_doc_store()
    return jsonify(doc_obj), 201

<<<<<<< HEAD
def update_doc(doc_id):
    """Update an existing document."""
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc or doc.get("deleted"):
=======
@docmanage_bp.route('/api/docs/<doc_id>', methods=['PUT'])
@verify_firebase_token
def update_doc(doc_id):
    """Update an existing document"""
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc or doc.get("deleted") or (doc.get("owner") != request.uid and not is_admin(request.uid)):
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie
        return jsonify({"error": "Doc not found"}), 404

    doc["name"] = data.get("name", doc.get("name"))
    doc["content"] = data.get("content", doc.get("content"))

    save_doc_store()
    return jsonify(doc), 200

<<<<<<< HEAD
def delete_doc(doc_id):
    """Soft delete a document and move its audio file to trash if applicable."""
    d = doc_store.get(doc_id)
    if not d or d.get("deleted"):
=======
@docmanage_bp.route('/api/docs/<doc_id>', methods=['DELETE'])
@verify_firebase_token
def delete_doc(doc_id):
    """Soft delete a document and mark its file as trashed"""
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie
        return jsonify({"message": "Doc not found"}), 404

    d["deleted"] = True
    filename = d.get("audioFilename")
<<<<<<< HEAD

    if filename and not d.get("audioTrashed"):
        src_path = os.path.join(UPLOAD_FOLDER, filename)
        dst_path = os.path.join(TRASH_FOLDER, filename)
        if os.path.exists(src_path):
            os.rename(src_path, dst_path)
            d["audioTrashed"] = True
            logger.info(f"Moved file to trash: {src_path}")

    save_doc_store()
    return jsonify({"message": "Doc deleted"}), 200
=======
    
    if filename and not d.get("audioTrashed"):
        # Move the file to trash in Firebase with permission check
        uid = d.get("owner")
        upload_path = f"users/{uid}/uploads/{filename}"
        trash_path = f"users/{uid}/trash/{filename}"
        
        try:
            # First check if file exists in uploads
            file_exists_in_uploads = check_blob_exists(upload_path)
            
            # If file doesn't exist in uploads, check if it's already in trash
            file_exists_in_trash = False
            if not file_exists_in_uploads:
                file_exists_in_trash = check_blob_exists(trash_path)
            
            # Move in Firebase if it exists in uploads
            firebase_moved = False
            if file_exists_in_uploads:
                firebase_moved = move_file(upload_path, trash_path, request.uid)
                logger.info(f"Firebase move result: {firebase_moved}")
            elif file_exists_in_trash:
                # File already in trash
                firebase_moved = True
                logger.info(f"File {filename} already in trash")
            
            # Try to move local file if it exists
            local_moved = False
            try:
                local_upload_path = os.path.join(UPLOAD_FOLDER, filename)
                local_trash_path = os.path.join(TRASH_FOLDER, filename)
                if os.path.exists(local_upload_path):
                    os.makedirs(os.path.dirname(local_trash_path), exist_ok=True)
                    os.rename(local_upload_path, local_trash_path)
                    local_moved = True
                    logger.info(f"Moved local file to trash: {filename}")
                elif os.path.exists(local_trash_path):
                    # File already in local trash
                    local_moved = True
                    logger.info(f"File {filename} already in local trash")
            except Exception as local_err:
                logger.error(f"Error moving local file to trash: {local_err}")
            
            # Update document status if either operation succeeded or file was already in trash
            if firebase_moved or local_moved:
                d["audioTrashed"] = True
                logger.info(f"Moved file to trash: {filename}")
            else:
                logger.error(f"Failed to move file to trash: {filename}")
        except Exception as e:
            logger.error(f"Error moving file to trash: {e}")
    
    save_doc_store()
    return jsonify({"message": "Doc deleted"}), 200

def register_docmanage_routes(app):
    """Register document management routes with Flask app"""
    app.register_blueprint(docmanage_bp)
>>>>>>> origin/SCRUM-80-sync-new-buttons-functionalitie

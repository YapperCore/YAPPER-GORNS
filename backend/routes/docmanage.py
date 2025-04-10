# backend/routes/docmanage.py
import os
import uuid
import json
import logging
from flask import request, jsonify, Blueprint
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store
from services.firebase_service import delete_file, move_file
from auth import verify_firebase_token, is_admin
from routes.trash_route import mark_file_trashed

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
        "deleted": False,
        "owner": request.uid
    }

    doc_store[doc_id] = doc_obj
    save_doc_store()
    return jsonify(doc_obj), 201

@docmanage_bp.route('/api/docs/<doc_id>', methods=['PUT'])
@verify_firebase_token
def update_doc(doc_id):
    """Update an existing document"""
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc or doc.get("deleted") or (doc.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"error": "Doc not found"}), 404

    doc["name"] = data.get("name", doc.get("name"))
    doc["content"] = data.get("content", doc.get("content"))

    save_doc_store()
    return jsonify(doc), 200

@docmanage_bp.route('/api/docs/<doc_id>', methods=['DELETE'])
@verify_firebase_token
def delete_doc(doc_id):
    """Soft delete a document and mark its file as trashed"""
    d = doc_store.get(doc_id)
    if not d or d.get("deleted") or (d.get("owner") != request.uid and not is_admin(request.uid)):
        return jsonify({"message": "Doc not found"}), 404

    d["deleted"] = True
    filename = d.get("audioFilename")
    
    if filename and not d.get("audioTrashed"):
        # Move the file to trash in Firebase with permission check
        uid = d.get("owner")
        upload_path = f"users/{uid}/uploads/{filename}"
        trash_path = f"users/{uid}/trash/{filename}"
        
        try:
            if move_file(upload_path, trash_path, request.uid):
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

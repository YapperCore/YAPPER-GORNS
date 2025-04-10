# backend/routes/docmanage.py
import os
import uuid
import json
import logging
from flask import request, jsonify
from config import UPLOAD_FOLDER, TRASH_FOLDER
from services.storage import save_doc_store, doc_store
from firebase_helper import delete_audio, is_admin_user
from auth_middleware import require_auth, user_owns_resource

# Set up logger
logger = logging.getLogger(__name__)

@require_auth
def list_docs(user_id):
    """Return only documents the user has access to"""
    if not doc_store:
        return jsonify([]), 200
        
    # Filter docs based on ownership and deletion status
    if is_admin_user(user_id):
        # Admins see all non-deleted docs
        active_docs = [d for d in doc_store.values() if not d.get("deleted", False)]
    else:
        # Regular users see only their non-deleted docs
        active_docs = [d for d in doc_store.values() 
                       if not d.get("deleted", False) and 
                       (d.get("ownerId") == user_id or not d.get("ownerId"))]
                       
    return jsonify(active_docs), 200

@require_auth
def get_doc(user_id, doc_id):
    """Retrieve a specific document by ID with owner check"""
    doc = doc_store.get(doc_id)
    
    if not doc or doc.get("deleted"):
        return jsonify({"error": "Document not found"}), 404
        
    # Check if user owns this doc or is admin
    if doc.get("ownerId") and doc.get("ownerId") != user_id and not is_admin_user(user_id):
        return jsonify({"error": "Access denied: You don't own this document"}), 403
        
    return jsonify(doc), 200

@require_auth
def create_doc(user_id):
    """Create a new document with owner ID"""
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
        "ownerId": user_id,  # Set document owner
        "createdAt": datetime.now().isoformat()
    }

    doc_store[doc_id] = doc_obj
    save_doc_store()
    logger.info(f"Document {doc_id} created by user {user_id}")
    return jsonify(doc_obj), 201

@require_auth
def update_doc(user_id, doc_id):
    """Update an existing document with owner check"""
    data = request.json or {}
    doc = doc_store.get(doc_id)
    
    if not doc or doc.get("deleted"):
        return jsonify({"error": "Document not found"}), 404
        
    # Check if user owns this doc or is admin
    if doc.get("ownerId") and doc.get("ownerId") != user_id and not is_admin_user(user_id):
        return jsonify({"error": "Access denied: You don't own this document"}), 403

    # Update fields
    doc["name"] = data.get("name", doc.get("name"))
    doc["content"] = data.get("content", doc.get("content"))
    doc["updatedAt"] = datetime.now().isoformat()
    doc["updatedBy"] = user_id

    save_doc_store()
    logger.info(f"Document {doc_id} updated by user {user_id}")
    return jsonify(doc), 200

@require_auth
def delete_doc(user_id, doc_id):
    """Soft delete a document and move its audio file to trash if applicable"""
    doc = doc_store.get(doc_id)
    
    if not doc or doc.get("deleted"):
        return jsonify({"message": "Document not found"}), 404
        
    # Check if user owns this doc or is admin
    if doc.get("ownerId") and doc.get("ownerId") != user_id and not is_admin_user(user_id):
        return jsonify({"error": "Access denied: You don't own this document"}), 403

    # Mark document as deleted
    doc["deleted"] = True
    doc["deletedAt"] = datetime.now().isoformat()
    doc["deletedBy"] = user_id

    # Move audio file to trash if exists
    filename = doc.get("audioFilename")
    if filename and not doc.get("audioTrashed"):
        src_path = os.path.join(UPLOAD_FOLDER, filename)
        dst_path = os.path.join(TRASH_FOLDER, filename)
        if os.path.exists(src_path):
            try:
                os.rename(src_path, dst_path)
                doc["audioTrashed"] = True
                logger.info(f"Moved file to trash: {src_path}")
                
                # Delete from Firebase if available and user has permission
                if doc.get("firebase_filename"):
                    try:
                        delete_audio(doc["firebase_filename"], user_id)
                    except Exception as e:
                        logger.error(f"Error deleting from Firebase: {e}")
            except Exception as e:
                logger.error(f"Error moving file to trash: {e}")
    
    save_doc_store()
    logger.info(f"Document {doc_id} deleted by user {user_id}")
    return jsonify({"message": "Document deleted"}), 200

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
        "deleted": False
    }

    doc_store[doc_id] = doc_obj
    save_doc_store()
    return jsonify(doc_obj), 201

def update_doc(doc_id):
    """Update an existing document."""
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc or doc.get("deleted"):
        return jsonify({"error": "Doc not found"}), 404

    doc["name"] = data.get("name", doc.get("name"))
    doc["content"] = data.get("content", doc.get("content"))

    save_doc_store()
    return jsonify(doc), 200

def delete_doc(doc_id):
    """Soft delete a document and move its audio file to trash if applicable."""
    d = doc_store.get(doc_id)
    if not d or d.get("deleted"):
        return jsonify({"message": "Doc not found"}), 404

    d["deleted"] = True
    filename = d.get("audioFilename")

    if filename and not d.get("audioTrashed"):
        src_path = os.path.join(UPLOAD_FOLDER, filename)
        dst_path = os.path.join(TRASH_FOLDER, filename)
        if os.path.exists(src_path):
            os.rename(src_path, dst_path)
            d["audioTrashed"] = True
            logger.info(f"Moved file to trash: {src_path}")

    save_doc_store()
    return jsonify({"message": "Doc deleted"}), 200

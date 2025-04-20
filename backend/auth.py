import firebase_admin
from firebase_admin import auth
from flask import request, jsonify
from functools import wraps
from config import ADMIN_UIDS


def verify_firebase_token(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', None)
        if not auth_header:
            return jsonify({"error": "Authorization header missing"}), 401
        parts = auth_header.split()
        if parts[0].lower() != "bearer" or len(parts) != 2:
            return jsonify({"error": "Invalid authorization header"}), 401
        token = parts[1]
        try:
            decoded_token = auth.verify_id_token(token)
            request.uid = decoded_token.get("uid")
            request.user_email = decoded_token.get("email")
        except Exception as e:
            return jsonify({"error": "Invalid token", "details": str(e)}), 401
        return fn(*args, **kwargs)
    return wrapper

def is_admin(uid):
    return uid in ADMIN_UIDS


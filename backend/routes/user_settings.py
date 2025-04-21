import logging
from flask import request, jsonify, Blueprint
from auth import verify_firebase_token

logger = logging.getLogger(__name__)

user_settings_bp = Blueprint('user_settings', __name__)

user_settings_store = {}

@user_settings_bp.route('/api/user-settings', methods=['GET'])
@verify_firebase_token
def get_user_settings():
    user_id = request.uid
    
    if user_id not in user_settings_store:
        default_settings = {
            "transcriptionConfig": {
                "mode": "local-cpu",
                "cpuThreads": 2,
                "gpuDevice": 0,
                "whisperModel": "small"
            }
        }
        user_settings_store[user_id] = default_settings
    
    return jsonify(user_settings_store[user_id]), 200

@user_settings_bp.route('/api/user-settings', methods=['POST'])
@verify_firebase_token
def update_user_settings():
    user_id = request.uid
    data = request.json
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    if user_id not in user_settings_store:
        user_settings_store[user_id] = {}
    
    for key, value in data.items():
        user_settings_store[user_id][key] = value
    
    return jsonify({"message": "Settings updated successfully"}), 200

def register_user_settings_routes(app):
    app.register_blueprint(user_settings_bp)
    logger.info("User settings routes registered successfully")

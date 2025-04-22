# backend/routes/settings_route.py
import os
import platform
import multiprocessing
import logging
import json
import requests
from flask import jsonify, request, Blueprint
from firebase_admin import firestore
from auth import verify_firebase_token

logger = logging.getLogger(__name__)
settings_bp = Blueprint('settings', __name__)

# Try to import GPU info modules
try:
    import torch
    has_torch = True
except ImportError:
    has_torch = False

@settings_bp.route('/api/system-info', methods=['GET'])
@verify_firebase_token
def get_system_info():
    """Get information about the system CPU and GPU"""
    
    # Get CPU information
    cpu_info = platform.processor() or "Unknown CPU"
    cpu_threads = multiprocessing.cpu_count()
    
    # Get GPU information
    gpu_info = "No GPU detected"
    gpu_count = 0
    
    if has_torch and torch.cuda.is_available():
        gpu_count = torch.cuda.device_count()
        if gpu_count > 0:
            gpu_info = torch.cuda.get_device_name(0)
            for i in range(1, gpu_count):
                gpu_info += f", {torch.cuda.get_device_name(i)}"
    
    return jsonify({
        "cpuInfo": cpu_info,
        "cpuThreads": cpu_threads,
        "gpuInfo": gpu_info,
        "gpuCount": gpu_count
    }), 200

@settings_bp.route('/api/user-settings', methods=['GET'])
@verify_firebase_token
def get_user_settings():
    """Get user settings from Firestore"""
    try:
        # Get reference to Firestore
        db = firestore.client()
        
        # Get user ID from the token verification middleware
        user_id = request.uid
        
        # Get user settings document
        user_settings_ref = db.collection('user_settings').document(user_id)
        user_settings = user_settings_ref.get()
        
        if user_settings.exists:
            # Get the settings
            settings_data = user_settings.to_dict()
            
            # Check if we should indicate the presence of an API key
            if 'transcriptionConfig' in settings_data and 'replicateApiKey' in settings_data['transcriptionConfig']:
                # Don't send the actual API key to the client
                has_key = bool(settings_data['transcriptionConfig']['replicateApiKey'])
                settings_data['transcriptionConfig']['hasReplicateApiKey'] = has_key
                settings_data['transcriptionConfig']['replicateApiKey'] = ''
            
            return jsonify(settings_data), 200
        else:
            # Return default settings if no document exists yet
            default_settings = {
                "transcriptionConfig": {
                    "mode": "local-cpu",
                    "replicateApiKey": "",
                    "hasReplicateApiKey": False,
                    "cpuThreads": 1,
                    "gpuDevice": 0,
                    "whisperModel": "small"
                }
            }
            return jsonify(default_settings), 200
            
    except Exception as e:
        logger.error(f"Error fetching user settings: {e}")
        return jsonify({"error": "Failed to fetch user settings"}), 500

@settings_bp.route('/api/user-settings', methods=['POST'])
@verify_firebase_token
def save_user_settings():
    """Save user settings to Firestore"""
    try:
        # Get reference to Firestore
        db = firestore.client()
        
        # Get user ID from the token verification middleware
        user_id = request.uid
        
        # Get data from request body
        data = request.json
        
        # Validate data
        if not data or not isinstance(data, dict):
            return jsonify({"error": "Invalid settings data"}), 400
        
        # If Replicate API key is provided, store securely
        if 'transcriptionConfig' in data and 'replicateApiKey' in data['transcriptionConfig']:
            # Store API key securely
            api_key = data['transcriptionConfig']['replicateApiKey']
            
            if api_key and api_key.strip():
                # Create a secure storage folder if it doesn't exist
                secure_dir = os.path.join(os.getcwd(), 'secure_storage')
                os.makedirs(secure_dir, exist_ok=True)
                
                # Store the API key in a secure file named with the user's ID
                key_path = os.path.join(secure_dir, f"{user_id}_replicate_key.json")
                with open(key_path, 'w') as f:
                    json.dump({"api_key": api_key}, f)
                
                # Set flag in the data to indicate API key is stored
                data['transcriptionConfig']['hasReplicateApiKey'] = True
            
            # Don't store the actual API key in Firestore for security
            data['transcriptionConfig']['replicateApiKey'] = ''
        
        # Save settings to Firestore
        user_settings_ref = db.collection('user_settings').document(user_id)
        user_settings_ref.set(data, merge=True)
        
        return jsonify({"message": "Settings saved successfully"}), 200
            
    except Exception as e:
        logger.error(f"Error saving user settings: {e}")
        return jsonify({"error": "Failed to save user settings", "details": str(e)}), 500

@settings_bp.route('/api/test-replicate-api', methods=['POST'])
@verify_firebase_token
def test_replicate_api():
    """Test if the Replicate API key is valid"""
    try:
        # Get user ID from the token verification middleware
        user_id = request.uid
        
        # Get data from request body or use stored key
        data = request.json or {}
        api_key = data.get('apiKey')
        
        # If no API key in request, try to get from stored key
        if not api_key:
            secure_dir = os.path.join(os.getcwd(), 'secure_storage')
            key_path = os.path.join(secure_dir, f"{user_id}_replicate_key.json")
            if os.path.exists(key_path):
                try:
                    with open(key_path, 'r') as f:
                        key_data = json.load(f)
                        api_key = key_data.get('api_key')
                except Exception as e:
                    logger.error(f"Error reading stored API key: {e}")
            
            if not api_key:
                return jsonify({
                    "success": False,
                    "message": "No API key provided"
                }), 400
        
        # Test the Replicate API
        headers = {
            "Authorization": f"Token {api_key}"
        }
        
        # Attempt to call the account API to check if the key is valid
        test_response = requests.get(
            "https://api.replicate.com/v1/account",
            headers=headers
        )
        
        if test_response.status_code == 200:
            # API key is valid
            return jsonify({
                "success": True,
                "message": "API key verified successfully",
                "user": test_response.json()
            }), 200
        else:
            # API key is invalid or another error occurred
            error_message = "Unknown error"
            try:
                error_data = test_response.json()
                error_message = error_data.get('detail') or str(error_data)
            except:
                error_message = test_response.text or f"Status code: {test_response.status_code}"
                
            return jsonify({
                "success": False,
                "message": f"API key verification failed: {error_message}",
                "status": test_response.status_code
            }), 200
    
    except Exception as e:
        logger.error(f"Error testing Replicate API: {e}")
        return jsonify({
            "success": False,
            "message": f"Error testing Replicate API: {str(e)}"
        }), 500

def register_settings_routes(app):
    """Register settings routes with Flask app"""
    app.register_blueprint(settings_bp)

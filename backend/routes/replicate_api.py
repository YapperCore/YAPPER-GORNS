# backend/routes/replicate_api.py
import os
import logging
import requests
from flask import Blueprint, jsonify, request
from auth import verify_firebase_token

logger = logging.getLogger(__name__)
replicate_api_bp = Blueprint('replicate_api', __name__)

@replicate_api_bp.route('/api/test-replicate-api', methods=['POST'])
@verify_firebase_token
def test_replicate_api():
    """Test the Replicate API key"""
    try:
        data = request.json
        api_key = data.get('apiKey')
        
        if not api_key:
            return jsonify({
                "success": False,
                "message": "API key is required"
            }), 400
        
        # Test the API key with a direct API call
        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json"
        }
        
        # Just check API user endpoint to validate the token
        response = requests.get("https://api.replicate.com/v1/account", headers=headers)
        
        if response.status_code == 200:
            return jsonify({
                "success": True,
                "message": "API key is valid"
            }), 200
        else:
            error_detail = "Invalid API key"
            try:
                error_data = response.json()
                if 'detail' in error_data:
                    error_detail = error_data['detail']
            except:
                pass
                
            return jsonify({
                "success": False,
                "message": f"Invalid API key: {error_detail}"
            }), 400
    except Exception as e:
        logger.error(f"Error testing Replicate API: {e}")
        return jsonify({
            "success": False,
            "message": f"Error testing API key: {str(e)}"
        }), 500

def register_replicate_api_routes(app):
    """Register Replicate API routes with Flask app"""
    app.register_blueprint(replicate_api_bp)
    logger.info("Replicate API routes registered successfully")

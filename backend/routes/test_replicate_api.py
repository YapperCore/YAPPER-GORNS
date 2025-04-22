import os
import sys
import json
import logging
from flask import request, jsonify, Blueprint
from auth import verify_firebase_token

# Import replicate to test if API key works
try:
    import replicate
except ImportError:
    replicate = None

logger = logging.getLogger(__name__)
test_replicate_api_bp = Blueprint('test_replicate_api', __name__)

@test_replicate_api_bp.route('/api/test-replicate-api', methods=['POST'])
@verify_firebase_token
def test_replicate_api():
    """Test Replicate API key validity"""
    data = request.json
    api_key = data.get('apiKey')
    
    if not api_key:
        return jsonify({"success": False, "message": "API key is required"}), 400
    
    try:
        # Set API key temporarily for testing
        original_api_key = os.environ.get('REPLICATE_API_TOKEN')
        os.environ['REPLICATE_API_TOKEN'] = api_key
        
        # Check if the replicate library is installed
        if replicate is None:
            return jsonify({
                "success": False, 
                "message": "Replicate Python library is not installed on the server."
            }), 500
        
        # Make a simple API call to validate the key
        # We'll use a lightweight model just to test the API key
        result = replicate.run(
            "meta/llama-2-7b-chat:13c3cdee13ee059ab779f0291d29054dab00a47dad8261375654de5540165fb0",
            input={"prompt": "testing api key", "max_new_tokens": 1}
        )
        
        # Check if we got a valid response
        if result and len(result) > 0:
            # Success - the API key is valid
            return jsonify({
                "success": True,
                "message": "API key validated successfully"
            }), 200
        else:
            # Response was empty or invalid
            return jsonify({
                "success": False,
                "message": "Could not get valid response from Replicate API"
            }), 400
    except Exception as e:
        logger.error(f"Error testing Replicate API: {e}")
        
        # Check for common errors in the exception message
        error_msg = str(e).lower()
        if "unauthorized" in error_msg or "authentication" in error_msg or "api key" in error_msg:
            return jsonify({
                "success": False,
                "message": "Invalid or expired API key"
            }), 401
        else:
            return jsonify({
                "success": False,
                "message": f"Error testing API: {str(e)}"
            }), 500
    finally:
        # Restore the original API key
        if original_api_key:
            os.environ['REPLICATE_API_TOKEN'] = original_api_key
        else:
            os.environ.pop('REPLICATE_API_TOKEN', None)

def register_test_replicate_api_route(app):
    """Register test Replicate API route with Flask app"""
    app.register_blueprint(test_replicate_api_bp)

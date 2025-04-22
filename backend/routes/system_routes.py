# backend/routes/system_routes.py
import os
import platform
import logging
import torch
from flask import request, jsonify, Blueprint
from auth import verify_firebase_token
import requests

logger = logging.getLogger(__name__)

system_bp = Blueprint('system', __name__)

@system_bp.route('/api/system-info', methods=['GET'])
@verify_firebase_token
def get_system_info():
    """Get system hardware information for transcription settings"""
    try:
        # CPU info
        try:
            import psutil
            cpu_count = psutil.cpu_count(logical=True)
            cpu_physical = psutil.cpu_count(logical=False)
        except ImportError:
            import multiprocessing
            cpu_count = multiprocessing.cpu_count()
            cpu_physical = cpu_count
            
        cpu_name = "CPU information not available"
        
        try:
            # Try to get CPU model name
            if platform.system() == "Linux":
                with open('/proc/cpuinfo') as f:
                    for line in f:
                        if line.strip().startswith('model name'):
                            cpu_name = line.strip().split(':')[1].strip()
                            break
            elif platform.system() == "Windows":
                from subprocess import check_output
                cpu_name = check_output(["wmic", "cpu", "get", "name"]).decode('utf-8').strip().split('\n')[1]
            elif platform.system() == "Darwin":  # macOS
                from subprocess import check_output
                cpu_name = check_output(["/usr/sbin/sysctl", "-n", "machdep.cpu.brand_string"]).decode('utf-8').strip()
        except Exception as e:
            logger.warning(f"Could not get detailed CPU info: {e}")
            cpu_name = f"{platform.processor()} - {cpu_physical} cores / {cpu_count} threads"
        
        # GPU info
        gpu_info = "No GPU detected"
        gpu_count = 0
        
        if torch.cuda.is_available():
            gpu_count = torch.cuda.device_count()
            gpu_names = []
            for i in range(gpu_count):
                gpu_names.append(torch.cuda.get_device_name(i))
            gpu_info = ", ".join(gpu_names)
        
        # Compile system info
        system_info = {
            "cpuInfo": cpu_name,
            "cpuThreads": cpu_count,
            "gpuInfo": gpu_info,
            "gpuCount": gpu_count,
            "platform": platform.system(),
            "isWSL": "microsoft" in platform.uname().release.lower() if hasattr(platform, "uname") else False,
            "pythonVersion": platform.python_version()
        }
        
        return jsonify(system_info), 200
        
    except Exception as e:
        logger.error(f"Error getting system info: {e}")
        return jsonify({
            "error": f"Failed to get system info: {str(e)}",
            "cpuInfo": "Unknown",
            "cpuThreads": 2,
            "gpuInfo": "Unknown", 
            "gpuCount": 0
        }), 500


@system_bp.route('/api/test-replicate-api', methods=['POST'])
@verify_firebase_token
def test_replicate_api():
    """Test Replicate API key validity"""
    try:
        data = request.json
        api_key = data.get('apiKey', '')
        
        if not api_key:
            return jsonify({"success": False, "message": "No API key provided"}), 400
        
        # Use a direct API request to check key validity
        try:
            response = requests.get(
                "https://api.replicate.com/v1/account", 
                headers={"Authorization": f"Token {api_key}"}
            )
            
            if response.status_code == 200:
                account_data = response.json()
                return jsonify({
                    "success": True,
                    "message": f"API key is valid for account: {account_data.get('username', 'Unknown')}",
                }), 200
            else:
                error_message = "Invalid API key or authentication failed"
                try:
                    error_data = response.json()
                    if "detail" in error_data:
                        error_message = error_data["detail"]
                except:
                    pass
                
                return jsonify({
                    "success": False,
                    "message": error_message
                }), 401
                
        except Exception as request_error:
            logger.error(f"Error testing Replicate API: {request_error}")
            return jsonify({
                "success": False,
                "message": f"Error connecting to Replicate API: {str(request_error)}"
            }), 500
            
    except Exception as e:
        logger.error(f"Error in API key test endpoint: {e}")
        return jsonify({
            "success": False,
            "message": f"API test failed: {str(e)}"
        }), 500


def register_system_routes(app):
    """Register system routes with Flask app"""
    app.register_blueprint(system_bp)
    logger.info("System routes registered successfully")

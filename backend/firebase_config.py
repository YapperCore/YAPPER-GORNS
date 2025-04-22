# backend/firebase_config.py
"""
Firebase configuration for Yapper application
"""
import os
import json

# Path to service account key file (local development) or use environment variable (production)
if os.environ.get('FIREBASE_SERVICE_ACCOUNT'):
    # For Render deployment - create a temp file with the credentials from env var
    import tempfile
    service_account_data = json.loads(os.environ.get('FIREBASE_SERVICE_ACCOUNT', '{}'))
    fd, FIREBASE_SERVICE_ACCOUNT_KEY = tempfile.mkstemp()
    with open(FIREBASE_SERVICE_ACCOUNT_KEY, 'w') as f:
        json.dump(service_account_data, f)
else:
    # Local development 
    FIREBASE_SERVICE_ACCOUNT_KEY = os.path.join(os.getcwd(), "Accesskey.json")

# Firebase configuration
FIREBASE_CONFIG = {
    "apiKey": "AIzaSyB1J8UFKuJ8S4OxTuKJFAJsozKqe6QVBI8",
    "authDomain": "yapper-1958d.firebaseapp.com",
    "projectId": "yapper-1958d",
    "storageBucket": "yapper-1958d.firebasestorage.app",
    "messagingSenderId": "247545046246",
    "appId": "1:247545046246:web:98be3dc3dbde53dce5c727",
}

# List of admin user IDs
ADMIN_USER_IDS = [
    "fqFmFaVxP9YCbdpCSbxjw9I8UZI2",
    "9I0tKoljp3h97WaPFH1hEsxgPGP2",
    "OK7kfRfp5YOSawBii8RNIP54fgo1",
    "XOW0xzNdu2V39X88TlKrbnkoMOq1",
]

# Firebase Storage configuration
FIREBASE_STORAGE_BUCKET = "yapper-1958d.firebasestorage.app"

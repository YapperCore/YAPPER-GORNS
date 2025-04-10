# backend/config.py
import os

# Basic backend configuration
UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
DOC_STORE_FILE = 'doc_store.json'

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

# Firebase configuration
FIREBASE_SERVICE_ACCOUNT_KEY = os.path.join(os.path.dirname(__file__), "Accesskey.json")
FIREBASE_CONFIG = {
    "apiKey": "AIzaSyB1J8UFKuJ8S4OxTuKJFAJsozKqe6QVBI8",
    "authDomain": "yapper-1958d.firebaseapp.com",
    "databaseURL": "https://yapper-1958d-default-rtdb.firebaseio.com",
    "projectId": "yapper-1958d",
    "storageBucket": "yapper-1958d.firebasestorage.app",
    "messagingSenderId": "247545046246",
    "appId": "1:247545046246:web:98be3dc3dbde53dce5c727",
    "measurementId": "G-TREYQ105SE"
}

# Admin user IDs
ADMIN_USER_IDS = [
    "fqFmFaVxP9YCbdpCSbxjw9I8UZI2",
    "9I0tKoljp3h97WaPFH1hEsxgPGP2",
    "OK7kfRfp5YOSawBii8RNIP54fgo1",
    "XOW0xzNdu2V39X88TlKrbnkoMOq1"
]

# Flask & Socket.IO settings
CORS_ALLOWED_ORIGINS = "*"
FLASK_SECRET_KEY = "yapper-secure-key-2025"
DEBUG_MODE = True

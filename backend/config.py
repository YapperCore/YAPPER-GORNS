import os

# Configuration settings
UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
DOC_STORE_FILE = 'doc_store.json'

# Flask & SocketIO settings
CORS_ALLOWED_ORIGINS = "*"

# List of Firebase user IDs that are system admins (adjust as needed)
ADMIN_UIDS = []  

# Ensure necessary directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)


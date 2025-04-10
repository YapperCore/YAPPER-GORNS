import os

# Configuration settings
# Use absolute paths for better cross-platform compatibility
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
TRASH_FOLDER = os.path.join(os.getcwd(), 'trash')
DOC_STORE_FILE = os.path.join(os.getcwd(), 'doc_store.json')

# Flask & SocketIO settings
CORS_ALLOWED_ORIGINS = "*"

# List of Firebase user IDs that are system admins (adjust as needed)
ADMIN_UIDS = []  

# Ensure necessary directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

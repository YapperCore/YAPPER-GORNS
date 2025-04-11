import os

# Configuration settings
# Use absolute paths for better cross-platform compatibility
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
TRASH_FOLDER = os.path.join(BASE_DIR, 'trash')
DOC_STORE_FILE = os.path.join(BASE_DIR, 'doc_store.json')

# Log the resolved paths
print(f"BASE_DIR: {BASE_DIR}")
print(f"UPLOAD_FOLDER: {UPLOAD_FOLDER}")
print(f"TRASH_FOLDER: {TRASH_FOLDER}")
print(f"DOC_STORE_FILE: {DOC_STORE_FILE}")

# Flask & SocketIO settings
CORS_ALLOWED_ORIGINS = "*"

# List of Firebase user IDs that are system admins (adjust as needed)
ADMIN_UIDS = []  

# Ensure necessary directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

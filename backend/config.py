# backend/config.py
import os
import sys
import platform
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger(__name__)

# Detect platform
IS_WINDOWS = platform.system() == "Windows"
IS_WSL = (
    "microsoft" in platform.uname().release.lower()
    if hasattr(platform, "uname")
    else False
)


# Platform-specific path fixes
def normalize_path(path):
    """Normalize path for cross-platform compatibility"""
    if IS_WINDOWS:
        # Use Windows-style paths
        return str(Path(path))
    elif IS_WSL:
        # For WSL, handle Windows paths properly
        return str(Path(path)).replace("\\", "/")
    else:
        # Use Unix-style paths
        return str(Path(path))


# Base directory (location of this file)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Common paths
UPLOAD_FOLDER = normalize_path(os.path.join(BASE_DIR, "uploads"))
TRASH_FOLDER = normalize_path(os.path.join(BASE_DIR, "trash"))
DOC_STORE_FILE = normalize_path(os.path.join(BASE_DIR, "doc_store.json"))

# Web config
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", 5001))
DEBUG = os.environ.get("DEBUG", "False").lower() == "true"

# Whisper model config
WHISPER_MODEL = "small"  # tiny, base, small, medium, or large

# Firebase config
FIREBASE_STORAGE_BUCKET = "yapper-1958d.firebasestorage.app"
FIREBASE_SERVICE_ACCOUNT_KEY = os.path.join(BASE_DIR, "Accesskey.json")

# Admin configuration
ADMIN_UIDS = []

# Log startup settings
logger.info(f"Platform detected: {platform.system()} {'(WSL)' if IS_WSL else ''}")
logger.info(f"Base directory: {BASE_DIR}")
logger.info(f"Upload folder: {UPLOAD_FOLDER}")
logger.info(f"Trash folder: {TRASH_FOLDER}")
logger.info(f"Doc store file: {DOC_STORE_FILE}")


# Ensure necessary directories exist
def create_directories():
    """Create required directories if they don't exist"""
    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(TRASH_FOLDER, exist_ok=True)
        logger.info("Directory structure verified/created successfully")

        # Test writing permissions by creating and removing test files
        test_upload_path = os.path.join(UPLOAD_FOLDER, "test_write.tmp")
        test_trash_path = os.path.join(TRASH_FOLDER, "test_write.tmp")

        # Test upload directory
        try:
            with open(test_upload_path, "w") as f:
                f.write("test")
            os.remove(test_upload_path)
            logger.info(f"Write test successful in {UPLOAD_FOLDER}")
        except Exception as e:
            logger.error(f"Cannot write to upload folder: {e}")

        # Test trash directory
        try:
            with open(test_trash_path, "w") as f:
                f.write("test")
            os.remove(test_trash_path)
            logger.info(f"Write test successful in {TRASH_FOLDER}")
        except Exception as e:
            logger.error(f"Cannot write to trash folder: {e}")

    except Exception as e:
        logger.error(f"Error creating directories: {e}")
        # Create in current directory as fallback
        fallback_upload = os.path.join(os.getcwd(), "uploads")
        fallback_trash = os.path.join(os.getcwd(), "trash")

        os.makedirs(fallback_upload, exist_ok=True)
        os.makedirs(fallback_trash, exist_ok=True)

        logger.info(f"Created fallback directories in current working directory")
        return fallback_upload, fallback_trash

    return UPLOAD_FOLDER, TRASH_FOLDER


# Create directories
UPLOAD_FOLDER, TRASH_FOLDER = create_directories()

# backend/services/storage.py
import os
import json
import logging
import platform
from pathlib import Path

# Get configuration
try:
    from config import DOC_STORE_FILE
except ImportError:
    # Default value if config can't be imported
    DOC_STORE_FILE = 'doc_store.json'

logger = logging.getLogger(__name__)

# Detect platform
IS_WINDOWS = platform.system() == "Windows"
IS_WSL = "microsoft" in platform.uname().release.lower() if hasattr(platform, 'uname') else False

# Initialize storage
doc_store = {}
doc_counter = 0

def get_absolute_path(file_path):
    """
    Get absolute path for a file, handling Windows/WSL paths correctly.
    """
    # If path is empty, use current directory as base
    if not file_path:
        file_path = 'doc_store.json'
        logger.warning(f"Empty document store path, defaulting to: {file_path}")
    
    # Convert to absolute path if it's not already
    if not os.path.isabs(file_path):
        # Use current directory as base
        file_path = os.path.join(os.getcwd(), file_path)
        logger.info(f"Using absolute path: {file_path}")
    
    # Normalize path (handles ../ and ./ components)
    file_path = os.path.normpath(file_path)
    
    return file_path

def ensure_directory_exists(file_path):
    """
    Ensure the directory for a file exists, creating it if necessary.
    """
    directory = os.path.dirname(file_path)
    
    # Only try to create directory if path is not empty
    if directory:
        try:
            os.makedirs(directory, exist_ok=True)
            logger.info(f"Ensured directory exists: {directory}")
        except Exception as e:
            logger.error(f"Error ensuring directory exists: {e}")
            # If we can't create the directory, try to use current directory
            return os.path.join(os.getcwd(), os.path.basename(file_path))
    
    return file_path

def load_doc_store():
    """Load document store from file"""
    global doc_store, doc_counter
    
    # Get absolute path and ensure directory exists
    safe_path = get_absolute_path(DOC_STORE_FILE)
    
    if os.path.exists(safe_path):
        try:
            with open(safe_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                doc_store.update(data.get('docs', {}))
                doc_counter = data.get('counter', 0)
            logger.info(f"Loaded document store with {len(doc_store)} documents from {safe_path}")
        except Exception as e:
            logger.error(f"Error loading document store from {safe_path}: {e}")
            # Create backup if exists but corrupted
            if os.path.exists(safe_path):
                backup_file = f"{safe_path}.bak"
                try:
                    import shutil
                    shutil.copy2(safe_path, backup_file)
                    logger.info(f"Created backup of corrupted document store at {backup_file}")
                except Exception as backup_err:
                    logger.error(f"Failed to create backup: {backup_err}")
    else:
        logger.info(f"Document store file not found at {safe_path}, starting with empty store")

def save_doc_store():
    """Save document store to file"""
    global doc_store, doc_counter
    
    # Get absolute path
    safe_path = get_absolute_path(DOC_STORE_FILE)
    
    # Ensure directory exists
    safe_path = ensure_directory_exists(safe_path)
    
    data = {
        'docs': doc_store,
        'counter': doc_counter
    }
    
    try:
        # Write directly to the final file - safer than using temp files which can cause I/O issues
        with open(safe_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            # Ensure data is written to disk before closing
            f.flush()
            os.fsync(f.fileno())
            
        logger.info(f"Saved document store with {len(doc_store)} documents to {safe_path}")
    except Exception as e:
        logger.error(f"Error saving document store to {safe_path}: {e}")
        # Try saving to current directory as fallback
        try:
            fallback_path = os.path.join(os.getcwd(), 'doc_store.json')
            with open(fallback_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                # Ensure data is written to disk before closing
                f.flush()
                os.fsync(f.fileno())
            logger.info(f"Saved document store to fallback path: {fallback_path}")
        except Exception as fallback_err:
            logger.error(f"Error saving document store to fallback path: {fallback_err}")

# Load document store on module import
load_doc_store()

# backend/services/storage.py
import os
import json
import logging
from config import DOC_STORE_FILE

logger = logging.getLogger(__name__)

doc_store = {}
doc_counter = 0

def load_doc_store():
    """Load document store from file"""
    global doc_store, doc_counter
    if os.path.exists(DOC_STORE_FILE):
        try:
            with open(DOC_STORE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                doc_store.update(data.get('docs', {}))
                doc_counter = data.get('counter', 0)
            logger.info(f"Loaded document store with {len(doc_store)} documents")
        except Exception as e:
            logger.error(f"Error loading document store: {e}")
            # Create backup if exists but corrupted
            if os.path.exists(DOC_STORE_FILE):
                backup_file = f"{DOC_STORE_FILE}.bak"
                try:
                    import shutil
                    shutil.copy2(DOC_STORE_FILE, backup_file)
                    logger.info(f"Created backup of corrupted document store at {backup_file}")
                except Exception as backup_err:
                    logger.error(f"Failed to create backup: {backup_err}")

def save_doc_store():
    """Save document store to file"""
    global doc_store, doc_counter
    data = {
        'docs': doc_store,
        'counter': doc_counter
    }
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(DOC_STORE_FILE), exist_ok=True)
        
        with open(DOC_STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Saved document store with {len(doc_store)} documents")
    except Exception as e:
        logger.error(f"Error saving document store: {e}")

# Load document store on module import
load_doc_store()

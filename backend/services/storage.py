import os
import json
from config import DOC_STORE_FILE

doc_store = {}
doc_counter = 0

def load_doc_store():
    global doc_store, doc_counter
    if os.path.exists(DOC_STORE_FILE):
        try:
            with open(DOC_STORE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                doc_store.update(data.get('docs', {}))
                doc_counter = data.get('counter', 0)
        except:
            pass

def save_doc_store():
    global doc_store, doc_counter
    data = {
        'docs': doc_store,
        'counter': doc_counter
    }
    try:
        with open(DOC_STORE_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except:
        pass

def add_document(doc_id, doc_data):
    global doc_store, doc_counter
    if doc_id not in doc_store:
        doc_store[doc_id] = doc_data
        doc_counter += 1  # Increment the counter when a new document is added
        save_doc_store()

load_doc_store()
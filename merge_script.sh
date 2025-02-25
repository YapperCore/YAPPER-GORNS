#!/usr/bin/env bash
#
# setup_integration.sh
#
# Creates or overwrites files in backend/ and frontend/ to integrate
# advanced text-editor features, chunked transcription, doc management,
# trash, and real-time collaborative editing.
#
# Usage: ./setup_integration.sh

echo "=== Creating directories if needed..."
mkdir -p backend
mkdir -p backend/uploads
mkdir -p backend/trash
mkdir -p frontend/src/components/Navbar
mkdir -p frontend/src/components/TrashBucket
mkdir -p frontend/src/pages
mkdir -p frontend/src/util

echo "=== Writing backend/app.py..."
cat << 'EOF' > backend/app.py
import os
import uuid
import json
import eventlet
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from transcribe import chunked_transcribe_audio

# Disable Eventlet's green DNS and patch the stdlib
os.environ['EVENTLET_NO_GREENDNS'] = '1'
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Folders for uploads and trash
UPLOAD_FOLDER = 'uploads'
TRASH_FOLDER = 'trash'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRASH_FOLDER, exist_ok=True)

# For doc management (in-memory)
doc_store = {}
doc_counter = 0

###################################################
#     BASIC / HELLO
###################################################
@app.route('/')
def index():
    return "Backend running with integrated doc mgmt and chunked transcription."

###################################################
#     UPLOAD AUDIO => CREATE DOC => START TRANSCRIBE
###################################################
@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    global doc_counter

    if 'audio' not in request.files:
        app.logger.error("No audio file found in request.")
        return jsonify({"error": "No audio file found"}), 400

    audio_file = request.files['audio']
    file_ext = audio_file.filename.rsplit('.', 1)[-1].lower()
    unique_name = f"{uuid.uuid4()}.{file_ext}"
    save_path = os.path.join(UPLOAD_FOLDER, unique_name)

    # Save
    try:
        if os.path.exists(save_path):
            return jsonify({"error": "File already exists"}), 400
        audio_file.save(save_path)
        app.logger.info(f"Saved file to: {save_path}")
    except Exception as e:
        app.logger.error(f"Error saving file: {e}")
        return jsonify({"error": "File saving failed"}), 500

    # Create a doc automatically, store in doc_store
    doc_counter += 1
    doc_id = str(uuid.uuid4())
    doc_name = f"Doc{doc_counter}"
    doc_obj = {
        "id": doc_id,
        "name": doc_name,
        "content": "",
    }
    doc_store[doc_id] = doc_obj

    # Start chunked transcription in background
    socketio.start_background_task(background_transcription, save_path, doc_id)

    return jsonify({
        "message": "File received and doc created",
        "filename": unique_name,
        "doc_id": doc_id
    }), 200

def background_transcription(file_path, doc_id):
    try:
        chunk_buffer = []
        # We call chunked_transcribe_audio generator
        for i, total, text in chunked_transcribe_audio(file_path):
            chunk_buffer.append({
                'chunk_index': i,
                'total_chunks': total,
                'text': text
            })
            # If we have 5 chunks, emit partial
            if len(chunk_buffer) >= 5:
                socketio.emit('partial_transcript_batch', {
                    'doc_id': doc_id,
                    'chunks': chunk_buffer
                })
                socketio.sleep(0.1)
                # Also append them to doc content
                append_to_doc(doc_id, chunk_buffer)
                chunk_buffer = []

        # leftover
        if chunk_buffer:
            socketio.emit('partial_transcript_batch', {
                'doc_id': doc_id,
                'chunks': chunk_buffer
            })
            socketio.sleep(0.1)
            append_to_doc(doc_id, chunk_buffer)

        # final
        socketio.emit('final_transcript', {
            'doc_id': doc_id,
            'done': True
        })

    except Exception as e:
        app.logger.error(f"Error during transcription: {e}")

def append_to_doc(doc_id, chunk_list):
    """Append chunk texts into doc_store[doc_id]['content']. """
    doc = doc_store.get(doc_id)
    if not doc:
        return
    combined_text = doc["content"]
    for chunk in chunk_list:
        combined_text += "\n" + chunk["text"]
    doc["content"] = combined_text

###################################################
#    DELETE FILE => MOVE TO TRASH
###################################################
@app.route('/delete_file/<filename>', methods=['DELETE'])
def delete_file(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    trash_path = os.path.join(TRASH_FOLDER, filename)

    if os.path.exists(file_path):
        os.rename(file_path, trash_path)
        app.logger.info(f"Deleted file => moved to trash: {file_path}")
        return jsonify({"message": "File moved to trash"}), 200
    else:
        return jsonify({"message": "File not found"}), 404

###################################################
#    LIST TRASH
###################################################
@app.route('/trash-files', methods=['GET'])
def get_trash_files():
    try:
        files = os.listdir(TRASH_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error fetching trash files: {e}")
        return jsonify({"error": "Failed to fetch trash files"}), 500

###################################################
#    RESTORE FILE
###################################################
@app.route('/restore_file/<filename>', methods=['GET'])
def restore_file(filename):
    trash_path = os.path.join(TRASH_FOLDER, filename)
    upload_path = os.path.join(UPLOAD_FOLDER, filename)

    try:
        if os.path.exists(trash_path):
            os.rename(trash_path, upload_path)
            app.logger.info(f"Restored file: {trash_path}")
            return jsonify({"message": "File restored"}), 200
        else:
            return jsonify({"message": "File not found in trash"}), 404
    except Exception as e:
        app.logger.error(f"Error restoring file: {e}")
        return jsonify({"message": f"Error restoring file: {str(e)}"}), 500

###################################################
#    LIST UPLOAD FILES
###################################################
@app.route('/upload-files', methods=['GET'])
def get_upload_files():
    try:
        files = os.listdir(UPLOAD_FOLDER)
        return jsonify({"files": files}), 200
    except Exception as e:
        app.logger.error(f"Error fetching upload files: {e}")
        return jsonify({"error": "Failed to fetch upload files"}), 500

###################################################
#    DOC MANAGEMENT
###################################################
@app.route('/api/docs', methods=['GET'])
def list_docs():
    return jsonify(list(doc_store.values())), 200

@app.route('/api/docs', methods=['POST'])
def create_doc():
    global doc_counter
    data = request.json or {}
    doc_counter += 1
    default_name = f"Doc{doc_counter}"

    name = data.get('name', default_name)
    content = data.get('content', '')
    doc_id = str(uuid.uuid4())

    doc_obj = {
        "id": doc_id,
        "name": name,
        "content": content
    }
    doc_store[doc_id] = doc_obj

    return jsonify(doc_obj), 201

@app.route('/api/docs/<doc_id>', methods=['GET'])
def get_doc(doc_id):
    doc = doc_store.get(doc_id)
    if not doc:
        return jsonify({"error": "Doc not found"}), 404
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['PUT'])
def update_doc(doc_id):
    data = request.json or {}
    doc = doc_store.get(doc_id)
    if not doc:
        # create it if not found
        doc = {
            "id": doc_id,
            "name": data.get('name', 'DocX'),
            "content": data.get('content', '')
        }
        doc_store[doc_id] = doc

    doc['name'] = data.get('name', doc['name'])
    doc['content'] = data.get('content', doc['content'])
    return jsonify(doc), 200

@app.route('/api/docs/<doc_id>', methods=['DELETE'])
def delete_doc(doc_id):
    if doc_id in doc_store:
        del doc_store[doc_id]
    return jsonify({"message": "Doc deleted"}), 200

###################################################
#   SOCKET.IO for Real-Time Doc Editing
###################################################
@socketio.on('join_doc')
def handle_join_doc(data):
    doc_id = data.get('doc_id')
    join_room(doc_id)
    doc = doc_store.get(doc_id)
    if doc:
        # Send current content
        emit('doc_content_update', {
            "doc_id": doc_id,
            "content": doc['content']
        })

@socketio.on('edit_doc')
def handle_edit_doc(data):
    doc_id = data.get('doc_id')
    content = data.get('content')
    doc = doc_store.get(doc_id)
    if doc:
        doc['content'] = content
    emit('doc_content_update', {
        "doc_id": doc_id,
        "content": content
    }, room=doc_id, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
EOF

echo "=== Writing backend/transcribe.py..."
cat << 'EOF' > backend/transcribe.py
import os
import math
import torch
import torchaudio
from transformers import Speech2TextProcessor, Speech2TextForConditionalGeneration

# We can force sox_io
torchaudio.set_audio_backend("soundfile")
if os.name == 'posix':
    # Possibly for mac
    try:
        import platform
        if platform.system() == "Darwin":
            torchaudio.set_audio_backend("sox_io")
    except:
        pass

LOCAL_MODEL_PATH = os.path.join(os.getcwd(), "s2t-small-librispeech-asr")

def chunked_transcribe_audio(audio_path, chunk_sec=5, model_path=LOCAL_MODEL_PATH):
    processor = Speech2TextProcessor.from_pretrained(model_path)
    model = Speech2TextForConditionalGeneration.from_pretrained(model_path)

    speech, sr = torchaudio.load(audio_path)
    if speech.shape[0] > 1:
        speech = torch.mean(speech, dim=0, keepdim=True)

    target_sr = 16000
    if sr != target_sr:
        resampler = torchaudio.transforms.Resample(sr, target_sr)
        speech = resampler(speech)
        sr = target_sr

    signal = speech.squeeze()
    total_len_sec = signal.shape[0] / sr
    num_chunks = math.ceil(total_len_sec / chunk_sec)

    for i in range(num_chunks):
        start = int(i * chunk_sec * sr)
        end = int((i + 1) * chunk_sec * sr)
        audio_chunk = signal[start:end]
        if audio_chunk.shape[0] == 0:
            break

        inputs = processor(audio_chunk.numpy(), sampling_rate=sr, return_tensors="pt")
        with torch.no_grad():
            generated_ids = model.generate(inputs["input_features"], attention_mask=inputs["attention_mask"])
        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        yield (i+1, num_chunks, text)
EOF

echo "=== Writing frontend/src/App.js..."
cat << 'EOF' > frontend/src/App.js
import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import TranscriptionEditor from './TranscriptionEditor';
import DocEditor from './DocEditor';
import Home from './pages/Home';
import Trash from './pages/Trash';

/**
 * Integrates:
 * - Home page (upload + doc creation + partial transcripts)
 * - /trash page
 * - /transcription/:docId -> real-time transcription
 * - /docs/* -> doc mgmt
 */

function App() {
  return (
    <Router>
      <div className="App">
        <nav style={{ background: '#333', color: '#fff', padding: '1rem' }}>
          <Link to="/" style={{ color: '#fff', marginRight: '1rem' }}>Home</Link>
          <Link to="/trash" style={{ color: '#fff', marginRight: '1rem' }}>Trash</Link>
          <Link to="/docs" style={{ color: '#fff' }}>Docs</Link>
        </nav>
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/docs/*" element={<DocEditor />} />
          <Route path="/transcription/:docId" element={<TranscriptionEditor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
EOF

echo "=== Writing frontend/src/pages/Home.js..."
cat << 'EOF' > frontend/src/pages/Home.js
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

function Home() {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);

  useEffect(() => {
    const socket = io();
    // Listen for partial transcripts
    socket.on('partial_transcript_batch', (data) => {
      const lines = data.chunks.map(
        c => `Chunk ${c.chunk_index}/${c.total_chunks}: ${c.text}`
      );
      setTranscripts(prev => [...prev, ...lines]);
    });
    socket.on('final_transcript', (data) => {
      setTranscripts(prev => [...prev, "Transcription complete."]);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if(!file){
      setUploadMessage("No file selected");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('audio', file);

      const res = await fetch('/upload-audio', {
        method: 'POST',
        body: formData
      });
      if(res.ok){
        const data = await res.json();
        setUploadMessage(data.message || 'Upload succeeded');
        if(data.doc_id){
          // open new tab to /transcription/:docId
          window.open(`/transcription/${data.doc_id}`, '_blank');
        }
      }else{
        const errData = await res.json();
        setUploadMessage(errData.error || 'Upload failed');
      }
    } catch(err){
      console.error("Upload error:", err);
      setUploadMessage('Upload failed');
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Home - Upload Audio</h2>
      <div style={{ margin: '1rem 0' }}>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>Submit</button>
      </div>
      {uploadMessage && <p>{uploadMessage}</p>}

      <div style={{ marginTop: '2rem' }}>
        <h3>Transcription Output (global, just test):</h3>
        {transcripts.map((t, i) => (
          <div key={i}>{t}</div>
        ))}
      </div>
    </div>
  );
}

export default Home;
EOF

echo "=== Writing frontend/src/pages/Trash.js..."
cat << 'EOF' > frontend/src/pages/Trash.js
import React from 'react';
import Navbar from '../components/Navbar/Navbar';
import TrashBucket from '../components/TrashBucket/TrashBucket';

const Trash = () => {
  return (
    <div className="trash-page">
      <Navbar />
      <TrashBucket />
    </div>
  );
};

export default Trash;
EOF

echo "=== Writing frontend/src/components/Navbar/Navbar.css..."
cat << 'EOF' > frontend/src/components/Navbar/Navbar.css
.Navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #333;
  color: white;
}

.Navbar h1 {
  margin: 0;
}

.logo {
  font-size: 1.5rem;
  margin: 0;
}

.nav-links {
  list-style: none;
  display: flex;
  gap: 1rem;
  margin: 0;
}

.nav-links li {
  margin: 0;
}

.nav-links li a {
  color: white;
  text-decoration: none;
  font-size: 1rem;
}

.nav-links a:hover {
  text-decoration: underline;
}
EOF

echo "=== Writing frontend/src/components/Navbar/Navbar.js..."
cat << 'EOF' > frontend/src/components/Navbar/Navbar.js
import React from 'react';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="Navbar">
      <h1 className="logo">Yapper</h1>
      <ul className="nav-links">
        <li><a href="/">Home</a></li>
        <li><a href="/trash">Trash</a></li>
        <li><a href="/docs">Docs</a></li>
      </ul>
    </nav>
  );
};

export default Navbar;
EOF

echo "=== Writing frontend/src/components/TrashBucket/TrashBucket.css..."
cat << 'EOF' > frontend/src/components/TrashBucket/TrashBucket.css
.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: calc(10px + 2vmin);
  color: white;
}

.TrashBucket-container {
  margin-top: 20px;
  padding: 20px;
  border: 2px solid #ccc;
  border-radius: 12px;
  background-color: #f9f9f9;
  width: 80%;
  margin-left: auto;
  margin-right: auto;
}

.TrashBucket {
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.TrashBucket h3 {
  margin-bottom: 1rem;
  color: #343a40;
}

.TrashBucket ul {
  padding: 0;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-gap: 0.5em; 
  list-style-type: none;
}

.trash-item {
  padding: 5px; 
  background-color: #090909;
  border-radius: 5px;
  color: white;
}

.trash-item:hover {
  background-color: #54525b; 
  color: #fff;
}

.trash-filename {
  color: #fefeff;
  font-weight: 500;
}

.delete-button {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
}

.delete-button:hover {
  background-color: #c82333;
}

p {
  color: #495057;
  font-weight: 500;
  margin-top: 1rem;
}
EOF

echo "=== Writing frontend/src/components/TrashBucket/TrashBucket.js..."
cat << 'EOF' > frontend/src/components/TrashBucket/TrashBucket.js
import React, { useState, useEffect } from 'react';
import './TrashBucket.css';
import { Restore } from '../../util/confirmable';

const TrashBucket = () => {
  const [trashFiles, setTrashFiles] = useState([]);

  const handleRestore = async (filename) => {
    try {
        const response = await fetch(`/restore_file/${filename}`, {
            method: 'GET',
        });

        if (response.ok) {
            setTrashFiles((prev) => prev.filter((f) => f !== filename));
        } else {
            const data = await response.json();
            alert(`Error restoring file: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error restoring file');
    }
  };

  useEffect(() => {
    const fetchTrash = async () => {
      try {
        const res = await fetch('/trash-files');
        if(res.ok){
          const data = await res.json();
          setTrashFiles(data.files);
        }
      } catch(err){
        console.error("Error fetching trash files:", err);
      }
    };
    fetchTrash();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h3>Trash Bucket</h3>
        <div className="TrashBucket-container">
          <div className="TrashBucket">
            <ul className="trash-list">
              {trashFiles.map((file, i) => (
                <li key={i} className="trash-item">
                  <span className="trash-filename">{file}</span>
                  <Restore onRestore={() => handleRestore(file)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>
    </div>
  );
};

export default TrashBucket;
EOF

echo "=== Writing frontend/src/App.css..."
cat << 'EOF' > frontend/src/App.css
.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: calc(10px + 2vmin);
  color: white;
}

.Doclist-container {
  margin-top: 20px;
  padding: 20px;
  border: 2px solid #ccc;
  border-radius: 12px;
  background-color: #f9f9f9;
  width: 80%;
  margin-left: auto;
  margin-right: auto;
}

.Doclist ul {
  padding: 0;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-gap: 0.5em; 
  list-style-type: none;
}

.Doclist li {
  padding: 5px; 
  background-color: #090909;
  border-radius: 5px;
  color: white;
}

.Doclist li:hover {
  background-color: #54525b; 
  color: #fff;
}
EOF

echo "=== Writing frontend/src/util/confirmable.js..."
cat << 'EOF' > frontend/src/util/confirmable.js
import React, { useRef } from 'react';
import { ConfirmPopup, confirmPopup } from 'primereact/confirmpopup';
import { Toast } from 'primereact/toast';
import { Button } from 'primereact/button';

export default function Confirmable({ onDelete }) {
    const toast = useRef(null);

    const accept = async () => {
        try {
            await onDelete();
            toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'Deleted successfully', life: 3000 });
        } catch (err) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to delete', life: 3000 });
        }
    };

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
    };

    const confirmDelete = (event) => {
        confirmPopup({
            target: event.currentTarget,
            message: 'Do you want to delete this item?',
            icon: 'pi pi-info-circle',
            defaultFocus: 'reject',
            acceptClassName: 'p-button-danger',
            accept,
            reject
        });
    };

    return (
        <>
            <Toast ref={toast} />
            <ConfirmPopup />
            <Button onClick={confirmDelete} icon="pi pi-times" label="Delete" className="p-button-danger" />
        </>
    );
}

export function Restore({ onRestore }) {
    const toast = useRef(null);

    const accept = async () => {
        try {
            await onRestore();
            toast.current?.show({ severity: 'info', summary: 'Restored', detail: 'Item restored successfully', life: 3000 });
        } catch (err) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to restore', life: 3000 });
        }
    };

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Rejected', detail: 'Restoration cancelled', life: 3000 });
    };

    const confirmRestore = (event) => {
        confirmPopup({
            target: event.currentTarget,
            message: 'Do you want to restore this item?',
            icon: 'pi pi-info-circle',
            defaultFocus: 'accept',
            acceptClassName: 'p-button-success',
            accept,
            reject
        });
    };

    return (
        <>
            <Toast ref={toast} />
            <ConfirmPopup />
            <Button onClick={confirmRestore} icon="pi pi-check" label="Restore" className="p-button-success" />
        </>
    );
}
EOF

echo "=== Writing frontend/src/DocEditor.js (for doc mgmt) ..."
cat << 'EOF' > frontend/src/DocEditor.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

/**
 * Minimal doc mgmt: lists docs from in-memory store, can create/edit.
 */

export default function DocEditor() {
  return (
    <Routes>
      <Route path="/" element={<DocList />} />
      <Route path="new" element={<DocCreate />} />
      <Route path="edit/:docId" element={<DocEdit />} />
    </Routes>
  );
}

function DocList() {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    fetch('/api/docs')
      .then(r => r.json())
      .then(data => setDocs(data))
      .catch(err => console.error("Error listing docs:", err));
  }, []);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      if(res.ok){
        setDocs(prev => prev.filter(d => d.id !== id));
      }
    } catch(err){
      console.error("Error deleting doc:", err);
    }
  };

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2>Documents</h2>
      <Link to="new"><button>Create New Doc</button></Link>
      <ul>
        {docs.map(d => (
          <li key={d.id}>
            {d.name} | <Link to={`edit/${d.id}`}><button>Edit</button></Link>
            <button onClick={() => handleDelete(d.id)} style={{ marginLeft: '1rem' }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocCreate() {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({name, content})
      });
      if(res.ok){
        const doc = await res.json();
        navigate(`edit/${doc.id}`);
      }
    } catch(err){
      console.error("Error creating doc:", err);
    }
  };

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2>Create Doc</h2>
      <p>
        Name:
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginLeft:'0.5rem' }}/>
      </p>
      <p>Content:</p>
      <ReactQuill theme="snow" value={content} onChange={setContent} />
      <button onClick={handleSubmit}>Create</button>
    </div>
  );
}

function DocEdit() {
  const { docId } = useParams();
  const [doc, setDoc] = useState(null);
  const [socket, setSocket] = useState(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch(`/api/docs/${docId}`)
      .then(r => r.json())
      .then(data => {
        if(!data.error){
          setDoc(data);
          setContent(data.content || '');
        }
      })
      .catch(err => console.error("Error loading doc:", err));
  }, [docId]);

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.emit('join_doc', { doc_id: docId });

    const handleDocUpdate = (update) => {
      if(update.doc_id === docId){
        setContent(update.content);
      }
    };
    s.on('doc_content_update', handleDocUpdate);

    return () => {
      s.off('doc_content_update', handleDocUpdate);
      s.disconnect();
    };
  }, [docId]);

  const handleQuillChange = (val) => {
    setContent(val);
    if(socket){
      socket.emit('edit_doc', { doc_id: docId, content: val });
    }
  };

  const handleSave = async () => {
    if(!doc) return;
    try {
      const res = await fetch(`/api/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: doc.name, content })
      });
      if(!res.ok) console.error("Error saving doc");
    } catch(err){
      console.error("Error saving doc:", err);
    }
  };

  if(!doc) {
    return <div>Loading doc...</div>
  }

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2>Edit Doc</h2>
      <p>
        Doc Name:
        <input
          style={{ marginLeft:'0.5rem' }}
          value={doc.name}
          onChange={(e) => setDoc({...doc, name: e.target.value})}
          onBlur={handleSave}
        />
      </p>
      <ReactQuill theme="snow" value={content} onChange={handleQuillChange} style={{ minHeight: '300px', background:'#fff' }}/>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
EOF

echo "=== Writing frontend/src/TranscriptionEditor.js..."
cat << 'EOF' > frontend/src/TranscriptionEditor.js
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function TranscriptionEditor() {
  const { docId } = useParams();
  const socketRef = useRef(null);
  const [content, setContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // fetch doc initial content
    (async () => {
      try {
        const res = await fetch(`/api/docs/${docId}`);
        if(res.ok){
          const data = await res.json();
          setContent(data.content || '');
        }
      } catch(err){
        console.error("Error fetching doc:", err);
      }
    })();
  }, [docId]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.emit('join_doc', { doc_id: docId });

    const handlePartial = (data) => {
      if(data.doc_id === docId){
        let updated = content;
        data.chunks.forEach((ch) => {
          updated += '\n' + ch.text;
        });
        setContent(updated);
      }
    };
    const handleFinal = (data) => {
      if(data.doc_id === docId && data.done){
        setIsComplete(true);
      }
    };
    const handleDocUpdate = (upd) => {
      if(upd.doc_id === docId){
        setContent(upd.content);
      }
    };

    socket.on('partial_transcript_batch', handlePartial);
    socket.on('final_transcript', handleFinal);
    socket.on('doc_content_update', handleDocUpdate);

    return () => {
      socket.off('partial_transcript_batch', handlePartial);
      socket.off('final_transcript', handleFinal);
      socket.off('doc_content_update', handleDocUpdate);
      socket.disconnect();
    };
  }, [docId, content]);

  const handleChange = (val) => {
    setContent(val);
    if(socketRef.current){
      socketRef.current.emit('edit_doc', { doc_id: docId, content: val });
    }
  };

  return (
    <div style={{ background:'#f5f5f5', minHeight:'100vh', padding:'1rem' }}>
      <h2>Transcription for Doc: {docId}</h2>
      {isComplete && <p style={{ color:'green' }}>Transcription Complete!</p>}

      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleChange}
        style={{ height:'600px', background:'#fff' }}
      />
    </div>
  );
}
EOF

echo "=== Writing frontend/src/index.js..."
cat << 'EOF' > frontend/src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
EOF

echo "=== Writing frontend/src/index.css..."
cat << 'EOF' > frontend/src/index.css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
EOF

echo "=== Writing frontend/src/reportWebVitals.js..."
cat << 'EOF' > frontend/src/reportWebVitals.js
const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};
export default reportWebVitals;
EOF

echo "=== Creating sample test files (optional) ..."
mkdir -p frontend/src/__tests__
cat << 'EOF' > frontend/src/__tests__/App.test.js
import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders something', () => {
  render(<App />);
  const linkElement = screen.getByText(/Home/i);
  expect(linkElement).toBeInTheDocument();
});
EOF

echo "=== Writing setupTests.js..."
cat << 'EOF' > frontend/src/setupTests.js
import '@testing-library/jest-dom';
EOF

echo "=== Done. Now your integrated code is placed in backend/ and frontend/src."
echo "=== 1) cd backend && python app.py (or flask run) to start server, or use python -m flask run"
echo "=== 2) cd ../frontend && npm install && npm start"
echo "=== Then visit http://localhost:3000/ in your browser."
EOF

chmod +x setup_integration.sh

cat << 'EOF' > setup_integration.vim
" A tiny Vimscript snippet to create the same files if run in Vim,
" though it's more typical to use the .sh script. This is just a placeholder.

command! SetupIntegration :!./setup_integration.sh
EOF

echo "Created setup_integration.sh and setup_integration.vim."
echo "Usage:"
echo "  chmod +x setup_integration.sh"
echo "  ./setup_integration.sh"
echo "Then run your app as usual."


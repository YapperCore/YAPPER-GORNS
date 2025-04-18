import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import '../static/Home.css';
import Confirmable from '../util/confirmable';
import { Toast } from 'primereact/toast';
import 'primereact/resources/themes/saga-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import { useAuth } from '../context/AuthContext';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';

function Home() {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [docToMove, setDocToMove] = useState(null);
  const [transcriptionConfig, setTranscriptionConfig] = useState({});
  const [transcriptionPrompt, setTranscriptionPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const { currentUser } = useAuth();
  const toast = useRef(null);

  useEffect(() => {
    const socket = io();
    socket.on('partial_transcript_batch', data => {
      const lines = data.chunks.map(
        c => `Chunk ${c.chunk_index}/${c.total_chunks}: ${c.text}`
      );
      setTranscripts(prev => [...prev, ...lines]);
    });
    socket.on('final_transcript', data => {
      setTranscripts(prev => [...prev, "Transcription complete."]);
    });

    async function fetchDocs() {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/docs', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const d = await res.json();
          setDocs(Array.isArray(d) ? d : []);
        } catch (err) {
          console.error("Error fetching docs:", err);
          setDocs([]);
        }
      }
    }
    fetchDocs();

    async function fetchFolders() {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/folders', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const data = await res.json();
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
        } catch (err) {
          console.error("Error fetching folders:", err);
          setFolders([]);
        }
      }
    }
    fetchFolders();

    async function fetchSettings() {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/user-settings', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          if (res.ok) {
            const settings = await res.json();
            if (settings.transcriptionConfig) {
              setTranscriptionConfig(settings.transcriptionConfig);
              setShowPromptInput(settings.transcriptionConfig.mode === 'replicate');
            }
          }
        } catch (err) {
          console.error("Error fetching settings:", err);
        }
      }
    }

    fetchSettings();

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  const handleFileChange = e => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("No file selected!");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('audio', file);

      // If using Replicate, make sure we have a prompt (default or custom)
      if (transcriptionConfig.mode === 'replicate') {
        const finalPrompt = transcriptionPrompt.trim() ||
          "Please transcribe this audio file accurately, preserving all speech content. This is a speech-to-text transcription task.";
        formData.append('transcription_prompt', finalPrompt);
      }

      const token = await currentUser.getIdToken();
      const res = await fetch('/upload-audio', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setUploadMessage(data.message || "Upload succeeded");

        if (data.doc_id) {
          window.open(`/transcription/${data.doc_id}`, '_blank');
        }

        const docsRes = await fetch('/api/docs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (docsRes.ok) {
          const docData = await docsRes.json();
          setDocs(Array.isArray(docData) ? docData : []);
        }
      } else {
        const errData = await res.json();
        setUploadMessage(errData.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadMessage("Upload failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setDocs(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      console.error("Error deleting doc:", err);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = window.prompt("Enter the name of the folder:");
    if (!folderName) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ folderName })
      });

      if (res.ok) {
        const data = await res.json();
        toast.current?.show({ severity: 'success', summary: 'Folder Created', detail: data.message, life: 3000 });
        await fetchFolders(); // Re-fetch folders after creating a new one
      } else {
        const errData = await res.json();
        toast.current?.show({ severity: 'error', summary: 'Error', detail: errData.error || 'Failed to create folder', life: 3000 });
      }
    } catch (err) {
      console.error("Error creating folder:", err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to create folder', life: 3000 });
    }
  };

   // Define fetchFolders here to be accessible by handleCreateFolder and useEffect
   const fetchFolders = async () => {
     if (currentUser) {
       try {
         const token = await currentUser.getIdToken();
         const res = await fetch('/api/folders', {
           headers: {
             Authorization: `Bearer ${token}`
           }
         });
         if (res.ok) {
           const data = await res.json();
           setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []);
         } else {
           console.error("Error fetching folders:", res.statusText);
           setFolders([]);
         }
       } catch (err) {
         console.error("Error fetching folders:", err);
         setFolders([]);
       }
     }
   };


  const handleFolderClick = (folderName) => {
    window.location.href = `/folders/${folderName}`;
  };

  const handleOpenMoveModal = (docId) => {
    setDocToMove(docId);
    setShowMoveModal(true);
  };

  const handleCloseMoveModal = () => {
    setShowMoveModal(false);
    setSelectedFolder("");
    setDocToMove(null);
  };

  const handleMoveToFolder = async () => {
    if (!selectedFolder) {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Please select a folder.', life: 3000 });
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/folders/${selectedFolder}/add/${docToMove}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        toast.current?.show({ severity: 'success', summary: 'Document Moved', detail: data.message, life: 3000 });
        setShowMoveModal(false);
        setSelectedFolder("");
        setDocToMove(null);

        // Re-fetch docs after moving to potentially update its status or location info if needed
        const docsRes = await fetch('/api/docs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (docsRes.ok) {
          const docData = await docsRes.json();
          setDocs(Array.isArray(docData) ? docData : []);
        }
      } else {
        const errData = await res.json();
        toast.current?.show({ severity: 'error', summary: 'Error', detail: errData.error || 'Failed to move document', life: 3000 });
      }
    } catch (err) {
      console.error("Error moving document:", err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to move document', life: 3000 });
    }
  };

  return (
    <div className="home-container">
      <Toast ref={toast} position="top-right" />

      <h2>Home - Upload Audio =&gt; Create Doc</h2>
      <div className="upload-section">
        {showPromptInput && (
          <div className="prompt-input" style={{
            float: 'right',
            width: '30%',
            padding: '10px',
            background: '#f7f7f7',
            borderRadius: '5px',
            marginBottom: '10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Replicate API Prompt:
            </p>
            <textarea
              placeholder="Enter transcription prompt for Replicate API (defaults to standard speech-to-text prompt if empty)"
              value={transcriptionPrompt}
              onChange={(e) => setTranscriptionPrompt(e.target.value)}
              style={{
                width: '100%',
                height: '80px',
                marginBottom: '5px',
                padding: '8px',
                fontSize: '0.9rem'
              }}
              rows={3}
            />
            <small style={{ display: 'block', color: '#666', fontSize: '0.8rem' }}>
              This prompt will guide the AI model in transcribing your audio.
            </small>
          </div>
        )}

        <div style={{ width: showPromptInput ? '65%' : '100%' }}>
          <input
            type="file"
            onChange={handleFileChange}
            className="file-input"
          />
          <button
            onClick={handleUpload}
            className="upload-button"
          >
            Submit
          </button>
          <p className="message" style={{ clear: 'both' }}>{uploadMessage}</p>
        </div>
      </div>

      <hr className="divider" style={{ clear: 'both' }} />
      <div>
        <button onClick={handleCreateFolder} className="action-link edit-link">Create Folder</button>
      </div>
      <hr className="divider" />
      <div>
        <h3>Folders:</h3>
        <div className="docs-grid">
          {folders.map(folder => (
            <div key={folder} className="doc-card" onClick={() => handleFolderClick(folder)}>
              <h4 className="doc-title">{folder}</h4>
            </div>
          ))}
        </div>
      </div>

      <hr style={{ border: '1px solid black', margin: '1rem 0' }} />

      <div>
        <h3>Docs in Session:</h3>
        <div className="docs-grid">
          {docs.map(doc => (
            <div key={doc.id} className="doc-card">
              <h4 className="doc-title">{doc.name}</h4>
              {doc.audioFilename && (
                <p className="audio-info">
                  Audio: {doc.audioFilename}
                  {doc.audioTrashed && ' [TRASHED]'}
                </p>
              )}

              <div className="doc-actions">
                {/* Corrected line: Added opening <a> tag */}
                <a
                  href={`/transcription/${doc.id}`}
                  rel="noreferrer"
                  className="action-link transcription-link"
                >
                  View Doc
                </a>
                {/* Corrected line: Added opening <a> tag */}
                <a
                  href={`/docs/edit/${doc.id}`}
                  rel="noreferrer"
                  className="action-link edit-link"
                >
                  Edit Doc
                </a>
                <Confirmable
                  onDelete={() => handleDelete(doc.id)}
                  toast={toast}
                />
                <button
                  onClick={() => handleOpenMoveModal(doc.id)}
                  className="action-link move-link orange-button"
                >
                  Move to Folder
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        header="Move Document to Folder"
        visible={showMoveModal}
        style={{ width: '30vw' }}
        onHide={handleCloseMoveModal}
        footer={
          <div>
            <button
              className="p-button p-component p-button-text"
              onClick={handleCloseMoveModal}
            >
              Cancel
            </button>
            <button
              className="p-button p-component p-button-primary"
              onClick={handleMoveToFolder}
            >
              Move
            </button>
          </div>
        }
      >
        <div>
          <Dropdown
            value={selectedFolder}
            options={folders.map(folder => ({ label: folder, value: folder }))}
            onChange={(e) => setSelectedFolder(e.value)}
            placeholder="Select a folder"
            style={{ width: '100%' }}
          />
        </div>
      </Dialog>
    </div>
  );
}

export default Home;

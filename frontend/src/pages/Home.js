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
  const [docs, setDocs] = useState([]); // make sure docs is an array
  const [folders, setFolders] = useState([]);
  const { currentUser } = useAuth();
  const toast = useRef(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [docToMove, setDocToMove] = useState(null);

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
          // Ensure that docs is an array. If not, log an error and default to [].
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
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []); // Extract the 'dotFiles' key
        } catch (err) {
          console.error("Error fetching folders:", err);
          setFolders([]);
        }
      }
    }
    fetchFolders();

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
    const folderName = prompt("Enter the name of the folder:");
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
        // Re-fetch folders after successful creation
        await fetchFolders();
      } else {
        const errData = await res.json();
        toast.current?.show({ severity: 'error', summary: 'Error', detail: errData.error || 'Failed to create folder', life: 3000 });
      }
    } catch (err) {
      console.error("Error creating folder:", err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to create folder', life: 3000 });
    }
  };

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
          setFolders(Array.isArray(data.dotFiles) ? data.dotFiles : []); // Extract the 'dotFiles' key
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

  useEffect(() => {
    fetchFolders();
  }, [currentUser]);

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

        // Re-fetch documents after successful move
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

      <h2>Home - Upload Audio ={'>'} Create Doc</h2>
      <div className="upload-section">
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
      </div>
      <p className="message">{uploadMessage}</p>

      <hr className="divider" />
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
                <a
                  href={`/transcription/${doc.id}`}
                  rel="noreferrer"
                  className="action-link transcription-link"
                >
                  View Doc
                </a>
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

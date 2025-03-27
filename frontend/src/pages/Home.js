import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import '../static/Home.css';
import Confirmable from '../util/confirmable';
import 'primereact/resources/themes/saga-blue/theme.css';  
import 'primereact/resources/primereact.min.css';          
    

function Home() {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [docs, setDocs] = useState([]);

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

    fetch('/api/docs')
      .then(r => r.json())
      .then(d => setDocs(d))
      .catch(err => console.error("Error docs:", err));

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleFileChange = e => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if(!file){
      setUploadMessage("No file selected!");
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
        setUploadMessage(data.message || "Upload succeeded");
        if(data.doc_id){
          window.open(`/transcription/${data.doc_id}`, '_blank');
        }
        const dres = await fetch('/api/docs');
        if(dres.ok){
          const docData = await dres.json();
          setDocs(docData);
        }
      } else {
        const eData = await res.json();
        setUploadMessage(eData.error || "Upload failed");
      }
    } catch(err){
      console.error("Upload error:", err);
      setUploadMessage("Upload failed");
    }
  };

  const handleDelete = async (id) => {
    try {
      const url = `/api/docs/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        setDocs(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      console.error("Error deleting doc:", err);
    }
  };

  return (
    <div className="home-container">
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
                  target="_blank" 
                  rel="noreferrer"
                  className="action-link transcription-link"
                >
                  View Doc
                </a>
                <a 
                  href={`/docs/edit/${doc.id}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="action-link edit-link"
                >
                  Edit Doc
                </a>
                <Confirmable 
                  onDelete={() => handleDelete(doc.id)} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <hr className="divider" />
    </div>
  );
}

export default Home;
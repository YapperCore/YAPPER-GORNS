import './App.css';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

/**
 * This is used by the Home page to show partial transcripts and let user upload.
 * We also show "Docs in session" but we only do the doc listing + links here.
 * The "Delete" of doc is done via /api/docs/<docId> in the Docs page
 * or you could do it here if you want. 
 */
function App() {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const socket = io();
    socket.on('partial_transcript_batch', data => {
      if(!data || !data.chunks) return;
      const lines = data.chunks.map(ch =>
        \`[Doc \${data.doc_id}] chunk \${ch.chunk_index}/\${ch.total_chunks}: \${ch.text}\`
      );
      setTranscripts(prev => [...prev, ...lines]);
    });
    socket.on('final_transcript', data => {
      if(data && data.doc_id && data.done) {
        setTranscripts(prev => [...prev, \`[Doc \${data.doc_id}] Transcription complete.\`]);
      }
    });

    fetchDocs();

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/docs');
      if(res.ok) {
        const data = await res.json();
        setDocs(data);
      }
    } catch(err) {
      console.error("Docs fetch error:", err);
    }
  };

  const handleFileChange = e => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if(!file) {
      setMsg("No file selected!");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch('/upload-audio', {
        method:'POST',
        body: formData
      });
      if(res.ok) {
        const data = await res.json();
        setMsg(data.message || "File uploaded successfully");
        fetchDocs();
      } else {
        const eData = await res.json();
        setMsg(eData.error || "Upload failed");
      }
    } catch(err) {
      console.error("Upload error:", err);
      setMsg("Upload failed");
    }
  };

  return (
    <div className="App" style={{ padding:'1rem' }}>
      <h2>Upload & Transcription (Home)</h2>
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>Upload</button>
      </div>
      <p>{msg}</p>

      <hr/>
      <div>
        <h3>Docs in Session:</h3>
        <ul>
          {docs.map(doc => (
            <li key={doc.id}>
              {doc.name}
              {doc.audioFilename ? \` (Audio: \${doc.audioFilename}\${doc.audioTrashed?' [TRASHED]':''})\` : ''}
              &nbsp;|&nbsp;
              <a href={\`/transcription/\${doc.id}\`} target="_blank" rel="noreferrer">Transcription</a>
              &nbsp;|&nbsp;
              <a href={\`/docs/edit/\${doc.id}\`} target="_blank" rel="noreferrer">Edit</a>
            </li>
          ))}
        </ul>
      </div>

      <hr/>
      <div>
        <h3>Partial Transcript Logs</h3>
        {transcripts.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

export default App;

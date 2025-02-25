import './App.css';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

/**
 * The Home page content for uploading audio => doc => partial transcripts
 * plus listing docs (but we don't delete from here, we do that in /docs).
 */
function App() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [docs, setDocs] = useState([]);
  const [transcripts, setTranscripts] = useState([]);

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
      console.error("Doc fetch err:", err);
    }
  };

  const handleFileChange = e => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if(!file) {
      setMessage("No file selected!");
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
        setMessage(data.message || "Upload success");
        fetchDocs();
      } else {
        const eData = await res.json();
        setMessage(eData.error || "Upload failed");
      }
    } catch(err) {
      console.error("Upload error:", err);
      setMessage("Upload failed");
    }
  };

  return (
    <div className="App" style={{ padding:'1rem' }}>
      <h2>Home - Upload Audio => Doc => Partial Transcripts</h2>
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>Upload</button>
      </div>
      <p>{message}</p>

      <hr/>
      <div>
        <h3>Docs in Session</h3>
        <ul>
          {docs.map(d => (
            <li key={d.id}>
              {d.name}
              {d.audioFilename ? \` (Audio: \${d.audioFilename}\${d.audioTrashed?' [TRASHED]':''})\` : ''}
            </li>
          ))}
        </ul>
      </div>

      <hr/>
      <div>
        <h3>Partial Transcript Logs:</h3>
        {transcripts.map((t,i) => <div key={i}>{t}</div>)}
      </div>
    </div>
  );
}

export default App;

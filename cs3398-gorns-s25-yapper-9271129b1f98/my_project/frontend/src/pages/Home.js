import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

export default function Home() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const socket = io();
    // partial
    socket.on('partial_transcript_batch', data => {
      if(!data || !data.chunks) return;
      const lines = data.chunks.map(ch => 
        \`[Doc \${data.doc_id}] Chunk \${ch.chunk_index}/\${ch.total_chunks}: \${ch.text}\`
      );
      setTranscripts(prev => [...prev, ...lines]);
    });
    // final
    socket.on('final_transcript', data => {
      if(data.doc_id && data.done) {
        setTranscripts(prev => [...prev, \`[Doc \${data.doc_id}] Transcription complete.\`]);
      }
    });

    // fetch docs
    fetch('/api/docs')
      .then(r => r.json())
      .then(dd => setDocs(dd))
      .catch(err => console.error("Error listing docs:", err));

    return () => {
      socket.disconnect();
    };
  }, []);

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
      formData.append('audio', file);
      const res = await fetch('/upload-audio', {
        method:'POST',
        body: formData
      });
      if(res.ok) {
        const data = await res.json();
        setMessage(data.message || "Uploaded successfully");
        // refresh docs
        fetch('/api/docs')
          .then(r => r.json())
          .then(dd => setDocs(dd));
      } else {
        const errorData = await res.json();
        setMessage(errorData.error || "Upload failed");
      }
    } catch(err) {
      console.error("Upload error:", err);
      setMessage("Upload failed");
    }
  };

  return (
    <div style={{ padding:'1rem' }}>
      <h2>Home Page - Upload Audio => Start Transcription</h2>
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>Submit</button>
      </div>
      <p>{message}</p>

      <hr />
      <div>
        <h3>Doc Store:</h3>
        <ul>
          {docs.map(d => (
            <li key={d.id}>
              <strong>{d.name}</strong> 
              { d.audioFilename ? \` (File: \${d.audioFilename}\` : '' }
              { d.audioTrashed ? ' [TRASHED])' : (d.audioFilename?')':'')}
            </li>
          ))}
        </ul>
      </div>

      <hr />
      <div>
        <h3>Live Transcript Logs:</h3>
        {transcripts.map((t, i) => <div key={i}>{t}</div>)}
      </div>
    </div>
  );
}

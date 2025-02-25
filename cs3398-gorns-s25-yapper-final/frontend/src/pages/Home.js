import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

export default function Home() {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const socket = io();
    socket.on('partial_transcript_batch', data => {
      if(data && data.chunks){
        const lines = data.chunks.map(ch => 
          \`[Doc \${data.doc_id}] chunk \${ch.chunk_index}/\${ch.total_chunks}: \${ch.text}\`
        );
        setTranscripts(prev => [...prev, ...lines]);
      }
    });
    socket.on('final_transcript', data => {
      if(data && data.doc_id && data.done){
        setTranscripts(prev => [...prev, \`[Doc \${data.doc_id}] Transcription complete.\`]);
      }
    });
    fetch('/api/docs')
      .then(r => r.json())
      .then(d => setDocs(d))
      .catch(err => console.error("Error fetching docs:", err));

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleFileChange = e => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if(!file){
      setMsg("No file selected!");
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
        setMsg(data.message || "Upload succeeded");
        if(data.doc_id){
          window.open(`/transcription/${data.doc_id}`, '_blank');
        }
        fetch('/api/docs')
          .then(r => r.json())
          .then(d => setDocs(d))
          .catch(err => console.error("Error fetching docs:", err));
      } else {
        const eData = await res.json();
        setMsg(eData.error || "Upload failed");
      }
    } catch(err){
      console.error("Upload error:", err);
      setMsg("Upload failed");
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Home - Upload Audio => Create Doc</h2>
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>Submit</button>
      </div>
      <p>{msg}</p>
      <hr />
      <div>
        <h3>Docs in Session:</h3>
        <ul>
          {docs.map(d => (
            <li key={d.id}>
              {d.name}
              {d.audioFilename ? \` (Audio: \${d.audioFilename}\${d.audioTrashed ? ' [TRASHED]' : ''})\` : ''}
              &nbsp;|&nbsp;
              <a href={\`/transcription/\${d.id}\`} target="_blank" rel="noreferrer">Transcription</a>
              &nbsp;|&nbsp;
              <a href={\`/docs/edit/\${d.id}\`} target="_blank" rel="noreferrer">Edit</a>
            </li>
          ))}
        </ul>
      </div>
      <hr />
      <div>
        <h3>Partial Transcript Logs</h3>
        {transcripts.map((t, i) => <div key={i}>{t}</div>)}
      </div>
    </div>
  );
}

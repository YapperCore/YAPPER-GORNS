import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

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
        // open transcription
        if(data.doc_id){
          window.open(`/transcription/${data.doc_id}`, '_blank');
        }
        // refresh doc list
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

  return (
    <div style={{ padding:'1rem' }}>
      <h2>Home - Upload Audio => Create Doc</h2>
      <div>
        <input type="file" onChange={handleFileChange}/>
        <button onClick={handleUpload}>Submit</button>
      </div>
      <p>{uploadMessage}</p>

      <hr />
      <div>
        <h3>Docs in Session:</h3>
        <ul>
          {docs.map(doc => (
            <li key={doc.id}>
              {doc.name} { doc.audioFilename ? `(Audio: ${doc.audioFilename}${doc.audioTrashed?' [TRASHED]':''})` : '' }
              &nbsp;|&nbsp;
              <a href={`/transcription/${doc.id}`} target="_blank" rel="noreferrer">
                (Transcription)
              </a>
              &nbsp;|&nbsp;
              <a href={`/docs/edit/${doc.id}`} target="_blank" rel="noreferrer">
                (Edit)
              </a>
            </li>
          ))}
        </ul>
      </div>

      <hr />
      <div>
        <h3>Global Transcripts</h3>
        {transcripts.map((t,i) => <div key={i}>{t}</div>)}
      </div>
    </div>
  );
}

export default Home;

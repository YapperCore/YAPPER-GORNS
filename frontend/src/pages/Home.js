import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

function Home() {
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    // Socket to watch partial transcripts globally
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

    // fetch docs
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
      setUploadMessage("No file selected!");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('audio', file);
      const res = await fetch('/upload-audio', {
        method:'POST',
        body: formData
      });
      if(res.ok){
        const data = await res.json();
        setUploadMessage(data.message || 'Upload succeeded');
        // open new tab
        if(data.doc_id){
          window.open(`/transcription/${data.doc_id}`, '_blank');
        }
        // re-fetch docs
        const docRes = await fetch('/api/docs');
        if(docRes.ok){
          const docData = await docRes.json();
          setDocs(docData);
        }
      } else {
        const eData = await res.json();
        setUploadMessage(eData.error || 'Upload failed');
      }
    } catch(err){
      console.error("Upload err:", err);
      setUploadMessage('Upload failed');
    }
  };

  return (
    <div style={{ padding:'1rem' }}>
      <h2>Home - Upload Audio => Create Doc</h2>
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>Submit</button>
        <p>{uploadMessage}</p>
      </div>

      <hr />

      <div>
        <h3>Docs in Session:</h3>
        <ul>
          {docs.map(d => (
            <li key={d.id}>
              {d.name} &nbsp;
              <a href={`/transcription/${d.id}`} target="_blank" rel="noreferrer">
                (Transcription)
              </a>
              &nbsp;|&nbsp;
              <a href={`/docs/edit/${d.id}`} target="_blank" rel="noreferrer">
                (Edit Doc)
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

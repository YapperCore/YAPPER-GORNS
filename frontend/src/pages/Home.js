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

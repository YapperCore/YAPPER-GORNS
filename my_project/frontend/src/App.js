import './App.css';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

function App() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);

  useEffect(() => {
    const socket = io();
    socket.on('partial_transcript', (data) => {
      setTranscripts((prev) => [
        ...prev,
        `Chunk ${data.chunk_index}/${data.total_chunks}: ${data.text}`
      ]);
    });

    socket.on('final_transcript', (data) => {
      setTranscripts((prev) => [...prev, "Transcription complete."]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const addDoc = () => {
    setDocuments((prevDocuments) => [
      ...prevDocuments,
      `doc${prevDocuments.length + 1}`
    ]);
  };

  const handleFileChange = (e) => {
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
      const res = await fetch('/upload-audio', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUploadMessage(data.message || 'Upload succeeded');
      } else {
        const errorData = await res.json();
        setUploadMessage(errorData.error || 'Upload failed');
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadMessage('Upload failed');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="Input-Form">
          <label htmlFor="myfile">Select a file: </label>
          <input type="file" id="myfile" name="myfile" onChange={handleFileChange} />
          <button onClick={handleUpload}>Submit</button>
          {uploadMessage && <p>{uploadMessage}</p>}
        </div>
        <div className="addButton">
          <button onClick={addDoc}>
            Add Document
          </button>
        </div>
        <div className="Doclist">
          <ul>
            {documents.map((doc, index) => (
              <li key={index}>{doc}</li>
            ))}
          </ul>
        </div>
        <div className="Transcripts" style={{ marginTop: '2rem' }}>
          <h3>Transcription Output:</h3>
          {transcripts.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      </header>
    </div>
  );
}

export default App;

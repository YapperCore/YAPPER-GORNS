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

    // Listen for batch events carrying an array of chunks
    socket.on('partial_transcript_batch', (data) => {
      // data is expected to be an object with a "chunks" array
      const batchLines = data.chunks.map(chunk =>
        `Chunk ${chunk.chunk_index}/${chunk.total_chunks}: ${chunk.text}`
      );
      setTranscripts((prev) => [...prev, ...batchLines]);
    });

    socket.on('final_transcript', (data) => {
      setTranscripts((prev) => [...prev, "Transcription complete."]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const addDoc = (docName) => {
    setDocuments((prevDocuments) => [
      ...prevDocuments,
      docName
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

            // Save the actual filename from backend
            setDocuments((prevDocuments) => [...prevDocuments, data.filename]);
        } else {
            const errorData = await res.json();
            setUploadMessage(errorData.error || 'Upload failed');
        }
    } catch (err) {
        console.error("Upload error:", err);
        setUploadMessage('Upload failed');
    }
};


  const handleDelete = async (filename) => {
    try {
        const response = await fetch(`http://localhost:5000/delete_file/${filename}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            setFiles(files.filter((doc) => doc !== filename));
            alert('File deleted successfully');
        } else {
            const data = await response.json();
            alert(`Error deleting file: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while deleting the file');
    }
};

  return (
    <div className="App">
      <header className="App-header">
        {/* Input Form */}
        <div className="Input-Form">
          <label htmlFor="myfile">Select a file: </label>
          <input type="file" id="myfile" name="myfile" onChange={handleFileChange} />
          <button onClick={handleUpload}>Submit</button>
          {uploadMessage && <p>{uploadMessage}</p>}
        </div>

        {/* Button to Add Document */}
        <div className="addButton">
          <button onClick={() => addDoc(`doc${documents.length + 1}`)}>Add Document</button>
        </div>

        {/* Document List */}
        <div className="Doclist">
          <ul>
            {documents.map((doc, index) => (
              <li key={index}>{doc}
                <div className="DeleteButton"> <button onClick={() => handleDelete(doc)}> Delete Document </button> </div></li>
            ))}
          </ul>
        </div>

        {/* Real-time transcription logs */}
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

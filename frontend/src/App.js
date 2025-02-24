import './App.css';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Confirmable from './util/confirmable';
import 'primereact/resources/themes/saga-blue/theme.css';  
import 'primereact/resources/primereact.min.css';          
import 'primeicons/primeicons.css';                        

function App() {
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [fileName, setFileName] = useState("Select a file");

  useEffect(() => {
    const socket = io('http://localhost:5000'); 

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

    const fetchUploadFiles = async () => {
      try {
        const response = await fetch('/upload-files');
        if (response.ok) {
          const data = await response.json();
          setDocuments(data.files);
        } else {
          console.error('Failed to fetch upload files');
        }
      } catch (error) {
        console.error('Error fetching upload files:', error);
      }
    };

    fetchUploadFiles();

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(null); 
    setFile(selectedFile);
    setFileName(selectedFile ? selectedFile.name : "Click here to select a file");
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

            // Save the actual filename and displayname from backend
            setDocuments((prevDocuments) => [...prevDocuments, { filename: data.filename, displayname: data.displayname }]);

            // Clear the file input and reset the file name
            setFile(null);
            setFileName("Select a file");
        } else {
            const errorData = await res.json();
            if (errorData.error === "File already exists") {
                alert("File already exists. Please upload a different file.");
            }
            setUploadMessage(errorData.error || 'Upload failed');
        }
    } catch (err) {
        console.error("Upload error:", err);
        setUploadMessage('Upload failed');
    }
};


  const handleDelete = async (filename) => {
    try {
        const response = await fetch(`/delete_file/${filename}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            setDocuments((prevDocuments) => prevDocuments.filter((doc) => doc.filename !== filename));
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
        <div className="Input-Form rounded-box">
          <label htmlFor="myfile" className="file-label">Select a file: </label>
          <div onClick={() => document.getElementById('myfile').click()} className="input-container">
            <input type="file" id="myfile" name="myfile" onChange={handleFileChange} className="rounded-input" style={{ display: 'none' }} />
            <span className="input-placeholder">{fileName}</span>
          </div>
          <button onClick={handleUpload} className="modern-button">Submit</button>
        </div>

        <div className="Doclist-container">
          <div className="Doclist">
            <ul>
              {documents.map((doc, index) => (
                <li key={index}>{doc.displayname}
                  <div className="DeleteButton"> 
                    <Confirmable onDelete={() => handleDelete(doc.filename)} /> 
                  </div>
                </li>
              ))}
            </ul>
          </div>
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
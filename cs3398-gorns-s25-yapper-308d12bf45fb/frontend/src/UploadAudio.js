import React, { useState } from "react";

/**
 * A small component example for uploading audio, if needed as a separate widget.
 */
export default function UploadAudio() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");

  const handleFileChange = e => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if(!selectedFile) {
      alert("No file selected!");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);

      const res = await fetch("/upload-audio", {
        method:"POST",
        body: formData
      });
      const data = await res.json();
      if(res.ok) {
        setMessage(\`File uploaded: \${data.filename}\`);
      } else {
        setMessage(\`Upload failed: \${data.error}\`);
      }
    } catch(err) {
      console.error("Error uploading:", err);
      setMessage("Error uploading file.");
    }
  };

  return (
    <div style={{ margin:'1rem' }}>
      <h2>Upload Audio File</h2>
      <input type="file" accept="audio/*" onChange={handleFileChange}/>
      <button onClick={handleUpload}>Upload</button>
      {message && <p>{message}</p>}
    </div>
  );
}

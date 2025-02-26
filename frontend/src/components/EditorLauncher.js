// src/components/EditorLauncher.js
import React, { useState } from "react";

function EditorLauncher() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("Click here to select a file");
  const [uploadMessage, setUploadMessage] = useState("");

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setFileName(f ? f.name : "Click here to select a file");
  };

  const handleAudioUpload = async () => {
    if (!file) {
      setUploadMessage("No file selected!");
      return;
    }
    // Open new tab immediately (it will start as about:blank)
    const newWindow = window.open('about:blank', '_blank');

    try {
      const fd = new FormData();
      fd.append("audio", file);

      const res = await fetch("/upload-audio", {
        method: "POST",
        body: fd
      });
      if (res.ok) {
        const data = await res.json();
        setUploadMessage(data.message || "Upload success");
        if (data.doc_id && newWindow) {
          // Directly redirect the new window to the transcription editor route.
          newWindow.location.href = `/transcription/${data.doc_id}`;
        }
      } else {
        const errData = await res.json();
        setUploadMessage(errData.error || "Upload failed");
        if (newWindow) newWindow.close();
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadMessage("Upload failed");
      if (newWindow) newWindow.close();
    }
  };

  return (
    <div style={{ padding: '1rem', background: '#333', color: '#fff', minHeight: '100vh' }}>
      <h2>Yapper</h2>
      <div
        style={{
          border: '2px dashed #ccc',
          borderRadius: '12px',
          padding: '10px',
          cursor: 'pointer',
          marginBottom: '1rem',
          display: 'inline-block'
        }}
        onClick={() => document.getElementById('fileUpload').click()}
      >
        <input
          id="fileUpload"
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {fileName}
      </div>
      <button onClick={handleAudioUpload} style={{ marginLeft: '1rem' }}>
        Submit
      </button>
      {uploadMessage && <p style={{ marginTop: '1rem' }}>{uploadMessage}</p>}
    </div>
  );
}

export default EditorLauncher;


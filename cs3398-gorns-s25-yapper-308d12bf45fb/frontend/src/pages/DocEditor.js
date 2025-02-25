import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function DocEditor() {
  const { docId } = useParams();
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoc();
  }, [docId]);

  const fetchDoc = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/docs/${docId}`);
      if(res.ok) {
        const data = await res.json();
        setDoc(data);
        setContent(data.content || '');
      }
    } catch(err) {
      console.error("Fetch doc error:", err);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if(!doc) return;
    try {
      const res = await fetch(`/api/docs/${docId}`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ name: doc.name, content })
      });
      if(!res.ok) {
        console.error("Error saving doc");
      }
    } catch(err) {
      console.error("Save doc error:", err);
    }
  };

  if(loading) return <div style={{ padding:'1rem' }}>Loading doc...</div>;
  if(!doc) return <div style={{ padding:'1rem' }}>Doc not found.</div>;

  return (
    <div style={{ padding:'1rem' }}>
      <h2>Edit Doc: {doc.name}</h2>
      <ReactQuill theme="snow" value={content} onChange={setContent} style={{ background:'#fff', minHeight:'300px' }}/>
      <br/>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

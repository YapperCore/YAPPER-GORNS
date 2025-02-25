import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

/**
 * Minimal doc mgmt: lists docs from in-memory store, can create/edit.
 */

export default function DocEditor() {
  return (
    <Routes>
      <Route path="/" element={<DocList />} />
      <Route path="new" element={<DocCreate />} />
      <Route path="edit/:docId" element={<DocEdit />} />
    </Routes>
  );
}

function DocList() {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    fetch('/api/docs')
      .then(r => r.json())
      .then(data => setDocs(data))
      .catch(err => console.error("Error listing docs:", err));
  }, []);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      if(res.ok){
        setDocs(prev => prev.filter(d => d.id !== id));
      }
    } catch(err){
      console.error("Error deleting doc:", err);
    }
  };

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2>Documents</h2>
      <Link to="new"><button>Create New Doc</button></Link>
      <ul>
        {docs.map(d => (
          <li key={d.id}>
            {d.name} | <Link to={`edit/${d.id}`}><button>Edit</button></Link>
            <button onClick={() => handleDelete(d.id)} style={{ marginLeft: '1rem' }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocCreate() {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({name, content})
      });
      if(res.ok){
        const doc = await res.json();
        navigate(`edit/${doc.id}`);
      }
    } catch(err){
      console.error("Error creating doc:", err);
    }
  };

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2>Create Doc</h2>
      <p>
        Name:
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginLeft:'0.5rem' }}/>
      </p>
      <p>Content:</p>
      <ReactQuill theme="snow" value={content} onChange={setContent} />
      <button onClick={handleSubmit}>Create</button>
    </div>
  );
}

function DocEdit() {
  const { docId } = useParams();
  const [doc, setDoc] = useState(null);
  const [socket, setSocket] = useState(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch(`/api/docs/${docId}`)
      .then(r => r.json())
      .then(data => {
        if(!data.error){
          setDoc(data);
          setContent(data.content || '');
        }
      })
      .catch(err => console.error("Error loading doc:", err));
  }, [docId]);

  useEffect(() => {
    const s = io();
    setSocket(s);

    s.emit('join_doc', { doc_id: docId });

    const handleDocUpdate = (update) => {
      if(update.doc_id === docId){
        setContent(update.content);
      }
    };
    s.on('doc_content_update', handleDocUpdate);

    return () => {
      s.off('doc_content_update', handleDocUpdate);
      s.disconnect();
    };
  }, [docId]);

  const handleQuillChange = (val) => {
    setContent(val);
    if(socket){
      socket.emit('edit_doc', { doc_id: docId, content: val });
    }
  };

  const handleSave = async () => {
    if(!doc) return;
    try {
      const res = await fetch(`/api/docs/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: doc.name, content })
      });
      if(!res.ok) console.error("Error saving doc");
    } catch(err){
      console.error("Error saving doc:", err);
    }
  };

  if(!doc) {
    return <div>Loading doc...</div>
  }

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2>Edit Doc</h2>
      <p>
        Doc Name:
        <input
          style={{ marginLeft:'0.5rem' }}
          value={doc.name}
          onChange={(e) => setDoc({...doc, name: e.target.value})}
          onBlur={handleSave}
        />
      </p>
      <ReactQuill theme="snow" value={content} onChange={handleQuillChange} style={{ minHeight: '300px', background:'#fff' }}/>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

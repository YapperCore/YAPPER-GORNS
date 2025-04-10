import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import io from 'socket.io-client';

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
    if (!currentUser) return;
    
    try {
      const res = await fetch(`/api/docs/${id}`, { method:'DELETE' });
      if(res.ok){
        setDocs(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      console.error("Error deleting doc:", err);
      setError(`Error deleting document: ${err.message}`);
    }
  };

  if (loading) {
    return <div style={{ padding: '1rem' }}>Loading documents...</div>;
  }

  return (
    <div style={{ padding:'1rem', background:'#f5f5f5', minHeight:'100vh' }}>
      <h2>Docs</h2>
      <Link to="new"><button>Create New Doc</button></Link>
      <ul>
        {docs.map(d => (
          <li key={d.id}>
            {d.name} 
            {d.audioFilename ? ` (Audio: ${d.audioFilename}${d.audioTrashed?' [TRASHED]':''})` : ''}
            &nbsp;|&nbsp;
            <Link to={`edit/${d.id}`} style={{ marginRight:'1rem' }}>
              <button>Edit</button>
            </Link>
            <button onClick={() => handleDelete(d.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocCreate() {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (!name.trim()) {
      setError('Please enter a document name');
      return;
    }
    
    try {
      const res = await fetch('/api/docs', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ name, content })
      });
      if(res.ok){
        const doc = await res.json();
        navigate(`edit/${doc.id}`);
      }
    } catch (err) {
      console.error("Error creating doc:", err);
      setError(`Error creating document: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2>Create Document</h2>
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
      <p>
        Name: <input 
          value={name} 
          onChange={e => setName(e.target.value)} 
          style={{ marginLeft: '0.5rem' }}
          placeholder="Enter document name"
        />
      </p>
      <p>Content:</p>
      <ReactQuill theme="snow" value={content} onChange={setContent}/>
      <button 
        onClick={handleSubmit} 
        disabled={loading}
        style={{ marginTop: '1rem' }}
      >
        {loading ? 'Creating...' : 'Create'}
      </button>
    </div>
  );
}

function DocEdit() {
  const { docId } = useParams();
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetch(`/api/docs/${docId}`)
      .then(r => r.json())
      .then(d => {
        if(!d.error){
          setDoc(d);
          setContent(d.content || '');
        }
      })
      .catch(err => console.error("Err loading doc:", err));
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

  const handleChange = val => {
    setContent(val);
    if(socket){
      socket.emit('edit_doc', { doc_id: docId, content: val });
    }
  };

  const handleSave = async () => {
    if(!doc) return;
    try {
      const res = await fetch(`/api/docs/${docId}`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          name: doc.name,
          content
        })
      });
      if(!res.ok){
        console.error("Error saving doc");
      }
    } catch (err) {
      console.error("Error saving doc:", err);
      setError(`Error saving document: ${err.message}`);
    }
  };

  if (loading) {
    return <div style={{ padding: '1rem' }}>Loading document...</div>;
  }

  if (!doc && !loading) {
    return (
      <div style={{ padding: '1rem' }}>
        <h2>Error</h2>
        <p>{error || 'Document not found'}</p>
        <Link to="/docs">Back to Documents</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', background: '#f5f5f5', minHeight: '100vh' }}>
      <h2>Edit Document</h2>
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
      <p>
        Name:
        <input
          style={{ marginLeft: '0.5rem' }}
          value={doc.name}
          onChange={e => setDoc({ ...doc, name: e.target.value })}
          onBlur={handleSave}
        />
      </p>
      {doc.audioTrashed && <p style={{ color: 'red' }}>Warning: The associated audio file is currently in trash.</p>}
      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleChange}
        style={{ minHeight: '300px', background: '#fff' }}
      />
      <br />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

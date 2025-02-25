import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
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
  const [dir, setDir] = useState('');
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const d = params.get('dir') || '';
    setDir(d);
    fetchDocs(d);
  }, [location]);

  const fetchDocs = async (directory) => {
    try {
      let url = '/api/docs';
      if (directory) {
        url += \`?dir=\${encodeURIComponent(directory)}\`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDocs(data);
      }
    } catch (err) {
      console.error("Error fetching docs:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      let url = \`/api/docs/\${id}\`;
      if (dir) url += \`?dir=\${encodeURIComponent(dir)}\`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        fetchDocs(dir);
      }
    } catch (err) {
      console.error("Error deleting doc:", err);
    }
  };

  return (
    <div style={{ background: '#f5f5f5', color: '#000', minHeight: '100vh', padding: '1rem' }}>
      <h2>Document List</h2>
      <p>
        Optional directory:
        <input
          style={{ marginLeft: '0.5rem' }}
          type="text"
          placeholder="saved_docs"
          value={dir}
          onChange={(e) => setDir(e.target.value)}
        />
        <button onClick={() => fetchDocs(dir)}>Load</button>
      </p>
      <ul>
        {docs.map(doc => (
          <li key={doc.id} style={{ margin: '8px 0' }}>
            {doc.name} (ID: {doc.id})
            &nbsp;|&nbsp;
            <a href={\`/docs/edit/\${doc.id}\${dir ? \`?dir=\${encodeURIComponent(dir)}\` : ''}\`} target="_blank" rel="noreferrer">
              Edit
            </a>
            &nbsp;|&nbsp;
            <button onClick={() => handleDelete(doc.id)}>Delete</button>
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
  const location = useLocation();

  const handleSubmit = async () => {
    try {
      const params = new URLSearchParams(location.search);
      const dir = params.get('dir') || '';
      let url = '/api/docs';
      if (dir) url += \`?dir=\${encodeURIComponent(dir)}\`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content })
      });
      if (res.ok) {
        const newDoc = await res.json();
        navigate(\`edit/\${newDoc.id}\${dir ? \`?dir=\${encodeURIComponent(dir)}\` : ''}\`);
      }
    } catch (err) {
      console.error("Error creating doc:", err);
    }
  };

  return (
    <div style={{ background: '#f5f5f5', color: '#000', minHeight: '100vh', padding: '1rem' }}>
      <h2>Create New Document</h2>
      <p>
        Name:
        <input
          type="text"
          style={{ marginLeft: '0.5rem' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="DocX"
        />
      </p>
      <p>Initial Content:</p>
      <ReactQuill theme="snow" value={content} onChange={setContent} style={{ background: '#fff' }} />
      <br />
      <button onClick={handleSubmit}>Create</button>
    </div>
  );
}

function DocEdit() {
  const { docId } = useParams();
  const location = useLocation();
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(location.search);
        const dir = params.get('dir') || '';
        let url = \`/api/docs/\${docId}\`;
        if (dir) url += \`?dir=\${encodeURIComponent(dir)}\`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setDoc(data);
          setContent(data.content || '');
        }
      } catch (err) {
        console.error("Error fetching doc:", err);
      }
    })();
  }, [docId, location]);

  useEffect(() => {
    const s = io('http://localhost:5000');
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!doc || !socket) return;
    socket.emit('join_doc', { doc_id: docId });
    const handleUpdate = (data) => {
      if (data.doc_id === docId) {
        setContent(data.content);
      }
    };
    socket.on('doc_content_update', handleUpdate);
    return () => {
      socket.off('doc_content_update', handleUpdate);
    };
  }, [doc, socket, docId]);

  const handleNameChange = (e) => {
    if (!doc) return;
    setDoc({ ...doc, name: e.target.value });
  };

  const handleEditorChange = (val) => {
    setContent(val);
    if (socket) {
      socket.emit('edit_doc', { doc_id: docId, content: val });
    }
  };

  const handleSave = async () => {
    if (!doc) return;
    try {
      const params = new URLSearchParams(location.search);
      const dir = params.get('dir') || '';
      let url = \`/api/docs/\${docId}\`;
      if (dir) url += \`?dir=\${encodeURIComponent(dir)}\`;
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: doc.name, content })
      });
    } catch (err) {
      console.error("Error saving doc:", err);
    }
  };

  if (!doc) {
    return <div style={{ padding: '1rem' }}>Loading doc...</div>
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Edit Document</h2>
      <p>Doc ID: {docId}</p>
      <p>
        Name:
        <input
          type="text"
          value={doc.name}
          onChange={handleNameChange}
          style={{ marginLeft: '0.5rem' }}
        />
      </p>
      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleEditorChange}
        style={{ height: '400px', background: '#fff' }}
      />
      <br />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

export default DocEditor;

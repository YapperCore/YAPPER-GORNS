// frontend/src/util/DocEditor.js
import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export default function DocEditor(){
  return (
    <Routes>
      <Route path="/" element={<DocList />} />
      <Route path="new" element={<DocCreate />} />
      <Route path="edit/:docId" element={<DocEdit />} />
    </Routes>
  );
}

function DocList(){
  const [docs, setDocs] = useState([]);
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      // Get authentication token
      const idToken = await currentUser.getIdToken();
      
      const response = await fetch('/api/docs', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'X-User-ID': currentUser.uid
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDocs(data);
      } else {
        console.error("Error listing docs:", await response.text());
      }
    } catch (err) {
      console.error("Error listing docs:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      // Get authentication token
      const idToken = await currentUser.getIdToken();
      
      const res = await fetch(`/api/docs/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'X-User-ID': currentUser.uid
        }
      });
      
      if(res.ok){
        setDocs(prev => prev.filter(d => d.id !== id));
      } else {
        console.error("Delete failed:", await res.text());
      }
    } catch(err){
      console.error("Error deleting doc:", err);
    }
  };

  return (
    <div style={{ padding:'1rem', background:'#f5f5f5', minHeight:'100vh' }}>
      <h2>Your Documents</h2>
      <Link to="new"><button>Create New Doc</button></Link>
      <ul>
        {docs.length > 0 ? docs.map(d => (
          <li key={d.id}>
            {d.name} 
            {d.audioFilename ? ` (Audio: ${d.audioFilename}${d.audioTrashed?' [TRASHED]':''})` : ''}
            &nbsp;|&nbsp;
            <Link to={`edit/${d.id}`} style={{ marginRight:'1rem' }}>
              <button>Edit</button>
            </Link>
            <button onClick={() => handleDelete(d.id)}>Delete</button>
          </li>
        )) : (
          <p>No documents found. Create a new one or upload audio from the home page.</p>
        )}
      </ul>
    </div>
  );
}

function DocCreate(){
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleSubmit = async () => {
    try {
      // Get authentication token
      const idToken = await currentUser.getIdToken();
      
      const res = await fetch('/api/docs', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-User-ID': currentUser.uid
        },
        body: JSON.stringify({ name, content })
      });
      
      if(res.ok){
        const doc = await res.json();
        navigate(`edit/${doc.id}`);
      } else {
        console.error("Create doc failed:", await res.text());
      }
    } catch(err){
      console.error("Error creating doc:", err);
    }
  };

  return (
    <div style={{ padding:'1rem', background:'#f5f5f5', minHeight:'100vh' }}>
      <h2>Create Doc</h2>
      <p>
        Name: <input value={name} onChange={e => setName(e.target.value)} style={{ marginLeft:'0.5rem' }}/>
      </p>
      <p>Content:</p>
      <ReactQuill theme="snow" value={content} onChange={setContent}/>
      <button onClick={handleSubmit}>Create</button>
    </div>
  );
}

function DocEdit(){
  const { docId } = useParams();
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [socket, setSocket] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Load document with authentication
    (async () => {
      try {
        // Get authentication token
        const idToken = await currentUser.getIdToken();
        
        const res = await fetch(`/api/docs/${docId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'X-User-ID': currentUser.uid
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setDoc(data);
          setContent(data.content || '');
        } else {
          console.error("Error loading doc:", await res.text());
        }
      } catch (err) {
        console.error("Error loading doc:", err);
      }
    })();
  }, [docId, currentUser]);

  useEffect(() => {
    // Setup socket connection with authentication
    const setupSocket = async () => {
      try {
        // Get authentication token
        const idToken = await currentUser.getIdToken();
        
        const s = io();
        setSocket(s);
        
        // Join doc room with authentication
        s.emit('join_doc', { 
          doc_id: docId,
          user_id: currentUser.uid,
          token: idToken
        });

        const handleDocUpdate = (update) => {
          if(update.doc_id === docId){
            setContent(update.content);
          }
        };
        
        const handleError = (data) => {
          if(data.doc_id === docId){
            console.error("Document access error:", data.error);
          }
        };
        
        s.on('doc_content_update', handleDocUpdate);
        s.on('doc_access_error', handleError);

        return () => {
          s.off('doc_content_update', handleDocUpdate);
          s.off('doc_access_error', handleError);
          s.disconnect();
        };
      } catch (err) {
        console.error("Socket setup error:", err);
      }
    };
    
    if (doc) {
      setupSocket();
    }
    
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [docId, doc, currentUser]);

  const handleChange = async (val) => {
    setContent(val);
    
    try {
      // Get authentication token for socket event
      const idToken = await currentUser.getIdToken();
      
      if(socket){
        socket.emit('edit_doc', { 
          doc_id: docId, 
          content: val,
          user_id: currentUser.uid,
          token: idToken
        });
      }
    } catch (err) {
      console.error("Error emitting edit event:", err);
    }
  };

  const handleSave = async () => {
    if(!doc) return;
    
    try {
      // Get authentication token
      const idToken = await currentUser.getIdToken();
      
      const res = await fetch(`/api/docs/${docId}`, {
        method:'PUT',
        headers:{
          'Content-Type':'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-User-ID': currentUser.uid
        },
        body: JSON.stringify({
          name: doc.name,
          content
        })
      });
      
      if(!res.ok){
        console.error("Error saving doc:", await res.text());
      }
    } catch(err){
      console.error("Error saving doc:", err);
    }
  };

  if(!doc) return <div>Loading doc...</div>;

  return (
    <div style={{ padding:'1rem', background:'#f5f5f5', minHeight:'100vh' }}>
      <h2>Edit Doc</h2>
      <p>
        Name:
        <input
          style={{ marginLeft:'0.5rem' }}
          value={doc.name}
          onChange={e => setDoc({ ...doc, name:e.target.value })}
          onBlur={handleSave}
        />
      </p>
      { doc.audioTrashed && <p style={{ color:'red' }}>Warning: The associated audio file is currently in trash.</p> }
      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleChange}
        style={{ minHeight:'300px', background:'#fff' }}
      />
      <br />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

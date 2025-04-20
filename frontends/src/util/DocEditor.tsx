// src/pages/DocEditor.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import io, { Socket } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

interface Doc {
  id: string;
  name: string;
  content?: string;
  audioFilename?: string;
  audioTrashed?: boolean;
}

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
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDocs = async () => {
      if (!currentUser) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = await currentUser.getIdToken();
        const res = await fetch("/api/docs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
        if (!Array.isArray(data)) {
          setError("Invalid data format received from server");
        }
      } catch (err: any) {
        console.error("Error loading docs:", err);
        setDocs([]);
        setError(`Error loading documents: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, [currentUser, navigate]);

  const handleDelete = async (id: string) => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
      } else {
        const errorData = await res.json();
        console.error("Failed to delete document:", errorData);
        setError(`Failed to delete document: ${errorData.error || "Unknown error"}`);
      }
    } catch (err: any) {
      console.error("Error deleting doc:", err);
      setError(`Error deleting document: ${err.message}`);
    }
  };

  if (loading) return <div style={{ padding: "1rem" }}>Loading documents...</div>;

  return (
    <div style={{ padding: "1rem", background: "#f5f5f5", minHeight: "100vh" }}>
      <h2>Documents</h2>
      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}
      <Link to="new">
        <button>Create New Document</button>
      </Link>

      {docs.length === 0 ? (
        <p style={{ marginTop: "1rem" }}>No documents found. Create a new one to get started!</p>
      ) : (
        <ul>
          {docs.map((d) => (
            <li key={d.id}>
              {d.name}
              {d.audioFilename
                ? ` (Audio: ${d.audioFilename}${d.audioTrashed ? " [TRASHED]" : ""})`
                : ""}
              &nbsp;|&nbsp;
              <Link to={`edit/${d.id}`} style={{ marginRight: "1rem" }}>
                <button>Edit</button>
              </Link>
              <button onClick={() => handleDelete(d.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DocCreate() {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleSubmit = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!name.trim()) {
      setError("Please enter a document name");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, content }),
      });

      if (res.ok) {
        const doc = await res.json();
        navigate(`edit/${doc.id}`);
      } else {
        const errorData = await res.json();
        setError(`Failed to create document: ${errorData.error || "Unknown error"}`);
      }
    } catch (err: any) {
      console.error("Error creating doc:", err);
      setError(`Error creating document: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "1rem", background: "#f5f5f5", minHeight: "100vh" }}>
      <h2>Create Document</h2>
      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}
      <p>
        Name:
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginLeft: "0.5rem" }}
          placeholder="Enter document name"
        />
      </p>
      <p>Content:</p>
      <ReactQuill theme="snow" value={content} onChange={setContent} />
      <button onClick={handleSubmit} disabled={loading} style={{ marginTop: "1rem" }}>
        {loading ? "Creating..." : "Create"}
      </button>
    </div>
  );
}

function DocEdit() {
  const { docId } = useParams<{ docId: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [content, setContent] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDoc = async () => {
      if (!currentUser) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

        const docData = await res.json();
        setDoc(docData);
        setContent(docData.content || "");
      } catch (err: any) {
        console.error("Error loading doc:", err);
        setError(`Error loading document: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [docId, currentUser, navigate]);

  useEffect(() => {
    if (!currentUser) return;

    const s = io();
    setSocket(s);
    s.emit("join_doc", { doc_id: docId });

    const handleDocUpdate = (update: { doc_id: string; content: string }) => {
      if (update.doc_id === docId) {
        setContent(update.content);
      }
    };

    s.on("doc_content_update", handleDocUpdate);

    return () => {
      s.off("doc_content_update", handleDocUpdate);
      s.disconnect();
    };
  }, [docId, currentUser]);

  const handleChange = (val: string) => {
    setContent(val);
    if (socket) {
      socket.emit("edit_doc", { doc_id: docId, content: val });
    }
  };

  const handleSave = async () => {
    if (!doc || !currentUser) return;

    try {
      setError("");

      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: doc.name, content }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(`Failed to save document: ${errorData.error || "Unknown error"}`);
      }
    } catch (err: any) {
      console.error("Error saving doc:", err);
      setError(`Error saving document: ${err.message}`);
    }
  };

  if (loading) return <div style={{ padding: "1rem" }}>Loading document...</div>;

  if (!doc && !loading) {
    return (
      <div style={{ padding: "1rem" }}>
        <h2>Error</h2>
        <p>{error || "Document not found"}</p>
        <Link to="/docs">Back to Documents</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", background: "#f5f5f5", minHeight: "100vh" }}>
      <h2>Edit Document</h2>
      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}
      <p>
        Name:
        <input
          style={{ marginLeft: "0.5rem" }}
          value={doc.name}
          onChange={(e) => setDoc({ ...doc, name: e.target.value })}
          onBlur={handleSave}
        />
      </p>
      {doc.audioTrashed && <p style={{ color: "red" }}>Warning: The associated audio file is currently in trash.</p>}
      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleChange}
        style={{ minHeight: "300px", background: "#fff" }}
      />
      <br />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

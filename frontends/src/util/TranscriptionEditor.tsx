// src/pages/TranscriptionEditor.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import AudioPlayer from "@/components/AudioPlayer"; //! changed this to @ instead of ..
import { useAuth } from "@/context/AuthContext"; //! changed this to @ instead of ..
import { Toast } from "primereact/toast";
import { ProgressBar } from "primereact/progressbar";

const TranscriptionEditor: React.FC = () => {
  const { docId } = useParams<{ docId: string }>();
  const { currentUser } = useAuth();
  const [content, setContent] = useState<string>("");
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [audioFilename, setAudioFilename] = useState<string>("");
  const [audioTrashed, setAudioTrashed] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [processedChunks, setProcessedChunks] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const toastRef = useRef<Toast | null>(null);
  const editorRef = useRef<ReactQuill | null>(null);

  useEffect(() => {
    const fetchDocInfo = async () => {
      if (!currentUser) return;

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

        const doc = await res.json();
        setContent(doc.content || "");
        setAudioFilename(doc.audioFilename || "");
        setAudioTrashed(!!doc.audioTrashed);

        if (doc.content && doc.content.trim().length > 0) {
          if (
            doc.content.includes("Transcription complete") ||
            doc.content.length > 100
          ) {
            setIsComplete(true);
            setProgress(100);
          }
        }
      } catch (err: any) {
        console.error("Error loading document:", err);
        setError(`Error loading document: ${err.message}`);
        toastRef.current?.show({
          severity: "error",
          summary: "Error",
          detail: `Failed to load document: ${err.message}`,
          life: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDocInfo();
  }, [docId, currentUser]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.emit("join_doc", { doc_id: docId });

    const fetchCurrentContent = async () => {
      try {
        const token = await currentUser?.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const doc = await res.json();
          setContent(doc.content || "");
        }
      } catch (err) {
        console.error("Error fetching current content:", err);
      }
    };

    const handlePartialBatch = (data: any) => {
      if (data.doc_id === docId) {
        if (data.progress !== undefined) {
          setProgress(data.progress);
        }
        fetchCurrentContent();
        if (data.chunks && data.chunks.length > 0) {
          setProcessedChunks((prev) => [...prev, ...data.chunks]);
          toastRef.current?.show({
            severity: "info",
            summary: "New Content",
            detail: `Received new transcription content`,
            life: 1000,
          });
        }
      }
    };

    const handleFinal = (data: any) => {
      if (data.doc_id === docId && data.done) {
        setIsComplete(true);
        setProgress(100);
        fetchCurrentContent();
        toastRef.current?.show({
          severity: "success",
          summary: "Transcription Complete",
          detail: "The audio file has been fully transcribed",
          life: 3000,
        });
      }
    };

    const handleDocUpdate = (update: any) => {
      if (update.doc_id === docId) {
        setContent(update.content);
      }
    };

    const handleTranscriptionError = (data: any) => {
      if (data.doc_id === docId) {
        setError(`Transcription error: ${data.error}`);
        toastRef.current?.show({
          severity: "error",
          summary: "Transcription Error",
          detail: data.error,
          life: 5000,
        });
      }
    };

    socket.on("partial_transcript_batch", handlePartialBatch);
    socket.on("final_transcript", handleFinal);
    socket.on("doc_content_update", handleDocUpdate);
    socket.on("transcription_error", handleTranscriptionError);

    return () => {
      socket.off("partial_transcript_batch", handlePartialBatch);
      socket.off("final_transcript", handleFinal);
      socket.off("doc_content_update", handleDocUpdate);
      socket.off("transcription_error", handleTranscriptionError);
      socket.disconnect();
    };
  }, [docId, currentUser]);

  const handleContentChange = async (newContent: string) => {
    setContent(newContent);
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        await fetch(`/api/docs/${docId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: newContent }),
        });

        socketRef.current?.emit("edit_doc", {
          doc_id: docId,
          content: newContent,
        });
      } catch (err: any) {
        console.error("Error updating document:", err);
        setError(`Error saving changes: ${err.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Loading Transcription...</h2>
        <div style={{ width: "60%", margin: "0 auto" }}>
          <ProgressBar value={50} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: "1rem" }}>
      <Toast ref={toastRef} position="top-right" />
      <h2>Transcription for Document</h2>
      {error && (
        <div
          style={{
            color: "red",
            background: "#ffeeee",
            padding: "0.5rem",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}
      {audioFilename && (
        <p>
          Audio: {audioFilename}
          {audioTrashed && " (in TRASH)"}
        </p>
      )}
      {!isComplete && (
        <div style={{ marginBottom: "1rem" }}>
          <p>Transcription in progress... {progress}% complete</p>
          <ProgressBar value={progress} />
        </div>
      )}
      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleContentChange}
        style={{ height: "600px", background: "#fff" }}
        ref={editorRef}
      />
      {audioFilename && !audioTrashed && (
        <div style={{ marginTop: "1rem" }}>
          <AudioPlayer
            filename={audioFilename}
            audioUrl={`/api/audio/${audioFilename}`}
          />
        </div>
      )}
      <div style={{ marginTop: "1rem" }}>
        <Link to="/home">Back to Home</Link>
      </div>
    </div>
  );
};

export default TranscriptionEditor;

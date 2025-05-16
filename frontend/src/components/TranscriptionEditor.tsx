// src/components/TranscriptionEditor.tsx - Fixed for real-time updates with proper socket handling
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import io from "socket.io-client";
import { Toast } from "primereact/toast";
import { ProgressBar } from "primereact/progressbar";
import { Button } from "primereact/button";
import Link from "next/link";
import Editor from "@/components/Editor";
import AudioPlayer from "@/components/AudioPlayer";
import { useAuth } from "@/context/AuthContext";
// In TranscriptionEditor component
import {
  getSocket,
  joinDocRoom,
  leaveDocRoom,
  updateDocContent,
} from "@/lib/socket-client";
interface ChunkData {
  chunk_index: number;
  total_chunks: number;
  text: string;
}

export default function TranscriptionEditor() {
  const params = useParams();
  const docId = params.docId as string;
  const { currentUser } = useAuth();
  const socketRef = useRef<any>(null);

  const [content, setContent] = useState<string>("");
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [audioFilename, setAudioFilename] = useState<string>("");
  const [audioTrashed, setAudioTrashed] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  const toastRef = useRef<Toast>(null);
  const maxReconnectAttempts = 5;

  // Load document data
  useEffect(() => {
    const fetchDocData = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/docs/${docId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch document: ${res.status}`);
        }

        const doc = await res.json();
        setContent(doc.content || "");
        setAudioFilename(doc.audioFilename || "");
        setAudioTrashed(!!doc.audioTrashed);

        // Check if content indicates completion
        if (doc.content && doc.content.length > 0) {
          setIsComplete(true);
          setProgress(100);
        }
      } catch (err) {
        console.error("Error loading document:", err);
        setError(
          `Error loading document: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDocData();
  }, [docId, currentUser]);

  // Socket connection with reconnection logic
  useEffect(() => {
    if (!currentUser) return;

    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        setError(
          `Failed to connect to real-time updates after ${maxReconnectAttempts} attempts`
        );
        return;
      }

      // Close any existing connection
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      // Create socket connection
      const socket = io("http://localhost:5001", {
        transports: ["polling", "websocket"],
        path: "/socket.io",
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Socket connected with ID:", socket.id);
        setSocketConnected(true);
        setReconnectAttempts(0);
        setError("");

        // Join document room
        socket.emit("join_doc", { doc_id: docId });

        toastRef.current?.show({
          severity: "success",
          summary: "Connected",
          detail: "Real-time updates enabled",
          life: 3000,
        });
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
        setSocketConnected(false);

        // Attempt reconnection
        if (reconnectAttempts < maxReconnectAttempts) {
          console.log(
            `Attempting to reconnect socket... (${
              reconnectAttempts + 1
            }/${maxReconnectAttempts})`
          );
          setReconnectAttempts((prev) => prev + 1);

          // Schedule reconnection
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectSocket, 2000);
        } else {
          setError(
            "Could not connect to real-time updates. Updates will not be live."
          );
        }
      });

      // Handle incoming transcription chunks
      socket.on("partial_transcript_batch", (data) => {
        if (data.doc_id === docId) {
          console.log("Received partial transcript batch:", data);

          if (data.progress !== undefined) {
            setProgress(data.progress);
          }

          if (data.chunks && data.chunks.length > 0) {
            // Append new chunks to content
            data.chunks.forEach((chunk: ChunkData) => {
              setContent((prevContent) => {
                const newText = chunk.text.trim();

                // If we already have content, append with proper spacing
                if (prevContent) {
                  const lastChar = prevContent.charAt(prevContent.length - 1);
                  const firstChar = newText.charAt(0);

                  // Determine how to join text
                  if (lastChar === "" || firstChar === "") {
                    return prevContent + newText;
                  } else if (
                    [".", ",", "!", "?", ":", ";"].includes(firstChar)
                  ) {
                    return prevContent + newText;
                  } else if (lastChar.match(/\s$/)) {
                    return prevContent + newText;
                  } else {
                    return prevContent + " " + newText;
                  }
                }

                // If no previous content, just set the new text
                return newText;
              });
            });

            // Show a notification
            toastRef.current?.show({
              severity: "info",
              summary: "Update",
              detail: "New transcription content received",
              life: 1000,
            });
          }
        }
      });

      // Handle final transcript
      socket.on("final_transcript", (data) => {
        if (data.doc_id === docId && data.done) {
          setIsComplete(true);
          setProgress(100);

          if (data.content) {
            setContent(data.content);
          }

          toastRef.current?.show({
            severity: "success",
            summary: "Complete",
            detail: "Transcription completed successfully",
            life: 3000,
          });
        }
      });

      // Handle document content updates from other users
      socket.on("doc_content_update", (update) => {
        if (update.doc_id === docId) {
          console.log("Received doc content update");
          setContent(update.content);
        }
      });

      // Handle transcription errors
      socket.on("transcription_error", (data) => {
        if (data.doc_id === docId) {
          setError(`Transcription error: ${data.error}`);

          toastRef.current?.show({
            severity: "error",
            summary: "Error",
            detail: data.error,
            life: 5001,
          });
        }
      });

      // Clean up on disconnect
      socket.on("disconnect", () => {
        console.log("Socket disconnected");
        setSocketConnected(false);
      });
    };

    // Initialize connection
    connectSocket();

    // Clean up function
    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [docId, currentUser, reconnectAttempts]);

  const handleContentChange = async (newContent: string) => {
    setContent(newContent);

    if (!currentUser) return;

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

      // Emit to socket if connected
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("edit_doc", {
          doc_id: docId,
          content: newContent,
        });
      }
    } catch (err) {
      console.error("Error updating document:", err);
      setError(
        `Error saving changes: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  const startTranscription = async () => {
    if (!currentUser) return;

    try {
      setContent("");
      setProgress(0);
      setIsComplete(false);

      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/transcribe/${docId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        toastRef.current?.show({
          severity: "info",
          summary: "Transcription Started",
          detail: "Transcription has been started. Please wait...",
          life: 3000,
        });
      } else {
        const data = await response.json();
        setError(
          `Failed to start transcription: ${data.error || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("Error starting transcription:", err);
      setError(
        `Error starting transcription: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          background: "#f5f5f5",
          minHeight: "100vh",
        }}
      >
        <h2>Loading Transcription...</h2>
        <div style={{ width: "60%", margin: "2rem auto" }}>
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div>
          {audioFilename && (
            <p>
              Audio: {audioFilename}
              {audioTrashed && " (in TRASH)"}
            </p>
          )}
        </div>

        <div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
              backgroundColor: socketConnected ? "#e6f7e6" : "#ffeeee",
              color: socketConnected ? "#2e7d32" : "#d32f2f",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: socketConnected ? "#2e7d32" : "#d32f2f",
                display: "inline-block",
                marginRight: "0.5rem",
              }}
            ></span>
            {socketConnected ? "Real-time updates" : "Offline mode"}
          </span>
        </div>
      </div>

      {!isComplete && progress > 0 && progress < 100 && (
        <div style={{ marginBottom: "1rem" }}>
          <p>Transcription in progress... {progress}% complete</p>
          <ProgressBar value={progress} />
        </div>
      )}

      {typeof window !== "undefined" && (
        <div className="editor-container">
          <Editor
            value={content}
            onChange={handleContentChange}
            height="600px"
          />
        </div>
      )}

      {audioFilename && !audioTrashed && (
        <div style={{ marginTop: "1rem" }}>
          <AudioPlayer filename={audioFilename} />
        </div>
      )}

      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Link href="/home">
          <Button
            label="Back to Home"
            icon="pi pi-arrow-left"
            className="p-button-secondary"
          />
        </Link>

        {content && isComplete && (
          <Button
            label="Restart Transcription"
            icon="pi pi-refresh"
            className="p-button-warning"
            onClick={startTranscription}
          />
        )}
      </div>
    </div>
  );
}

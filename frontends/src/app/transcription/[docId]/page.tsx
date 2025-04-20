"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import io, { Socket } from "socket.io-client";
import "react-quill/dist/quill.snow.css";
import AudioPlayer from "@/components/AudioPlayer";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

 
interface PartialChunk {
  text: string;
  chunk_index?: number;
  total_chunks?: number;
}

interface TranscriptEvent {
  doc_id: string;
  chunks: PartialChunk[];
  done?: boolean;
}

interface DocUpdateEvent {
  doc_id: string;
  content: string;
}

export default function TranscriptionEditor() {
  const params = useParams();
  const docId = params.docId as string;

  const socketRef = useRef<Socket | null>(null);
  const [content, setContent] = useState<string>("");
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [audioTrashed, setAudioTrashed] = useState<boolean>(false);
  const [audioFilename, setAudioFilename] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/docs/${docId}`);
        if (res.ok) {
          const docData = await res.json();
          setContent(docData.content || "");
          setAudioTrashed(!!docData.audioTrashed);
          setAudioFilename(docData.audioFilename || "");
          setAudioUrl(`/uploads/${docData.audioFilename}`);
        }
      } catch (err) {
        console.error("Err loading doc:", err);
      }
    })();
  }, [docId]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.emit("join_doc", { doc_id: docId });

    const handlePartial = (data: TranscriptEvent) => {
      if (data.doc_id === docId) {
        let updated = content;
        data.chunks.forEach((ch) => {
          updated += " " + ch.text;
        });
        setContent(updated);
        updateDocContent(updated);
      }
    };

    const handleFinal = (data: TranscriptEvent) => {
      if (data.doc_id === docId && data.done) {
        setIsComplete(true);
      }
    };

    const handleDocUpdate = (upd: DocUpdateEvent) => {
      if (upd.doc_id === docId) {
        setContent(upd.content);
      }
    };

    socket.on("partial_transcript_batch", handlePartial);
    socket.on("final_transcript", handleFinal);
    socket.on("doc_content_update", handleDocUpdate);

    return () => {
      socket.off("partial_transcript_batch", handlePartial);
      socket.off("final_transcript", handleFinal);
      socket.off("doc_content_update", handleDocUpdate);
      socket.disconnect();
    };
  }, [docId, content]);

  const updateDocContent = async (newContent: string) => {
    try {
      await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });
    } catch (err) {
      console.error("Update doc err:", err);
    }
  };

  const handleChange = (val: string) => {
    setContent(val);
    if (socketRef.current) {
      socketRef.current.emit("edit_doc", { doc_id: docId, content: val });
    }
    updateDocContent(val);
  };

  return (
    <div style={{ background: "#f5f5f5", minHeight: "100vh", padding: "1rem" }}>
      <h2>Transcription for Doc: {docId}</h2>
      {audioFilename && (
        <p>
          Audio: {audioFilename}
          {audioTrashed ? " (in TRASH)" : ""}
        </p>
      )}
      {isComplete && <p style={{ color: "green" }}>Transcription Complete!</p>}

      <ReactQuill
        theme="snow"
        value={content}
        onChange={handleChange}
        style={{ height: "600px", background: "#fff" }}
      />

      {audioUrl && <AudioPlayer audioUrl={audioUrl} filename={audioFilename} />}
    </div>
  );
}

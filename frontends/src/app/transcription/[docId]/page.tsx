// src/app/transcription/[docId]/page.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Import the component dynamically to avoid SSR issues
const TranscriptionEditor = dynamic(() => import('@/components/TranscriptionEditor'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Loading Transcription Editor...</h2>
    </div>
  )
});

export default function TranscriptionPage() {
  return <TranscriptionEditor />;
}

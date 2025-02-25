import React from 'react';
import App from '../App';

/**
 * The main page is reusing App.js to handle upload + doc listing + partial transcripts.
 */
export default function Home() {
  return (
    <div style={{ padding:'1rem' }}>
      <App />
    </div>
  );
}

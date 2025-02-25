import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import reportWebVitals from './reportWebVitals';

import Navbar from './components/Navbar/Navbar';
import Home from './pages/Home';
import Docs from './pages/Docs';
import Trash from './pages/Trash';
import DocEditor from './pages/DocEditor';
import TranscriptionEditor from './pages/TranscriptionEditor';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/edit/:docId" element={<DocEditor />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/transcription/:docId" element={<TranscriptionEditor />} />
      </Routes>
    </Router>
  </React.StrictMode>
);

reportWebVitals();

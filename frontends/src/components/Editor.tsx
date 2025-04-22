// src/components/Editor.tsx
'use client';

import React, { useState, useEffect } from 'react';

// A placeholder that will be shown during server-side rendering and loading
const EditorPlaceholder = () => (
  <div style={{ 
    height: '500px', 
    background: '#f8f8f8', 
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
    <p>Loading editor...</p>
  </div>
);

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

const Editor: React.FC<EditorProps> = ({ value, onChange, height = '500px' }) => {
  const [mounted, setMounted] = useState(false);
  const [QuillEditor, setQuillEditor] = useState<any>(null);

  useEffect(() => {
    // Only import ReactQuill on the client side
    if (typeof window !== 'undefined') {
      // Dynamically import ReactQuill to avoid SSR issues
      import('react-quill').then((mod) => {
        // Import the CSS as well
        import('react-quill/dist/quill.snow.css');
        setQuillEditor(() => mod.default);
        setMounted(true);
      });
    }
  }, []);

  if (!mounted || !QuillEditor) {
    return <EditorPlaceholder />;
  }

  // Define Quill modules and formats
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link'
  ];

  // Render ReactQuill with appropriate props
  return (
    <div className="editor-wrapper">
      <QuillEditor
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        style={{ height }}
      />
    </div>
  );
};

export default Editor;

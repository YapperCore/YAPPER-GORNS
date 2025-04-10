// frontend/src/App.js
import './static/App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Trash from './pages/Trash';
import Signup from './pages/Signup';
import Login from './pages/login';
import { AuthProvider, useAuth } from './context/AuthContext';
import DocEditor from './util/DocEditor';
import TranscriptionEditor from './util/TranscriptionEditor';
import Navbar from './components/Navbar/Navbar';
import FolderDocs from './pages/FolderDocs';

// Protected route component
function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

function AppContent() {
  const { currentUser } = useAuth();
  
  return (
    <Router>
      <div className="App">
        <Navbar />
        
        <Routes>
          <Route path="/" element={currentUser ? <Navigate to="/home" /> : <Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route path="/home" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          
          <Route path="/trash" element={
            <ProtectedRoute>
              <Trash />
            </ProtectedRoute>
          } />
          
          <Route path="/docs/*" element={
            <ProtectedRoute>
              <DocEditor />
            </ProtectedRoute>
          } />
          
          <Route path="/transcription/:docId" element={
            <ProtectedRoute>
              <TranscriptionEditor />
            </ProtectedRoute>
          } />

          <Route path="/folders/:folderName" element={
            <ProtectedRoute>
              <FolderDocs />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
    </AuthProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

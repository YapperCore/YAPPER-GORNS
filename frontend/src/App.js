// frontend/src/App.js
import './static/App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Trash from './pages/Trash';
import Signup from './pages/Signup';
import Login from './pages/login';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import DocEditor from './util/DocEditor';
import TranscriptionEditor from './util/TranscriptionEditor';
import AdminPanel from './pages/AdminPanel';
import Navbar from './components/Navbar/Navbar';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar />
          
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Protected routes */}
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
            
            {/* Admin routes */}
            <Route path="/admin/*" element={
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

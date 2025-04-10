import './static/App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Trash from './pages/Trash';
import Signup from './pages/Signup';
import Login from './pages/login';
import { AuthProvider } from './context/AuthContext';
import DocEditor from './util/DocEditor';
import TranscriptionEditor from './util/TranscriptionEditor';

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
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
    <Router>
      <div className="App">
        <nav style={{ background:'#333', color:'#fff', padding:'1rem' }}>
          
          <Link to="/" style={{ color:'#fff', marginRight:'1rem' }}>Login</Link>
          <Link to="/home" style={{ color:'#fff', marginRight:'1rem' }}>Home</Link>
          <Link to="/trash" style={{ color:'#fff', marginRight:'1rem' }}>Trash</Link>
        </nav>

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/home" element={<Home />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/docs/*" element={<DocEditor />} />
          <Route path="/transcription/:docId" element={<TranscriptionEditor />} />
        </Routes>
      </div>
    </Router>
    </AuthProvider>
  );
}

export default App;
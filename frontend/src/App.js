import './App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Trash from './pages/Trash';
import DocEditor from './DocEditor';
import TranscriptionEditor from './TranscriptionEditor';
import Signup from './pages/Signup';
import Login from './pages/login';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
    <Router>
      <div className="App">
        <nav style={{ background:'#333', color:'#fff', padding:'1rem' }}>
          
          <Link to="/" style={{ color:'#fff', marginRight:'1rem' }}>Login</Link>
          <Link to="/home" style={{ color:'#fff', marginRight:'1rem' }}>Home</Link>
          <Link to="/trash" style={{ color:'#fff', marginRight:'1rem' }}>Trash</Link>
          <Link to="/docs" style={{ color:'#fff' }}>Docs</Link>
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
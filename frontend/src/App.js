import './static/App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Trash from './pages/Trash';
import Signup from './pages/Signup';
import Login from './pages/login';
import { AuthProvider } from './context/AuthContext';
import DocEditor from './util/DocEditor';
import TranscriptionEditor from './util/TranscriptionEditor';

function App() {
  return (
    <AuthProvider>
    <Router>
      <div className="App">
        <nav style={{ background:'#333', color:'#fff', padding:'1rem' }}>
          
          <Link to="/" style={{ color:'#fff', marginRight:'1rem' }}>Signup</Link>
          <Link to="/login" style={{ color:'#fff', marginRight:'1rem' }}>Login</Link>
          <Link to="/home" style={{ color:'#fff', marginRight:'1rem' }}>Home</Link>
          <Link to="/trash" style={{ color:'#fff', marginRight:'1rem' }}>Trash</Link>
        </nav>

        <Routes>
          <Route path="/" element={<Signup />} />
          <Route path="/login" element={<Login />} />
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
import './static/App.css';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Trash from './pages/Trash';
import Signup from './pages/Signup';
import Login from './pages/login';
import { AuthProvider, useAuth } from './context/AuthContext'; 
import DocEditor from './util/DocEditor';
import TranscriptionEditor from './util/TranscriptionEditor';
import 'bootstrap/dist/css/bootstrap.min.css'; 
import Navbar from './components/Navbar/Navbar';


function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar /> 
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
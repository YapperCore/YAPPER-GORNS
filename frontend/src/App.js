import './App.css';
import { useState } from "react";

function App() {
  const [documents,setDocuments] = useState([]);

  const addDoc = () => {
    setDocuments((prevDocuments) => [...prevDocuments, `doc${prevDocuments.length + 1}`]);
  };
  
  return (
    <div className="App">
      <header className="App-header">
        {/*<img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>*/}
        <div className="Input-Form">
          <label htmlFor="myfile">Select a file: </label>
          <input type="file" id="myfile" name="myfile" />
          <input type="submit" />
        </div>

        <div className="addButton">
          <button onClick={addDoc}>
            Add Document
          </button>
        </div>

        <div className="Doclist">
          <ul>
            {documents.map((doc, index) => (
              <li key={index}>
                {doc}{" "}
              </li>
            ))}
          </ul>
        </div>
      </header>

    </div>
  );
}

export default App;

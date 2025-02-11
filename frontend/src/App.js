import './App.css';

function App() {
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
        <div className='Input-Form'>
          <label for="myfile">Select a file: </label>
          <input type="file" id="myfile" name="myfile"/>
          <input type="submit"/>
        </div>
        <div className='Doclist'>
          <ul>
            <li>Document-1</li>
            <li>Document-2</li>
            <li>Document-3</li>
          </ul>
          </div>

      </header>


    </div>
  );
}

export default App;

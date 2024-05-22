import React, { useState } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/theme-monokai';
import Sk from 'skulpt';
import './App.css';

const PythonPlayground = () => {
  const [pythonCode, setPythonCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const executePythonCode = () => {
    setIsRunning(true);

    Sk.configure({
      output: (text) => setOutput(prevOutput => prevOutput + text),
      read: (filename) => {
        if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][filename] === undefined) {
          throw "File not found: '" + filename + "'";
        }
        return Sk.builtinFiles["files"][filename];
      },
      execLimit: null,
      yieldLimit: 100
    });

    Sk.misceval.asyncToPromise(() => {
      return Sk.importMainWithBody("<stdin>", false, pythonCode, true);
    }).then(() => {
      console.log("Python code executed successfully!");
      setIsRunning(false);
    }, (err) => {
      setOutput(prevOutput => prevOutput + `\nError: ${err.toString()}`);
      console.error("Error executing Python code:", err.toString());
      setIsRunning(false);
    });
  };

  const clearConsole = () => {
    setOutput('');
  };

  return (
    <div className="container">
      <div className="editor-container">
        <h2>Python Playground</h2>
        <AceEditor
          mode="python"
          theme="monokai"
          value={pythonCode}
          onChange={setPythonCode}
          fontSize={14}
          width="100%"
          height="300px"
          className="python-editor"
          editorProps={{
            $blockScrolling: true,
          }}
          setOptions={{ 
            enableBasicAutocompletion: true, 
            enableLiveAutocompletion: true,
            fontFamily: 'Fira Code, monospace' 
          }}
        />
        <br />
        <button className="run-button" onClick={executePythonCode} disabled={isRunning}>Run</button>
        <button className="clear-button" onClick={clearConsole}>Clear Console</button>
      </div>
      <div className="output-container">
        <h3>Output:</h3>
        <pre>{output}</pre>
      </div>
      <footer className="footer">
        <p>&copy; MADE BY SID, DO NOT DISTRIBUTE</p>
      </footer>
      <a href="/html-playground/index.html" className="html-playground-button">HTML Playground</a>
    </div>
  );
};

export default PythonPlayground;
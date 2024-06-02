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

  const clearOutput = () => {
    setOutput('');
  };

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
      yieldLimit: 100,
      inputfun: (prompt) => window.prompt(prompt),
      inputfunTakesPrompt: true
    });

    // Custom time module
    const timeModule = new Sk.builtin.module({
      __name__: new Sk.builtin.str("time"),
      sleep: new Sk.builtin.func(function (seconds) {
        return new Promise(resolve => setTimeout(resolve, Sk.ffi.remapToJs(seconds) * 1000));
      }),
    });

    // Custom random module
    const randomModule = new Sk.builtin.module({
      __name__: new Sk.builtin.str("random"),
      random: new Sk.builtin.func(function () {
        return Sk.ffi.remapToPy(Math.random());
      }),
      randint: new Sk.builtin.func(function (a, b) {
        a = Sk.ffi.remapToJs(a);
        b = Sk.ffi.remapToJs(b);
        return Sk.ffi.remapToPy(Math.floor(Math.random() * (b - a + 1)) + a);
      }),
      choice: new Sk.builtin.func(function (seq) {
        const index = Math.floor(Math.random() * Sk.ffi.remapToJs(seq).length);
        return seq.mp$subscript(index);
      })
    });

    Sk.sysmodules.mp$ass_subscript(new Sk.builtin.str('time'), timeModule);
    Sk.sysmodules.mp$ass_subscript(new Sk.builtin.str('random'), randomModule);

    // Custom clear function
    Sk.builtins.clear = new Sk.builtin.func(() => {
      clearOutput();
      return Sk.builtin.none.none$;
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
        <button className="clear-button" onClick={clearOutput}>Clear Console</button>
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
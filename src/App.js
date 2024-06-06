import React, { useState, useRef, useEffect } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/theme-monokai';
import Sk from 'skulpt';
import SplitPane from 'react-split-pane';
import { SketchPicker } from 'react-color';
import './App.css';

const PythonPlayground = () => {
  const [pythonCode, setPythonCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [outputTextColor, setOutputTextColor] = useState('#8FBC8F'); // Default light green color
  const [showColorPicker, setShowColorPicker] = useState(false);
  const outputRef = useRef(null);

  const clearOutput = () => {
    setOutput('');
  };

  const executePythonCode = () => {
    setIsRunning(true);

    Sk.configure({
      output: (text) => {
        if (text.includes('\r')) {
          setOutput(text.replace('\r', ''));
        } else {
          setOutput(prevOutput => prevOutput + text);
        }
      },
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

    // Custom sleep function
    Sk.builtins.sleep = new Sk.builtin.func(function (seconds) {
      return Sk.misceval.promiseToSuspension(
        new Promise(resolve => setTimeout(resolve, Sk.ffi.remapToJs(seconds) * 1000))
      );
    });

    // Custom choice function
    Sk.builtins.choice = new Sk.builtin.func(function (seq) {
      const index = Math.floor(Math.random() * Sk.ffi.remapToJs(seq).length);
      return seq.mp$subscript(index);
    });

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

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="container">
      <SplitPane split="vertical" minSize={200} defaultSize="50%">
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
              fontFamily: 'Fira Code, monospace',
              printMargin: false // Disable the print margin
            }}
          />
          <br />
          <div>
            <button className="run-button" onClick={executePythonCode} disabled={isRunning}>Run</button>
            <button className="clear-button" onClick={clearOutput}>Clear Console</button>
            <button className="color-picker-button" onClick={() => setShowColorPicker(!showColorPicker)}>
              {showColorPicker ? 'Close Color Picker' : 'Change Text Color'}
            </button>
          </div>
          {showColorPicker && (
            <div className="color-picker">
              <SketchPicker
                color={outputTextColor}
                onChangeComplete={color => setOutputTextColor(color.hex)}
              />
            </div>
          )}
        </div>
        <div className="output-container" ref={outputRef} style={{ color: outputTextColor }}>
          <h3>Output:</h3>
          <pre>{output}</pre>
        </div>
      </SplitPane>
      <a href="/html-playground/index.html" className="html-playground-button">HTML Playground</a>
    </div>
  );
};

export default PythonPlayground;

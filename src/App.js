import React, { useState, useRef, useEffect } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/ext-language_tools';
import Sk from 'skulpt';
import SplitPane from 'react-split-pane';
import { SketchPicker } from 'react-color';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

const PythonPlayground = () => {
  const [pythonCode, setPythonCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [outputTextColor, setOutputTextColor] = useState(localStorage.getItem('outputTextColor') || '#8FBC8F');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [filename, setFilename] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for sidebar visibility
  const [showFiles, setShowFiles] = useState(false); // State for showing files
  const [inputPrompt, setInputPrompt] = useState(null);
  const outputRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputFieldRef = useRef(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    const querySnapshot = await getDocs(collection(db, 'files'));
    const filesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setFiles(filesList);
  };

  const createFile = async () => {
    const newFile = { filename, content: '' };
    const docRef = await addDoc(collection(db, 'files'), newFile);
    setFiles([...files, { id: docRef.id, ...newFile }]);
    setFilename('');
  };

  const deleteFile = async (id) => {
    await deleteDoc(doc(db, 'files', id));
    fetchFiles();
  };

  const clearOutput = () => {
    setOutput('');
  };

  const executePythonCode = () => {
    setIsRunning(true);
    setOutput('');

    Sk.configure({
      output: (text) => {
        setOutput(prevOutput => prevOutput + text);
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
      },
      read: (filename) => {
        if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][filename] === undefined) {
          throw new Error("File not found: '" + filename + "'");
        }
        return Sk.builtinFiles["files"][filename];
      },
      execLimit: null,
      yieldLimit: 100,
      inputfunTakesPrompt: true,
      inputfun: (prompt) => {
        return new Promise((resolve) => {
          setOutput(prevOutput => prevOutput + prompt + '\n');
          setInputPrompt({ prompt, resolve });
        });
      }
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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPythonCode(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const saveCurrentFile = async () => {
    if (currentFile) {
      await updateDoc(doc(db, 'files', currentFile.id), { content: pythonCode });
      alert('File saved successfully!');
    } else {
      const filename = prompt('Enter filename:');
      if (filename) {
        const newFile = { filename, content: pythonCode };
        const docRef = await addDoc(collection(db, 'files'), newFile);
        setCurrentFile({ id: docRef.id, ...newFile });
        alert('File saved successfully!');
      }
    }
  };

  const handleSelectFile = (file) => {
    setCurrentFile(file);
    setPythonCode(file.content);
  };

  const handleColorChangeComplete = (color) => {
    setOutputTextColor(color.hex);
    localStorage.setItem('outputTextColor', color.hex);
  };

  const toggleShowFiles = () => {
    setShowFiles(!showFiles);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && inputPrompt) {
      const input = inputFieldRef.current.value;
      setOutput(prevOutput => prevOutput + input + '\n');
      inputPrompt.resolve(input + '\n');
      setInputPrompt(null);
      inputFieldRef.current.value = '';
    }
  };

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="container" onKeyPress={handleKeyPress}>
      <button className="hamburger-button" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        ☰
      </button>
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <h2>chillenz Playground</h2>
        <div className="file-controls">
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="New file name"
            className="file-input"
          />
          <button className="create-button" onClick={createFile}>Create</button>
          <button className="show-files-button" onClick={toggleShowFiles}>
            {showFiles ? 'Hide Files' : 'Show Files'}
          </button>
        </div>
        <div className={`files-container ${showFiles ? 'show' : ''}`}>
          <ul>
            {files.map((file) => (
              <li key={file.id} className={currentFile && currentFile.id === file.id ? 'selected' : ''}>
                <span>{file.filename}</span>
                <div className="file-buttons">
                  <button onClick={() => handleSelectFile(file)}>Open</button>
                  <button className="delete-button" onClick={() => deleteFile(file.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <button className="save-button" onClick={saveCurrentFile}>Save</button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          accept=".py"
        />
        <button className="load-button" onClick={() => fileInputRef.current.click()}>Load</button>
      </div>
      <SplitPane split="vertical" minSize={200} defaultSize="50%">
        <div className="editor-container">
          <h2 className="playground-heading">chillenz Playground</h2>
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
                onChangeComplete={handleColorChangeComplete}
              />
            </div>
          )}
          <a href="/html-playground/index.html" className="html-playground-button">HTML Playground</a>
        </div>
        <div className="output-container" ref={outputRef} style={{ color: outputTextColor }}>
          <h3>Output:</h3>
          <pre>{output}</pre>
          {inputPrompt && (
            <input
              type="text"
              className="input-field"
              ref={inputFieldRef}
              autoFocus
            />
          )}
        </div>
      </SplitPane>
    </div>
  );
};

export default PythonPlayground;

import React, { useState, useRef, useEffect } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/ext-language_tools';
import Sk from 'skulpt';
import SplitPane from 'react-split-pane';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { SketchPicker } from 'react-color';
import './App.css';

const PythonPlayground = () => {
  const [pythonCode, setPythonCode] = useState(localStorage.getItem('pythonCode') || '');
  const [isRunning, setIsRunning] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [isInputRunning, setIsInputRunning] = useState(false);
  const [filename, setFilename] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [outputColor, setOutputColor] = useState(() => {
    const savedColor = localStorage.getItem('outputColor');
    return savedColor ? parseInt(savedColor, 10) : 82; // Default to green if no saved color
  });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const terminalRef = useRef(null);
  const fileInputRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const onKeyRef = useRef(null);
  let input = ''; // Define input variable here

  useEffect(() => {
    fetchFiles();
    initializeTerminal();
  }, []);

  useEffect(() => {
    localStorage.setItem('pythonCode', pythonCode);
  }, [pythonCode]);

  const initializeTerminal = () => {
    if (terminalRef.current && !terminal.current) {
      terminal.current = new Terminal({
        theme: {
          background: '#1e1e1e',
          foreground: '#8FBC8F',
        },
        cursorBlink: true,
      });
      fitAddon.current = new FitAddon();
      terminal.current.loadAddon(fitAddon.current);
      terminal.current.open(terminalRef.current);
      fitAddon.current.fit();
    }
  };

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

  const renameFile = async (id) => {
    const newFilename = prompt('Enter new filename:');
    if (newFilename) {
      await updateDoc(doc(db, 'files', id), { filename: newFilename });
      fetchFiles();
    }
  };

  const clearOutput = () => {
    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[H'); // Moves cursor to the top-left corner
    }
  };

  // Function to write colored text
  const writeColoredText = (text, color) => {
    if (terminal.current) {
      const colorCode = `\x1b[38;5;${color}m`; // ANSI escape code for 256 colors
      const resetCode = `\x1b[0m`;
      terminal.current.write(text.split('\n').map(line => colorCode + line + resetCode).join('\r\n'));
    }
  };

  // Define the custom functions and add them to Skulpt's built-in namespace
  const skulptBuiltinFuncs = () => {
    const clear = new Sk.builtin.func(() => {
      clearOutput();
      return Sk.builtin.none.none$;
    });

    const sleep = new Sk.builtin.func((seconds) => {
      return Sk.misceval.promiseToSuspension(new Promise((resolve) => {
        setTimeout(() => resolve(Sk.builtin.none.none$), Sk.ffi.remapToJs(seconds) * 1000);
      }));
    });

    const choice = new Sk.builtin.func((seq) => {
      const jsSeq = Sk.ffi.remapToJs(seq);
      const choice = jsSeq[Math.floor(Math.random() * jsSeq.length)];
      return Sk.ffi.remapToPy(choice);
    });

    Sk.builtins['clear'] = clear;
    Sk.builtins['sleep'] = sleep;
    Sk.builtins['choice'] = choice;
  };

  const executePythonCode = () => {
    setIsRunning(true);

    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[H'); // Moves cursor to the top-left corner
    }

    Sk.configure({
      output: (text) => {
        // Use the selected color for regular output and red for errors
        const color = text.includes('Error:') ? 196 : outputColor; // Use color code 196 (red) for errors
        writeColoredText(text, color);
      },
      read: (filename) => {
        if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][filename] === undefined) {
          throw new Error("File not found: '" + filename + "'");
        }
        return Sk.builtinFiles["files"][filename];
      },
      yieldLimit: 10,
      inputfunTakesPrompt: true,
      inputfun: (prompt) => {
        setIsInputRunning(true); // Set the state when input command starts
        return new Promise((resolve) => {
          if (terminal.current) {
            writeColoredText(prompt, outputColor); // Use selected color for prompt
            input = ''; // Reset input on new input command
            onKeyRef.current = terminal.current.onKey((key) => {
              const char = key.domEvent.key;
              if (char === 'Enter') {
                terminal.current.write('\r\n');
                setIsInputRunning(false); // Reset the state when input command ends
                resolve(input);
                onKeyRef.current.dispose();
              } else if (char === 'Backspace') {
                input = input.slice(0, -1);
                terminal.current.write('\b \b');
              } else {
                terminal.current.write(`\x1b[38;5;${outputColor}m` + char + `\x1b[0m`); // Use selected color for input characters
                input += char;
              }
            });
          }
        });
      },
    });

    skulptBuiltinFuncs();

    Sk.misceval.asyncToPromise(() => {
      return Sk.importMainWithBody("<stdin>", false, pythonCode, true);
    }).then(() => {
      console.log("Python code executed successfully!");
      setIsRunning(false);
    }, (err) => {
      writeColoredText(`\nError: ${err.toString()}`, 196); // Example: Using color code 196 (red)
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

  const toggleShowFiles = () => {
    setShowFiles(!showFiles);
  };

  const handleColorChangeComplete = (color) => {
    const rgb = color.rgb;
    const ansiColor = 16 + (36 * Math.round(rgb.r / 51)) + (6 * Math.round(rgb.g / 51)) + Math.round(rgb.b / 51);
    setOutputColor(ansiColor);
    localStorage.setItem('outputColor', ansiColor);
  };
  

  return (
    <div className="container">
      <button className="hamburger-button" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        ☰
      </button>
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <br></br>
        <br></br>
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
        <div className={`files-container ${showFiles ? 'open' : ''}`}>
          <ul>
            {files.map((file) => (
              <li key={file.id} className={currentFile && currentFile.id === file.id ? 'selected' : ''}>
                <span>{file.filename}</span>
                <div className="file-buttons">
                  <button onClick={() => handleSelectFile(file)}>Open</button>
                  <button className="delete-button" onClick={() => deleteFile(file.id)}>Delete</button>
                  <button className="rename-button" onClick={() => renameFile(file.id)}>Rename</button>
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
            className="python-editor"
            editorProps={{
              $blockScrolling: true,
            }}
            setOptions={{
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              fontFamily: 'Fira Code, monospace',
              printMargin: false
            }}
          />
          <div>
            {isRunning ? (
              <button className="stop-button" onClick={() => window.location.reload()}>Stop</button>
            ) : (
              <button className="run-button" onClick={executePythonCode}>Run</button>
            )}
            <button className="clear-button" onClick={clearOutput}>Clear Console</button>
            <button className="color-picker-button" onClick={() => setShowColorPicker(!showColorPicker)}>
              {showColorPicker ? 'Close Color Picker' : 'Change Text Color'}
            </button>
            {showColorPicker && (
              <div className="color-picker">
                <SketchPicker
                  color={`#${outputColor.toString(16)}`}
                  onChangeComplete={handleColorChangeComplete}
                />
              </div>
            )}
          </div>
          <a href="/html-playground/index.html" className="html-playground-button">HTML Playground</a>
        </div>
        <div className={`output-container ${isInputRunning ? '' : 'hide-cursor'}`} ref={terminalRef} style={{ height: '100%' }}>
        </div>
      </SplitPane>
    </div>
  );
};

export default PythonPlayground;
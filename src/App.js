import React, { useState, useRef, useEffect } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/ext-language_tools';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-twilight';
import 'ace-builds/src-noconflict/theme-xcode';
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
  const [showOutput, setShowOutput] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [theme, setTheme] = useState(localStorage.getItem('editorTheme') || 'monokai');
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('editorFontSize'), 10) || 14);
  const [showSettings, setShowSettings] = useState(false);
  const terminalRef = useRef(null);
  const fileInputRef = useRef(null);
  const terminal = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(parseInt(localStorage.getItem('zoomLevel'), 10) || 100);
  const fitAddon = useRef(null);
  const onKeyRef = useRef(null);
  const colorPickerRef = useRef(null);
  const colorPickerButtonRef = useRef(null);
  let input = ''; // Define input variable here

  useEffect(() => {
    fetchFiles();
    initializeTerminal();

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setShowOutput(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('pythonCode', pythonCode);
  }, [pythonCode]);

  useEffect(() => {
    document.body.style.zoom = `${zoomLevel}%`;
    localStorage.setItem('zoomLevel', zoomLevel);
  }, [zoomLevel]);

  useEffect(() => {
    localStorage.setItem('outputColor', outputColor);
  }, [outputColor]);

  useEffect(() => {
    const hasRefreshed = localStorage.getItem('hasRefreshed');
    if (!hasRefreshed) {
      localStorage.setItem('hasRefreshed', 'true');
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('editorTheme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('editorFontSize', fontSize);
  }, [fontSize]);

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

  const renderZoomSelector = () => (
    <div className="zoom-selector">
      <h3>Zoom Level</h3>
      <button onClick={() => setZoomLevel((level) => Math.max(level - 10, 50))}>-</button>
      <span>{zoomLevel}%</span>
      <button onClick={() => setZoomLevel((level) => Math.min(level + 10, 200))}>+</button>
    </div>
  );

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
      terminal.current.scrollToBottom(); // Ensure the terminal auto-scrolls to the bottom
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
    if (isMobile) {
      setShowOutput(true);
    }

    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[H'); // Moves cursor to the top-left corner
    }

    Sk.configure({
      output: (text) => {
        const color = text.includes('Error:') ? 196 : outputColor;
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
        setIsInputRunning(true);
        return new Promise((resolve) => {
          if (terminal.current) {
            writeColoredText(prompt, outputColor);
            input = '';
            onKeyRef.current = terminal.current.onKey((key) => {
              const char = key.domEvent.key;
              if (char === 'Enter') {
                terminal.current.write('\r\n');
                setIsInputRunning(false);
                resolve(input);
                onKeyRef.current.dispose();
              } else if (char === 'Backspace') {
                if (input.length > 0) {
                  input = input.slice(0, -1);
                  terminal.current.write('\b \b');
                }
              } else if (char.length === 1) {
                terminal.current.write(`\x1b[38;5;${outputColor}m${char}\x1b[0m`);
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
      writeColoredText(`\nError: ${err.toString()}`, 196);
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

  const toggleColorPicker = () => {
    setShowColorPicker(!showColorPicker);
  };

  const colorPickerRefCallback = (element) => {
    if (element && colorPickerButtonRef.current) {
      const rect = colorPickerButtonRef.current.getBoundingClientRect();
      element.style.top = `${rect.bottom + window.scrollY}px`;
      element.style.left = `${rect.left + window.scrollX}px`;
    }
    colorPickerRef.current = element;
  };

  const renderThemeSelector = () => (
    <div className="theme-selector">
      <h3>Select Theme</h3>
      <label>
        <input
          type="radio"
          value="monokai"
          checked={theme === 'monokai'}
          onChange={(e) => setTheme(e.target.value)}
        />
        Monokai
      </label>
      <label>
        <input
          type="radio"
          value="github"
          checked={theme === 'github'}
          onChange={(e) => setTheme(e.target.value)}
        />
        Github
      </label>
      <label>
        <input
          type="radio"
          value="twilight"
          checked={theme === 'twilight'}
          onChange={(e) => setTheme(e.target.value)}
        />
        Twilight
      </label>
      <label>
        <input
          type="radio"
          value="xcode"
          checked={theme === 'xcode'}
          onChange={(e) => setTheme(e.target.value)}
        />
        Xcode
      </label>
    </div>
  );

  const renderFontSizeSelector = () => (
    <div className="font-size-selector">
      <h3>Font Size</h3>
      <button onClick={() => setFontSize((size) => Math.max(size - 1, 10))}>-</button>
      <span>{fontSize}</span>
      <button onClick={() => setFontSize((size) => Math.min(size + 1, 30))}>+</button>
    </div>
  );

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
          {isMobile && (
            <>
              <button
                className="color-picker-button"
                onClick={toggleColorPicker}
                ref={colorPickerButtonRef}
              >
                {showColorPicker ? 'Close Color Picker' : 'Change Text Color'}
              </button>
              <a href="/html-playground/index.html" className="html-playground-button">HTML Playground</a>
            </>
          )}
          <button className="settings-button" onClick={() => setShowSettings(true)}>Settings</button>
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
      {isMobile ? (
        <>
          <div className={`editor-container ${showOutput ? 'hidden' : ''}`}>
            <h2 className="playground-heading">chillenz Playground</h2>
            <AceEditor
              mode="python"
              theme={theme}
              value={pythonCode}
              onChange={setPythonCode}
              fontSize={fontSize}
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
            <div className="mobile-buttons">
              {isRunning ? (
                <button className="stop-button" onClick={() => window.location.reload()}>Stop</button>
              ) : (
                <button className="run-button" onClick={executePythonCode}>Run</button>
              )}
              <button className="clear-button" onClick={clearOutput}>Clear Console</button>
            </div>
          </div>
          <div className={`output-container ${isInputRunning ? '' : 'hide-cursor'} ${showOutput ? 'show' : 'hidden'}`} ref={terminalRef} style={{ height: '100vh', overflowY: 'auto' }}>
            <button className="back-button" onClick={() => setShowOutput(false)}>Back</button>
          </div>
        </>
      ) : (
        <SplitPane split="vertical" minSize={200} defaultSize="50%">
          <div className="editor-container">
            <h2 className="playground-heading">chillenz Playground</h2>
            <AceEditor
              mode="python"
              theme={theme}
              value={pythonCode}
              onChange={setPythonCode}
              fontSize={fontSize}
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
              <button
                className="color-picker-button"
                onClick={toggleColorPicker}
                ref={colorPickerButtonRef}
              >
                {showColorPicker ? 'Close Color Picker' : 'Change Text Color'}
              </button>
              <a href="/html-playground/index.html" className="html-playground-button">HTML Playground</a>
            </div>
          </div>
          <div className={`output-container ${isInputRunning ? '' : 'hide-cursor'}`} ref={terminalRef} style={{ height: '100%' }}>
          </div>
        </SplitPane>
      )}
      {showColorPicker && (
        <div className="color-picker" ref={colorPickerRefCallback}>
          <SketchPicker
            color={`#${outputColor.toString(16)}`}
            onChangeComplete={handleColorChangeComplete}
          />
        </div>
      )}
      {showSettings && (
        <div className="settings-modal">
          <h2>Settings</h2>
          {renderThemeSelector()}
          {renderFontSizeSelector()}
          {renderZoomSelector()}
          <button className="close-settings-button" onClick={() => setShowSettings(false)}>Close Settings</button>
        </div>
      )}
    </div>
  );
};

export default PythonPlayground; // sorry.
import React, { useState, useRef, useEffect } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/theme-nord_dark';
import 'ace-builds/src-noconflict/ext-language_tools';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Play, Save, FileUp, X, Folder, Download, ChevronRight, Code2 } from 'lucide-react';

// Add Skulpt imports
import 'skulpt/dist/skulpt.min.js';
import 'skulpt/dist/skulpt-stdlib.js';

/* global Sk */

export default function ModernPlayground() {
  const [pythonCode, setPythonCode] = useState(localStorage.getItem('pythonCode') || '');
  const [isRunning, setIsRunning] = useState(false);
  const [files, setFiles] = useState([]);
  const [isInputRunning, setIsInputRunning] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const fileInputRef = useRef(null);
  const onKeyRef = useRef(null);
  let input = '';

  useEffect(() => {
    fetchFiles();
    initializeTerminal();
    localStorage.setItem('pythonCode', pythonCode);
  }, [pythonCode]);

  const initializeTerminal = () => {
    if (terminalRef.current && !terminal.current) {
      terminal.current = new Terminal({
        theme: {
          background: '#1a1b26',
          foreground: '#c0caf5',
          cursor: '#c0caf5'
        },
        fontSize: 14,
        fontFamily: '"JetBrains Mono", monospace',
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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setPythonCode(e.target.result);
      reader.readAsText(file);
    }
  };

  const saveFile = async () => {
    if (!newFileName.trim()) return;
    
    try {
      if (currentFile) {
        await updateDoc(doc(db, 'files', currentFile.id), { 
          content: pythonCode,
          filename: newFileName 
        });
      } else {
        await addDoc(collection(db, 'files'), {
          filename: newFileName,
          content: pythonCode
        });
      }
      setNewFileName('');
      fetchFiles();
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  const deleteFile = async (id) => {
    await deleteDoc(doc(db, 'files', id));
    fetchFiles();
  };

  const executePythonCode = () => {
    setIsRunning(true);
    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[H');
    }

    const output = (text) => {
      if (terminal.current) {
        terminal.current.write(text);
        terminal.current.scrollToBottom();
      }
    };

    Sk.configure({
      output,
      read: (filename) => {
        if (Sk.builtinFiles === undefined || 
            Sk.builtinFiles["files"][filename] === undefined) {
          throw new Error("File not found: '" + filename + "'");
        }
        return Sk.builtinFiles["files"][filename];
      },
      inputfunTakesPrompt: true,
      inputfun: (prompt) => {
        setIsInputRunning(true);
        return new Promise((resolve) => {
          if (terminal.current) {
            terminal.current.write(prompt);
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
                terminal.current.write(char);
                input += char;
              }
            });
          }
        });
      }
    });

    Sk.misceval.asyncToPromise(() => {
      return Sk.importMainWithBody("<stdin>", false, pythonCode, true);
    }).then(() => {
      setIsRunning(false);
    }).catch((err) => {
      output(`\nError: ${err.toString()}\n`);
      setIsRunning(false);
    });
  };

  return (
    <div className="flex h-screen bg-[#0f1117] text-gray-100">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${showFiles ? 'translate-x-0' : '-translate-x-full'} w-64 bg-[#1a1b26] p-6 transition-transform duration-300 ease-in-out z-10 flex flex-col`}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-purple-400">Files</h2>
          <button onClick={() => setShowFiles(false)} className="p-1 hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="File name..."
            className="flex-1 px-3 py-2 bg-[#24283b] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <button
            onClick={saveFile}
            className="p-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"
          >
            <Save className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className={`group flex items-center justify-between p-3 mb-2 rounded-lg transition-all ${
                currentFile?.id === file.id ? 'bg-purple-500 bg-opacity-20' : 'hover:bg-gray-800'
              }`}
            >
              <button
                onClick={() => {
                  setCurrentFile(file);
                  setPythonCode(file.content);
                  setNewFileName(file.filename);
                }}
                className="flex items-center flex-1"
              >
                <Code2 className="w-4 h-4 mr-2 text-purple-400" />
                <span className="truncate">{file.filename}</span>
              </button>
              <button
                onClick={() => deleteFile(file.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500 rounded transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".py"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current.click()}
          className="mt-4 w-full py-2 bg-[#24283b] hover:bg-[#2a2f44] rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <FileUp className="w-5 h-5" />
          Upload File
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center p-4 bg-[#1a1b26] border-b border-gray-800">
          <button
            onClick={() => setShowFiles(true)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors mr-4"
          >
            <Folder className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-purple-400">Python Playground</h1>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4 p-4">
          <div className="relative flex flex-col rounded-lg overflow-hidden border border-gray-800">
            <div className="p-2 bg-[#1a1b26] border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-medium">Editor</span>
              <button
                onClick={executePythonCode}
                disabled={isRunning}
                className={`px-4 py-1 rounded-full flex items-center gap-2 text-sm ${
                  isRunning
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-purple-500 hover:bg-purple-600'
                } transition-colors`}
              >
                {isRunning ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isRunning ? 'Running...' : 'Run'}
              </button>
            </div>
            <AceEditor
              mode="python"
              theme="nord_dark"
              value={pythonCode}
              onChange={setPythonCode}
              fontSize={14}
              width="100%"
              height="100%"
              className="flex-1"
              setOptions={{
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                showPrintMargin: false,
                fontFamily: '"JetBrains Mono", monospace'
              }}
            />
          </div>

          <div className="flex flex-col rounded-lg overflow-hidden border border-gray-800">
            <div className="p-2 bg-[#1a1b26] border-b border-gray-800">
              <span className="text-sm font-medium">Output</span>
            </div>
            <div ref={terminalRef} className="flex-1 bg-[#1a1b26]" />
          </div>
        </div>
      </div>
    </div>
  );
}
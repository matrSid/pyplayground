import React, { useState, useRef, useEffect } from 'react';
import AceEditor from 'react-ace';
import { useFiles } from './useFiles';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/theme-nord_dark';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-tomorrow_night';
import 'ace-builds/src-noconflict/ext-language_tools';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Code2, Play, Save, FileUp, X, Folder, Settings, GripVertical, Menu } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

// Add Skulpt imports
import 'skulpt/dist/skulpt.min.js';
import 'skulpt/dist/skulpt-stdlib.js';

/* global Sk */

export default function ModernPlayground() {
  const [pythonCode, setPythonCode] = useState(localStorage.getItem('pythonCode') || '');
  const [isRunning, setIsRunning] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editorSettings, setEditorSettings] = useState({
    fontSize: parseInt(localStorage.getItem('editorFontSize')) || 14,
    theme: localStorage.getItem('editorTheme') || 'nord_dark',
    terminalFontSize: parseInt(localStorage.getItem('terminalFontSize')) || 14,
  });
  
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const fileInputRef = useRef(null);
  const onKeyRef = useRef(null);
  const isMobile = useRef(window.innerWidth <= 768);

  // Use the custom hook for file operations
  const [files, { fetchFiles, saveFile, deleteFile }] = useFiles();

  useEffect(() => {
    fetchFiles();
    initializeTerminal();
    localStorage.setItem('pythonCode', pythonCode);
    
    const handleResize = () => {
      isMobile.current = window.innerWidth <= 768;
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pythonCode, fetchFiles]);

  useEffect(() => {
    localStorage.setItem('editorFontSize', editorSettings.fontSize);
    localStorage.setItem('editorTheme', editorSettings.theme);
    localStorage.setItem('terminalFontSize', editorSettings.terminalFontSize);
    
    if (terminal.current) {
      // Create a new terminal instance with updated options
      const newTerminal = new Terminal({
        theme: {
          background: '#1a1b26',
          foreground: '#c0caf5',
          cursor: '#c0caf5'
        },
        fontSize: editorSettings.terminalFontSize,
        fontFamily: '"JetBrains Mono", monospace',
        cursorBlink: true,
        cols: 80,
        rows: 24,
        convertEol: true,
        scrollback: 1000,
        wordWrap: true
      });

      // Clear the terminal container
      if (terminalRef.current) {
        terminalRef.current.innerHTML = '';
      }

      // Set up the new terminal
      fitAddon.current = new FitAddon();
      newTerminal.loadAddon(fitAddon.current);
      newTerminal.open(terminalRef.current);
      fitAddon.current.fit();

      // Update the terminal reference
      terminal.current = newTerminal;
    }
  }, [editorSettings]);

  const initializeTerminal = () => {
    if (terminalRef.current && !terminal.current) {
      terminal.current = new Terminal({
        theme: {
          background: '#1a1b26',
          foreground: '#c0caf5',
          cursor: '#c0caf5'
        },
        fontSize: editorSettings.terminalFontSize,
        fontFamily: '"JetBrains Mono", monospace',
        cursorBlink: true,
        cols: 80,
        rows: 24,
        convertEol: true,
        scrollback: 1000,
        wordWrap: true,
        allowTransparency: true,
        disableStdin: false,
        screenReaderMode: true, // Enable screen reader support
        rightClickSelectsWord: true, // Enable right-click word selection
      });
      
      fitAddon.current = new FitAddon();
      terminal.current.loadAddon(fitAddon.current);
      terminal.current.open(terminalRef.current);
      fitAddon.current.fit();

      // Enable text selection and copying
      terminalRef.current.style.userSelect = 'text';
      terminal.current.attachCustomKeyEventHandler((event) => {
        // Allow Ctrl+C for copying
        if (event.type === 'keydown' && event.ctrlKey && event.code === 'KeyC') {
          const selection = terminal.current.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
          }
          return false;
        }
        return true;
      });

      window.addEventListener('resize', () => {
        if (fitAddon.current) {
          fitAddon.current.fit();
        }
      });
    }
  };


  const handleInput = (prompt) => {
    return new Promise((resolve, reject) => {
      if (terminal.current) {
        // Create a hidden input element for mobile
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'text';
        hiddenInput.style.position = 'absolute';
        hiddenInput.style.left = '-9999px';
        hiddenInput.style.opacity = '0';
        document.body.appendChild(hiddenInput);
  
        terminal.current.write(prompt);
        let input = '';
        let composing = false;
  
        const cleanup = () => {
          if (document.body.contains(hiddenInput)) {
            document.body.removeChild(hiddenInput);
          }
          terminalRef.current?.removeEventListener('click', focusInput);
        };
  
        // Handle composition events for mobile
        hiddenInput.addEventListener('compositionstart', () => {
          composing = true;
        });
  
        hiddenInput.addEventListener('compositionend', (e) => {
          composing = false;
          // Clear previous input display
          for (let i = 0; i < input.length; i++) {
            terminal.current.write('\b \b');
          }
          input = e.data;
          terminal.current.write(input);
        });
  
        hiddenInput.addEventListener('input', (e) => {
          if (composing) return; // Skip if we're in IME composition
  
          // Clear previous input display
          for (let i = 0; i < input.length; i++) {
            terminal.current.write('\b \b');
          }
          
          input = e.target.value;
          terminal.current.write(input);
        });
  
        const handleKeyDown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            terminal.current.write('\r\n');
            cleanup();
            resolve(input);
          } else if (e.key === 'Backspace') {
            e.preventDefault();
            if (input.length > 0) {
              input = input.slice(0, -1);
              terminal.current.write('\b \b');
              hiddenInput.value = input;
            }
          }
        };
  
        hiddenInput.addEventListener('keydown', handleKeyDown);

  
        // Focus the hidden input immediately and when terminal is clicked
        const focusInput = () => {
          hiddenInput.focus();
        };
        
        terminalRef.current.addEventListener('click', focusInput);
        hiddenInput.focus();
      } else {
        reject(new Error('Terminal not initialized'));
      }
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setPythonCode(e.target.result);
      reader.readAsText(file);
    }
  };

  const handleSaveFile = async () => {
    if (await saveFile(newFileName, pythonCode, currentFile)) {
      setNewFileName('');
    }
  };

  const executePythonCode = () => {
    setIsRunning(true);
    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[H');
    }

    const output = (text) => {
      if (terminal.current) {
        const formattedText = text.replace(/\n/g, '\r\n');
        terminal.current.write(formattedText);
        if (!formattedText.endsWith('\r\n') && !formattedText.endsWith('\n')) {
          terminal.current.write('\r\n');
        }
        terminal.current.scrollToBottom();
        fitAddon.current.fit();
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
      inputfun: handleInput
    });

    Sk.misceval.asyncToPromise(() => {
      return Sk.importMainWithBody("<stdin>", false, pythonCode, true);
    }).then(() => {
      setIsRunning(false);
      terminal.current.write('\r\n');
    }).catch((err) => {
      output(`\nError: ${err.toString()}\r\n`);
      setIsRunning(false);
    });
  };

  const SettingsPanel = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#1a1b26] rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-purple-400">Settings</h2>
          <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-700 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Editor Theme</label>
            <select
              value={editorSettings.theme}
              onChange={(e) => setEditorSettings(prev => ({ ...prev, theme: e.target.value }))}
              className="w-full px-3 py-2 bg-[#24283b] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="nord_dark">Nord Dark</option>
              <option value="monokai">Monokai</option>
              <option value="github">Github Light</option>
              <option value="tomorrow_night">Tomorrow Night</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Editor Font Size</label>
            <input
              type="number"
              value={editorSettings.fontSize}
              onChange={(e) => setEditorSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 bg-[#24283b] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              min="8"
              max="32"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Terminal Font Size</label>
            <input
              type="number"
              value={editorSettings.terminalFontSize}
              onChange={(e) => setEditorSettings(prev => ({ ...prev, terminalFontSize: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 bg-[#24283b] rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              min="8"
              max="32"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const MobileMenu = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-[#1a1b26] rounded-lg p-4 w-full max-w-xs">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-purple-400">Menu</h2>
                <button onClick={() => setIsMobileMenuOpen(false)} 
                        className="p-1 hover:bg-gray-700 rounded-full">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <div className="space-y-3">
                <button
                    onClick={() => {
                        setShowFiles(true);
                        setIsMobileMenuOpen(false);
                    }}
                    className="w-full py-2 px-4 bg-[#24283b] hover:bg-[#2a2f44] rounded-lg 
                             transition-colors flex items-center justify-center gap-2"
                >
                    <Folder className="w-5 h-5" />
                    Files
                </button>

                <button
                    onClick={executePythonCode}
                    disabled={isRunning}
                    className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 
                             ${isRunning ? 'bg-gray-700 cursor-not-allowed' : 
                                         'bg-purple-500 hover:bg-purple-600'}`}
                >
                    {isRunning ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent 
                                      rounded-full animate-spin" />
                    ) : (
                        <Play className="w-4 h-4" />
                    )}
                    {isRunning ? 'Running...' : 'Run'}
                </button>

                <button
                    onClick={() => {
                        setShowSettings(true);
                        setIsMobileMenuOpen(false);
                    }}
                    className="w-full py-2 px-4 bg-[#24283b] hover:bg-[#2a2f44] rounded-lg 
                             transition-colors flex items-center justify-center gap-2"
                >
                    <Settings className="w-5 h-5" />
                    Settings
                </button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0f1117] text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${showFiles ? 'translate-x-0' : '-translate-x-full'} 
      w-64 bg-[#1a1b26] transition-transform duration-300 ease-in-out z-20 flex flex-col p-3 sm:p-4`}>
      
      {/* Close Button for Sidebar */}
      <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-purple-400">Files</h2>
          <button onClick={() => setShowFiles(false)} className="p-1 hover:bg-gray-700 rounded-full">
              <X className="w-5 h-5" />
          </button>
      </div>

      {/* File Input and Save Button */}
      <div className="flex items-center gap-1 mb-4 px-1">
          <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="File name..."
              className="flex-1 px-2 py-1.5 text-sm bg-[#24283b] rounded-lg focus:outline-none 
                        focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <button
              onClick={handleSaveFile}
              className="p-1.5 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors flex-shrink-0"
          >
              <Save className="w-4 h-4" />
          </button>
      </div>

      <div className="flex-1 overflow-y-auto">
          {files.map((file) => (
              <div
                  key={file.id}
                  className={`group flex items-center justify-between p-2 mb-2 rounded-lg transition-all ${
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
                      <span className="truncate text-sm">{file.filename}</span>
                  </button>
                  <button
                      onClick={() => deleteFile(file.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500 rounded transition-all"
                  >
                      <X className="w-3 h-3" />
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
          className="mt-4 w-full py-2 bg-[#24283b] hover:bg-[#2a2f44] rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
      >
          <FileUp className="w-4 h-4" />
          Upload File
      </button>
  </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
      <div className="flex items-center p-3 bg-[#1a1b26] border-b border-gray-800">
        <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors md:hidden"
        >
            <Menu className="w-5 h-5" />
        </button>
        
        <button
            onClick={() => setShowFiles(true)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors mr-2 hidden md:block"
        >
            <Folder className="w-5 h-5" />
        </button>
        
        <h1 className="text-lg md:text-xl font-bold text-purple-400 flex-1">Python Playground</h1>
        
        <div className="flex items-center gap-2">
            <button
                onClick={executePythonCode}
                disabled={isRunning}
                className="md:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
                {isRunning ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Play className="w-5 h-5" />
                )}
            </button>
            
            <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors hidden md:block"
            >
                <Settings className="w-5 h-5" />
            </button>
        </div>
    </div>
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction={isMobile.current ? "vertical" : "horizontal"}>
            <Panel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col rounded-lg overflow-hidden border border-gray-800">
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
                  theme={editorSettings.theme}
                  value={pythonCode}
                  onChange={setPythonCode}
                  fontSize={editorSettings.fontSize}
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
            </Panel>

            <PanelResizeHandle className="w-2 md:w-1 bg-gray-800 hover:bg-purple-500 transition-colors flex items-center justify-center">
              <GripVertical className="w-4 h-4 text-gray-500" />
            </PanelResizeHandle>

            <Panel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col rounded-lg overflow-hidden border border-gray-800">
                <div className="p-2 bg-[#1a1b26] border-b border-gray-800">
                  <span className="text-sm font-medium">Output</span>
                </div>
                <div ref={terminalRef} className="flex-1 bg-[#1a1b26]" />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>

      {showSettings && <SettingsPanel />}
      {isMobileMenuOpen && <MobileMenu />}
    </div>
  );
}
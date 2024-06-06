import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FileManager = ({ onSelectFile, onNewFile }) => {
  const [files, setFiles] = useState([]);
  const [filename, setFilename] = useState('');

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    const response = await axios.get('http://localhost:5000/files');
    setFiles(response.data);
  };

  const createFile = async () => {
    const response = await axios.post('http://localhost:5000/files', { filename, content: '' });
    setFiles([...files, response.data]);
    setFilename('');
  };

  const deleteFile = async (id) => {
    await axios.delete(`http://localhost:5000/files/${id}`);
    fetchFiles();
  };

  return (
    <div>
      <h3>Files</h3>
      <input
        type="text"
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
        placeholder="New file name"
      />
      <button onClick={createFile}>Create</button>
      <ul>
        {files.map((file) => (
          <li key={file._id}>
            <span onClick={() => onSelectFile(file)}>{file.filename}</span>
            <button onClick={() => deleteFile(file._id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileManager;

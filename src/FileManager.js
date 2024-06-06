import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

const FileManager = ({ onSelectFile, onNewFile }) => {
  const [files, setFiles] = useState([]);
  const [filename, setFilename] = useState('');

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
          <li key={file.id}>
            <span onClick={() => onSelectFile(file)}>{file.filename}</span>
            <button onClick={() => deleteFile(file.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileManager;

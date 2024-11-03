import { useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export function useFiles() {
  const [files, setFiles] = useState([]);

  const fetchFiles = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'files'));
      const filesList = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setFiles(filesList);
    } catch (error) {
      console.error('Error fetching files:', error);
      return false;
    }
  };

  const saveFile = async (newFileName, pythonCode, currentFile) => {
    if (!newFileName.trim()) return false;
    
    try {
      if (currentFile) {
        // Update existing file
        await updateDoc(doc(db, 'files', currentFile.id), { 
          content: pythonCode,
          filename: newFileName 
        });
      } else {
        // Create new file
        await addDoc(collection(db, 'files'), {
          filename: newFileName,
          content: pythonCode
        });
      }
      await fetchFiles();
      return true;
    } catch (error) {
      console.error('Error saving file:', error);
      return false;
    }
  };

  const deleteFile = async (id) => {
    try {
      await deleteDoc(doc(db, 'files', id));
      await fetchFiles();
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  };

  return [files, { fetchFiles, saveFile, deleteFile }];
}
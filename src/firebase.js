import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCf0M20Y2bKAY6oWpRSeLNWmJRzt3H-5io",
    authDomain: "pyplaygroundv2.firebaseapp.com",
    projectId: "pyplaygroundv2",
    storageBucket: "pyplaygroundv2.appspot.com",
    messagingSenderId: "844040781116",
    appId: "1:844040781116:web:1edddc2f93f3fdd9ebf239"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

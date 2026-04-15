import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBJJh4BnuNfcoWqyeDJkcMEn4nTcktn8GU',
  authDomain: 'trash-iq-umg.firebaseapp.com',
  projectId: 'trash-iq-umg',
  storageBucket: 'trash-iq-umg.firebasestorage.app',
  messagingSenderId: '542439315774',
  appId: '1:542439315774:web:8862053821b28b9842746f',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app, firebaseConfig };

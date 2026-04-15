import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'REEMPLAZAR_API_KEY',
  authDomain: 'trash-iq-umg.firebaseapp.com',
  projectId: 'trash-iq-umg',
  storageBucket: 'trash-iq-umg.appspot.com',
  messagingSenderId: 'REEMPLAZAR_MESSAGING_SENDER_ID',
  appId: 'REEMPLAZAR_APP_ID',
  measurementId: 'REEMPLAZAR_MEASUREMENT_ID',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

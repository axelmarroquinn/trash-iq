import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from './firebase.js';

const LOGIN_PATH = 'login.html';
const DASHBOARD_PATH = 'index.html';

export async function initLogin() {
  const form = document.getElementById('loginForm');
  const errorMsg = document.getElementById('errorMsg');

  if (!form) return;

  const currentUser = await waitForAuthState();
  if (currentUser) {
    window.location.href = DASHBOARD_PATH;
    return;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const email = document.getElementById('email')?.value?.trim() || '';
    const password = document.getElementById('password')?.value || '';

    hideError(errorMsg);

    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = DASHBOARD_PATH;
    } catch (error) {
      showError(errorMsg, 'No se pudo iniciar sesion. Verifica tu correo y contrasena.');
      console.error('[TrashIQ] Error de autenticacion:', error);
    }
  });
}

export async function protectRoute() {
  if (!document.body?.dataset?.requiresAuth) {
    return auth.currentUser;
  }

  const user = await waitForAuthState();

  if (!user) {
    window.location.href = LOGIN_PATH;
    return null;
  }

  return user;
}

export function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');

  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('[TrashIQ] Error cerrando sesion:', error);
    } finally {
      window.location.href = LOGIN_PATH;
    }
  });
}

function waitForAuthState() {
  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      resolve(user);
    });
  });
}

function hideError(errorMsg) {
  if (!errorMsg) return;
  errorMsg.textContent = '';
  errorMsg.classList.add('hidden');
}

function showError(errorMsg, message) {
  if (!errorMsg) return;
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
}

if (document.getElementById('loginForm')) {
  initLogin();
}

import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from './firebase.js';

export function initLogin() {
  const form = document.getElementById('loginForm');
  const errorMsg = document.getElementById('errorMsg');

  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const email = document.getElementById('email')?.value?.trim() || '';
    const password = document.getElementById('password')?.value || '';

    if (errorMsg) {
      errorMsg.classList.add('hidden');
      errorMsg.textContent = '';
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = 'index.html';
    } catch (error) {
      if (errorMsg) {
        errorMsg.textContent = 'No se pudo iniciar sesion. Verifica tu correo y contrasena.';
        errorMsg.classList.remove('hidden');
      }
      console.error('[TrashIQ] Error de autenticacion:', error);
    }
  });
}

export function protectRoute() {
  if (!document.body?.dataset?.requiresAuth) return;

  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = 'login.html';
    }
  });
}

export function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');

  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
  });
}

if (document.getElementById('loginForm')) {
  initLogin();
}

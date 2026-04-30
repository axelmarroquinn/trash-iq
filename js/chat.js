const PREGUNTAR_DASHBOARD_ENDPOINT =
  'https://preguntardashboard-epnwwyvrcq-uc.a.run.app';

export function initChat() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  });
}

async function handleSend() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const text = input.value.trim();

  if (!text) return;

  input.value = '';
  sendBtn.disabled = true;
  appendMessage('user', text);
  const typingEl = appendTyping();

  try {
    const response = await preguntarDashboard(text);
    typingEl.remove();
    appendMessage('ai', response);
  } catch (error) {
    typingEl.remove();
    appendMessage('ai', 'Error al consultar IA');
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

async function preguntarDashboard(pregunta) {
  const response = await fetch(PREGUNTAR_DASHBOARD_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pregunta }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data || typeof data.respuesta !== 'string') {
    throw new Error('Respuesta invalida');
  }

  return formatearRespuestaDashboard(data);
}

function formatearRespuestaDashboard(data) {
  if (data.total_peso_g === null || data.total_registros === null) {
    return data.respuesta;
  }
  const totalPeso = Number(data.total_peso_g).toLocaleString('es-GT');
  const totalRegistros = Number(data.total_registros).toLocaleString('es-GT');
  const labelRegistros = data.total_registros === 1 ? 'registro' : 'registros';
  return `${data.respuesta} Total: ${totalPeso} g en ${totalRegistros} ${labelRegistros}.`;
}

function limpiarRespuestaIA(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role === 'user' ? 'user' : 'ai'}`;
  div.innerHTML = `<div class="chat-msg__bubble">${escapeHTML(text)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendTyping() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg--ai';
  div.innerHTML = `
    <div class="chat-msg__bubble">
      <div class="chat-typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import { getMetricLabel, getWasteKeys, WASTE_TYPES } from './data.js';
import { getMetricMode, isDevMode } from './state.js';

const AI_CONFIG = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  apiKey: 'TU_API_KEY_AQUI',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 300,
};

const SYSTEM_PROMPT = `Eres un asistente de analisis de residuos domesticos.
Responde en espanol de forma clara y concisa.
Cuando menciones cantidades, usa gramos, kilogramos o cantidad de items segun corresponda.
Enfocate en patrones, recomendaciones de compra y almacenamiento.`;

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
    const context = buildDataContext();
    const response = await callAI(text, context);
    typingEl.remove();
    appendMessage('ai', response);
  } catch (error) {
    typingEl.remove();
    appendMessage('ai', `Error al conectar con la IA: ${error.message}.`);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function buildDataContext() {
  const types = getWasteKeys();
  const metricMode = getMetricMode();
  const lines = types.map(key => {
    const value = document.getElementById(`val-${key}`)?.textContent || 'N/A';
    const badge = document.getElementById(`badge-${key}`)?.textContent || 'N/A';
    return `- ${WASTE_TYPES[key].label}: ${value} (variacion: ${badge})`;
  });

  return [
    `Modo dev: ${isDevMode() ? 'activo' : 'apagado'}`,
    `Vista actual: ${getMetricLabel(metricMode)}`,
    'Datos visibles en dashboard:',
    lines.join('\n'),
  ].join('\n');
}

async function callAI(userMessage, dataContext) {
  /*
  const response = await fetch(AI_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_CONFIG.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      max_tokens: AI_CONFIG.maxTokens,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${dataContext}\n\nPregunta del usuario: ${userMessage}`,
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text || 'Sin respuesta.';
  */

  await new Promise(resolve => setTimeout(resolve, 900));
  return mockAIResponse(userMessage, dataContext);
}

function mockAIResponse(question) {
  const q = question.toLowerCase();

  if (!isDevMode()) {
    return 'El modo dev esta apagado, asi que el dashboard esta limpio y no tengo datos historicos de prueba para analizar todavia.';
  }

  if (getMetricMode() === 'count') {
    if (q.includes('mas') || q.includes('mayor')) {
      return 'En cantidad de items, lo organico sigue liderando. Esta vista te ayuda a comparar volumen de piezas en lugar de peso.';
    }

    return 'Ahora mismo estas viendo el dashboard por cantidad de items. Si quieres, puedo ayudarte a interpretar esas diferencias por categoria.';
  }

  if (q.includes('mas') || q.includes('mayor')) {
    return 'Segun los datos de prueba, el residuo organico es el que mas peso acumula esta semana. Conviene revisar porciones y almacenamiento.';
  }

  if (q.includes('plastico')) {
    return 'En los datos de prueba, el plastico viene por encima de la semana anterior. Podrias priorizar compras con menos empaque.';
  }

  return 'Puedo ayudarte a leer el dashboard, comparar categorias y sugerir mejoras para reducir desperdicio.';
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

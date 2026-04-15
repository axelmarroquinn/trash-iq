import { calcVariation, formatMetricCardValue, getPrevStatValue, getStatValue } from './data.js';
import { getMetricMode, isDarkMode, isDevMode, setDevMode, setMetricMode, toggleTheme } from './state.js';

export function setTopbarDate() {
  const el = document.getElementById('pageDate');
  const now = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  el.textContent = now.toLocaleDateString('es-GT', opts);
}

export function updateKPICards(stats) {
  const metricMode = getMetricMode();

  Object.entries(stats).forEach(([key, stat]) => {
    const valEl = document.getElementById(`val-${key}`);
    const badgeEl = document.getElementById(`badge-${key}`);
    if (!valEl || !badgeEl) return;

    const current = getStatValue(stat, metricMode);
    const previous = getPrevStatValue(stat, metricMode);
    const variation = calcVariation(current, previous);
    const isUp = current >= previous;

    animateValue(valEl, current, 550, value => formatMetricCardValue(value, metricMode));
    badgeEl.textContent = variation;
    badgeEl.className = 'kpi-badge ' + (
      current === previous ? 'kpi-badge--neutral' :
      isUp ? 'kpi-badge--up' :
      'kpi-badge--down'
    );
  });
}

function animateValue(el, to, duration, formatter) {
  const startValue = Number(el.dataset.rawValue || 0);
  el.dataset.rawValue = String(to);

  const start = performance.now();
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(startValue + (to - startValue) * eased);
    el.textContent = formatter(value);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

export function renderAlerts(alerts) {
  const container = document.getElementById('alertsList');
  const empty = document.getElementById('alertsEmpty');

  container.innerHTML = '';

  if (!alerts.length) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  alerts.forEach((alert, index) => {
    const li = document.createElement('li');
    li.className = `alert-item alert-item--${alert.type}`;
    li.style.animationDelay = `${index * 70}ms`;
    li.innerHTML = `<div class="alert-dot"></div><span>${alert.text}</span>`;
    container.appendChild(li);
  });
}

export function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');
  const pageTitle = document.getElementById('pageTitle');

  const viewTitles = {
    dashboard: 'Dashboard',
    historial: 'Historial',
    analisis: 'Analisis',
    config: 'Configuracion',
  };

  navItems.forEach(item => {
    item.addEventListener('click', event => {
      event.preventDefault();
      const viewName = item.dataset.view;
      if (!viewName) return;

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      views.forEach(view => view.classList.remove('active'));
      const target = document.getElementById(`view-${viewName}`);
      if (target) target.classList.add('active');

      pageTitle.textContent = viewTitles[viewName] || viewName;
    });
  });
}

export function initRefreshButton(reloadFn) {
  const btn = document.getElementById('refreshBtn');
  btn.addEventListener('click', async () => {
    btn.classList.add('spinning');
    await reloadFn();
    setTimeout(() => btn.classList.remove('spinning'), 600);
  });
}

export function initDeviceStatus() {
  const dot = document.getElementById('deviceDot');
  const status = document.getElementById('deviceStatus');

  setInterval(() => {
    const online = Math.random() > 0.08;
    if (online) {
      dot.classList.remove('offline');
      status.textContent = 'Conectado';
    } else {
      dot.classList.add('offline');
      status.textContent = 'Sin senal';
    }
  }, 8000);
}

export function initPreferenceControls(reloadFn) {
  const devToggle = document.getElementById('devModeToggle');
  const themeBtn = document.getElementById('themeToggleBtn');
  const metricInputs = document.querySelectorAll('input[name="metricMode"]');

  devToggle.addEventListener('change', async event => {
    setDevMode(event.target.checked);
    syncPreferenceControls();
    await reloadFn();
  });

  themeBtn.addEventListener('click', async () => {
    toggleTheme();
    syncPreferenceControls();
    await reloadFn();
  });

  metricInputs.forEach(input => {
    input.addEventListener('change', async event => {
      if (!event.target.checked) return;
      setMetricMode(event.target.value);
      syncPreferenceControls();
      await reloadFn();
    });
  });
}

export function syncPreferenceControls() {
  const devToggle = document.getElementById('devModeToggle');
  const themeBtn = document.getElementById('themeToggleBtn');
  const metricInputs = document.querySelectorAll('input[name="metricMode"]');
  const iconName = isDarkMode() ? 'sun-medium' : 'moon-star';

  if (devToggle) {
    devToggle.checked = isDevMode();
  }

  metricInputs.forEach(input => {
    input.checked = input.value === getMetricMode();
  });

  if (themeBtn) {
    themeBtn.title = isDarkMode() ? 'Volver a modo claro' : 'Cambiar a modo oscuro';
    themeBtn.innerHTML = `<i data-lucide="${iconName}"></i>`;
    lucide.createIcons();
  }
}

export function updateDashboardLabels() {
  const metricMode = getMetricMode();
  const barSubtitle = document.getElementById('barChartSubtitle');
  const donutSubtitle = document.getElementById('donutChartSubtitle');

  barSubtitle.textContent = metricMode === 'count'
    ? 'Cantidad de items por dia'
    : 'Residuos por dia (gramos)';

  donutSubtitle.textContent = metricMode === 'count'
    ? 'Por cantidad de items'
    : 'Por peso total';
}

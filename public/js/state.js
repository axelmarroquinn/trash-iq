const STORAGE_KEYS = {
  theme: 'trashiq-theme',
  metricMode: 'trashiq-metric-mode',
  devMode: 'trashiq-dev-mode',
};

const APP_STATE = {
  theme: 'light',
  metricMode: 'weight',
  devMode: true,
};

export function initAppState() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  const savedMetric = localStorage.getItem(STORAGE_KEYS.metricMode);
  const savedDevMode = localStorage.getItem(STORAGE_KEYS.devMode);

  if (savedTheme === 'dark' || savedTheme === 'light') {
    APP_STATE.theme = savedTheme;
  }

  if (savedMetric === 'weight' || savedMetric === 'count') {
    APP_STATE.metricMode = savedMetric;
  }

  if (savedDevMode !== null) {
    APP_STATE.devMode = savedDevMode === 'true';
  }

  applyTheme(APP_STATE.theme);
}

export function applyTheme(theme) {
  APP_STATE.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

export function toggleTheme() {
  applyTheme(APP_STATE.theme === 'dark' ? 'light' : 'dark');
}

export function setMetricMode(mode) {
  APP_STATE.metricMode = mode;
  localStorage.setItem(STORAGE_KEYS.metricMode, mode);
}

export function setDevMode(enabled) {
  APP_STATE.devMode = Boolean(enabled);
  localStorage.setItem(STORAGE_KEYS.devMode, String(APP_STATE.devMode));
}

export function getMetricMode() {
  return APP_STATE.metricMode;
}

export function isDarkMode() {
  return APP_STATE.theme === 'dark';
}

export function isDevMode() {
  return APP_STATE.devMode;
}

export { APP_STATE, STORAGE_KEYS };

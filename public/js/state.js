const STORAGE_KEYS = {
  theme: 'trashiq-theme',
  metricMode: 'trashiq-metric-mode',
};

const APP_STATE = {
  theme: 'light',
  metricMode: 'weight',
};

export function initAppState() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  const savedMetric = localStorage.getItem(STORAGE_KEYS.metricMode);

  if (savedTheme === 'dark' || savedTheme === 'light') {
    APP_STATE.theme = savedTheme;
  }

  if (savedMetric === 'weight' || savedMetric === 'count') {
    APP_STATE.metricMode = savedMetric;
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

export function getMetricMode() {
  return APP_STATE.metricMode;
}

export function isDarkMode() {
  return APP_STATE.theme === 'dark';
}

export { APP_STATE, STORAGE_KEYS };

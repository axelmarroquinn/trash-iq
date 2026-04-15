import { initLogout, protectRoute } from './auth.js';
import { renderBarChart, renderDonutChart } from './charts.js';
import { fetchAlerts, fetchChartData, fetchCurrentStats } from './data.js';
import { initChat } from './chat.js';
import { getMetricMode, initAppState } from './state.js';
import {
  initDeviceStatus,
  initNavigation,
  initPreferenceControls,
  initRefreshButton,
  renderAlerts,
  setTopbarDate,
  syncPreferenceControls,
  updateDashboardLabels,
  updateKPICards,
} from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await protectRoute();
  if (!user) return;

  initAppState();
  lucide.createIcons();

  setTopbarDate();
  initNavigation();
  initLogout();
  initDeviceStatus();
  initRefreshButton(loadDashboardData);
  initPreferenceControls(loadDashboardData);
  initChat();
  syncPreferenceControls();

  document.getElementById('chartRangeSelect').addEventListener('change', async () => {
    await loadDashboardData();
  });

  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    updateDashboardLabels();

    const range = document.getElementById('chartRangeSelect').value;
    const metricMode = getMetricMode();

    const [stats, chartData, alerts] = await Promise.all([
      fetchCurrentStats(),
      fetchChartData(range, metricMode),
      fetchAlerts(),
    ]);

    updateKPICards(stats);
    renderBarChart(chartData);
    renderDonutChart(stats);
    renderAlerts(alerts);
  } catch (error) {
    console.error('[TrashIQ] Error cargando datos:', error);
  }
}

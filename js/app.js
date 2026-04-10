document.addEventListener('DOMContentLoaded', async () => {
  initAppState();
  lucide.createIcons();

  setTopbarDate();
  initNavigation();
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

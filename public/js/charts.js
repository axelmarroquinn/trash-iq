let barChartInstance = null;
let donutChartInstance = null;

function getThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    textMuted: styles.getPropertyValue('--text-muted').trim(),
    textPrimary: styles.getPropertyValue('--text-primary').trim(),
    border: styles.getPropertyValue('--neutral-200').trim(),
    tooltipBg: styles.getPropertyValue('--chart-tooltip-bg').trim(),
    tooltipText: styles.getPropertyValue('--chart-tooltip-text').trim(),
    surface: styles.getPropertyValue('--surface-card').trim(),
  };
}

function destroyChart(instanceName) {
  if (instanceName === 'bar' && barChartInstance) {
    barChartInstance.destroy();
    barChartInstance = null;
  }

  if (instanceName === 'donut' && donutChartInstance) {
    donutChartInstance.destroy();
    donutChartInstance = null;
  }
}

function toggleChartEmptyState(canvasId, emptyId, shouldShowEmpty) {
  const canvas = document.getElementById(canvasId);
  const empty = document.getElementById(emptyId);

  canvas.classList.toggle('hidden', shouldShowEmpty);
  empty.classList.toggle('hidden', !shouldShowEmpty);
}

function renderBarChart(data) {
  const metricMode = getMetricMode();
  const hasData = data.hasData !== false;
  toggleChartEmptyState('barChart', 'barChartEmpty', !hasData);

  if (!hasData) {
    destroyChart('bar');
    return;
  }

  const ctx = document.getElementById('barChart').getContext('2d');
  const theme = getThemeColors();
  const datasets = Object.entries(data.datasets).map(([key, values]) => ({
    label: WASTE_TYPES[key].label,
    data: values,
    backgroundColor: WASTE_TYPES[key].color,
    borderRadius: 6,
    borderSkipped: false,
    barPercentage: 0.7,
    categoryPercentage: 0.8,
  }));

  destroyChart('bar');

  barChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: theme.textPrimary,
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            padding: 16,
            font: { family: 'Manrope', size: 11 },
          },
        },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: context => ` ${context.dataset.label}: ${formatMetricValue(context.raw, metricMode)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: theme.textMuted,
            font: { family: 'Manrope', size: 11 },
          },
        },
        y: {
          grid: {
            color: theme.border,
            lineWidth: 1,
          },
          border: { display: false },
          ticks: {
            color: theme.textMuted,
            font: { family: 'Manrope', size: 11 },
            callback: value => formatAxisTick(value, metricMode),
          },
        },
      },
    },
  });
}

function renderDonutChart(stats) {
  const metricMode = getMetricMode();
  const keys = Object.keys(stats);
  const values = keys.map(key => getStatValue(stats[key], metricMode));
  const total = values.reduce((sum, value) => sum + value, 0);
  const hasData = total > 0;
  const theme = getThemeColors();

  toggleChartEmptyState('donutChart', 'donutChartEmpty', !hasData);

  if (!hasData) {
    destroyChart('donut');
    renderDonutLegend(keys, values, total);
    return;
  }

  const ctx = document.getElementById('donutChart').getContext('2d');
  destroyChart('donut');

  donutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: keys.map(key => WASTE_TYPES[key].label),
      datasets: [{
        data: values,
        backgroundColor: keys.map(key => WASTE_TYPES[key].color),
        borderColor: theme.surface,
        borderWidth: 4,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: context => {
              const pct = total > 0 ? ((context.raw / total) * 100).toFixed(1) : '0.0';
              return ` ${formatMetricValue(context.raw, metricMode)} (${pct}%)`;
            },
          },
        },
      },
    },
  });

  renderDonutLegend(keys, values, total);
}

function renderDonutLegend(keys, values, total) {
  const container = document.getElementById('donutLegend');
  const metricMode = getMetricMode();
  container.innerHTML = '';

  if (total === 0) {
    container.innerHTML = '<li class="legend-empty">Sin distribucion disponible.</li>';
    return;
  }

  keys.forEach((key, index) => {
    const pct = total > 0 ? ((values[index] / total) * 100).toFixed(1) : '0.0';
    const li = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `
      <div class="legend-left">
        <div class="legend-dot" style="background:${WASTE_TYPES[key].color}"></div>
        <span class="legend-label">${WASTE_TYPES[key].label}</span>
      </div>
      <div class="legend-right">
        <span class="legend-value">${formatMetricValue(values[index], metricMode)}</span>
        <span class="legend-pct">${pct}%</span>
      </div>
    `;
    container.appendChild(li);
  });
}

function formatAxisTick(value, metricMode) {
  if (metricMode === 'count') {
    return value;
  }

  return value >= 1000 ? `${value / 1000}kg` : `${value}g`;
}

const WASTE_TYPES = {
  plastico: { label: 'Plastico', color: '#C73A3A' },
  papel:    { label: 'Papel',    color: '#7A8088' },
  organico: { label: 'Organico', color: '#3E8E4F' },
  otros:    { label: 'Otros',    color: '#8A5A36' },
};

function getWasteKeys() {
  return Object.keys(WASTE_TYPES);
}

function createEmptyStats() {
  return getWasteKeys().reduce((acc, key) => {
    acc[key] = {
      weight: 0,
      prevWeight: 0,
      count: 0,
      prevCount: 0,
    };
    return acc;
  }, {});
}

function createEmptyChartData(range = 'week') {
  const labels = range === 'month'
    ? ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4']
    : ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

  const datasets = getWasteKeys().reduce((acc, key) => {
    acc[key] = labels.map(() => 0);
    return acc;
  }, {});

  return {
    hasData: false,
    labels,
    datasets,
  };
}

async function fetchCurrentStats() {
  await delay(180);

  if (!isDevMode()) {
    return createEmptyStats();
  }

  return structuredClone(DEV_MOCK_DATA.current);
}

async function fetchChartData(range = 'week', metricMode = getMetricMode()) {
  await delay(160);

  if (!isDevMode()) {
    return createEmptyChartData(range);
  }

  const data = DEV_MOCK_DATA.charts[metricMode]?.[range] || DEV_MOCK_DATA.charts[metricMode]?.week;
  return {
    hasData: true,
    ...structuredClone(data),
  };
}

async function fetchAlerts() {
  await delay(120);

  if (!isDevMode()) {
    return [];
  }

  return structuredClone(DEV_MOCK_DATA.alerts);
}

function getStatValue(stat, metricMode = getMetricMode()) {
  return metricMode === 'count' ? stat.count : stat.weight;
}

function getPrevStatValue(stat, metricMode = getMetricMode()) {
  return metricMode === 'count' ? stat.prevCount : stat.prevWeight;
}

function calcVariation(current, prev) {
  if (prev === 0 && current === 0) return '0%';
  if (prev === 0) return '+100%';
  const pct = ((current - prev) / prev * 100).toFixed(1);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function formatWeight(g) {
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
}

function formatCount(count) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

function formatCountCompact(count) {
  return `${count}`;
}

function formatMetricValue(value, metricMode = getMetricMode()) {
  return metricMode === 'count' ? formatCount(value) : formatWeight(value);
}

function formatMetricCardValue(value, metricMode = getMetricMode()) {
  return metricMode === 'count' ? formatCountCompact(value) : formatWeight(value);
}

function getMetricLabel(metricMode = getMetricMode()) {
  return metricMode === 'count' ? 'cantidad de items' : 'peso';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

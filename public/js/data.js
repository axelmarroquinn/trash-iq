import { collection, getDocs, limit as limitDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './firebase.js';
import { getMetricMode } from './state.js';

export const WASTE_TYPES = {
  plastico: { label: 'Plastico', color: '#C73A3A' },
  papel:    { label: 'Papel',    color: '#7A8088' },
  organico: { label: 'Organico', color: '#3E8E4F' },
  otros:    { label: 'Otros',    color: '#8A5A36' },
};

export function getWasteKeys() {
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

export async function fetchCurrentStats() {
  const stats = createEmptyStats();
  const snapshot = await getDocs(collection(db, 'waste_logs'));
  const now = new Date();

  const currentStart = getStartOfDay(now);
  currentStart.setDate(currentStart.getDate() - 6);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 7);

  snapshot.forEach(docSnapshot => {
    const data = docSnapshot.data() || {};
    const category = normalizeCategory(data.categoria);
    const weight = normalizePositiveNumber(data.peso_g);
    const eventDate = toDate(data.timestamp);

    if (!category) return;

    stats[category].weight += weight;
    stats[category].count += 1;

    if (eventDate && eventDate >= previousStart && eventDate < currentStart) {
      stats[category].prevWeight += weight;
      stats[category].prevCount += 1;
    }
  });

  return stats;
}

export async function fetchChartData(range = 'week', metricMode = getMetricMode()) {
  const chartData = createEmptyChartData(range);
  const config = getChartRangeConfig(range, chartData.labels);
  if (config.labels) {
    chartData.labels = config.labels;
    chartData.datasets = getWasteKeys().reduce((acc, key) => {
      acc[key] = chartData.labels.map(() => 0);
      return acc;
    }, {});
  }

  const snapshot = await getDocs(collection(db, 'waste_logs'));

  snapshot.forEach(docSnapshot => {
    const data = docSnapshot.data() || {};
    const category = normalizeCategory(data.categoria);
    const eventDate = toDate(data.timestamp);

    if (!category || !eventDate || eventDate < config.start || eventDate > config.end) {
      return;
    }

    const bucketIndex = config.getBucketIndex(eventDate);
    if (bucketIndex < 0 || bucketIndex >= chartData.labels.length) {
      return;
    }

    const value = metricMode === 'count' ? 1 : normalizePositiveNumber(data.peso_g);
    chartData.datasets[category][bucketIndex] += value;
  });

  chartData.hasData = Object.values(chartData.datasets)
    .flat()
    .some(value => value > 0);

  return chartData;
}

export async function fetchAlerts() {
  const alertsQuery = query(
    collection(db, 'insights'),
    orderBy('timestamp', 'desc'),
    limitDocs(5),
  );
  const snapshot = await getDocs(alertsQuery);

  return snapshot.docs.map(docSnapshot => {
    const data = docSnapshot.data() || {};
    return {
      type: data.tipo || 'info',
      text: data.texto || 'Insight sin contenido.',
    };
  });
}

export function getStatValue(stat, metricMode = getMetricMode()) {
  return metricMode === 'count' ? stat.count : stat.weight;
}

export function getPrevStatValue(stat, metricMode = getMetricMode()) {
  return metricMode === 'count' ? stat.prevCount : stat.prevWeight;
}

export function calcVariation(current, prev) {
  if (prev === 0 && current === 0) return '0%';
  if (prev === 0) return '+100%';
  const pct = ((current - prev) / prev * 100).toFixed(1);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

export function formatWeight(g) {
  return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`;
}

export function formatCount(count) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

export function formatCountCompact(count) {
  return `${count}`;
}

export function formatMetricValue(value, metricMode = getMetricMode()) {
  return metricMode === 'count' ? formatCount(value) : formatWeight(value);
}

export function formatMetricCardValue(value, metricMode = getMetricMode()) {
  return metricMode === 'count' ? formatCountCompact(value) : formatWeight(value);
}

export function getMetricLabel(metricMode = getMetricMode()) {
  return metricMode === 'count' ? 'cantidad de items' : 'peso';
}

function normalizeCategory(category) {
  return typeof category === 'string' && WASTE_TYPES[category] ? category : null;
}

function normalizePositiveNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStartOfDay(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getChartRangeConfig(range, defaultLabels) {
  const now = new Date();
  const end = new Date(now);
  const start = getStartOfDay(now);

  if (range === 'month') {
    start.setDate(start.getDate() - 29);

    return {
      start,
      end,
      labels: defaultLabels,
      getBucketIndex(date) {
        const normalizedDate = getStartOfDay(date);
        const diffDays = Math.floor((normalizedDate - start) / 86400000);
        return Math.min(3, Math.max(0, Math.floor(diffDays / 7)));
      },
    };
  }

  start.setDate(start.getDate() - 6);
  const labels = [];
  const dayIndexes = new Map();

  for (let index = 0; index < 7; index += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const key = current.toISOString().slice(0, 10);
    labels.push(current.toLocaleDateString('es-GT', { weekday: 'short' }).replace('.', ''));
    dayIndexes.set(key, index);
  }

  return {
    start,
    end,
    labels,
    getBucketIndex(date) {
      const normalizedDate = getStartOfDay(date).toISOString().slice(0, 10);
      return dayIndexes.get(normalizedDate) ?? -1;
    },
  };
}

export const DEV_MOCK_DATA = {
  current: {
    plastico: { weight: 820, prevWeight: 640, count: 14, prevCount: 11 },
    papel:    { weight: 430, prevWeight: 510, count: 8,  prevCount: 10 },
    organico: { weight: 1100, prevWeight: 870, count: 18, prevCount: 15 },
    otros:    { weight: 290, prevWeight: 290, count: 5,  prevCount: 5 },
  },
  charts: {
    weight: {
      week: {
        labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
        datasets: {
          plastico: [120, 80, 200, 140, 100, 100, 80],
          papel:    [60, 90, 40, 80, 70, 50, 40],
          organico: [200, 150, 300, 180, 120, 90, 60],
          otros:    [0, 40, 80, 0, 90, 50, 30],
        },
      },
      month: {
        labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        datasets: {
          plastico: [820, 650, 910, 740],
          papel:    [430, 510, 380, 600],
          organico: [1100, 870, 1250, 990],
          otros:    [290, 310, 270, 350],
        },
      },
    },
    count: {
      week: {
        labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
        datasets: {
          plastico: [2, 1, 4, 2, 2, 2, 1],
          papel:    [1, 2, 1, 1, 1, 1, 1],
          organico: [3, 2, 5, 3, 2, 2, 1],
          otros:    [0, 1, 1, 0, 1, 1, 1],
        },
      },
      month: {
        labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        datasets: {
          plastico: [14, 11, 15, 12],
          papel:    [8, 10, 7, 11],
          organico: [18, 15, 20, 16],
          otros:    [5, 6, 5, 7],
        },
      },
    },
  },
  alerts: [
    {
      type: 'warn',
      text: 'Botaste aguacate 3 veces esta semana; posible sobrecompra.',
    },
    {
      type: 'info',
      text: 'El organico aumento 26% vs. la semana anterior. Revisa almacenamiento.',
    },
    {
      type: 'danger',
      text: 'Gas sensor: descomposicion detectada el miercoles a las 19:42 hrs.',
    },
    {
      type: 'info',
      text: '800 g de organico podrian haberse compostado esta semana.',
    },
  ],
};

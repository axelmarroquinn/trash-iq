require("dotenv").config();

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.recibirResiduo = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const { objeto, categoria, peso_g, gas_level, timestamp } = req.body;

    const categoriasPermitidas = ["plastico", "papel", "organico", "otros"];

    if (!objeto || typeof objeto !== "string" || !objeto.trim()) {
      return res.status(400).json({ error: "objeto invalido" });
    }

    if (!categoriasPermitidas.includes(categoria)) {
      return res.status(400).json({ error: "Categoría inválida" });
    }

    const peso = parseFloat(peso_g);
    if (isNaN(peso) || peso <= 0) {
      return res.status(400).json({ error: "peso_g inválido" });
    }

    const gas = parseFloat(gas_level);
    if (isNaN(gas) || gas < 0 || gas > 1) {
      return res.status(400).json({ error: "gas_level inválido" });
    }

    const fecha = new Date(timestamp);
    if (!timestamp || isNaN(fecha.getTime())) {
      return res.status(400).json({ error: "timestamp inválido" });
    }

    try {
      await db.collection("waste_logs").add({
        objeto: objeto.trim(),
        categoria,
        peso_g: peso,
        gas_level: gas,
        timestamp: fecha,
      });

      return res.status(200).json({
        success: true,
        message: "Registro guardado",
      });
    } catch (error) {
      return res.status(500).json({
        error: "Error al guardar en Firestore",
      });
    }
  }
);

exports.analizarDashboard = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ error: "Metodo no permitido" });
    }

    const periodo = req.query.periodo === "semana" ? "semana" : "dia";
    const ahora = new Date();
    const desde = new Date(ahora);
    desde.setDate(ahora.getDate() - (periodo === "semana" ? 7 : 1));

    try {
      const snapshot = await db
        .collection("waste_logs")
        .where("timestamp", ">=", desde)
        .get();

      const metricas = construirMetricas(snapshot.docs, periodo, desde, ahora);
      const prompt = construirPromptDashboard(metricas);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const analisis = result.response.text();

      return res.status(200).json({
        periodo,
        desde: desde.toISOString(),
        hasta: ahora.toISOString(),
        metricas,
        analisis,
      });
        } catch (error) {
      console.error("ERROR GEMINI:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  }
);

exports.preguntarDashboard = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metodo no permitido" });
    }

    try {
      const { pregunta } = req.body;

      if (!pregunta || typeof pregunta !== "string" || !pregunta.trim()) {
        return res.status(400).json({ error: "pregunta invalida" });
      }

      const filtros = interpretarPreguntaDashboard(pregunta);
      let query = db
        .collection("waste_logs")
        .where("timestamp", ">=", filtros.desde)
        .where("timestamp", "<=", filtros.hasta);

      if (filtros.categoria) {
        query = query.where("categoria", "==", filtros.categoria);
      }

      const snapshot = await query.get();
      const totalPeso = snapshot.docs.reduce((total, doc) => {
        const peso = Number(doc.data().peso_g) || 0;
        return total + peso;
      }, 0);

      const total_peso_g = redondear(totalPeso);
      const total_registros = snapshot.size;

      const prompt = construirPromptPreguntaDashboard(
        pregunta,
        total_peso_g,
        total_registros
      );
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      result = await model.generateContent(prompt);
      const respuesta = result.response.text();

      return res.status(200).json({
        respuesta,
        total_peso_g,
        total_registros,
      });
    } catch (error) {
      console.error("ERROR preguntarDashboard:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  }
);

function interpretarPreguntaDashboard(pregunta) {
  const texto = normalizarTexto(pregunta);
  const ahora = new Date();
  let desde = new Date(ahora);
  let hasta = new Date(ahora);
  let categoria = null;

  const categoriasPermitidas = ["plastico", "papel", "organico", "otros"];
  categoria = categoriasPermitidas.find((item) => texto.includes(item)) || null;

  const mesDetectado = detectarMes(texto);

  if (texto.includes("hoy")) {
    desde = new Date(ahora);
    desde.setHours(ahora.getHours() - 24);
  } else if (texto.includes("semana")) {
    desde = new Date(ahora);
    desde.setDate(ahora.getDate() - 7);
  } else if (texto.includes("mes") || mesDetectado !== null) {
    const mes = mesDetectado !== null ? mesDetectado : ahora.getMonth();
    const anio = ahora.getFullYear();
    desde = new Date(anio, mes, 1, 0, 0, 0, 0);
    hasta =
      mesDetectado !== null
        ? new Date(anio, mes + 1, 0, 23, 59, 59, 999)
        : ahora;
  } else {
    desde = new Date(ahora);
    desde.setDate(ahora.getDate() - 7);
  }

  return { categoria, desde, hasta };
}

function construirPromptPreguntaDashboard(
  pregunta,
  total_peso_g,
  total_registros
) {
  return [
    "Responde en espanol de forma breve, clara y util para un dashboard de residuos.",
    "No clasifiques residuos ni inventes datos; usa solo los totales entregados.",
    "",
    `Pregunta original: ${pregunta}`,
    `total_peso_g: ${total_peso_g}`,
    `total_registros: ${total_registros}`,
  ].join("\n");
}

function detectarMes(texto) {
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const indice = meses.findIndex((mes) => texto.includes(mes));
  return indice === -1 ? null : indice;
}

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function construirMetricas(docs, periodo, desde, hasta) {
  const metricas = {
    periodo,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    total_registros: docs.length,
    peso_total_g: 0,
    gas_promedio: 0,
    gas_maximo: 0,
    categorias: {},
    objetos: {},
    tendencia_por_dia: {},
  };

  let sumaGas = 0;

  docs.forEach((doc) => {
    const data = doc.data();
    const peso = Number(data.peso_g) || 0;
    const gas = Number(data.gas_level) || 0;
    const categoria = data.categoria || "sin_categoria";
    const objeto = data.objeto || "sin_objeto";
    const fecha = normalizarFecha(data.timestamp);
    const dia = fecha ? fecha.toISOString().slice(0, 10) : "sin_fecha";

    metricas.peso_total_g += peso;
    sumaGas += gas;
    metricas.gas_maximo = Math.max(metricas.gas_maximo, gas);

    if (!metricas.categorias[categoria]) {
      metricas.categorias[categoria] = { registros: 0, peso_total_g: 0 };
    }
    metricas.categorias[categoria].registros += 1;
    metricas.categorias[categoria].peso_total_g += peso;

    metricas.objetos[objeto] = (metricas.objetos[objeto] || 0) + 1;

    if (!metricas.tendencia_por_dia[dia]) {
      metricas.tendencia_por_dia[dia] = { registros: 0, peso_total_g: 0 };
    }
    metricas.tendencia_por_dia[dia].registros += 1;
    metricas.tendencia_por_dia[dia].peso_total_g += peso;
  });

  metricas.peso_total_g = redondear(metricas.peso_total_g);
  metricas.gas_promedio = docs.length ? redondear(sumaGas / docs.length) : 0;
  metricas.gas_maximo = redondear(metricas.gas_maximo);

  Object.values(metricas.categorias).forEach((categoria) => {
    categoria.peso_total_g = redondear(categoria.peso_total_g);
  });

  Object.values(metricas.tendencia_por_dia).forEach((dia) => {
    dia.peso_total_g = redondear(dia.peso_total_g);
  });

  return metricas;
}

function construirPromptDashboard(metricas) {
  return [
    "Eres una capa de analisis para un dashboard de gestion de residuos.",
    "No clasifiques residuos ni modifiques datos; el campo objeto ya fue generado por un ESP32 con TensorFlow.",
    "Analiza solamente las metricas agregadas recibidas.",
    "Devuelve un resumen breve en espanol con: patrones de residuos, anomalias y recomendaciones operativas.",
    "Usa tono claro, practico y orientado a decisiones.",
    "",
    "Metricas agregadas:",
    JSON.stringify(metricas, null, 2),
  ].join("\n");
}

function normalizarFecha(timestamp) {
  if (!timestamp) {
    return null;
  }

  if (typeof timestamp.toDate === "function") {
    return timestamp.toDate();
  }

  const fecha = new Date(timestamp);
  return isNaN(fecha.getTime()) ? null : fecha;
}

function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

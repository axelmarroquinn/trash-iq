require("dotenv").config();

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require("cors")({ origin: true });

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
    cors(req, res, async () => {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Metodo no permitido" });
      }

      try {
        const { pregunta } = req.body;

        if (!pregunta || typeof pregunta !== "string" || !pregunta.trim()) {
          return res.status(400).json({ error: "pregunta invalida" });
        }

        const ahora = new Date();

        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          tools: [
            {
              functionDeclarations: [
                {
                  name: "consultar_residuos",
                  description:
                    "Consulta registros de residuos en Firestore segun filtros de fecha y categoria.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      categoria: {
                        type: "STRING",
                        description:
                          "Categoria de residuo: plastico, papel, organico, otros. Omitir si se quiere todo.",
                        enum: ["plastico", "papel", "organico", "otros"],
                        nullable: true,
                      },
                      desde: {
                        type: "STRING",
                        description: `Fecha inicio en ISO 8601. Hoy es ${ahora.toISOString()}.`,
                      },
                      hasta: {
                        type: "STRING",
                        description: "Fecha fin en ISO 8601.",
                      },
                    },
                    required: ["desde", "hasta"],
                  },
                },
                {
                  name: "responder_sin_datos",
                  description:
                    "Usala cuando la pregunta es un saludo, pregunta general o no requiere consultar datos.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      mensaje: {
                        type: "STRING",
                        description: "Respuesta directa al usuario.",
                      },
                    },
                    required: ["mensaje"],
                  },
                },
              ],
            },
          ],
        });

        const chat = model.startChat({
          systemInstruction: {
            parts: [{ text: "Eres un asistente especializado ÚNICAMENTE en gestión de residuos del sistema TrashIQ. " +
"SOLO responde preguntas sobre residuos, categorías, pesos, registros o tendencias. " +
"Si el usuario pregunta algo fuera de ese tema, responde exactamente: " +
"'Solo puedo ayudarte con consultas sobre tus residuos.' " +
"SIEMPRE asume que el usuario pregunta sobre sus residuos cuando menciona categorías o períodos. " +
"Solo usa responder_sin_datos si es un saludo explícito como 'hola' o 'buenos días'. " +
"Si la pregunta menciona una categoría (plastico, papel, organico, otros) sin período, asume el mes actual. " +
"Responde siempre en español, breve y sin formato Markdown. " +
`La fecha y hora actual es: ${ahora.toISOString()}.` }]
          },
        });

        const result1 = await chat.sendMessage(pregunta);
        const call = result1.response.functionCalls()?.[0];

        if (!call || call.name === "responder_sin_datos") {
          const mensaje =
            call?.args?.mensaje ||
            "Hola. Puedes preguntarme sobre tus residuos. Por ejemplo: Cuanto tire esta semana?";
          return res.status(200).json({
            respuesta: limpiarRespuestaIA(mensaje),
            total_peso_g: null,
            total_registros: null,
          });
        }

        const { categoria, desde, hasta } = call.args;
        const desdeDate = new Date(desde);
        const hastaDate = new Date(hasta);

        if (isNaN(desdeDate.getTime()) || isNaN(hastaDate.getTime())) {
          return res.status(400).json({ error: "rango de fechas invalido" });
        }

        let query = db
          .collection("waste_logs")
          .where("timestamp", ">=", desdeDate)
          .where("timestamp", "<=", hastaDate);

        if (categoria) {
          query = query.where("categoria", "==", categoria);
        }

        const snapshot = await query.get();
        const total_peso_g = redondear(
          snapshot.docs.reduce((sum, doc) => {
            return sum + (Number(doc.data().peso_g) || 0);
          }, 0)
        );
        const total_registros = snapshot.size;

        const result2 = await chat.sendMessage([
          {
            functionResponse: {
              name: "consultar_residuos",
              response: { total_peso_g, total_registros },
            },
          },
        ]);

        const respuesta = limpiarRespuestaIA(result2.response.text());

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
    });
  }
);

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

function limpiarRespuestaIA(texto) {
  return String(texto || "")
    .replace(/\*\*/g, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

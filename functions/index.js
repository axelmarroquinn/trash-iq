require("dotenv").config();

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const sharp = require("sharp");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.recibirResiduo = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metodo no permitido" });
    }

    const { categoria, peso_g, gas_level, timestamp, imagen_base64 } = req.body;
    console.log("BODY KEYS:", Object.keys(req.body));
    console.log("IMAGEN_BASE64 TIPO:", typeof imagen_base64, "LONGITUD:", imagen_base64?.length ?? "undefined");

    const categoriasPermitidas = ["plastico", "papel", "organico", "otros"];

    if (!categoriasPermitidas.includes(categoria)) {
      return res.status(400).json({ error: "Categoria invalida" });
    }

    const peso = parseFloat(peso_g);
    if (isNaN(peso) || peso <= 0) {
      return res.status(400).json({ error: "peso_g invalido" });
    }

    const gas = parseFloat(gas_level);
    if (isNaN(gas) || gas < 0 || gas > 1) {
      return res.status(400).json({ error: "gas_level invalido" });
    }

    const fecha = new Date(timestamp);
    if (!timestamp || isNaN(fecha.getTime())) {
      return res.status(400).json({ error: "timestamp invalido" });
    }

    let imagen_url = null;

    if (imagen_base64 && typeof imagen_base64 === "string" && imagen_base64.trim()) {
      const buffer = Buffer.from(imagen_base64, "base64");
      const pixeles = buffer.slice(54);

      if (pixeles.length !== 150528) {
        return res.status(400).json({ error: "imagen con tamaño invalido" });
      }

      try {
        const pngBuffer = await sharp(pixeles, {
          raw: { width: 224, height: 224, channels: 3 },
        }).png().toBuffer();
        const bucket = admin.storage().bucket();
        const ruta = `imagenes/${Date.now()}.png`;
        const archivo = bucket.file(ruta);

        await archivo.save(pngBuffer, {
          metadata: { contentType: "image/png" },
        });

        const urls = await archivo.getSignedUrl({
          action: "read",
          expires: "01-01-2100",
        });
        imagen_url = urls[0];
      } catch (error) {
        console.error("ERROR imagen:", error);
        imagen_url = null;
      }
    }

    try {
      const docRef = await db.collection("waste_logs").add({
        objeto: null,
        categoria,
        peso_g: peso,
        gas_level: gas,
        timestamp: fecha,
        imagen_url,
      });

      if (imagen_url) {
        analizarUnaImagen(docRef.id, imagen_url);
      }

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
        const { pregunta, historial = [] } = req.body;

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
            parts: [{ text:
              "Eres TrashIQ, un asistente conversacional de gestión de residuos. " +
              "Tu objetivo es responder de forma natural, breve y amigable, como si fueras un amigo que conoce bien los datos. " +
              "Reglas estrictas: " +
              "1. Nunca termines tu respuesta con frases como 'Total: X g en Y registros' — eso es robótico. " +
              "2. Si recibes datos de consultar_residuos, úsalos para razonar y responder naturalmente. Por ejemplo: si el peso es 1050g y es una botella de agua, puedes inferir que estaba llena o casi llena. " +
              "3. Mantén el contexto de la conversación. Si el usuario pregunta algo de seguimiento, responde sobre lo mismo que se estaba hablando. " +
              "4. Si el usuario pregunta algo fuera del tema de residuos, responde: Solo puedo ayudarte con tus residuos. " +
              "5. Solo usa responder_sin_datos para saludos explícitos como hola o buenos días. " +
              "6. Si la pregunta menciona una categoría o un objeto sin período, asume el mes actual. " +
              "7. Responde siempre en español, máximo 2-3 oraciones, sin Markdown, sin listas, sin asteriscos. " +
              "8. Sé directo — si tienes los datos, responde. No digas que no puedes determinar algo si puedes razonarlo con los datos disponibles. " +
              `La fecha y hora actual es: ${ahora.toISOString()}.`
            }]
          },
          history: historial
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(m => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
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
        const objetos = snapshot.docs
          .map(doc => doc.data().objeto)
          .filter(obj => obj && obj !== null);
        const categorias = [...new Set(
          snapshot.docs.map(doc => doc.data().categoria).filter(Boolean)
        )];
        const gas_promedio = redondear(
          snapshot.docs.reduce((sum, doc) => sum + (Number(doc.data().gas_level) || 0), 0) /
          (snapshot.size || 1)
        );

        const result2 = await chat.sendMessage([
          {
            functionResponse: {
              name: "consultar_residuos",
              response: { total_peso_g, total_registros, objetos, categorias, gas_promedio },
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

exports.analizarImagenes = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metodo no permitido" });
    }

    try {
      const snapshot = await db
        .collection("waste_logs")
        .where("objeto", "==", null)
        .where("imagen_url", "!=", null)
        .limit(10)
        .get();

      if (snapshot.empty) {
        return res.status(200).json({
          message: "Sin imagenes pendientes",
          procesados: 0,
        });
      }

      let procesados = 0;

      for (const doc of snapshot.docs) {
        const docId = doc.id;
        const data = doc.data();
        const imagen_url = data.imagen_url;

        try {
          const response = await fetch(imagen_url);

          if (!response.ok) {
            throw new Error(`Error al descargar imagen: ${response.status}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
          const result = await model.generateContent([
            {
              inlineData: {
                mimeType: "image/png",
                data: base64,
              },
            },
            {
              text: "Eres un clasificador de residuos domésticos. Observa la imagen y responde ÚNICAMENTE con el nombre del objeto que ves en español. Debe ser una respuesta corta, máximo 4 palabras. Ejemplos: botella de plástico, cáscara de aguacate, caja de cartón, bolsa plástica. Sin explicaciones, sin puntos, solo el nombre del objeto.",
            },
          ]);
          const rawText = result.response.text().trim();
          const objeto = rawText
            .replace(/^.*?(THOUGHTS?:.*?\n)+/s, "")
            .split("\n")
            .filter(line => line.trim().length > 0)
            .pop()
            .trim();

          await db.collection("waste_logs").doc(docId).update({ objeto });
          procesados += 1;
        } catch (error) {
          console.error("ERROR analizarImagenes documento:", error);
        }
      }

      return res.status(200).json({
        message: "Analisis completado",
        procesados,
      });
    } catch (error) {
      console.error("ERROR analizarImagenes:", error);
      return res.status(500).json({
        error: error.message,
      });
    }
  }
);

async function analizarUnaImagen(docId, imagen_url) {
  try {
    const response = await fetch(imagen_url);

    if (!response.ok) {
      throw new Error(`Error al descargar imagen: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "image/png",
          data: base64,
        },
      },
      {
        text: "Eres un clasificador de residuos domésticos. Observa la imagen y responde ÚNICAMENTE con el nombre del objeto que ves en español. Debe ser una respuesta corta, máximo 4 palabras. Ejemplos: botella de plástico, cáscara de aguacate, caja de cartón, bolsa plástica. Sin explicaciones, sin puntos, solo el nombre del objeto.",
      },
    ]);
    const rawText = result.response.text().trim();
    const objeto = rawText
      .replace(/^.*?(THOUGHTS?:.*?\n)+/s, "")
      .split("\n")
      .filter(line => line.trim().length > 0)
      .pop()
      .trim();

    await db.collection("waste_logs").doc(docId).update({ objeto });
  } catch (error) {
    console.error("ERROR analizarUnaImagen:", error);
  }
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

function limpiarRespuestaIA(texto) {
  return String(texto || "")
    .replace(/\*\*/g, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

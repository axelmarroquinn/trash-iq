const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.recibirResiduo = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const { categoria, peso_g, gas_level, timestamp } = req.body;

    const categoriasPermitidas = ["plastico", "papel", "organico", "otros"];

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
        categoria,
        peso_g: peso,
        gas_level: gas,
        timestamp: fecha,
        processed_by_ai: false,
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
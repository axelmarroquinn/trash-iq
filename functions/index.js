const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const ALLOWED_CATEGORIES = ['plastico', 'papel', 'organico', 'otros'];

exports.recibirResiduo = functions.region('us-central1').https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  try {
    const categoria = typeof req.body?.categoria === 'string' ? req.body.categoria.trim().toLowerCase() : '';
    const peso_g = Number(req.body?.peso_g);
    const gas_level = Number(req.body?.gas_level);

    if (!ALLOWED_CATEGORIES.includes(categoria)) {
      return res.status(400).json({ error: 'Categoria invalida' });
    }

    if (!Number.isFinite(peso_g) || peso_g <= 0) {
      return res.status(400).json({ error: 'peso_g debe ser un numero positivo' });
    }

    if (!Number.isFinite(gas_level)) {
      return res.status(400).json({ error: 'gas_level debe ser numerico' });
    }

    await db.collection('waste_logs').add({
      categoria,
      peso_g,
      gas_level,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Functions] Error guardando residuo:', error);
    return res.status(500).json({ error: 'No se pudo guardar el residuo' });
  }
});

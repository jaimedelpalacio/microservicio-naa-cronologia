const express = require('express');
const axios = require('axios');
const cors = require('cors');
const pdfParse = require('pdf-parse');

const app = express();
app.use(cors());

const PDF_URL = 'https://www.interior.gob.es/opencms/pdf/prensa/nivel-de-alerta-antiterrorista/descargas/NAA_cronologia.pdf';

function limpiarTexto(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

app.get('/ultima-fila', async (req, res) => {
  try {
    const pdfBuffer = (await axios.get(PDF_URL, { responseType: 'arraybuffer' })).data;
    const data = await pdfParse(pdfBuffer);
    const lineas = data.text.split('\n');

    let bloques = [];
    let bloqueActual = {};

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();

      // Detectamos línea que es una FECHA
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(linea) || /^\w+ \d{4}$/.test(linea)) {
        if (bloqueActual.fecha && bloqueActual.motivo && bloqueActual.nivel) {
          bloques.push(bloqueActual);
        }
        bloqueActual = { fecha: linea, motivo: '', nivel: null };
        continue;
      }

      // Detectamos línea que es un NIVEL
      if (/NIVEL \d/.test(linea)) {
        const match = linea.match(/NIVEL (\d)/);
        if (match) {
          bloqueActual.nivel = parseInt(match[1]);
        }
        continue;
      }

      // Acumulamos como MOTIVO si no es vacía
      if (linea.length > 0) {
        bloqueActual.motivo += (bloqueActual.motivo ? ' ' : '') + linea;
      }
    }

    // Añadimos el último bloque si es válido
    if (bloqueActual.fecha && bloqueActual.motivo && bloqueActual.nivel) {
      bloques.push(bloqueActual);
    }

    if (bloques.length === 0) {
      return res.status(404).json({ error: true, mensaje: 'No se detectó ninguna fila válida.' });
    }

    const ultima = bloques[bloques.length - 1];

    res.json({
      fecha: limpiarTexto(ultima.fecha),
      motivo: limpiarTexto(ultima.motivo),
      nivel: ultima.nivel
    });

  } catch (err) {
    res.status(500).json({ error: true, mensaje: 'Error procesando el PDF.', detalle: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Microservicio activo en http://localhost:${PORT}`);
});

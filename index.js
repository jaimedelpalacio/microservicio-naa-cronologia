// index.js

// Importar módulos necesarios
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const pdfParse = require('pdf-parse');
const https = require('https');

// Crear una instancia de Express
const app = express();
app.use(cors());

// URL del PDF oficial
const PDF_URL = 'https://www.interior.gob.es/opencms/pdf/prensa/nivel-de-alerta-antiterrorista/descargas/NAA_cronologia.pdf';

// Crear un agente HTTPS que no rechace certificados no verificados
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Función para limpiar texto
function limpiarTexto(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

// Función para limpiar el campo motivo
function limpiarMotivo(motivo) {
  return motivo
    .replace(/Página \d+/gi, '')
    .replace(/DIRECCIÓN GENERAL DE COORDINACIÓN Y ESTUDIOS/gi, '')
    .replace(/SECRETARÍA DE ESTADO DE SEGURIDAD/gi, '')
    .replace(/MINISTERIO DEL INTERIOR/gi, '')
    .replace(/NIVEL DE ACTIVACIÓN MOTIVO FECHA CRONOLOGÍA DE LOS NIVELES DE ALERTA ANTITERRORISTA \[NAA\]/gi, '')
    .trim();
}

// Ruta para obtener la última fila del PDF
app.get('/ultima-fila', async (req, res) => {
  try {
    // Descargar el PDF utilizando axios con el agente HTTPS personalizado
    const pdfBuffer = (await axios.get(PDF_URL, {
      responseType: 'arraybuffer',
      httpsAgent
    })).data;

    // Parsear el contenido del PDF
    const data = await pdfParse(pdfBuffer);
    const lineas = data.text.split('\n');

    let bloques = [];
    let bloqueActual = {};

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();

      // Omitir líneas del pie de página
      if (
        /^Página \d+/i.test(linea) ||
        linea.includes('DIRECCIÓN GENERAL DE COORDINACIÓN Y ESTUDIOS') ||
        linea.includes('SECRETARÍA DE ESTADO DE SEGURIDAD') ||
        linea.includes('MINISTERIO DEL INTERIOR') ||
        linea.includes('NIVEL DE ACTIVACIÓN MOTIVO FECHA CRONOLOGÍA DE LOS NIVELES DE ALERTA ANTITERRORISTA [NAA]')
      ) {
        continue;
      }

      // Detectar líneas que representan una fecha
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(linea) || /^\w+ \d{4}$/.test(linea)) {
        if (bloqueActual.fecha && bloqueActual.motivo && bloqueActual.nivel) {
          bloques.push(bloqueActual);
        }
        bloqueActual = { fecha: linea, motivo: '', nivel: null };
        continue;
      }

      // Detectar líneas que indican el nivel
      if (/NIVEL \d/.test(linea)) {
        const match = linea.match(/NIVEL (\d)/);
        if (match) {
          bloqueActual.nivel = parseInt(match[1]);
        }
        continue;
      }

      // Acumular líneas como motivo si no están vacías
      if (linea.length > 0) {
        bloqueActual.motivo += (bloqueActual.motivo ? ' ' : '') + linea;
      }
    }

    // Añadir el último bloque si es válido
    if (bloqueActual.fecha && bloqueActual.motivo && bloqueActual.nivel) {
      bloques.push(bloqueActual);
    }

    // Verificar si se encontraron bloques válidos
    if (bloques.length === 0) {
      return res.status(404).json({ error: true, mensaje: 'No se detectó ninguna fila válida.' });
    }

    // Obtener la última fila
    const ultima = bloques[bloques.length - 1];

    // Responder con la información de la última fila
    res.json({
      fecha: limpiarTexto(ultima.fecha),
      motivo: limpiarMotivo(ultima.motivo),
      nivel: ultima.nivel
    });

  } catch (err) {
    // Manejar errores y responder con un mensaje de error
    res.status(500).json({ error: true, mensaje: 'Error procesando el PDF.', detalle: err.message });
  }
});

// Iniciar el servidor en el puerto especificado
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Microservicio activo en http://localhost:${PORT}`);
});

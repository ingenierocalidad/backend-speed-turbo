import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";
import ExcelJS from 'exceljs';
import sgMail from '@sendgrid/mail'; // Cambio a SendGrid
import serviceAccountLocal from "./firebase-key.json" with { type: "json" };

dotenv.config();

// Configuración de SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- CONFIGURACIÓN FIREBASE ---
let serviceAccount;
if (process.env.FIREBASE_KEY) {
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
} else {
  serviceAccount = serviceAccountLocal;
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const enviarPush = async (titulo, mensaje) => {
  const message = {
    topic: "mantenimiento", 
    notification: { title: titulo, body: mensaje },
    android: { 
      priority: "high",
      notification: { 
        sound: "default", 
        channelId: "mantenimiento_channel" 
      } 
    }
  };
  try {
    await delay(1500); 
    await admin.messaging().send(message);
    console.log(`✅ Push enviado: ${titulo}`);
  } catch (err) {
    console.error("❌ Error Push:", err.message);
  }
};

// --- LÓGICA DE FECHAS ---
const calcularEstado = (fechaStr) => {
  if (!fechaStr) return "Vigente";
  const [d, m, a] = fechaStr.split("/");
  const limite = new Date(a, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diff = Math.ceil((limite - hoy) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Plazo Incumplido";
  if (diff <= 5) return "Próximo";
  return "Vigente";
};

const proximaFecha = (tipo) => {
  const hoy = new Date();
  let dias = 30;
  const t = tipo.toLowerCase();
  if (t.includes("bimestral")) dias = 60;
  else if (t.includes("trimestral")) dias = 90;
  else if (t.includes("semestral")) dias = 180;
  hoy.setDate(hoy.getDate() + dias);
  return hoy.toLocaleDateString("es-CO");
};

// --- MODELOS DE DATOS ---
const mttoSchema = new mongoose.Schema({
  tipo: String, 
  estado: String, 
  fecha_limite: String,
  fecha_registro: { type: Date, default: Date.now }
});

const Maquina = mongoose.model("Maquina", new mongoose.Schema({
    _id: String,
    nombre: String, 
    laboratorio: String, 
    mantenimientos: [mttoSchema], 
    historial: [mttoSchema]
}));

// --- LÓGICA DE REPORTE CON SENDGRID ---
const enviarReporteExcel = async () => {
  console.log("📊 [SENDGRID] Generando reporte...");
  try {
    const maquinas = await Maquina.find();
    if (!maquinas || maquinas.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Historial de Mantenimiento');

    worksheet.columns = [
      { header: 'MAQUINA/EQUIPO', key: 'equipo', width: 25 },
      { header: 'LABORATORIO', key: 'lab', width: 15 },
      { header: 'TIPO MANTENIMIENTO', key: 'tipo', width: 20 },
      { header: 'FECHA REGISTRO', key: 'fecha', width: 25 },
      { header: 'ESTADO FINAL', key: 'estado', width: 15 }
    ];

    let hayDatos = false;
    maquinas.forEach(m => {
      if (m.historial && m.historial.length > 0) {
        m.historial.forEach(h => {
          worksheet.addRow({
            equipo: m.nombre || 'N/A',
            lab: m.laboratorio || 'N/A',
            tipo: h.tipo || 'N/A',
            fecha: h.fecha_registro ? new Date(h.fecha_registro).toLocaleString('es-CO') : 'N/A',
            estado: h.estado || 'Realizado'
          });
          hayDatos = true;
        });
      }
    });

    if (!hayDatos) {
      console.log("ℹ️ Historial vacío, no se envía reporte.");
      return;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64Content = buffer.toString('base64');

    const msg = {
      to: ['ing.calidad@spturbos.com', 'juang@spturbos.com', 'jgomez@spturbos.com', 'jarango@spturbos.com'],
      from: 'speedturbo.ingenieria@gmail.com', 
      bcc: 'dbecerravele@gmail.com',
      subject: `📊 Reporte Bimestral Historial - ${new Date().toLocaleDateString('es-CO')}`,
      text: 'Adjunto se encuentra el historial de mantenimientos registrados en la App en el bimestre anterior.',
      attachments: [{
        content: base64Content,
        filename: `Reporte_SpeedTurbo_${new Date().getMonth() + 1}.xlsx`,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment'
      }]
    };

    await sgMail.sendMultiple(msg);
    console.log("✅ [SENDGRID] Reporte enviado con éxito.");

  } catch (error) {
    console.error("❌ [SENDGRID] Error:", error.response ? error.response.body : error.message);
  }
};

// Cron Job Bimestral
cron.schedule("0 9 1 1,3,5,7,9,11 *", () => {
  enviarReporteExcel();
});

// --- RUTAS API ---
app.post("/suscribir", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token requerido" });
  try {
    await admin.messaging().subscribeToTopic(token, "mantenimiento");
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CRON JOB: REVISIÓN DE MANTENIMIENTOS ---
cron.schedule("*/1 * * * *", async () => {
  try {
    const ahora = new Date();
    const hora = ahora.getHours();
    const minutos = ahora.getMinutes();
    const esHorarioLaboral = (hora > 8 || (hora === 8 && minutos >= 30)) && hora < 17;

    if (esHorarioLaboral) {
      const maquinas = await Maquina.find();
      maquinas.forEach(m => {
        m.mantenimientos.forEach(mt => {
          const estado = calcularEstado(mt.fecha_limite);
          if (estado === "Plazo Incumplido") {
            enviarPush("🚨 PLAZO INCUMPLIDO", `${m.nombre}: ${mt.tipo} vencido.`);
          } else if (estado === "Próximo" && hora === 9 && minutos === 0) {
            enviarPush("⚠️ PRÓXIMO VENCIMIENTO", `${m.nombre}: ${mt.tipo} vence pronto.`);
          }
        });
      });
    }
  } catch (err) { console.error("Error Cron:", err); }
});

app.get("/maquinas", async (req, res) => {
  try {
    const maquinas = await Maquina.find();
    maquinas.forEach(m => {
      m.mantenimientos.forEach(mt => { mt.estado = calcularEstado(mt.fecha_limite); });
    });
    res.json(maquinas);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/maquinas/:id/mantenimiento", async (req, res) => {
    try {
        const idRecibido = req.params.id.trim();
        const maquina = await Maquina.findOne({ _id: idRecibido });
        if (!maquina) return res.status(404).json({ error: "Máquina no encontrada" });

        const mtto = maquina.mantenimientos.find(m => m.tipo === req.body.tipo);
        if (!mtto) return res.status(400).json({ error: "Tipo de mantenimiento no válido" });

        maquina.historial.push({
            tipo: mtto.tipo, 
            estado: "Realizado",
            fecha_limite: mtto.fecha_limite, 
            fecha_registro: new Date()
        });

        mtto.fecha_limite = proximaFecha(mtto.tipo);
        mtto.estado = "Vigente";
        
        maquina.markModified('mantenimientos');
        maquina.markModified('historial'); 
        await maquina.save();

        enviarPush("✅ Registro Exitoso", `${maquina.nombre}: ${mtto.tipo} completado.`);
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

setInterval(() => {
  fetch("https://backend-speed-turbo.onrender.com/maquinas").catch(() => {});
}, 600000); 

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://speedserver:Speed2026@mantenimiento.fucwjdl.mongodb.net/mantenimientoAPP?retryWrites=true&w=majority&appName=mantenimiento";

mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor activo. Puerto: ${PORT}`);
      
      // PRUEBA INMEDIATA
      enviarReporteExcel(); // ELIMINAR después de verificar
    });
  })
  .catch(err => console.error("❌ Error DB:", err));
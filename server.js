import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";
import serviceAccountLocal from "./firebase-key.json" with { type: "json" };

dotenv.config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- CONFIGURACIÓN FIREBASE (ACTUALIZADA) ---
let serviceAccount;

if (process.env.FIREBASE_KEY) {
  // 1. Convertimos el texto a objeto
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  // 2. Limpiamos los saltos de línea de la llave privada
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
} else {
  serviceAccount = serviceAccountLocal;
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Función auxiliar para no saturar a Google (retraso de 1 segundo)
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
    // Esperamos 1.5 segundos antes de enviar para evitar el error de JWT Signature por saturación
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
  nombre: String, 
  laboratorio: String, 
  mantenimientos: [mttoSchema], 
  historial: [mttoSchema]
}));

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

// --- RUTA MODIFICADA PARA FUNCIONAMIENTO DEL BOTÓN ---
app.post("/maquinas/:id/mantenimiento", async (req, res) => {
  try {
    // 1. Limpieza del ID para asegurar compatibilidad con Atlas y Capacitor
    const idLimpio = req.params.id.toString().trim();
    const maquina = await Maquina.findById(idLimpio);

    if (!maquina) {
      console.log(`❌ Máquina no encontrada con ID: ${idLimpio}`);
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    const mtto = maquina.mantenimientos.find(m => m.tipo === req.body.tipo);
    if (!mtto) return res.status(400).json({ error: "Tipo no válido" });

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
    console.error("❌ Error en registro:", err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// --- AUTO-PING (MANTIENE RENDER DESPIERTO) ---
setInterval(() => {
  fetch("https://backend-speed-turbo.onrender.com/maquinas").catch(() => {});
}, 600000); 

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://speedserver:Speed2026@mantenimiento.fucwjdl.mongodb.net/mantenimientoAPP?retryWrites=true&w=majority&appName=mantenimiento";

mongoose.connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor activo (8:30-17:00). Puerto: ${PORT}`);
    });
  })
  .catch(err => console.error("❌ Error DB:", err));
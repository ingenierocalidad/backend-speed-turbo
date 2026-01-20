import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";
import serviceAccount from "./firebase-key.json" with { type: "json" };

dotenv.config();
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- CONFIGURACIÓN FIREBASE ---
let serviceAccount;

if (process.env.FIREBASE_KEY) {
  // Si estamos en Render, usamos la variable de entorno
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
} else {
  // Si estamos en local, usamos el archivo
  serviceAccount = serviceAccountJSON; // Asegúrate de que el import de arriba siga igual
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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
    console.log("📱 Dispositivo suscrito");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

cron.schedule("*/1 * * * *", async () => {
  try {
    const maquinas = await Maquina.find();
    const horaActual = new Date().getHours();
    maquinas.forEach(m => {
      m.mantenimientos.forEach(mt => {
        const estado = calcularEstado(mt.fecha_limite);
        if (estado === "Plazo Incumplido") {
          enviarPush("🚨 PLAZO INCUMPLIDO", `${m.nombre}: ${mt.tipo}`);
        } else if (estado === "Próximo" && horaActual === 8) {
          enviarPush("⚠️ PRÓXIMO", `${m.nombre}: ${mt.tipo}`);
        }
      });
    });
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
    const maquina = await Maquina.findById(req.params.id);
    const mtto = maquina.mantenimientos.find(m => m.tipo === req.body.tipo);
    
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CONEXIÓN CON DIAGNÓSTICO ---
const PORT = process.env.PORT || 3001;
// Asegúrate que después de .net/ diga exactamente mantenimientoAPP
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://speedserver:Speed2026@mantenimiento.fucwjdl.mongodb.net/mantenimientoAPP?retryWrites=true&w=majority&appName=mantenimiento";

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log("🚀 Servidor listo");
    console.log("✅ Conectado a MongoDB Atlas");

    // --- BLOQUE DE DIAGNÓSTICO ---
    const adminDb = mongoose.connection.db.admin();
    const dbs = await adminDb.listDatabases();
    console.log("📂 Bases de datos detectadas en Atlas:", dbs.databases.map(d => d.name));
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("📂 Colecciones en la base actual:", collections.map(c => c.name));
    
    const count = await mongoose.model("Maquina").countDocuments();
    console.log(`📊 Total máquinas encontradas: ${count}`);
    // ------------------------------

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`📍 Escuchando en el puerto ${PORT}`);
    });
  })
  .catch(err => console.error("❌ Error de conexión:", err));
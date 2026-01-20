import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cron from "node-cron";
import admin from "firebase-admin";

dotenv.config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- CONFIGURACIÓN FIREBASE ---
let serviceAccount;
if (process.env.FIREBASE_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

if (!admin.apps.length && serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const enviarPush = async (titulo, mensaje) => {
    const message = {
        topic: "mantenimiento", 
        notification: { title: titulo, body: mensaje },
        android: { 
            priority: "high",
            notification: { sound: "default", channelId: "mantenimiento_channel" } 
        }
    };
    try {
        await new Promise(res => setTimeout(res, 1500)); 
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

// --- MODELOS ---
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

// --- RUTAS ---
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
        // CORRECCIÓN: Limpieza profunda del ID y validación
        const idRecibido = req.params.id.trim();
        
        // Buscamos la máquina
        const maquina = await Maquina.findById(idRecibido);
        
        if (!maquina) {
            console.log("❌ Máquina no encontrada con ID:", idRecibido);
            return res.status(404).json({ error: "Máquina no encontrada" });
        }

        // Buscamos el mantenimiento específico dentro de la máquina
        const mtto = maquina.mantenimientos.find(m => m.tipo === req.body.tipo);
        
        if (!mtto) {
            console.log("❌ Tipo de mtto no encontrado:", req.body.tipo);
            return res.status(400).json({ error: "Tipo no válido" });
        }

        // Guardamos en el historial antes de actualizar la fecha
        maquina.historial.push({
            tipo: mtto.tipo, 
            estado: "Realizado",
            fecha_limite: mtto.fecha_limite, 
            fecha_registro: new Date()
        });

        // Calculamos la nueva fecha
        mtto.fecha_limite = proximaFecha(mtto.tipo);
        mtto.estado = "Vigente";
        
        // Forzamos a Mongoose a notar los cambios en los arreglos
        maquina.markModified('mantenimientos');
        maquina.markModified('historial'); 
        
        await maquina.save();

        // Enviamos la notificación
        enviarPush("✅ Registro Exitoso", `${maquina.nombre}: ${mtto.tipo} completado.`);
        
        res.json({ success: true });
    } catch (err) { 
        console.error("❌ Error en el servidor:", err.message);
        res.status(500).json({ error: err.message }); 
    }
});

// --- AUTO-PING ---
setInterval(() => {
    fetch("https://backend-speed-turbo.onrender.com/maquinas").catch(() => {});
}, 600000); 

const MONGO_URI = process.env.MONGO_URI || "TU_URL_DE_ATLAS_AQUÍ";
mongoose.connect(MONGO_URI).then(() => {
    app.listen(process.env.PORT || 3001, "0.0.0.0", () => console.log("🚀 Servidor en la nube listo"));
});
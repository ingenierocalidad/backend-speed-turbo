import mongoose from "mongoose";

// Local es tu PC
const LOCAL_URI = "mongodb://127.0.0.1:27017/mantenimientoAPP";

// NUBE: Usamos la cadena estándar para evitar errores de DNS
const ATLAS_URI = "mongodb+srv://speedserver:Speed2026@mantenimiento.fucwjdl.mongodb.net/mantenimientoAPP?retryWrites=true&w=majority&tls=true";
const mttoSchema = new mongoose.Schema({
    tipo: String, 
    estado: String, 
    fecha_limite: String,
    fecha_registro: { type: Date, default: Date.now }
});

const MaquinaSchema = new mongoose.Schema({
    nombre: String, 
    laboratorio: String, 
    mantenimientos: [mttoSchema], 
    historial: [mttoSchema]
});

async function realizarMigracion() {
    try {
        console.log("⏳ Esperando que el clúster esté listo...");
        
        const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
        const MaquinaLocal = localConn.model('Maquina', MaquinaSchema);
        
        const atlasConn = await mongoose.createConnection(ATLAS_URI).asPromise();
        const MaquinaAtlas = atlasConn.model('Maquina', MaquinaSchema);

        console.log("📥 Leyendo máquinas de la PC...");
        const datosLocales = await MaquinaLocal.find({});
        
        if (datosLocales.length > 0) {
            console.log(`🚀 Migrando ${datosLocales.length} equipos a Atlas...`);
            await MaquinaAtlas.deleteMany({}); 
            await MaquinaAtlas.insertMany(datosLocales);
            console.log("✅ ¡MIGRACIÓN EXITOSA!");
        } else {
            console.log("❌ No hay datos para migrar en la base local.");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Error de conexión:", error.message);
        process.exit(1);
    }
}

realizarMigracion();
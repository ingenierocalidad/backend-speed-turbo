import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const MantenimientoSchema = new mongoose.Schema({
  tipo: String,
  estado: String,
  fecha_limite: String,
  frecuencia_dias: Number,
  fecha_registro: { type: Date, default: Date.now }
});

const MaquinaSchema = new mongoose.Schema({
  nombre: String,
  laboratorio: String,
  mantenimientos: [MantenimientoSchema],
  historial: [MantenimientoSchema],
});

const Maquina = mongoose.model("Maquina", MaquinaSchema);

const MAQUINAS_INICIALES = [
  // --- BODEGA ---
  { nombre: "BG_MARCADORA_LASER_2", laboratorio: "Bodega", mantenimientos: [{ tipo: "BIMESTRAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },
  { nombre: "BG_ZUNCHADORA_H959", laboratorio: "Bodega", mantenimientos: [{ tipo: "TRIMESTRAL", fecha_limite: "15/03/2026", estado: "Vigente" }] },

  // --- LAB. ELECTRÓNICO ---
  { nombre: "LE_ALTERNADORES_BOSCH", laboratorio: "Electrónico", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "22/01/2026", estado: "Vigente" }] },
  { nombre: "LE_MS005", laboratorio: "Electrónico", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "22/01/2026", estado: "Vigente" }] },
  { nombre: "LE_SCR008", laboratorio: "Electrónico", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "22/01/2026", estado: "Vigente" }] },

  // --- LAB. INYECCIÓN ---
  { nombre: "LI_BANCO_CHINO", laboratorio: "Inyección", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "05/01/2026", estado: "Vigente" }, { tipo: "SEMESTRAL", fecha_limite: "30/06/2026", estado: "Vigente" }] },
  { nombre: "LI_BANCO_HEUI", laboratorio: "Inyección", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },
  { nombre: "LI_CUARTO_LIMPIO", laboratorio: "Inyección", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "28/01/2026", estado: "Vigente" }, { tipo: "SEMESTRAL", fecha_limite: "15/07/2026", estado: "Vigente" }] },
  { nombre: "LI_EPS205", laboratorio: "Inyección", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },
  { nombre: "LI_EPS708", laboratorio: "Inyección", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },
  { nombre: "LI_ITBR", laboratorio: "Inyección", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },
  { nombre: "LI_MTBR", laboratorio: "Inyección", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },

  // --- LAB. MECÁNICO ---
  { nombre: "LM_BANCO_DIRECCIONES_SPECIFER", laboratorio: "Mecánico", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "26/01/2026", estado: "Vigente" }] },
  { nombre: "LM_EPS385", laboratorio: "Mecánico", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },
  { nombre: "LM_EPS625", laboratorio: "Mecánico", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },
  { nombre: "LM_EPS815", laboratorio: "Mecánico", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },

  // --- LAB. TURBOS ---
  { nombre: "TR_CORTADORA_LASER", laboratorio: "Turbos", mantenimientos: [{ tipo: "TRIMESTRAL", fecha_limite: "15/03/2026", estado: "Vigente" }] },
  { nombre: "TR_MARCADORA_LASER_1", laboratorio: "Turbos", mantenimientos: [{ tipo: "BIMESTRAL", fecha_limite: "10/02/2026", estado: "Vigente" }] },
  { nombre: "TR_MRV2_2", laboratorio: "Turbos", mantenimientos: [{ tipo: "BIMESTRAL", fecha_limite: "24/01/2026", estado: "Vigente" }] },
  { nombre: "TR_MRV2_3", laboratorio: "Turbos", mantenimientos: [{ tipo: "BIMESTRAL", fecha_limite: "24/01/2026", estado: "Vigente" }] },
  { nombre: "TR_TURBOCLINIC_1", laboratorio: "Turbos", mantenimientos: [{ tipo: "BIMESTRAL", fecha_limite: "24/01/2026", estado: "Vigente" }] },
  { nombre: "TR_TURBOCLINIC_2", laboratorio: "Turbos", mantenimientos: [{ tipo: "BIMESTRAL", fecha_limite: "24/01/2026", estado: "Vigente" }] },
  { nombre: "TR_TURBO_MAX10_1", laboratorio: "Turbos", mantenimientos: [{ tipo: "BIMESTRAL", fecha_limite: "24/01/2026", estado: "Vigente" }] },
  { nombre: "TR_TURBO_MAX10_2", laboratorio: "Turbos", mantenimientos: [{ tipo: "BIMESTRAL", fecha_limite: "24/01/2026", estado: "Vigente" }] },
  { nombre: "TR_UPS_1", laboratorio: "Turbos", mantenimientos: [{ tipo: "SEMESTRAL", fecha_limite: "15/06/2026", estado: "Vigente" }] },

  // --- PATIO ---
  { nombre: "PT_BOXER_CT100_NEGRA", laboratorio: "Patio", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "22/01/2026", estado: "Vigente" }] },
  { nombre: "PT_COMPRESOR", laboratorio: "Patio", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "25/01/2026", estado: "Vigente" }] },
  { nombre: "PT_ELEVADORES_TIJERA", laboratorio: "Patio", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "20/01/2026", estado: "Vigente" }, { tipo: "SEMESTRAL", fecha_limite: "15/06/2026", estado: "Vigente" }] },

  // --- REMAN ---
  { nombre: "RM_MAQUINA_BLASTING", laboratorio: "REMAN", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "22/01/2026", estado: "Vigente" }] },
  { nombre: "RM_ZONA_DE_LAVADO", laboratorio: "REMAN", mantenimientos: [{ tipo: "MENSUAL", fecha_limite: "22/01/2026", estado: "Vigente" }] }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mantenimientoAPP");
    await Maquina.deleteMany({});
    await Maquina.insertMany(MAQUINAS_INICIALES);
    console.log("✅ Base de datos restaurada con todos los laboratorios.");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
seed();
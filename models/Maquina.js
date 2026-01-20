const mongoose = require('mongoose');

// Definimos el sub-esquema para los mantenimientos
const MantenimientoSchema = new mongoose.Schema({
  tipo: String,        // Ejemplo: "MENSUAL", "SEMESTRAL", "5 AÑOS"
  fecha_limite: String,
  estado: String
});

const MaquinaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  laboratorio: { type: String, required: true },
  // Usamos corchetes [] para indicar que es una LISTA de objetos
  mantenimientos: [MantenimientoSchema] 
});

module.exports = mongoose.model('Maquina', MaquinaSchema);
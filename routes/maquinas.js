import express from "express";
import Maquina from "../models/Maquina.js";

const router = express.Router();

// Registrar mantenimiento
router.put("/:id/mantenimiento/:mid", async (req, res) => {
  try {
    const { id, mid } = req.params;
    const hoy = new Date();

    const maquina = await Maquina.findById(id);
    if (!maquina) return res.status(404).json({ error: "Máquina no encontrada" });

    const mantenimiento = maquina.mantenimientos.id(mid);
    if (!mantenimiento) return res.status(404).json({ error: "Mantenimiento no encontrado" });

    // Calcular nueva fecha
    const nuevaFecha = new Date(hoy);
    nuevaFecha.setDate(nuevaFecha.getDate() + mantenimiento.frecuencia_dias);

    mantenimiento.estado = "Plazo Cumplido";
    mantenimiento.fecha_limite = nuevaFecha.toLocaleDateString("es-CO");

    await maquina.save();

    res.json({ mensaje: "Mantenimiento registrado", maquina });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
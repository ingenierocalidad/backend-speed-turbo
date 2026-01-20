import express from "express";
import Maquina from "../models/Maquina.js";

const router = express.Router();

// GET todas las máquinas
router.get("/maquinas", async (req, res) => {
  try {
    const maquinas = await Maquina.find();
    res.json(maquinas);
  } catch (err) {
    console.error("Error al obtener máquinas:", err);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
});

// POST registrar un nuevo mantenimiento
router.post("/maquinas/:id/mantenimientos", async (req, res) => {
  const { id } = req.params;
  const nuevoMantenimiento = req.body;

  try {
    const maquina = await Maquina.findById(id);
    if (!maquina) return res.status(404).json({ msg: "Máquina no encontrada" });

    maquina.mantenimientos.push(nuevoMantenimiento);
    await maquina.save();

    res.json(maquina);
  } catch (err) {
    console.error("Error registrando mantenimiento:", err);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
});

export default router;
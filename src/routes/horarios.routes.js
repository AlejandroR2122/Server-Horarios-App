import express from "express";
import { getHorarios, createHorario } from "../controllers/horarios.controller.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Conexión exitosa" });
});

router.post("/", createHorario);

export default router;

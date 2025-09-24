import express from "express";
import cors from "cors";
import horariosRoutes from "./routes/horarios.routes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use( horariosRoutes);

export default app;

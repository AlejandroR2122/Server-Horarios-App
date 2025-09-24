import app from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
app.on("error", (error) => {
  console.error("Error en el servidor:", error);
});
app.use((err, req, res, next) => {
  console.log(`Nueva conexión: ${req.method} ${req.url}`);
    next();
});
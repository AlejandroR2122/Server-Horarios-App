import { pool } from "../config/superbase.js";


export const getHorarios = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM horarios");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createHorario = async (req, res) => {
  const { empleado, fecha, turno } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO horarios (empleado, fecha, turno) VALUES ($1, $2, $3) RETURNING *",
      [empleado, fecha, turno]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

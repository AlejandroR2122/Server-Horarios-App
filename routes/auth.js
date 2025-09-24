const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, generateToken } = require('../middleware/auth');

const router = express.Router();

// Validaciones para registro
const registerValidation = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('apellido')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El apellido debe tener entre 2 y 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe proporcionar un email válido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos: 1 minúscula, 1 mayúscula y 1 número'),
  body('departamento')
    .isIn(['IT', 'RRHH', 'Ventas', 'Marketing', 'Contabilidad', 'Operaciones', 'Otro'])
    .withMessage('Departamento inválido'),
  body('puesto')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El puesto debe tener entre 2 y 100 caracteres'),
  body('telefono')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Formato de teléfono inválido')
];

// Validaciones para login
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe proporcionar un email válido'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida')
];

// POST /api/auth/register - Registrar nuevo usuario
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: errors.array()
      });
    }

    const {
      nombre,
      apellido,
      email,
      password,
      departamento,
      puesto,
      telefono,
      role = 'empleado'
    } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        error: 'Usuario ya existe',
        message: 'Ya existe un usuario con este email'
      });
    }

    // Crear nuevo usuario
    const newUser = new User({
      nombre,
      apellido,
      email,
      password,
      departamento,
      puesto,
      telefono,
      role: role === 'admin' ? 'empleado' : role // Solo admins pueden crear otros admins
    });

    await newUser.save();

    // Generar token
    const token = generateToken(newUser._id);

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: newUser.toPublicJSON(),
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo registrar el usuario'
    });
  }
});

// POST /api/auth/login - Iniciar sesión
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Buscar usuario y incluir password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user || !user.activo) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos'
      });
    }

    // Actualizar último login
    user.ultimoLogin = new Date();
    await user.save();

    // Generar token
    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      user: user.toPublicJSON(),
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo iniciar sesión'
    });
  }
});

// GET /api/auth/me - Obtener información del usuario actual
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.status(200).json({
      user: req.user.toPublicJSON()
    });
  } catch (error) {
    console.error('Error obteniendo usuario actual:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la información del usuario'
    });
  }
});

// POST /api/auth/refresh - Refrescar token (opcional)
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const newToken = generateToken(req.user._id);
    
    res.status(200).json({
      message: 'Token refrescado exitosamente',
      token: newToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  } catch (error) {
    console.error('Error refrescando token:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo refrescar el token'
    });
  }
});

// POST /api/auth/logout - Cerrar sesión (cliente debe eliminar el token)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // En una implementación más robusta, aquí se podría agregar el token a una lista negra
    res.status(200).json({
      message: 'Sesión cerrada exitosamente'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo cerrar la sesión'
    });
  }
});

module.exports = router;
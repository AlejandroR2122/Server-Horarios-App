const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware para autenticación JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Token de acceso requerido',
        message: 'Por favor incluya el token en el header Authorization: Bearer <token>'
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar al usuario
    const user = await User.findById(decoded.userId).select('+password');
    
    if (!user || !user.activo) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Usuario no encontrado o inactivo'
      });
    }

    // Actualizar último login
    user.ultimoLogin = new Date();
    await user.save();

    // Añadir usuario a la request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token proporcionado no es válido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'El token ha expirado, por favor inicie sesión nuevamente'
      });
    }

    console.error('Error en autenticación:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al verificar el token'
    });
  }
};

// Middleware para autorización por roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        message: 'Debe estar autenticado para acceder a este recurso'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: `Se requiere uno de los siguientes roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

// Middleware para verificar si el usuario puede acceder a datos de otro usuario
const authorizeUserAccess = (req, res, next) => {
  const targetUserId = req.params.userId || req.params.id;
  const currentUserId = req.user._id.toString();
  const userRole = req.user.role;

  // Admins y RRHH pueden acceder a cualquier usuario
  if (userRole === 'admin' || userRole === 'rrhh') {
    return next();
  }

  // Los empleados solo pueden acceder a sus propios datos
  if (targetUserId && targetUserId !== currentUserId) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'No tiene permisos para acceder a los datos de otro usuario'
    });
  }

  next();
};

// Generar token JWT
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'horarios-app',
      audience: 'horarios-app-users'
    }
  );
};

// Verificar token JWT sin middleware (útil para verificaciones puntuales)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizeUserAccess,
  generateToken,
  verifyToken
};
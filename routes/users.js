const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const { authenticateToken, authorizeRoles, authorizeUserAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - Listar usuarios (solo admin/rrhh)
router.get('/', 
  authenticateToken, 
  authorizeRoles('admin', 'rrhh'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe estar entre 1 y 100'),
    query('departamento').optional().isIn(['IT', 'RRHH', 'Ventas', 'Marketing', 'Contabilidad', 'Operaciones', 'Otro']),
    query('role').optional().isIn(['empleado', 'admin', 'rrhh']),
    query('activo').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Parámetros de consulta inválidos',
          details: errors.array()
        });
      }

      const {
        page = 1,
        limit = 10,
        departamento,
        role,
        activo,
        search
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Construir filtros
      const filters = {};
      if (departamento) filters.departamento = departamento;
      if (role) filters.role = role;
      if (activo !== undefined) filters.activo = activo === 'true';
      
      // Búsqueda por texto
      if (search) {
        filters.$or = [
          { nombre: { $regex: search, $options: 'i' } },
          { apellido: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { puesto: { $regex: search, $options: 'i' } }
        ];
      }

      const [users, total] = await Promise.all([
        User.find(filters)
          .select('-password')
          .sort({ apellido: 1, nombre: 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(filters)
      ]);

      res.status(200).json({
        users,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error listando usuarios:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los usuarios'
      });
    }
  }
);

// GET /api/users/:id - Obtener usuario por ID
router.get('/:id', 
  authenticateToken, 
  authorizeUserAccess,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id).select('-password');
      
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario solicitado no existe'
        });
      }

      res.status(200).json({ user });

    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el usuario'
      });
    }
  }
);

// PUT /api/users/:id - Actualizar usuario
router.put('/:id',
  authenticateToken,
  authorizeUserAccess,
  [
    body('nombre').optional().trim().isLength({ min: 2, max: 100 }),
    body('apellido').optional().trim().isLength({ min: 2, max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('departamento').optional().isIn(['IT', 'RRHH', 'Ventas', 'Marketing', 'Contabilidad', 'Operaciones', 'Otro']),
    body('puesto').optional().trim().isLength({ min: 2, max: 100 }),
    body('telefono').optional().matches(/^\+?[\d\s\-\(\)]+$/),
    body('role').optional().isIn(['empleado', 'admin', 'rrhh'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          details: errors.array()
        });
      }

      const updates = req.body;
      const { password, ...allowedUpdates } = updates;

      // Solo admin/rrhh pueden cambiar roles
      if (updates.role && !['admin', 'rrhh'].includes(req.user.role)) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tiene permisos para cambiar roles'
        });
      }

      // Verificar si email ya existe (si se está cambiando)
      if (updates.email) {
        const existingUser = await User.findOne({ 
          email: updates.email, 
          _id: { $ne: req.params.id } 
        });
        
        if (existingUser) {
          return res.status(409).json({
            error: 'Email ya existe',
            message: 'Ya existe un usuario con este email'
          });
        }
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        allowedUpdates,
        { 
          new: true, 
          runValidators: true 
        }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario solicitado no existe'
        });
      }

      res.status(200).json({
        message: 'Usuario actualizado exitosamente',
        user
      });

    } catch (error) {
      console.error('Error actualizando usuario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar el usuario'
      });
    }
  }
);

// PUT /api/users/:id/password - Cambiar contraseña
router.put('/:id/password',
  authenticateToken,
  authorizeUserAccess,
  [
    body('currentPassword').notEmpty().withMessage('La contraseña actual es requerida'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('La contraseña debe contener al menos: 1 minúscula, 1 mayúscula y 1 número')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          details: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.params.id).select('+password');
      
      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario solicitado no existe'
        });
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          error: 'Contraseña actual inválida',
          message: 'La contraseña actual no es correcta'
        });
      }

      // Actualizar contraseña
      user.password = newPassword;
      await user.save();

      res.status(200).json({
        message: 'Contraseña actualizada exitosamente'
      });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo cambiar la contraseña'
      });
    }
  }
);

// DELETE /api/users/:id - Desactivar usuario (soft delete)
router.delete('/:id',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { activo: false },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario solicitado no existe'
        });
      }

      res.status(200).json({
        message: 'Usuario desactivado exitosamente',
        user
      });

    } catch (error) {
      console.error('Error desactivando usuario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo desactivar el usuario'
      });
    }
  }
);

// PUT /api/users/:id/activate - Reactivar usuario
router.put('/:id/activate',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { activo: true },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          error: 'Usuario no encontrado',
          message: 'El usuario solicitado no existe'
        });
      }

      res.status(200).json({
        message: 'Usuario reactivado exitosamente',
        user
      });

    } catch (error) {
      console.error('Error reactivando usuario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo reactivar el usuario'
      });
    }
  }
);

module.exports = router;
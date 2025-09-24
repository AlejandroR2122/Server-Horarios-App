const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const { authenticateToken, authorizeRoles, authorizeUserAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/schedules - Listar horarios
router.get('/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe estar entre 1 y 100'),
    query('empleado').optional().isMongoId().withMessage('ID de empleado inválido'),
    query('fechaInicio').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    query('fechaFin').optional().isISO8601().withMessage('Fecha de fin inválida'),
    query('estado').optional().isIn(['programado', 'en_curso', 'completado', 'ausente', 'tardanza'])
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
        empleado,
        fechaInicio,
        fechaFin,
        estado
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Construir filtros
      const filters = {};
      
      // Los empleados solo pueden ver sus horarios
      if (req.user.role === 'empleado') {
        filters.empleado = req.user._id;
      } else if (empleado) {
        filters.empleado = empleado;
      }

      if (estado) filters.estado = estado;

      // Filtros de fecha
      if (fechaInicio || fechaFin) {
        filters.fecha = {};
        if (fechaInicio) filters.fecha.$gte = new Date(fechaInicio);
        if (fechaFin) filters.fecha.$lte = new Date(fechaFin);
      }

      const [schedules, total] = await Promise.all([
        Schedule.find(filters)
          .populate('empleado', 'nombre apellido email departamento')
          .populate('creadoPor', 'nombre apellido')
          .sort({ fecha: -1, horaEntrada: 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Schedule.countDocuments(filters)
      ]);

      res.status(200).json({
        schedules,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error listando horarios:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los horarios'
      });
    }
  }
);

// GET /api/schedules/:id - Obtener horario por ID
router.get('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const schedule = await Schedule.findById(req.params.id)
        .populate('empleado', 'nombre apellido email departamento')
        .populate('creadoPor', 'nombre apellido');

      if (!schedule) {
        return res.status(404).json({
          error: 'Horario no encontrado',
          message: 'El horario solicitado no existe'
        });
      }

      // Verificar acceso (empleados solo pueden ver sus horarios)
      if (req.user.role === 'empleado' && schedule.empleado._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tiene permisos para ver este horario'
        });
      }

      res.status(200).json({ schedule });

    } catch (error) {
      console.error('Error obteniendo horario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el horario'
      });
    }
  }
);

// POST /api/schedules - Crear nuevo horario
router.post('/',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  [
    body('empleado').isMongoId().withMessage('ID de empleado inválido'),
    body('fecha').isISO8601().withMessage('Fecha inválida'),
    body('horaEntrada').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Formato de hora de entrada inválido (HH:MM)'),
    body('horaSalida').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Formato de hora de salida inválido (HH:MM)'),
    body('tipoJornada').optional().isIn(['completa', 'media', 'noche', 'especial']),
    body('observaciones').optional().isLength({ max: 500 }).withMessage('Las observaciones no pueden exceder 500 caracteres')
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

      const {
        empleado,
        fecha,
        horaEntrada,
        horaSalida,
        tipoJornada,
        observaciones
      } = req.body;

      // Verificar que el empleado existe
      const empleadoExists = await User.findById(empleado);
      if (!empleadoExists) {
        return res.status(404).json({
          error: 'Empleado no encontrado',
          message: 'El empleado especificado no existe'
        });
      }

      // Verificar que no exista un horario para el mismo empleado y fecha
      const existingSchedule = await Schedule.findOne({
        empleado,
        fecha: new Date(fecha)
      });

      if (existingSchedule) {
        return res.status(409).json({
          error: 'Horario ya existe',
          message: 'Ya existe un horario para este empleado en esta fecha'
        });
      }

      const schedule = new Schedule({
        empleado,
        fecha: new Date(fecha),
        horaEntrada,
        horaSalida,
        tipoJornada,
        observaciones,
        creadoPor: req.user._id
      });

      await schedule.save();
      
      await schedule.populate('empleado', 'nombre apellido email departamento');
      await schedule.populate('creadoPor', 'nombre apellido');

      res.status(201).json({
        message: 'Horario creado exitosamente',
        schedule
      });

    } catch (error) {
      console.error('Error creando horario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear el horario'
      });
    }
  }
);

// PUT /api/schedules/:id - Actualizar horario
router.put('/:id',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  [
    body('fecha').optional().isISO8601().withMessage('Fecha inválida'),
    body('horaEntrada').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Formato de hora de entrada inválido (HH:MM)'),
    body('horaSalida').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Formato de hora de salida inválido (HH:MM)'),
    body('horaEntradaReal').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Formato de hora de entrada real inválido (HH:MM)'),
    body('horaSalidaReal').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Formato de hora de salida real inválido (HH:MM)'),
    body('tipoJornada').optional().isIn(['completa', 'media', 'noche', 'especial']),
    body('estado').optional().isIn(['programado', 'en_curso', 'completado', 'ausente', 'tardanza']),
    body('horasExtras').optional().isFloat({ min: 0 }).withMessage('Las horas extras no pueden ser negativas'),
    body('observaciones').optional().isLength({ max: 500 }).withMessage('Las observaciones no pueden exceder 500 caracteres')
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

      const schedule = await Schedule.findByIdAndUpdate(
        req.params.id,
        updates,
        { 
          new: true, 
          runValidators: true 
        }
      )
      .populate('empleado', 'nombre apellido email departamento')
      .populate('creadoPor', 'nombre apellido');

      if (!schedule) {
        return res.status(404).json({
          error: 'Horario no encontrado',
          message: 'El horario solicitado no existe'
        });
      }

      res.status(200).json({
        message: 'Horario actualizado exitosamente',
        schedule
      });

    } catch (error) {
      console.error('Error actualizando horario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar el horario'
      });
    }
  }
);

// DELETE /api/schedules/:id - Eliminar horario
router.delete('/:id',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  async (req, res) => {
    try {
      const schedule = await Schedule.findByIdAndDelete(req.params.id);

      if (!schedule) {
        return res.status(404).json({
          error: 'Horario no encontrado',
          message: 'El horario solicitado no existe'
        });
      }

      res.status(200).json({
        message: 'Horario eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando horario:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar el horario'
      });
    }
  }
);

// POST /api/schedules/:id/checkin - Registrar entrada
router.post('/:id/checkin',
  authenticateToken,
  async (req, res) => {
    try {
      const schedule = await Schedule.findById(req.params.id);

      if (!schedule) {
        return res.status(404).json({
          error: 'Horario no encontrado',
          message: 'El horario solicitado no existe'
        });
      }

      // Solo el empleado puede registrar su entrada
      if (req.user.role === 'empleado' && schedule.empleado.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No puede registrar entrada para otro empleado'
        });
      }

      if (schedule.horaEntradaReal) {
        return res.status(400).json({
          error: 'Entrada ya registrada',
          message: 'La entrada ya fue registrada para este horario'
        });
      }

      const now = new Date();
      const horaActual = now.toTimeString().slice(0, 5); // HH:MM

      schedule.horaEntradaReal = horaActual;
      schedule.estado = 'en_curso';

      await schedule.save();
      await schedule.populate('empleado', 'nombre apellido email departamento');

      res.status(200).json({
        message: 'Entrada registrada exitosamente',
        schedule
      });

    } catch (error) {
      console.error('Error registrando entrada:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo registrar la entrada'
      });
    }
  }
);

// POST /api/schedules/:id/checkout - Registrar salida
router.post('/:id/checkout',
  authenticateToken,
  async (req, res) => {
    try {
      const schedule = await Schedule.findById(req.params.id);

      if (!schedule) {
        return res.status(404).json({
          error: 'Horario no encontrado',
          message: 'El horario solicitado no existe'
        });
      }

      // Solo el empleado puede registrar su salida
      if (req.user.role === 'empleado' && schedule.empleado.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No puede registrar salida para otro empleado'
        });
      }

      if (!schedule.horaEntradaReal) {
        return res.status(400).json({
          error: 'Sin entrada registrada',
          message: 'Debe registrar la entrada antes de la salida'
        });
      }

      if (schedule.horaSalidaReal) {
        return res.status(400).json({
          error: 'Salida ya registrada',
          message: 'La salida ya fue registrada para este horario'
        });
      }

      const now = new Date();
      const horaActual = now.toTimeString().slice(0, 5); // HH:MM

      schedule.horaSalidaReal = horaActual;
      schedule.estado = 'completado';

      await schedule.save();
      await schedule.populate('empleado', 'nombre apellido email departamento');

      res.status(200).json({
        message: 'Salida registrada exitosamente',
        schedule
      });

    } catch (error) {
      console.error('Error registrando salida:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo registrar la salida'
      });
    }
  }
);

module.exports = router;
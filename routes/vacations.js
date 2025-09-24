const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Vacation = require('../models/Vacation');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/vacations - Listar vacaciones
router.get('/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe estar entre 1 y 100'),
    query('empleado').optional().isMongoId().withMessage('ID de empleado inválido'),
    query('estado').optional().isIn(['pendiente', 'aprobada', 'rechazada', 'cancelada', 'en_curso', 'completada']),
    query('tipoVacacion').optional().isIn(['vacaciones', 'permiso_personal', 'licencia_medica', 'permiso_matrimonio', 'permiso_maternidad', 'permiso_paternidad', 'licencia_sin_goce', 'otro']),
    query('anoVacacional').optional().isInt().withMessage('Año vacacional inválido'),
    query('urgente').optional().isBoolean()
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
        estado,
        tipoVacacion,
        anoVacacional,
        urgente
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Construir filtros
      const filters = {};
      
      // Los empleados solo pueden ver sus vacaciones
      if (req.user.role === 'empleado') {
        filters.empleado = req.user._id;
      } else if (empleado) {
        filters.empleado = empleado;
      }

      if (estado) filters.estado = estado;
      if (tipoVacacion) filters.tipoVacacion = tipoVacacion;
      if (anoVacacional) filters.anoVacacional = parseInt(anoVacacional);
      if (urgente !== undefined) filters.urgente = urgente === 'true';

      const [vacations, total] = await Promise.all([
        Vacation.find(filters)
          .populate('empleado', 'nombre apellido email departamento')
          .populate('reemplazo', 'nombre apellido email')
          .populate('aprobadoPor', 'nombre apellido')
          .populate('creadoPor', 'nombre apellido')
          .sort({ fechaSolicitud: -1, urgente: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Vacation.countDocuments(filters)
      ]);

      res.status(200).json({
        vacations,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error listando vacaciones:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las vacaciones'
      });
    }
  }
);

// GET /api/vacations/:id - Obtener vacación por ID
router.get('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const vacation = await Vacation.findById(req.params.id)
        .populate('empleado', 'nombre apellido email departamento')
        .populate('reemplazo', 'nombre apellido email departamento')
        .populate('aprobadoPor', 'nombre apellido email')
        .populate('creadoPor', 'nombre apellido')
        .populate('modificadoPor', 'nombre apellido');

      if (!vacation) {
        return res.status(404).json({
          error: 'Vacación no encontrada',
          message: 'La solicitud de vacación no existe'
        });
      }

      // Verificar acceso (empleados solo pueden ver sus vacaciones)
      if (req.user.role === 'empleado' && vacation.empleado._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tiene permisos para ver esta solicitud de vacación'
        });
      }

      res.status(200).json({ vacation });

    } catch (error) {
      console.error('Error obteniendo vacación:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la vacación'
      });
    }
  }
);

// POST /api/vacations - Crear nueva solicitud de vacación
router.post('/',
  authenticateToken,
  [
    body('empleado').optional().isMongoId().withMessage('ID de empleado inválido'),
    body('fechaInicio').isISO8601().withMessage('Fecha de inicio inválida'),
    body('fechaFin').isISO8601().withMessage('Fecha de fin inválida'),
    body('tipoVacacion').isIn(['vacaciones', 'permiso_personal', 'licencia_medica', 'permiso_matrimonio', 'permiso_maternidad', 'permiso_paternidad', 'licencia_sin_goce', 'otro']).withMessage('Tipo de vacación inválido'),
    body('motivo').trim().notEmpty().withMessage('El motivo es requerido').isLength({ max: 500 }).withMessage('El motivo no puede exceder 500 caracteres'),
    body('observaciones').optional().isLength({ max: 1000 }).withMessage('Las observaciones no pueden exceder 1000 caracteres'),
    body('reemplazo').optional().isMongoId().withMessage('ID de reemplazo inválido'),
    body('instruccionesReemplazo').optional().isLength({ max: 1000 }).withMessage('Las instrucciones no pueden exceder 1000 caracteres'),
    body('urgente').optional().isBoolean()
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

      const vacationData = req.body;

      // Los empleados solo pueden crear solicitudes para sí mismos
      const empleadoId = req.user.role === 'empleado' ? req.user._id : (vacationData.empleado || req.user._id);

      // Verificar que el empleado existe
      const empleado = await User.findById(empleadoId);
      if (!empleado) {
        return res.status(404).json({
          error: 'Empleado no encontrado',
          message: 'El empleado especificado no existe'
        });
      }

      // Verificar reemplazo si se proporciona
      if (vacationData.reemplazo) {
        const reemplazo = await User.findById(vacationData.reemplazo);
        if (!reemplazo) {
          return res.status(404).json({
            error: 'Reemplazo no encontrado',
            message: 'El empleado de reemplazo especificado no existe'
          });
        }
      }

      // Validar fechas
      const fechaInicio = new Date(vacationData.fechaInicio);
      const fechaFin = new Date(vacationData.fechaFin);
      
      if (fechaFin <= fechaInicio) {
        return res.status(400).json({
          error: 'Fechas inválidas',
          message: 'La fecha de fin debe ser posterior a la fecha de inicio'
        });
      }

      // Verificar que no se solapen con otras vacaciones aprobadas
      const existingVacation = await Vacation.findOne({
        empleado: empleadoId,
        estado: { $in: ['aprobada', 'pendiente', 'en_curso'] },
        $or: [
          {
            fechaInicio: { $lte: fechaFin },
            fechaFin: { $gte: fechaInicio }
          }
        ]
      });

      if (existingVacation) {
        return res.status(409).json({
          error: 'Fechas en conflicto',
          message: 'Ya existe una solicitud de vacaciones que se solapa con estas fechas'
        });
      }

      const vacation = new Vacation({
        ...vacationData,
        empleado: empleadoId,
        creadoPor: req.user._id
      });

      await vacation.save();
      
      await vacation.populate('empleado', 'nombre apellido email departamento');
      await vacation.populate('reemplazo', 'nombre apellido email');
      await vacation.populate('creadoPor', 'nombre apellido');

      res.status(201).json({
        message: 'Solicitud de vacación creada exitosamente',
        vacation
      });

    } catch (error) {
      console.error('Error creando solicitud de vacación:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear la solicitud de vacación'
      });
    }
  }
);

// PUT /api/vacations/:id - Actualizar solicitud de vacación
router.put('/:id',
  authenticateToken,
  [
    body('fechaInicio').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    body('fechaFin').optional().isISO8601().withMessage('Fecha de fin inválida'),
    body('tipoVacacion').optional().isIn(['vacaciones', 'permiso_personal', 'licencia_medica', 'permiso_matrimonio', 'permiso_maternidad', 'permiso_paternidad', 'licencia_sin_goce', 'otro']),
    body('motivo').optional().trim().notEmpty().isLength({ max: 500 }),
    body('observaciones').optional().isLength({ max: 1000 }),
    body('reemplazo').optional().isMongoId().withMessage('ID de reemplazo inválido'),
    body('instruccionesReemplazo').optional().isLength({ max: 1000 }),
    body('urgente').optional().isBoolean()
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

      const vacation = await Vacation.findById(req.params.id);

      if (!vacation) {
        return res.status(404).json({
          error: 'Vacación no encontrada',
          message: 'La solicitud de vacación no existe'
        });
      }

      // Solo se pueden modificar vacaciones pendientes
      if (vacation.estado !== 'pendiente') {
        return res.status(400).json({
          error: 'No se puede modificar',
          message: 'Solo se pueden modificar solicitudes pendientes'
        });
      }

      // Los empleados solo pueden modificar sus propias solicitudes
      if (req.user.role === 'empleado' && vacation.empleado.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No puede modificar solicitudes de otros empleados'
        });
      }

      const updates = { ...req.body, modificadoPor: req.user._id };

      // Verificar reemplazo si se actualiza
      if (updates.reemplazo) {
        const reemplazo = await User.findById(updates.reemplazo);
        if (!reemplazo) {
          return res.status(404).json({
            error: 'Reemplazo no encontrado',
            message: 'El empleado de reemplazo especificado no existe'
          });
        }
      }

      const updatedVacation = await Vacation.findByIdAndUpdate(
        req.params.id,
        updates,
        { 
          new: true, 
          runValidators: true 
        }
      )
      .populate('empleado', 'nombre apellido email departamento')
      .populate('reemplazo', 'nombre apellido email')
      .populate('creadoPor', 'nombre apellido')
      .populate('modificadoPor', 'nombre apellido');

      res.status(200).json({
        message: 'Solicitud de vacación actualizada exitosamente',
        vacation: updatedVacation
      });

    } catch (error) {
      console.error('Error actualizando vacación:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar la solicitud de vacación'
      });
    }
  }
);

// POST /api/vacations/:id/approve - Aprobar solicitud
router.post('/:id/approve',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  async (req, res) => {
    try {
      const vacation = await Vacation.findById(req.params.id);

      if (!vacation) {
        return res.status(404).json({
          error: 'Vacación no encontrada',
          message: 'La solicitud de vacación no existe'
        });
      }

      if (vacation.estado !== 'pendiente') {
        return res.status(400).json({
          error: 'Estado inválido',
          message: 'Solo se pueden aprobar solicitudes pendientes'
        });
      }

      vacation.estado = 'aprobada';
      vacation.aprobadoPor = req.user._id;
      vacation.fechaAprobacion = new Date();
      vacation.modificadoPor = req.user._id;

      await vacation.save();
      
      await vacation.populate('empleado', 'nombre apellido email departamento');
      await vacation.populate('aprobadoPor', 'nombre apellido email');
      await vacation.populate('reemplazo', 'nombre apellido email');

      res.status(200).json({
        message: 'Solicitud de vacación aprobada exitosamente',
        vacation
      });

    } catch (error) {
      console.error('Error aprobando vacación:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo aprobar la solicitud de vacación'
      });
    }
  }
);

// POST /api/vacations/:id/reject - Rechazar solicitud
router.post('/:id/reject',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  [
    body('motivoRechazo').trim().notEmpty().withMessage('El motivo de rechazo es requerido').isLength({ max: 500 }).withMessage('El motivo no puede exceder 500 caracteres')
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

      const vacation = await Vacation.findById(req.params.id);

      if (!vacation) {
        return res.status(404).json({
          error: 'Vacación no encontrada',
          message: 'La solicitud de vacación no existe'
        });
      }

      if (vacation.estado !== 'pendiente') {
        return res.status(400).json({
          error: 'Estado inválido',
          message: 'Solo se pueden rechazar solicitudes pendientes'
        });
      }

      vacation.estado = 'rechazada';
      vacation.motivoRechazo = req.body.motivoRechazo;
      vacation.aprobadoPor = req.user._id;
      vacation.fechaAprobacion = new Date();
      vacation.modificadoPor = req.user._id;

      await vacation.save();
      
      await vacation.populate('empleado', 'nombre apellido email departamento');
      await vacation.populate('aprobadoPor', 'nombre apellido email');

      res.status(200).json({
        message: 'Solicitud de vacación rechazada',
        vacation
      });

    } catch (error) {
      console.error('Error rechazando vacación:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo rechazar la solicitud de vacación'
      });
    }
  }
);

// POST /api/vacations/:id/cancel - Cancelar solicitud
router.post('/:id/cancel',
  authenticateToken,
  async (req, res) => {
    try {
      const vacation = await Vacation.findById(req.params.id);

      if (!vacation) {
        return res.status(404).json({
          error: 'Vacación no encontrada',
          message: 'La solicitud de vacación no existe'
        });
      }

      // Los empleados solo pueden cancelar sus propias solicitudes
      if (req.user.role === 'empleado' && vacation.empleado.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No puede cancelar solicitudes de otros empleados'
        });
      }

      if (!['pendiente', 'aprobada'].includes(vacation.estado)) {
        return res.status(400).json({
          error: 'Estado inválido',
          message: 'Solo se pueden cancelar solicitudes pendientes o aprobadas'
        });
      }

      vacation.estado = 'cancelada';
      vacation.modificadoPor = req.user._id;

      await vacation.save();
      
      await vacation.populate('empleado', 'nombre apellido email departamento');

      res.status(200).json({
        message: 'Solicitud de vacación cancelada exitosamente',
        vacation
      });

    } catch (error) {
      console.error('Error cancelando vacación:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo cancelar la solicitud de vacación'
      });
    }
  }
);

// GET /api/vacations/employee/:id/balance - Obtener balance de vacaciones de un empleado
router.get('/employee/:id/balance',
  authenticateToken,
  async (req, res) => {
    try {
      const empleadoId = req.params.id;
      const year = req.query.year || new Date().getFullYear();

      // Verificar acceso
      if (req.user.role === 'empleado' && empleadoId !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No puede ver el balance de otros empleados'
        });
      }

      const empleado = await User.findById(empleadoId);
      if (!empleado) {
        return res.status(404).json({
          error: 'Empleado no encontrado',
          message: 'El empleado especificado no existe'
        });
      }

      // Obtener vacaciones del año
      const vacaciones = await Vacation.find({
        empleado: empleadoId,
        anoVacacional: year,
        estado: { $in: ['aprobada', 'en_curso', 'completada'] }
      });

      // Calcular días utilizados
      const diasUtilizados = vacaciones.reduce((total, vacation) => {
        return total + vacation.diasHabiles;
      }, 0);

      // Obtener días disponibles del contrato más reciente (simulado)
      const diasDisponibles = 22; // Por defecto, debería obtenerse del contrato

      res.status(200).json({
        empleado: {
          id: empleado._id,
          nombre: empleado.nombreCompleto
        },
        año: year,
        diasDisponibles,
        diasUtilizados,
        diasRestantes: diasDisponibles - diasUtilizados,
        vacaciones
      });

    } catch (error) {
      console.error('Error obteniendo balance de vacaciones:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el balance de vacaciones'
      });
    }
  }
);

module.exports = router;
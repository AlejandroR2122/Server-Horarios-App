const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Contract = require('../models/Contract');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// GET /api/contracts - Listar contratos
router.get('/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe estar entre 1 y 100'),
    query('empleado').optional().isMongoId().withMessage('ID de empleado inválido'),
    query('estado').optional().isIn(['borrador', 'activo', 'finalizado', 'cancelado', 'renovado']),
    query('tipoContrato').optional().isIn(['indefinido', 'temporal', 'practicas', 'freelance', 'consultoria'])
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
        tipoContrato
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Construir filtros
      const filters = {};
      
      // Los empleados solo pueden ver sus contratos
      if (req.user.role === 'empleado') {
        filters.empleado = req.user._id;
      } else if (empleado) {
        filters.empleado = empleado;
      }

      if (estado) filters.estado = estado;
      if (tipoContrato) filters.tipoContrato = tipoContrato;

      const [contracts, total] = await Promise.all([
        Contract.find(filters)
          .populate('empleado', 'nombre apellido email departamento')
          .populate('supervisor', 'nombre apellido')
          .populate('creadoPor', 'nombre apellido')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Contract.countDocuments(filters)
      ]);

      res.status(200).json({
        contracts,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Error listando contratos:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los contratos'
      });
    }
  }
);

// GET /api/contracts/:id - Obtener contrato por ID
router.get('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const contract = await Contract.findById(req.params.id)
        .populate('empleado', 'nombre apellido email departamento')
        .populate('supervisor', 'nombre apellido email')
        .populate('creadoPor', 'nombre apellido')
        .populate('modificadoPor', 'nombre apellido');

      if (!contract) {
        return res.status(404).json({
          error: 'Contrato no encontrado',
          message: 'El contrato solicitado no existe'
        });
      }

      // Verificar acceso (empleados solo pueden ver sus contratos)
      if (req.user.role === 'empleado' && contract.empleado._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Acceso denegado',
          message: 'No tiene permisos para ver este contrato'
        });
      }

      res.status(200).json({ contract });

    } catch (error) {
      console.error('Error obteniendo contrato:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el contrato'
      });
    }
  }
);

// POST /api/contracts - Crear nuevo contrato
router.post('/',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  [
    body('empleado').isMongoId().withMessage('ID de empleado inválido'),
    body('tipoContrato').isIn(['indefinido', 'temporal', 'practicas', 'freelance', 'consultoria']).withMessage('Tipo de contrato inválido'),
    body('fechaInicio').isISO8601().withMessage('Fecha de inicio inválida'),
    body('fechaFin').optional().isISO8601().withMessage('Fecha de fin inválida'),
    body('salarioBase').isFloat({ min: 0 }).withMessage('El salario base debe ser un número positivo'),
    body('moneda').optional().isIn(['EUR', 'USD', 'MXN', 'COP', 'ARS']).withMessage('Moneda inválida'),
    body('horasSemanales').isInt({ min: 1, max: 60 }).withMessage('Las horas semanales deben estar entre 1 y 60'),
    body('diasVacaciones').isInt({ min: 0 }).withMessage('Los días de vacaciones no pueden ser negativos'),
    body('departamento').notEmpty().withMessage('El departamento es requerido'),
    body('puesto').notEmpty().withMessage('El puesto es requerido'),
    body('supervisor').optional().isMongoId().withMessage('ID de supervisor inválido'),
    body('observaciones').optional().isLength({ max: 1000 }).withMessage('Las observaciones no pueden exceder 1000 caracteres')
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

      const contractData = req.body;

      // Verificar que el empleado existe
      const empleado = await User.findById(contractData.empleado);
      if (!empleado) {
        return res.status(404).json({
          error: 'Empleado no encontrado',
          message: 'El empleado especificado no existe'
        });
      }

      // Verificar supervisor si se proporciona
      if (contractData.supervisor) {
        const supervisor = await User.findById(contractData.supervisor);
        if (!supervisor) {
          return res.status(404).json({
            error: 'Supervisor no encontrado',
            message: 'El supervisor especificado no existe'
          });
        }
      }

      // Validar fechas
      if (contractData.fechaFin && new Date(contractData.fechaFin) <= new Date(contractData.fechaInicio)) {
        return res.status(400).json({
          error: 'Fechas inválidas',
          message: 'La fecha de fin debe ser posterior a la fecha de inicio'
        });
      }

      const contract = new Contract({
        ...contractData,
        creadoPor: req.user._id
      });

      await contract.save();
      
      await contract.populate('empleado', 'nombre apellido email departamento');
      await contract.populate('supervisor', 'nombre apellido email');
      await contract.populate('creadoPor', 'nombre apellido');

      res.status(201).json({
        message: 'Contrato creado exitosamente',
        contract
      });

    } catch (error) {
      console.error('Error creando contrato:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo crear el contrato'
      });
    }
  }
);

// PUT /api/contracts/:id - Actualizar contrato
router.put('/:id',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  [
    body('tipoContrato').optional().isIn(['indefinido', 'temporal', 'practicas', 'freelance', 'consultoria']),
    body('fechaInicio').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    body('fechaFin').optional().isISO8601().withMessage('Fecha de fin inválida'),
    body('salarioBase').optional().isFloat({ min: 0 }).withMessage('El salario base debe ser un número positivo'),
    body('moneda').optional().isIn(['EUR', 'USD', 'MXN', 'COP', 'ARS']),
    body('horasSemanales').optional().isInt({ min: 1, max: 60 }),
    body('diasVacaciones').optional().isInt({ min: 0 }),
    body('estado').optional().isIn(['borrador', 'activo', 'finalizado', 'cancelado', 'renovado']),
    body('supervisor').optional().isMongoId().withMessage('ID de supervisor inválido'),
    body('observaciones').optional().isLength({ max: 1000 })
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

      const updates = { ...req.body, modificadoPor: req.user._id };

      // Verificar supervisor si se actualiza
      if (updates.supervisor) {
        const supervisor = await User.findById(updates.supervisor);
        if (!supervisor) {
          return res.status(404).json({
            error: 'Supervisor no encontrado',
            message: 'El supervisor especificado no existe'
          });
        }
      }

      const contract = await Contract.findByIdAndUpdate(
        req.params.id,
        updates,
        { 
          new: true, 
          runValidators: true 
        }
      )
      .populate('empleado', 'nombre apellido email departamento')
      .populate('supervisor', 'nombre apellido email')
      .populate('creadoPor', 'nombre apellido')
      .populate('modificadoPor', 'nombre apellido');

      if (!contract) {
        return res.status(404).json({
          error: 'Contrato no encontrado',
          message: 'El contrato solicitado no existe'
        });
      }

      res.status(200).json({
        message: 'Contrato actualizado exitosamente',
        contract
      });

    } catch (error) {
      console.error('Error actualizando contrato:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar el contrato'
      });
    }
  }
);

// POST /api/contracts/:id/activate - Activar contrato
router.post('/:id/activate',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  async (req, res) => {
    try {
      const contract = await Contract.findByIdAndUpdate(
        req.params.id,
        { 
          estado: 'activo',
          modificadoPor: req.user._id
        },
        { new: true }
      )
      .populate('empleado', 'nombre apellido email departamento')
      .populate('supervisor', 'nombre apellido email');

      if (!contract) {
        return res.status(404).json({
          error: 'Contrato no encontrado',
          message: 'El contrato solicitado no existe'
        });
      }

      res.status(200).json({
        message: 'Contrato activado exitosamente',
        contract
      });

    } catch (error) {
      console.error('Error activando contrato:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo activar el contrato'
      });
    }
  }
);

// POST /api/contracts/:id/finalize - Finalizar contrato
router.post('/:id/finalize',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  async (req, res) => {
    try {
      const contract = await Contract.findByIdAndUpdate(
        req.params.id,
        { 
          estado: 'finalizado',
          fechaFin: req.body.fechaFin || new Date(),
          modificadoPor: req.user._id
        },
        { new: true }
      )
      .populate('empleado', 'nombre apellido email departamento')
      .populate('supervisor', 'nombre apellido email');

      if (!contract) {
        return res.status(404).json({
          error: 'Contrato no encontrado',
          message: 'El contrato solicitado no existe'
        });
      }

      res.status(200).json({
        message: 'Contrato finalizado exitosamente',
        contract
      });

    } catch (error) {
      console.error('Error finalizando contrato:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo finalizar el contrato'
      });
    }
  }
);

// DELETE /api/contracts/:id - Eliminar contrato (solo borradores)
router.delete('/:id',
  authenticateToken,
  authorizeRoles('admin', 'rrhh'),
  async (req, res) => {
    try {
      const contract = await Contract.findById(req.params.id);

      if (!contract) {
        return res.status(404).json({
          error: 'Contrato no encontrado',
          message: 'El contrato solicitado no existe'
        });
      }

      if (contract.estado !== 'borrador') {
        return res.status(400).json({
          error: 'No se puede eliminar',
          message: 'Solo se pueden eliminar contratos en estado borrador'
        });
      }

      await Contract.findByIdAndDelete(req.params.id);

      res.status(200).json({
        message: 'Contrato eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando contrato:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar el contrato'
      });
    }
  }
);

module.exports = router;
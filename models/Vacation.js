const mongoose = require('mongoose');

const vacationSchema = new mongoose.Schema({
  empleado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El empleado es requerido']
  },
  fechaInicio: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida']
  },
  fechaFin: {
    type: Date,
    required: [true, 'La fecha de fin es requerida'],
    validate: {
      validator: function(value) {
        return value > this.fechaInicio;
      },
      message: 'La fecha de fin debe ser posterior a la fecha de inicio'
    }
  },
  tipoVacacion: {
    type: String,
    required: [true, 'El tipo de vacación es requerido'],
    enum: ['vacaciones', 'permiso_personal', 'licencia_medica', 'permiso_matrimonio', 'permiso_maternidad', 'permiso_paternidad', 'licencia_sin_goce', 'otro']
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aprobada', 'rechazada', 'cancelada', 'en_curso', 'completada'],
    default: 'pendiente'
  },
  motivo: {
    type: String,
    required: [true, 'El motivo es requerido'],
    trim: true,
    maxlength: [500, 'El motivo no puede exceder 500 caracteres']
  },
  observaciones: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las observaciones no pueden exceder 1000 caracteres']
  },
  documentoSoporte: {
    nombre: String,
    url: String,
    tipo: String,
    fechaSubida: {
      type: Date,
      default: Date.now
    }
  },
  aprobadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fechaAprobacion: {
    type: Date
  },
  motivoRechazo: {
    type: String,
    trim: true,
    maxlength: [500, 'El motivo de rechazo no puede exceder 500 caracteres']
  },
  diasSolicitados: {
    type: Number,
    min: [0.5, 'Mínimo medio día'],
    max: [365, 'Máximo 365 días']
  },
  diasHabiles: {
    type: Number,
    min: [0, 'Los días hábiles no pueden ser negativos']
  },
  afectaSalario: {
    type: Boolean,
    default: false
  },
  reemplazo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  instruccionesReemplazo: {
    type: String,
    trim: true,
    maxlength: [1000, 'Las instrucciones no pueden exceder 1000 caracteres']
  },
  urgente: {
    type: Boolean,
    default: false
  },
  fechaSolicitud: {
    type: Date,
    default: Date.now
  },
  anoVacacional: {
    type: Number,
    default: function() {
      return new Date().getFullYear();
    }
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modificadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para calcular días totales
vacationSchema.virtual('diasTotales').get(function() {
  if (!this.fechaInicio || !this.fechaFin) return 0;
  
  const inicio = new Date(this.fechaInicio);
  const fin = new Date(this.fechaFin);
  const diferencia = fin.getTime() - inicio.getTime();
  
  return Math.ceil(diferencia / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir el último día
});

// Virtual para calcular días hábiles (excluye sábados y domingos)
vacationSchema.virtual('diasHabilesCalculados').get(function() {
  if (!this.fechaInicio || !this.fechaFin) return 0;
  
  let count = 0;
  const inicio = new Date(this.fechaInicio);
  const fin = new Date(this.fechaFin);
  
  for (let date = new Date(inicio); date <= fin; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // No domingo (0) ni sábado (6)
      count++;
    }
  }
  
  return count;
});

// Virtual para verificar si está vigente
vacationSchema.virtual('vigente').get(function() {
  const hoy = new Date();
  return this.fechaInicio <= hoy && this.fechaFin >= hoy && this.estado === 'aprobada';
});

// Indices para consultas eficientes
vacationSchema.index({ empleado: 1 });
vacationSchema.index({ estado: 1 });
vacationSchema.index({ tipoVacacion: 1 });
vacationSchema.index({ fechaInicio: 1, fechaFin: 1 });
vacationSchema.index({ anoVacacional: 1 });
vacationSchema.index({ urgente: 1 });

// Middleware para calcular días automáticamente
vacationSchema.pre('save', function(next) {
  // Calcular días solicitados si no se proporciona
  if (!this.diasSolicitados) {
    this.diasSolicitados = this.diasTotales;
  }
  
  // Calcular días hábiles si no se proporciona
  if (!this.diasHabiles) {
    this.diasHabiles = this.diasHabilesCalculados;
  }
  
  // Establecer fecha de aprobación si se aprueba
  if (this.estado === 'aprobada' && !this.fechaAprobacion) {
    this.fechaAprobacion = new Date();
  }
  
  next();
});

// Middleware para validaciones adicionales
vacationSchema.pre('save', function(next) {
  // Validar que la fecha de inicio no sea en el pasado para nuevas solicitudes
  if (this.isNew && this.fechaInicio < new Date()) {
    return next(new Error('La fecha de inicio no puede ser en el pasado'));
  }
  
  // Validar que no se solapen vacaciones para el mismo empleado
  if (this.estado === 'aprobada' || this.estado === 'pendiente') {
    this.constructor.findOne({
      empleado: this.empleado,
      _id: { $ne: this._id },
      estado: { $in: ['aprobada', 'pendiente', 'en_curso'] },
      $or: [
        {
          fechaInicio: { $lte: this.fechaFin },
          fechaFin: { $gte: this.fechaInicio }
        }
      ]
    }).then(existingVacation => {
      if (existingVacation) {
        return next(new Error('Ya existe una solicitud de vacaciones que se solapa con estas fechas'));
      }
      next();
    }).catch(next);
  } else {
    next();
  }
});

module.exports = mongoose.model('Vacation', vacationSchema);
const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  empleado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El empleado es requerido']
  },
  tipoContrato: {
    type: String,
    required: [true, 'El tipo de contrato es requerido'],
    enum: ['indefinido', 'temporal', 'practicas', 'freelance', 'consultoria']
  },
  fechaInicio: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida']
  },
  fechaFin: {
    type: Date,
    validate: {
      validator: function(value) {
        // Solo validar si hay fecha de fin
        if (!value) return true;
        return value > this.fechaInicio;
      },
      message: 'La fecha de fin debe ser posterior a la fecha de inicio'
    }
  },
  salarioBase: {
    type: Number,
    required: [true, 'El salario base es requerido'],
    min: [0, 'El salario no puede ser negativo']
  },
  moneda: {
    type: String,
    default: 'EUR',
    enum: ['EUR', 'USD', 'MXN', 'COP', 'ARS']
  },
  horasSemanales: {
    type: Number,
    required: [true, 'Las horas semanales son requeridas'],
    min: [1, 'Debe ser al menos 1 hora semanal'],
    max: [60, 'No puede exceder 60 horas semanales']
  },
  diasVacaciones: {
    type: Number,
    required: [true, 'Los días de vacaciones son requeridos'],
    min: [0, 'Los días de vacaciones no pueden ser negativos'],
    default: 22
  },
  beneficios: [{
    nombre: {
      type: String,
      required: true,
      trim: true
    },
    descripcion: {
      type: String,
      trim: true
    },
    valor: {
      type: Number,
      default: 0
    }
  }],
  clausulasEspeciales: [{
    titulo: {
      type: String,
      required: true,
      trim: true
    },
    contenido: {
      type: String,
      required: true,
      trim: true
    }
  }],
  estado: {
    type: String,
    enum: ['borrador', 'activo', 'finalizado', 'cancelado', 'renovado'],
    default: 'borrador'
  },
  numeroContrato: {
    type: String,
    unique: true,
    trim: true
  },
  departamento: {
    type: String,
    required: [true, 'El departamento es requerido']
  },
  puesto: {
    type: String,
    required: [true, 'El puesto es requerido'],
    trim: true
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  observaciones: {
    type: String,
    maxlength: [1000, 'Las observaciones no pueden exceder 1000 caracteres']
  },
  documentos: [{
    nombre: String,
    url: String,
    tipo: String,
    fechaSubida: {
      type: Date,
      default: Date.now
    }
  }],
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

// Virtual para calcular duración del contrato
contractSchema.virtual('duracionMeses').get(function() {
  if (!this.fechaFin) return null;
  
  const inicio = new Date(this.fechaInicio);
  const fin = new Date(this.fechaFin);
  
  return Math.round((fin - inicio) / (1000 * 60 * 60 * 24 * 30));
});

// Virtual para verificar si está vigente
contractSchema.virtual('vigente').get(function() {
  const hoy = new Date();
  const inicioValido = this.fechaInicio <= hoy;
  const finValido = !this.fechaFin || this.fechaFin >= hoy;
  
  return this.estado === 'activo' && inicioValido && finValido;
});

// Indices para consultas eficientes
contractSchema.index({ empleado: 1 });
contractSchema.index({ estado: 1 });
contractSchema.index({ tipoContrato: 1 });
contractSchema.index({ fechaInicio: 1, fechaFin: 1 });
contractSchema.index({ numeroContrato: 1 });

// Generar número de contrato automáticamente
contractSchema.pre('save', async function(next) {
  if (this.isNew && !this.numeroContrato) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    
    this.numeroContrato = `CONT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Contract', contractSchema);
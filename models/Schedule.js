const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  empleado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El empleado es requerido']
  },
  fecha: {
    type: Date,
    required: [true, 'La fecha es requerida']
  },
  horaEntrada: {
    type: String,
    required: [true, 'La hora de entrada es requerida'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
  },
  horaSalida: {
    type: String,
    required: [true, 'La hora de salida es requerida'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
  },
  horaEntradaReal: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
  },
  horaSalidaReal: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
  },
  tipoJornada: {
    type: String,
    enum: ['completa', 'media', 'noche', 'especial'],
    default: 'completa'
  },
  estado: {
    type: String,
    enum: ['programado', 'en_curso', 'completado', 'ausente', 'tardanza'],
    default: 'programado'
  },
  horasExtras: {
    type: Number,
    default: 0,
    min: [0, 'Las horas extras no pueden ser negativas']
  },
  observaciones: {
    type: String,
    maxlength: [500, 'Las observaciones no pueden exceder 500 caracteres']
  },
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para calcular horas trabajadas planificadas
scheduleSchema.virtual('horasPlanificadas').get(function() {
  if (!this.horaEntrada || !this.horaSalida) return 0;
  
  const entrada = new Date(`2000-01-01 ${this.horaEntrada}`);
  const salida = new Date(`2000-01-01 ${this.horaSalida}`);
  
  // Si la salida es antes que la entrada, asumimos que cruza medianoche
  if (salida < entrada) {
    salida.setDate(salida.getDate() + 1);
  }
  
  return (salida - entrada) / (1000 * 60 * 60); // Horas
});

// Virtual para calcular horas trabajadas reales
scheduleSchema.virtual('horasReales').get(function() {
  if (!this.horaEntradaReal || !this.horaSalidaReal) return 0;
  
  const entrada = new Date(`2000-01-01 ${this.horaEntradaReal}`);
  const salida = new Date(`2000-01-01 ${this.horaSalidaReal}`);
  
  if (salida < entrada) {
    salida.setDate(salida.getDate() + 1);
  }
  
  return (salida - entrada) / (1000 * 60 * 60); // Horas
});

// Indices para consultas eficientes
scheduleSchema.index({ empleado: 1, fecha: 1 });
scheduleSchema.index({ fecha: 1 });
scheduleSchema.index({ estado: 1 });

// Validación personalizada: hora de salida debe ser después de hora de entrada
scheduleSchema.pre('save', function(next) {
  const entrada = new Date(`2000-01-01 ${this.horaEntrada}`);
  const salida = new Date(`2000-01-01 ${this.horaSalida}`);
  
  // Permitir cruces de medianoche
  if (salida <= entrada) {
    salida.setDate(salida.getDate() + 1);
  }
  
  if (salida <= entrada) {
    return next(new Error('La hora de salida debe ser posterior a la hora de entrada'));
  }
  
  next();
});

module.exports = mongoose.model('Schedule', scheduleSchema);
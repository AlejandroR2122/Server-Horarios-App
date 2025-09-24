# API Documentation - Backend Horarios App

## Configuración Inicial

### Requisitos
- Node.js (v14 o superior)
- MongoDB (v4.0 o superior)
- npm o yarn

### Instalación
```bash
npm install
```

### Configuración de Variables de Entorno
Crea un archivo `.env` con las siguientes variables:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/horarios_app
JWT_SECRET=your_very_secure_jwt_secret_key_here_change_this_in_production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
```

### Iniciar el Servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## Autenticación

Todas las rutas protegidas requieren un token JWT en el header:
```
Authorization: Bearer <token>
```

## Endpoints

### Autenticación (`/api/auth`)

#### Registrar Usuario
```http
POST /api/auth/register
Content-Type: application/json

{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@empresa.com",
  "password": "Password123",
  "departamento": "IT",
  "puesto": "Desarrollador",
  "telefono": "+34 123 456 789"
}
```

#### Iniciar Sesión
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "juan@empresa.com",
  "password": "Password123"
}
```

#### Obtener Usuario Actual
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Usuarios (`/api/users`)

#### Listar Usuarios (Admin/RRHH)
```http
GET /api/users?page=1&limit=10&departamento=IT
Authorization: Bearer <admin_token>
```

#### Obtener Usuario por ID
```http
GET /api/users/:id
Authorization: Bearer <token>
```

#### Actualizar Usuario
```http
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "telefono": "+34 987 654 321",
  "puesto": "Senior Developer"
}
```

#### Cambiar Contraseña
```http
PUT /api/users/:id/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "Password123",
  "newPassword": "NewPassword456"
}
```

### Horarios (`/api/schedules`)

#### Listar Horarios
```http
GET /api/schedules?empleado=<user_id>&fechaInicio=2024-01-01&fechaFin=2024-01-31
Authorization: Bearer <token>
```

#### Crear Horario (Admin/RRHH)
```http
POST /api/schedules
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "empleado": "user_id",
  "fecha": "2024-01-15",
  "horaEntrada": "09:00",
  "horaSalida": "17:00",
  "tipoJornada": "completa",
  "observaciones": "Horario estándar"
}
```

#### Registrar Entrada
```http
POST /api/schedules/:id/checkin
Authorization: Bearer <token>
```

#### Registrar Salida
```http
POST /api/schedules/:id/checkout
Authorization: Bearer <token>
```

### Contratos (`/api/contracts`)

#### Crear Contrato (Admin/RRHH)
```http
POST /api/contracts
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "empleado": "user_id",
  "tipoContrato": "indefinido",
  "fechaInicio": "2024-01-01",
  "salarioBase": 45000,
  "moneda": "EUR",
  "horasSemanales": 40,
  "diasVacaciones": 22,
  "departamento": "IT",
  "puesto": "Desarrollador Full Stack",
  "supervisor": "supervisor_id"
}
```

#### Activar Contrato
```http
POST /api/contracts/:id/activate
Authorization: Bearer <admin_token>
```

### Vacaciones (`/api/vacations`)

#### Solicitar Vacaciones
```http
POST /api/vacations
Authorization: Bearer <token>
Content-Type: application/json

{
  "fechaInicio": "2024-07-15",
  "fechaFin": "2024-07-29",
  "tipoVacacion": "vacaciones",
  "motivo": "Vacaciones de verano",
  "reemplazo": "replacement_user_id",
  "instruccionesReemplazo": "Revisar emails diarios y atender reuniones del proyecto X"
}
```

#### Aprobar Solicitud (Admin/RRHH)
```http
POST /api/vacations/:id/approve
Authorization: Bearer <admin_token>
```

#### Rechazar Solicitud (Admin/RRHH)
```http
POST /api/vacations/:id/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "motivoRechazo": "Conflicto con fechas críticas del proyecto"
}
```

#### Ver Balance de Vacaciones
```http
GET /api/vacations/employee/:id/balance?year=2024
Authorization: Bearer <token>
```

## Roles de Usuario

### Empleado (`empleado`)
- Ver y actualizar su propio perfil
- Ver sus horarios, contratos y vacaciones
- Registrar entrada/salida en horarios
- Solicitar vacaciones
- Cancelar sus propias solicitudes de vacaciones

### Administrador (`admin`)
- Acceso completo a todos los recursos
- Gestionar usuarios, horarios, contratos y vacaciones
- Aprobar/rechazar solicitudes

### Recursos Humanos (`rrhh`)
- Similar a admin pero enfocado en gestión de personal
- Gestionar horarios, contratos y vacaciones
- Aprobar/rechazar solicitudes

## Códigos de Estado HTTP

- `200`: Éxito
- `201`: Recurso creado exitosamente
- `400`: Datos de entrada inválidos
- `401`: No autenticado / Token inválido
- `403`: Acceso denegado / Permisos insuficientes
- `404`: Recurso no encontrado
- `409`: Conflicto (ej: email duplicado, fechas solapadas)
- `500`: Error interno del servidor

## Tipos de Datos

### Departamentos
- `IT`, `RRHH`, `Ventas`, `Marketing`, `Contabilidad`, `Operaciones`, `Otro`

### Estados de Horarios
- `programado`, `en_curso`, `completado`, `ausente`, `tardanza`

### Tipos de Contrato
- `indefinido`, `temporal`, `practicas`, `freelance`, `consultoria`

### Estados de Contrato
- `borrador`, `activo`, `finalizado`, `cancelado`, `renovado`

### Tipos de Vacación
- `vacaciones`, `permiso_personal`, `licencia_medica`, `permiso_matrimonio`, `permiso_maternidad`, `permiso_paternidad`, `licencia_sin_goce`, `otro`

### Estados de Vacación
- `pendiente`, `aprobada`, `rechazada`, `cancelada`, `en_curso`, `completada`

## Ejemplos de Respuesta

### Usuario
```json
{
  "user": {
    "_id": "user_id",
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@empresa.com",
    "departamento": "IT",
    "puesto": "Desarrollador",
    "role": "empleado",
    "activo": true,
    "fechaIngreso": "2024-01-01T00:00:00.000Z",
    "nombreCompleto": "Juan Pérez"
  }
}
```

### Horario
```json
{
  "schedule": {
    "_id": "schedule_id",
    "empleado": {
      "_id": "user_id",
      "nombre": "Juan",
      "apellido": "Pérez"
    },
    "fecha": "2024-01-15T00:00:00.000Z",
    "horaEntrada": "09:00",
    "horaSalida": "17:00",
    "horaEntradaReal": "09:05",
    "horaSalidaReal": null,
    "tipoJornada": "completa",
    "estado": "en_curso",
    "horasExtras": 0,
    "horasPlanificadas": 8,
    "horasReales": 0
  }
}
```

### Contrato
```json
{
  "contract": {
    "_id": "contract_id",
    "empleado": {
      "_id": "user_id",
      "nombre": "Juan",
      "apellido": "Pérez"
    },
    "numeroContrato": "CONT-2024-0001",
    "tipoContrato": "indefinido",
    "fechaInicio": "2024-01-01T00:00:00.000Z",
    "salarioBase": 45000,
    "moneda": "EUR",
    "horasSemanales": 40,
    "diasVacaciones": 22,
    "estado": "activo",
    "vigente": true
  }
}
```

### Vacación
```json
{
  "vacation": {
    "_id": "vacation_id",
    "empleado": {
      "_id": "user_id",
      "nombre": "Juan",
      "apellido": "Pérez"
    },
    "fechaInicio": "2024-07-15T00:00:00.000Z",
    "fechaFin": "2024-07-29T00:00:00.000Z",
    "tipoVacacion": "vacaciones",
    "estado": "pendiente",
    "motivo": "Vacaciones de verano",
    "diasTotales": 15,
    "diasHabiles": 11,
    "diasSolicitados": 15,
    "vigente": false
  }
}
```
# Server-Horarios-App

Backend de aplicación para gestión de horarios, contratos y vacaciones del equipo de una empresa, desarrollado con Node.js, Express y autenticación JWT.

## 🚀 Características

- **Autenticación JWT**: Sistema seguro de tokens con roles de usuario
- **Gestión de Usuarios**: CRUD completo con roles (empleado, admin, rrhh)
- **Sistema de Horarios**: Gestión de horarios de trabajo con registro de entrada/salida
- **Gestión de Contratos**: Administración completa de contratos laborales
- **Sistema de Vacaciones**: Solicitudes, aprobaciones y seguimiento de vacaciones
- **Seguridad**: Rate limiting, CORS, validación de datos y headers seguros
- **Base de Datos**: MongoDB con Mongoose ODM

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- MongoDB (v4.0 o superior)
- npm o yarn

## ⚡ Instalación Rápida

```bash
# Clonar el repositorio
git clone https://github.com/AlejandroR2122/Server-Horarios-App.git
cd Server-Horarios-App

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu configuración

# Iniciar el servidor
npm start
```

## 🔧 Configuración

Crear archivo `.env` con las siguientes variables:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/horarios_app
JWT_SECRET=your_very_secure_jwt_secret_key_here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
```

## 🎯 Scripts Disponibles

```bash
# Iniciar en producción
npm start

# Iniciar en desarrollo (con nodemon)
npm run dev

# Ejecutar pruebas de API
./test-api.sh
```

## 📚 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Usuario actual
- `POST /api/auth/refresh` - Refrescar token
- `POST /api/auth/logout` - Cerrar sesión

### Usuarios
- `GET /api/users` - Listar usuarios (admin/rrhh)
- `GET /api/users/:id` - Obtener usuario
- `PUT /api/users/:id` - Actualizar usuario
- `PUT /api/users/:id/password` - Cambiar contraseña
- `DELETE /api/users/:id` - Desactivar usuario

### Horarios
- `GET /api/schedules` - Listar horarios
- `POST /api/schedules` - Crear horario (admin/rrhh)
- `PUT /api/schedules/:id` - Actualizar horario
- `POST /api/schedules/:id/checkin` - Registrar entrada
- `POST /api/schedules/:id/checkout` - Registrar salida
- `DELETE /api/schedules/:id` - Eliminar horario

### Contratos
- `GET /api/contracts` - Listar contratos
- `POST /api/contracts` - Crear contrato (admin/rrhh)
- `GET /api/contracts/:id` - Obtener contrato
- `PUT /api/contracts/:id` - Actualizar contrato
- `POST /api/contracts/:id/activate` - Activar contrato
- `POST /api/contracts/:id/finalize` - Finalizar contrato

### Vacaciones
- `GET /api/vacations` - Listar vacaciones
- `POST /api/vacations` - Solicitar vacaciones
- `PUT /api/vacations/:id` - Actualizar solicitud
- `POST /api/vacations/:id/approve` - Aprobar (admin/rrhh)
- `POST /api/vacations/:id/reject` - Rechazar (admin/rrhh)
- `POST /api/vacations/:id/cancel` - Cancelar
- `GET /api/vacations/employee/:id/balance` - Balance de vacaciones

## 👥 Roles de Usuario

### Empleado (`empleado`)
- Ver y actualizar perfil propio
- Ver horarios, contratos y vacaciones propias
- Registrar entrada/salida
- Solicitar vacaciones

### Administrador (`admin`)
- Acceso completo a todos los recursos
- Gestionar usuarios, horarios, contratos
- Aprobar/rechazar vacaciones

### Recursos Humanos (`rrhh`)
- Gestión de personal
- Administrar horarios y contratos
- Gestión de vacaciones

## 🛡️ Seguridad

- **JWT Authentication**: Tokens seguros con expiración
- **Password Hashing**: bcryptjs con salt de 12 rounds
- **Rate Limiting**: 100 peticiones por 15 minutos por IP
- **Input Validation**: express-validator en todos los endpoints
- **CORS**: Configurado para dominios específicos
- **Security Headers**: helmet.js para headers seguros

## 🗄️ Modelos de Datos

### Usuario
- Información personal y profesional
- Roles y permisos
- Fecha de ingreso y estado activo

### Horario
- Horarios planificados vs reales
- Estados de trabajo (programado, en_curso, completado)
- Registro de horas extras

### Contrato
- Diferentes tipos de contrato
- Salarios y beneficios
- Estados y fechas de vigencia

### Vacación
- Solicitudes con flujo de aprobación
- Diferentes tipos de permisos
- Cálculo automático de días hábiles

## 🧪 Pruebas

Ejecutar el script de pruebas incluido:

```bash
# Asegúrate de que el servidor esté corriendo
npm start &

# En otra terminal
./test-api.sh
```

## 📖 Documentación Completa

Ver [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) para documentación detallada de todos los endpoints con ejemplos de uso.

## 🚀 Despliegue

### Variables de Entorno de Producción
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/horarios_app
JWT_SECRET=super_secure_secret_key_for_production
PORT=3000
```

### Docker (Opcional)
```bash
# Crear imagen
docker build -t horarios-app .

# Ejecutar contenedor
docker run -p 3000:3000 --env-file .env horarios-app
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear branch de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

**AlejandroR2122**

- GitHub: [@AlejandroR2122](https://github.com/AlejandroR2122)

## 🙏 Agradecimientos

- Express.js por el framework web
- MongoDB por la base de datos
- JWT para autenticación segura
- Toda la comunidad de Node.js

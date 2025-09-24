#!/bin/bash

# Script de pruebas para el API Backend Horarios App
# Asegúrate de que el servidor esté corriendo en http://localhost:3000

BASE_URL="http://localhost:3000/api"
TOKEN=""

echo "🧪 Iniciando pruebas del API Backend Horarios App"
echo "================================================="

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_test() {
    echo -e "${BLUE}🔍 Test: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Función para hacer peticiones HTTP
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$TOKEN" ]; then
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $TOKEN" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $TOKEN"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint"
        fi
    fi
}

# Test 1: Health Check
print_test "Health Check"
response=$(make_request GET "/health")
if echo "$response" | grep -q "OK"; then
    print_success "Health check passed"
else
    print_error "Health check failed"
    echo "Response: $response"
fi

echo ""

# Test 2: Registro de usuario
print_test "Registro de usuario"
register_data='{
  "nombre": "Test",
  "apellido": "User",
  "email": "test@empresa.com",
  "password": "Password123",
  "departamento": "IT",
  "puesto": "Tester",
  "telefono": "+34 123 456 789"
}'

response=$(make_request POST "/auth/register" "$register_data")
if echo "$response" | grep -q "token"; then
    print_success "Registro exitoso"
    # Extraer token para tests siguientes
    TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Token obtenido: ${TOKEN:0:20}..."
else
    print_error "Registro falló"
    echo "Response: $response"
fi

echo ""

# Test 3: Login
print_test "Login de usuario"
login_data='{
  "email": "test@empresa.com",
  "password": "Password123"
}'

response=$(make_request POST "/auth/login" "$login_data")
if echo "$response" | grep -q "token"; then
    print_success "Login exitoso"
    # Actualizar token
    TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    print_error "Login falló"
    echo "Response: $response"
fi

echo ""

# Test 4: Obtener usuario actual
print_test "Obtener usuario actual"
response=$(make_request GET "/auth/me")
if echo "$response" | grep -q "test@empresa.com"; then
    print_success "Usuario actual obtenido correctamente"
else
    print_error "No se pudo obtener usuario actual"
    echo "Response: $response"
fi

echo ""

# Test 5: Crear horario (requiere admin/rrhh, debería fallar)
print_test "Crear horario (debería fallar por permisos)"
user_id=$(echo "$response" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
schedule_data='{
  "empleado": "'$user_id'",
  "fecha": "2024-01-15",
  "horaEntrada": "09:00",
  "horaSalida": "17:00",
  "tipoJornada": "completa"
}'

response=$(make_request POST "/schedules" "$schedule_data")
if echo "$response" | grep -q "Acceso denegado\|Se requiere uno de los siguientes roles"; then
    print_success "Control de permisos funcionando correctamente"
else
    print_error "Control de permisos no funcionó como esperado"
    echo "Response: $response"
fi

echo ""

# Test 6: Solicitar vacaciones
print_test "Solicitar vacaciones"
vacation_data='{
  "fechaInicio": "2024-07-15",
  "fechaFin": "2024-07-19",
  "tipoVacacion": "vacaciones",
  "motivo": "Vacaciones de prueba"
}'

response=$(make_request POST "/vacations" "$vacation_data")
if echo "$response" | grep -q "Solicitud de vacación creada exitosamente\|vacation"; then
    print_success "Solicitud de vacaciones creada"
    vacation_id=$(echo "$response" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "ID de vacación: $vacation_id"
else
    print_error "No se pudo crear solicitud de vacaciones"
    echo "Response: $response"
fi

echo ""

# Test 7: Listar vacaciones del usuario
print_test "Listar vacaciones del usuario"
response=$(make_request GET "/vacations")
if echo "$response" | grep -q "vacations"; then
    print_success "Lista de vacaciones obtenida"
else
    print_error "No se pudo obtener lista de vacaciones"
    echo "Response: $response"
fi

echo ""

# Test 8: Endpoint no existente (404)
print_test "Endpoint no existente (debería devolver 404)"
response=$(make_request GET "/nonexistent")
if echo "$response" | grep -q "no encontrado\|no existe"; then
    print_success "Manejo de 404 funcionando correctamente"
else
    print_error "Manejo de 404 no funcionó"
    echo "Response: $response"
fi

echo ""
echo "================================================="
echo "🏁 Pruebas completadas"
echo ""
echo "💡 Para más pruebas detalladas:"
echo "   - Consulta API_DOCUMENTATION.md"
echo "   - Usa herramientas como Postman o Insomnia"
echo "   - Revisa los logs del servidor para más detalles"
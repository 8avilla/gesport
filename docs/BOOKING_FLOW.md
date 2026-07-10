# BOOKING_FLOW.md

# CanchaLibre Booking Flow

## Objetivo

El proceso de reserva debe sentirse:

- rápido
- intuitivo
- seguro
- sin fricción

El usuario debe poder reservar una cancha en menos de 60 segundos.

Inspiración

- Airbnb
- Playtomic
- Booking

---

# Principios

Reducir clics.

Nunca pedir información innecesaria.

Nunca hacer perder el contexto.

Siempre mostrar el resumen de la reserva.

---

# Flujo completo

Buscar cancha

↓

Ver detalle

↓

Seleccionar fecha

↓

Seleccionar horario

↓

Confirmar reserva

↓

Seleccionar método de pago

↓

Pago exitoso

↓

Reserva confirmada

---

# Paso 1

## Buscar cancha

El usuario puede buscar por

- nombre
- ciudad
- complejo
- deporte

Debe visualizar:

Imagen

Precio

Disponibilidad

Calificación

Amenidades

Nunca mostrar únicamente una lista de texto.

---

# Paso 2

## Detalle

Debe mostrar

Imagen grande

Galería

Descripción

Amenidades

Ubicación

Calificación

Calendario

Horarios

Sidebar

---

# Paso 3

## Seleccionar fecha

Desktop

Calendario horizontal.

Mostrar

Hoy

Próximos 14 días

No utilizar DatePicker como única opción.

---

# Paso 4

## Seleccionar horario

Separar por

Mañana

Tarde

Noche

Estados

Disponible

Seleccionado

Ocupado

Mantenimiento

El horario seleccionado debe ser muy evidente.

---

# Paso 5

## Confirmar

Mostrar

Cancha

Complejo

Fecha

Horario

Duración

Precio

Abono

Saldo restante

Nunca ocultar el precio.

---

# Paso 6

## Datos del usuario

Solicitar únicamente

Nombre

Teléfono

Correo (si no existe)

No pedir información innecesaria.

---

# Paso 7

## Pago

Métodos

PSE

Nequi

Tarjeta

Bold

Otros

Siempre mostrar

Pago seguro

Datos protegidos

Confirmación inmediata

---

# Paso 8

## Confirmación

Mostrar

Animación de éxito

Código de reserva

Botón

Agregar al calendario

Compartir

Ver reserva

---

# Sidebar

Desktop

Siempre visible.

Debe contener

Cancha

Fecha

Horario

Precio

Abono

Saldo

Botón principal

Nunca desaparecer.

---

# Wizard

Todos los procesos utilizan Wizard.

Ejemplo

1 Selecciona horario

2 Confirma

3 Paga

Mostrar siempre el progreso.

---

# Estados

Reserva disponible

Reserva pendiente

Pago pendiente

Reserva confirmada

Reserva cancelada

Reserva vencida

---

# Cancelaciones

Mostrar claramente

Hasta cuándo puede cancelar.

Monto a devolver.

Tiempo restante.

---

# Errores

Si un horario ya fue reservado

Mostrar mensaje claro.

Sugerir horarios alternativos.

Nunca dejar al usuario sin opciones.

---

# UX Rules

Siempre recordar:

El usuario reserva una experiencia.

No una tabla de horarios.

Las fotografías, el precio y el resumen deben estar visibles durante todo el flujo.
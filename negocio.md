# Cancha Libre — Arquitectura Operativa y Funcional

Este documento describe la arquitectura operativa y funcional de Cancha Libre. Explica detalladamente cómo
interactúan los administradores, empleados de turno y clientes finales con la plataforma para erradicar las
fugas de dinero, automatizar las reservas y blindar los cierres de caja.

## 1. Arquitectura General del Ecosistema

Cancha Libre opera como un ecosistema híbrido en la nube compuesto por tres módulos sincronizados en tiempo real:

- **Panel del Administrador / Dueño (Web & Móvil)**: Control total de métricas, auditorías de caja, gestión
  de inventarios y visualización de reportes desde cualquier lugar.
- **Terminal de Recepción / POS (Tablet o PC)**: Interfaz ágil para el empleado de turno. Permite asignar
  canchas en segundos, abrir cuentas de consumo a los jugadores y facturar barras/cafeterías.
- **Portal Público de Reservas (Link para Clientes)**: Enlace personalizado para WhatsApp e Instagram
  donde los usuarios consultan la disponibilidad real y abonan dinero de forma autónoma.

## 2. Flujo del Módulo 1: Agenda Digital y Reservas Autónomas

Este módulo elimina la dependencia telefónica del administrador y el riesgo de cruce de horarios
(overbooking) mediante un proceso de automatización rígido.

**El Flujo del Cliente Final:**

1. El usuario hace clic en el link del complejo deportivo (ej: sportarena.com/aremagol) desde su
   WhatsApp o Instagram.
2. Selecciona el tipo de escenario (Fútbol 5, Fútbol 8, Pádel) y visualiza las horas disponibles (los
   turnos ya reservados aparecen bloqueados de forma inmediata).
3. Selecciona la hora deseada e ingresa sus datos básicos. Para congelar el turno, el sistema le
   solicita un Abono Mínimo Obligatorio (ej: 50% de la tarifa vía pasarela integrada o cargando
   comprobante de Nequi/Daviplata).
4. El sistema procesa el pago, bloquea la hora en la cuadrícula de la recepción de forma automática
   y le envía un comprobante de confirmación por WhatsApp al cliente, notificando en paralelo a la
   recepción.

## 3. Flujo del Módulo 2: Punto de Venta (POS) Integrado a Canchas

Para detener las pérdidas en la venta de productos e implementación, Cancha Libre utiliza un modelo de
cuentas de consumo vinculadas a la reserva activa.

| Fase Operativa | Acción en el Sistema (Empleado de Turno) | Efecto de Control Administrativo (Dueño) |
| --- | --- | --- |
| Inicio de Turno | El sistema solicita ingresar la base de dinero en efectivo para habilitar las ventas. | Registra la hora exacta y el operario responsable de la caja. |
| Llegada del Grupo | El recepcionista marca "Grupo en Cancha" en el calendario digital. Se activa el contador de tiempo de iluminación. | Evita partidos fantasmas. Si las luces se encienden, el sistema exige un partido asociado. |
| Consumo en Barra | Los jugadores piden bebidas. El operario selecciona los productos en el POS y los asigna al botón "Cancha 3". | El inventario de la cafetería se descuenta en tiempo real. No hay producto vendido sin registrar. |
| Cierre de Cuenta | Al finalizar la hora, el operario da clic en "Cobrar Cancha 3". El sistema liquida: Tarifa Restante + Consumos de Barra + Alquileres. | Evita cobros manuales erróneos. Muestra el saldo total exacto que debe ingresar en caja. |

## 4. Flujo del Módulo 3: Cierre de Caja Blindado y Automatizado

El proceso de cuadre nocturno de Cancha Libre está diseñado para erradicar las auditorías manuales y las
alteraciones de los empleados en la entrega de turnos.

**Algoritmo de Conciliación Automática:**

Al finalizar la jornada laboral, el empleado encargado hace clic en el botón "Solicitar Cierre de Turno".
El sistema procesa la información recopilada en el día de la siguiente forma:

- **Suma de Canchas**: Calcula el total de horas jugadas multiplicadas por sus respectivas tarifas
  horarias configuradas.
- **Suma de Barra**: Cruza los productos descontados del almacén con los ingresos del Punto de Venta.
- **Desglose de Métodos de Pago**: Clasifica el dinero exacto que debe haber en Efectivo,
  transferencias electrónicas (Nequi/Daviplata) y datáfono.

**Control Anti-Fraude:**

El sistema genera un reporte a ciegas: el empleado debe ingresar el dinero físico que cuenta en
efectivo antes de ver el reporte del software. Si hay un descuadre, el sistema envía una alerta inmediata
por correo y WhatsApp directamente al dueño indicando el faltante exacto, bloqueando la caja para
modificaciones posteriores.

## 5. Resumen Ejecutivo de Beneficios Operativos

- **Cero Cruces de Horario**: El motor de reservas valida milisegundo a milisegundo la disponibilidad,
  imposibilitando el Overbooking.
- **Reducción de No-Shows en un 95%**: Al exigir abonos previos, las cancelaciones imprevistas ya no
  generan pérdidas financieras, protegiendo el valor de las horas pico.
- **Control Total del Almacén**: Alertas automáticas de inventario bajo para cervezas, bebidas hidratantes y
  accesorios de pádel/fútbol, evitando desabastecimiento.

## 6. Especificación Técnica Complementaria

Esta sección traduce el resumen ejecutivo anterior en reglas concretas que el equipo de desarrollo puede
implementar sin ambigüedad.

### 6.1 Máquina de Estados de la Reserva

Toda reserva debe transitar por un conjunto cerrado de estados; ninguna transición fuera de este mapa es válida:

| Estado | Significado | Transiciones permitidas |
| --- | --- | --- |
| `pendiente_pago` | Turno seleccionado, esperando confirmación del abono. Expira si no se paga en N minutos (ej: 15 min) y libera el cupo. | → `confirmada`, → `expirada` |
| `confirmada` | Abono recibido y validado. El cupo queda bloqueado en la agenda. | → `en_curso`, → `cancelada`, → `no_show` |
| `en_curso` | Recepción marcó "Grupo en Cancha". | → `finalizada` |
| `finalizada` | Cuenta cobrada y cerrada (tarifa + consumos). | (estado terminal) |
| `cancelada` | Cancelada por el cliente o el administrador dentro de la política vigente. | (estado terminal) |
| `no_show` | Hora llegada, el grupo nunca se presentó ni canceló. | (estado terminal) |
| `expirada` | El abono no se completó dentro del tiempo límite. | (estado terminal) |

### 6.2 Política de Cancelación y Reembolso

- **Cancelación con antelación** (ej: > 24 horas antes del turno): reembolso completo del abono o
  crédito interno a favor del cliente, configurable por complejo deportivo.
- **Cancelación tardía** (ej: < 24 horas): el abono no es reembolsable; el cupo se libera para reventa
  inmediata en el portal público.
- **No-show** (el cliente nunca llega ni cancela): el abono se retiene íntegramente y la reserva pasa a
  `no_show` automáticamente al cierre de la ventana horaria.
- **Comprobantes de Nequi/Daviplata cargados manualmente**: mientras no exista validación automática vía
  API bancaria, la reserva permanece en `pendiente_pago` y notifica a recepción para aprobación manual con
  un SLA máximo (ej: 10 minutos) antes de liberar el cupo; el cliente ve un estado "en verificación", no
  "confirmada".

### 6.3 Control de Concurrencia (Anti-Overbooking)

Para sostener la promesa de "cero cruces de horario" ante dos clientes reservando el mismo turno en
simultáneo:

- Cada combinación (cancha, fecha, franja horaria) es un recurso único con una restricción de unicidad a
  nivel de base de datos (constraint `UNIQUE`), no solo una validación en la capa de aplicación.
- La creación de la reserva y el descuento del cupo ocurren dentro de una única transacción atómica; si el
  `INSERT` viola la restricción de unicidad, la transacción falla y el segundo cliente recibe "cupo no
  disponible" antes de llegar a la pantalla de pago.
- El estado `pendiente_pago` también bloquea el cupo (no solo `confirmada`), para que dos personas no
  entren simultáneamente al flujo de pago del mismo turno; el bloqueo se libera automáticamente si expira
  sin pago.

### 6.4 Roles y Permisos

| Acción | Empleado de Turno | Administrador / Dueño |
| --- | --- | --- |
| Crear/asignar reserva manual | Sí | Sí |
| Cancelar reserva confirmada | No (solo escalar) | Sí |
| Modificar tarifas y precios de barra | No | Sí |
| Cerrar turno de caja | Sí (solicita el cierre) | — |
| Aprobar/editar un cierre de caja ya bloqueado | No | Sí, con registro de auditoría |
| Ver reportes históricos y métricas globales | No | Sí |
| Ajustar inventario (entradas de stock) | No | Sí |

Ninguna acción de "Solo Administrador" debe estar disponible en la terminal de recepción, ni siquiera
oculta en el frontend: la restricción se valida también en el backend por rol.

### 6.5 Resolución de Descuadres de Caja

El bloqueo automático de la caja ante un descuadre (sección 4) evita que el empleado altere el reporte,
pero necesita una vía de corrección para errores humanos genuinos (mal conteo, cambio no registrado, etc.):

1. El cierre bloqueado queda en estado `en_disputa`, visible solo para el administrador.
2. El administrador puede reabrir el cierre e ingresar un ajuste con motivo obligatorio (texto libre) y su
   propia autenticación.
3. Todo ajuste queda en un log de auditoría inmutable: valor original, valor corregido, motivo, usuario y
   timestamp. El log nunca se sobrescribe ni se borra.
4. Un descuadre solo se marca como "resuelto" cuando el administrador cierra la disputa explícitamente;
   hasta entonces permanece visible en el panel como pendiente.

---
Cancha Libre © 2026 — Confidencial Operativo

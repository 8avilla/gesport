# COMPONENTS.md

# Component Library

Todos los componentes son reutilizables.

Nunca crear HTML repetido.

---

# Hero

Component

<Hero />

Contiene

Imagen

Título

Subtítulo

CTA

Buscador

Filtros

Altura

480px

Desktop

Radius inferior

32px

Nunca usar héroes vacíos.

---

# Navbar

<Navbar />

Altura

80px

Contenido

Logo

Links

Acciones

Usuario

Sticky

Siempre visible.

---

# Search Bar

<SearchBar />

Altura

64px

Radius

20px

Contenido

Ubicación

Deporte

Fecha

Hora

Botón Buscar

Nunca dividirlo en múltiples inputs separados en Desktop.

---

# Button

<Button />

Variantes

Primary

Secondary

Ghost

Outline

Danger

Success

Loading

Icon

Height

52px

Radius

16px

Hover

Scale 1.02

Shadow

Medium

---

# Card

<Card />

Background

White

Radius

20px

Padding

24px

Shadow

Medium

Hover

TranslateY(-4px)

---

# Court Card

<CourtCard />

Debe incluir

Imagen

Rating

Reseñas

Nombre

Complejo

Ubicación

Amenidades

Precio

Horarios rápidos

CTA

Estado

Nunca eliminar la fotografía.

---

# Badge

<Badge />

Tipos

Disponible

Nuevo

Oferta

Premium

Últimos horarios

Muy demandada

Radius

999px

---

# Chip

<Chip />

Usado para filtros.

Ejemplo

⚽ Fútbol

🎾 Pádel

🏀 Basket

Seleccionado

Verde

---

# Avatar

<Avatar />

Circular.

Tamaños

32

40

48

64

---

# Calendar

<Calendar />

Horizontal.

Cada día es una Card.

Hoy

Verde

Seleccionado

Azul

Disponible

Blanco

---

# Time Slot

<TimeSlot />

Altura

48px

Estados

Disponible

Seleccionado

Ocupado

Mantenimiento

Hover

Elevación ligera

---

# Reservation Sidebar

<ReservationSidebar />

Sticky.

Contenido

Cancha

Fecha

Horario

Precio

Método Pago

Botón

Seguridad

Siempre visible.

---

# Wizard

<Wizard />

Horizontal.

Desktop

○────○────○

Cada paso muestra

Número

Título

Estado

Nunca ocultar el progreso.

---

# Input

<Input />

Altura

52px

Icono

Opcional

Label

Siempre

Helper Text

Opcional

Error

Debajo

---

# Select

<Select />

Mismo estilo que Input.

---

# Checkbox

<Checkbox />

Radius

6px

Animación

Check

---

# Radio

<Radio />

Circular.

---

# Switch

<Switch />

Color primario.

---

# Modal

<Modal />

Radius

24px

Padding

32px

Overlay

Oscuro

---

# Drawer

<Drawer />

Desktop

Lateral

Mobile

Bottom Sheet

---

# Toast

<Toast />

Posición

Top Right

Duración

4 segundos

Tipos

Success

Warning

Error

Info

---

# Alert

<Alert />

Background suave.

Icono obligatorio.

---

# Skeleton

<Skeleton />

Nunca usar Spinner.

Tipos

Card

Input

Text

Avatar

Hero

---

# Empty State

<EmptyState />

Debe contener

Ilustración

Título

Descripción

CTA

---

# Stats Card

<StatsCard />

Icono

Número

Descripción

Usado para Dashboard.

---

# KPI Card

<KPICard />

Número grande.

Variación

%

Mini gráfica

---

# Feature Card

<FeatureCard />

Icono

Título

Descripción

Utilizado en Home.

---

# Payment Card

<PaymentCard />

Método

Logo

Estado

Seleccionado

Hover

---

# Map Card

<MapCard />

Mapa

Botón

Dirección

---

# Gallery

<Gallery />

Desktop

Imagen principal

Miniaturas

Lightbox

---

# Tabs

<Tabs />

Subrayado verde.

Animación

200ms

---

# Accordion

<Accordion />

Solo una sección abierta.

---

# Timeline

<Timeline />

Reservas

Eventos

Historial

---

# Table

Evitar.

Solo usar cuando sea estrictamente necesario.

Preferir

Cards

Listas

Timeline

---

# Component Rules

Todos los componentes deben:

✔ Tener estados

Hover

Focus

Loading

Disabled

Error

Success

✔ Tener variantes

✔ Ser Responsive

✔ Tener animaciones

✔ Ser accesibles

✔ Tener props reutilizables

Nunca crear componentes específicos para una sola pantalla.

Si un componente puede reutilizarse, debe agregarse aquí antes de implementarse.

---

# Golden Rule

Si un componente no mejora la experiencia del usuario o rompe la consistencia visual del sistema, no debe incorporarse.

Cada nuevo componente debe sentirse como si hubiera sido diseñado por el mismo equipo que creó toda la plataforma.
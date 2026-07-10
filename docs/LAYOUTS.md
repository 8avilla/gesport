# LAYOUTS.md

# CanchaLibre Layout System

## Filosofía

Todas las pantallas siguen un mismo patrón de composición.

No se diseñan pantallas independientes.

Todo debe sentirse parte del mismo ecosistema.

Inspiración

- Airbnb
- Stripe Dashboard
- Playtomic
- Linear

---

# Contenedor principal

Desktop XL

Max Width

1440px

Desktop

1280px

Tablet

100%

Mobile

100%

Todo el contenido debe centrarse horizontalmente.

Nunca pegar contenido al borde del navegador.

---

# Padding Global

Desktop

32px

Laptop

24px

Tablet

20px

Mobile

16px

---

# Grid

Desktop

12 columnas

Gap

24px

Tablet

8 columnas

Gap

20px

Mobile

4 columnas

Gap

16px

Nunca usar posiciones absolutas para construir layouts.

---

# Espaciado Vertical

Hero → Contenido

48px

Entre secciones

64px

Entre Cards

24px

Entre Componentes

16px

Entre Inputs

16px

---

# Navbar

Altura

80px

Siempre Sticky

Contenido

Logo

Menú

Usuario

Nunca ocultar el Navbar.

---

# Hero

Desktop

Altura

480px

Contenido

Título

Subtítulo

Buscador

Filtros

CTA

Debe ocupar todo el ancho.

Nunca crear Hero pequeños.

---

# Página de búsqueda

Estructura

Navbar

↓

Hero

↓

Beneficios

↓

Filtros

↓

Resultados

↓

Mapa (Opcional)

↓

Footer

---

# Página Detalle

Desktop

┌──────────────────────────────┬───────────────┐
│                              │               │
│ Imagen                       │ Información   │
│                              │               │
├──────────────────────────────┤               │
│                              │               │
│ Calendario                   │ Sidebar       │
│                              │ Reserva       │
│ Horarios                     │               │
│                              │               │
├──────────────────────────────┤               │
│ Características              │               │
└──────────────────────────────┴───────────────┘

Sidebar fija.

---

# Página Reserva

Desktop

┌──────────────────────────────┬───────────────┐
│                              │               │
│ Wizard                       │ Resumen       │
│                              │               │
│ Datos                        │ Precio        │
│                              │               │
│ Pago                         │ Pago          │
│                              │               │
└──────────────────────────────┴───────────────┘

Nunca ocultar el resumen.

---

# Sidebar

Desktop

360px

Sticky

Top

100px

Debe permanecer visible durante toda la reserva.

Contenido

Resumen

Precio

Botón

Pago

Seguridad

---

# Formularios

Máximo

2 columnas

Nunca más.

Mobile

1 columna.

---

# Cards

Gap

24px

Desktop

3-4 Cards por fila

Laptop

3

Tablet

2

Mobile

1

Nunca dejar grandes espacios vacíos.

---

# Calendario

Desktop

Horizontal

Scroll

Tablet

Horizontal

Mobile

Horizontal

Nunca usar DatePicker como única opción.

---

# Horarios

Siempre Grid.

Desktop

3 columnas

Mañana

Tarde

Noche

Tablet

2 columnas

Mobile

1 columna

---

# Dashboard Administrativo

Evitar tablas.

Preferir

Cards

Widgets

Gráficas

Timeline

KPIs

Listas

---

# Footer

Padding

64px

Background

Dark

Contenido

Logo

Links

Redes

Contacto

---

# Empty State

Debe ocupar el espacio disponible.

Siempre centrado.

Ilustración

Título

Descripción

CTA

---

# Loading

Skeleton.

Nunca Spinner centrado.

---

# Responsive

Desktop

≥1440

Laptop

1280

Tablet

1024

Mobile

768

Small

390

---

# Regla

Toda pantalla debe respetar exactamente la misma estructura de márgenes, paddings y alineaciones.

Nunca inventar layouts nuevos si ya existe uno similar.
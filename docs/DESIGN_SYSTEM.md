# DESIGN_SYSTEM.md

# CanchaLibre Design System

Versión: 1.0

---

# Filosofía

CanchaLibre no es un sistema administrativo.

Es una plataforma premium para reservar canchas deportivas.

Toda la interfaz debe transmitir:

- confianza
- simplicidad
- velocidad
- tecnología
- deporte
- calidad

Inspiraciones:

- Airbnb
- Playtomic
- Booking
- Stripe
- Linear
- Notion

Nunca parecer Bootstrap.

Nunca parecer un ERP.

---

# Design Principles

## Menos es más

Eliminar cualquier elemento que no aporte valor.

---

## El contenido primero

La cancha es el producto.

Las fotografías deben ser protagonistas.

---

## Una sola acción principal

Cada pantalla tiene un único CTA principal.

Nunca competir con varios botones verdes.

---

## Consistencia

Todos los componentes reutilizan los mismos tokens.

Nunca crear variantes innecesarias.

---

# Colors

## Primary

Green 500

HEX

#22C55E

RGB

34 197 94

Uso

- Botón principal
- Links activos
- Switch
- Check
- Step activo

---

Green Hover

#16A34A

---

Green Dark

#15803D

---

## Secondary

Slate

#334155

Uso

Navbar

Sidebar

Footer

---

## Background

Main

#F8FAFC

Cards

#FFFFFF

Section

#F1F5F9

Hero Overlay

rgba(0,0,0,.45)

---

## Text

Primary

#111827

Secondary

#6B7280

Muted

#9CA3AF

White

#FFFFFF

---

## Borders

#E5E7EB

---

## Success

#DCFCE7

Text

#166534

---

## Error

Background

#FEE2E2

Text

#991B1B

---

## Warning

Background

#FEF3C7

Text

#92400E

---

## Info

Background

#DBEAFE

Text

#1E40AF

---

# Radius

Cards

20px

Buttons

16px

Inputs

16px

Modal

24px

Badge

999px

Avatar

999px

Nunca utilizar bordes rectos.

---

# Shadows

## Small

0 2px 10px rgba(15,23,42,.05)

---

## Medium

0 8px 30px rgba(15,23,42,.08)

---

## Large

0 20px 60px rgba(15,23,42,.12)

Nunca sombras negras fuertes.

---

# Typography

Font Family

Inter

Fallback

sans-serif

---

## Hero

56px

700

Line Height

64px

---

## H1

40px

700

---

## H2

32px

700

---

## H3

24px

600

---

## Card Title

22px

600

---

## Body

16px

400

---

## Small

14px

400

---

## Caption

12px

500

---

# Grid

Desktop

12 columnas

Gutter

24px

---

Container

1440px

---

Content Width

1280px

---

Sidebar Width

360px

---

Spacing Scale

4

8

12

16

20

24

32

40

48

64

80

96

Nunca usar medidas aleatorias.

---

# Buttons

## Height

52px

Desktop

48px

Tablet

44px

Mobile

---

Radius

16px

---

Padding

24px

---

Primary

Background

Primary Green

Text

White

---

Secondary

White

Border

Gray 200

---

Ghost

Transparent

---

Icon Button

48x48

Radius

999px

---

Loading

Spinner izquierdo

Texto permanece visible

---

Disabled

Opacity

40%

Cursor

not-allowed

---

# Inputs

Height

52px

Radius

16px

Border

Gray 200

Focus

Green

Placeholder

Gray 400

Padding

20px

Leading Icon

20px

Trailing Icon

Opcional

---

# Cards

Background

White

Radius

20px

Shadow

Medium

Padding

24px

Gap

20px

Hover

translateY(-4px)

Shadow Large

Transition

200ms ease

---

# Hero

Height

480px

Desktop

---

Background

Imagen

Overlay oscuro

---

Contenido

Título

Subtítulo

Buscador

Filtros

---

Nunca usar héroes vacíos.

---

# Navigation

Height

80px

Background

Slate

Logo

Izquierda

Menú

Centro

Usuario

Derecha

Siempre sticky.

---

# Chips

Height

40px

Radius

999px

Padding

16px

Selected

Green

Text White

Unselected

White

Border Gray

---

# Badges

Height

30px

Radius

999px

Padding

12px

Tipos

Disponible

Últimos horarios

Premium

Nuevo

Oferta

Muy demandada

Nunca badges cuadrados.

---

# Calendar

Cada día es una Card.

64x72

Radius

16px

Hoy

Verde

Seleccionado

Azul

Disponible

Blanco

---

# Time Slots

Altura

48px

Radius

12px

Disponible

Verde claro

Seleccionado

Azul

Ocupado

Gris

Mantenimiento

Amarillo

Hover

Elevación ligera

---

# Sidebar

Desktop

Sticky

Top

100px

Width

360px

Contenido

Resumen

Precio

Botón

Pago

Nunca desaparecer.

---

# Icons

Biblioteca

Lucide

Stroke

1.75

Tamaño

20px

Cards

24px

Hero

32px

Nunca mezclar iconos.

---

# Images

Formato

16:9

Desktop

---

Resolución mínima

1600px

---

Estilo

Profesional

Alta iluminación

Jugadores

Noches

Drone

Nunca usar capturas CCTV.

---

# Animations

Default

200ms

ease

Hover

translateY(-4px)

Focus

Border Green

Modal

Fade + Scale

Loading

Skeleton

Nunca usar animaciones lentas.

---

# Responsive

Desktop

1440+

Laptop

1280

Tablet

1024

Mobile

768

Small Mobile

390

---

# Elevation

Level 1

Cards

Level 2

Dropdowns

Level 3

Modals

Level 4

Dialogs críticos

---

# Z-Index

Navbar

100

Dropdown

200

Modal

1000

Toast

2000

---

# CSS Variables

:root {

--primary:#22C55E;

--primary-hover:#16A34A;

--primary-dark:#15803D;

--background:#F8FAFC;

--surface:#FFFFFF;

--border:#E5E7EB;

--text:#111827;

--text-secondary:#6B7280;

--radius-lg:20px;

--radius-md:16px;

--radius-sm:12px;

--shadow-md:0 8px 30px rgba(15,23,42,.08);

}

---

# Component Rules

Nunca usar:

- Bootstrap Cards
- Bootstrap Buttons
- Bootstrap Tables
- Bootstrap Alerts

Todo debe utilizar los componentes propios del proyecto.

---

# Golden Rule

Si una pantalla parece un sistema administrativo,
debe rediseñarse.

Debe parecer una plataforma premium donde el usuario
quiera reservar una cancha en menos de un minuto.

Toda decisión visual debe responder a esta pregunta:

"¿Airbnb o Playtomic diseñarían esto de esta forma?"

Si la respuesta es no, replantear el diseño.
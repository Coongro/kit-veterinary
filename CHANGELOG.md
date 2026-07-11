# @coongro/kit-veterinary

## 0.6.0

### Minor Changes

- c5fc9d1: feat: instalar billing, purchases y vet-pharmacy con el kit

  El dashboard consume `billing.*` y la vista de lotes consume `purchases.*` y
  `vet-pharmacy.*` por RPC. Declararlos como deps los instala transitivamente en el
  tenant, con lo que aparecen sus menus (Caja/Cobros, Salidas/Proveedores, Farmacia) y
  los RPCs dejan de degradar en silencio.

## 0.5.0

### Minor Changes

- 43d2d08: feat(copilot): declarar contexto de negocio veterinario para el Copilot IA

  Agrega `copilot-context.md` (contexto del rubro veterinario) y lo declara en el
  manifest vía `copilotContext: { file }`, para que el Copilot IA lo anexe a su
  prompt base cuando el kit está activo en el tenant.

- 427d8a0: El dashboard ahora calcula los ingresos (KPI "Ingresos Hoy", gráfico de 7 días y "Servicios más frecuentes") desde el módulo de cobros (@coongro/billing) cuando está instalado. Esto incluye las ventas de mostrador —como vacunas aplicadas fuera de una consulta— que antes eran invisibles al sumar solo los servicios de consultas. Si billing no está instalado, el dashboard sigue calculando desde los servicios de consultas (dependencia blanda).
- 0f7a93c: feat: vista unificada de Lotes en Farmacia (medicamentos + vacunas) (COONG-220)

  Nueva vista "Farmacia → Lotes" que compone la `BatchesView` genérica de `@coongro/products`, inyectando los clasificadores de tipo del kit: vacunas (vía `vaccination.catalog.list`) y medicamentos (vía `vet-pharmacy.medications.list`). Una sola tabla de lotes para todo lo loteable, con filtro por tipo y vencimiento, en lugar de la antigua vista siloada bajo Vacunación. Las dependencias hacia vaccination/vet-pharmacy son blandas: si un plugin no está instalado, su tipo simplemente no aparece.

### Patch Changes

- 6faebbb: Declara `@coongro/vaccination` y `@coongro/vademecum` como dependencias. La vista de Lotes ya consumía sus RPCs (`vaccination.catalog.list` y `vademecum.laboratories.list`) para mostrar el laboratorio en el subtítulo del lote, pero al no declararlos no venían con el kit y la feature degradaba en silencio. Ahora instalar el kit veterinario instala también el módulo de vacunación y el maestro de laboratorios (COONG-240).
- 81656ef: fix(dashboard): brand variant + ingresos label width (COONG-112)

  - "Registrar Paciente" button: drop variant='outline' so it matches the brand-yellow style of "Nueva Consulta" next to it.
  - Ingresos card: date label width w-12→w-20 + whitespace-nowrap so dates like "19/4/2026" fit on one line instead of wrapping below the bar.

- b9032d0: Menú: la sección "Equipo" pasa a llamarse "Directorio" (ahora agrupa Personal + Proveedores, que son maestros/directorios de entidades, no flujos de dinero). Se asigna el ítem "Proveedores" (de purchases) a esa sección.
- b2b463f: Reorganización de menú: Caja pasa a nivel principal (Inicio·Caja·Agenda), Consultas y Personal abren su vista directa, y "Servicios y Precios" se mueve a Dinero como ítem propio.
- 8493fc5: El menú reasigna "Salidas" (antes "Compras") del plugin purchases a la sección Dinero.

## 0.4.1

### Patch Changes

- 76db689: fix(dashboard): brand variant + ingresos label width (COONG-112)
  - "Registrar Paciente" button: drop variant='outline' so it matches the brand-yellow style of "Nueva Consulta" next to it.
  - Ingresos card: date label width w-12→w-20 + whitespace-nowrap so dates like "19/4/2026" fit on one line instead of wrapping below the bar.

## 0.4.0

### Minor Changes

- 4d51709: Replace the "Seguimientos Pendientes" widget on the dashboard with an "Agenda de Hoy" widget that reads from `@coongro/appointments` via `useTodayAppointments`. The new widget lists today's appointments sorted by time, with status badges and a link to the agenda view, reusing `EventCard` (variant `list`) from `@coongro/calendar` plus the exported status helpers from `@coongro/appointments` so the dashboard stays visually consistent with the agenda. Requires `@coongro/appointments >= 0.2.0`.

## 0.3.1

### Patch Changes

- ed3837c: Declare `@coongro/vet-staff` as a kit dependency so tenants installing the veterinary kit get the vet professionals module automatically. Also normalizes version constraints for `consultations` and `patients` (removes loose `*`).

## 0.3.0

### Minor Changes

- 431a4b2: Migrate dashboard to strict `@coongro/datetime` API.
  - Local `Consultation` / `Contact` types use branded `UTCTimestamp` / `DateKey`.
  - Dashboard uses `toDateKey` / `addDays` for day-local comparisons.
  - `follow_up_date` consumed directly (already `DateKey` from consultations schema).
  - Added `@coongro/appointments` as a kit dependency so installing the kit auto-installs the full veterinary bundle (appointments + calendar + consultations + patients + products + staff + contacts).
  - Deleted the transitional `dateKey()` regex workaround that handled both ISO and custom `follow_up_date` formats.

  Description updated to mention turnos.

## 0.2.0

### Minor Changes

- 5c7a124: Replace custom date utilities with @coongro/calendar exports

## 0.1.5

### Patch Changes

- 9092bc4: Disable Tailwind preflight to avoid duplicating host CSS reset

## 0.1.4

### Patch Changes

- d9c059b: fix(ci): correct release and publish workflows
  - Fix changesets/action version command (use shell script instead of inline &&)
  - Fix scoped registry override in production publish
  - Add tag creation and GitHub Release in publish workflow
  - Remove obsolete tag-release workflow

## 1.0.0

### Patch Changes

- Updated dependencies [3a28d12]
- Updated dependencies [792063d]
  - @coongro/plugin-sdk@0.13.0
  - @coongro/consultations@1.0.0

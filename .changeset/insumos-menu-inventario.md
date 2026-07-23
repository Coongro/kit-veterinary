---
'@coongro/kit-veterinary': minor
---

feat(menus): inventario unificado — reordena los menús de stock (COONG-263)

El kit ahora asigna los menús de `vet-inventory` así:
- **Inventario** (antes "Lotes y stock"): sección `inventario`, order 10. Compone perecederos + insumos en una sola pantalla.
- **Insumos** (catálogo de insumos): pasa a la sección `clinica`, order 60, junto a Pacientes/Consultas/Vacunación/Farmacia — es un catálogo, no una vista de stock.

Sin esta asignación, los menús nuevos/renombrados de `vet-inventory` quedarían flotando fuera de sus secciones.

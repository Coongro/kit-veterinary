---
'@coongro/kit-veterinary': minor
---

feat(menus): ubica «Insumos» en la sección Inventario (COONG-256)

Asigna el menú `Insumos` de `vet-inventory` a la sección **inventario**, con `order: 20` (después de "Lotes y stock"). Sin la asignación, un menú nuevo que el kit no conoce queda flotando arriba de todo, fuera de sus secciones.

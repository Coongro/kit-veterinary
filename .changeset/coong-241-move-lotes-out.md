---
"@coongro/kit-veterinary": minor
---

Mueve la vista "Lotes y stock" a un plugin dedicado (`@coongro/vet-inventory`) para que el kit quede como paraguas de organización, sin vistas de negocio propias más allá del Dashboard. Quita la view `kit-veterinary.lotes.open` y `src/views/lotes/`, declara `@coongro/vet-inventory` como dependencia y quita las deps directas de `vaccination`/`vademecum` (ahora transitivas vía vet-inventory — revierte COONG-240). El menú "Lotes y stock" sigue en la sección Inventario, ahora contribuido por vet-inventory y organizado vía menuAssignment. (COONG-241)

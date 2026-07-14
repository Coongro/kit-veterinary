---
"@coongro/kit-veterinary": minor
---

Mueve la vista "Lotes y stock" a un plugin dedicado (`@coongro/vet-inventory`) para que el kit quede como paraguas de organización, sin vistas de negocio propias más allá del Dashboard. Quita la view `kit-veterinary.lotes.open` y `src/views/lotes/`; el menú "Lotes y stock" sigue en la sección Inventario, ahora contribuido por vet-inventory y organizado vía `menuAssignment`.

Además se redefinen las dependencias del kit como un **grafo razonable** en vez de una lista plana: se declaran sólo las que el kit importa/compone directamente — hard-imports (`appointments`, `calendar`, `consultations`, `patients`) y raíces de composición (`purchases`, `vademecum-senasa`, `vet-inventory`, `vet-staff`) — y el resto (`billing`, `products`, `vaccination`, `vademecum`, `vet-pharmacy`, `contacts`, `staff`…) llega por resolución transitiva. Esto revierte la inflación de deps directas de COONG-240/244 manteniendo la instalación completa del kit. (COONG-241)

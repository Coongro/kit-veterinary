---
"@coongro/kit-veterinary": patch
---

Declara `@coongro/vaccination` y `@coongro/vademecum` como dependencias. La vista de Lotes ya consumía sus RPCs (`vaccination.catalog.list` y `vademecum.laboratories.list`) para mostrar el laboratorio en el subtítulo del lote, pero al no declararlos no venían con el kit y la feature degradaba en silencio. Ahora instalar el kit veterinario instala también el módulo de vacunación y el maestro de laboratorios (COONG-240).

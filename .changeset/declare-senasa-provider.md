---
'@coongro/kit-veterinary': minor
---

feat: instalar el provider de catalogo SENASA (vademecum-senasa) con el kit

El autofill SENASA (vacunacion) y el catalogo de farmacia llaman vademecum.catalog.*,
que registra el plugin vademecum-senasa. Declararlo como dep del kit lo instala en el
tenant y el RPC deja de dar 404 not registered.

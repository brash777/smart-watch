# Snapia — Shared

Esquemas Zod y tipos de TypeScript que usan la API y la web. Así las dos validan exactamente lo mismo: si cambia un esquema aquí, cambia en los dos lados.

[← Volver al README del proyecto](../../README.md)

## Qué hay

```
src/
├── schemas/   esquemas Zod: enums del glosario, cuerpos de cada endpoint, respuestas,
│              salidas de la IA por modo, ajustes (AppSetting) y configuración de la app
└── types/     tipos inferidos de esos esquemas (z.infer)
```

- La API valida con ellos cada entrada y las respuestas de la IA.
- La web los usa en los formularios (`zodResolver`) y para leer las respuestas de la API.
- Los valores de los enums (`STUDY`, `WORK`, `CONTENT`, `OWNER`…) son los mismos de Prisma y del glosario de [docs/PRODUCT.md](../../docs/PRODUCT.md).

## Pruebas

```bash
npm test -w @snapia/shared
```

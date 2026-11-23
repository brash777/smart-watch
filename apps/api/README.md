# Snapia — API

API REST de Snapia: cuentas, Espacios, snaps, análisis con IA, documentos, herramientas de estudio, la capa social y el panel de administración.

[← Volver al README del proyecto](../../README.md)

> Los comandos se corren desde la **raíz del repositorio**, que es un monorepo con npm workspaces.

## Tecnologías

| Pieza                      | Para qué                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Node.js 22 + TypeScript 6  | Lenguaje y entorno                                                                            |
| Express 5                  | Servidor HTTP                                                                                 |
| Prisma 7 + PostgreSQL      | Base de datos, migraciones y semilla                                                          |
| MinIO / S3 (o disco local) | Fotos, entregadas con URLs firmadas que vencen                                                |
| sharp                      | Revisa que la foto sea una imagen, le quita el EXIF y el GPS, la guarda en WebP con miniatura |
| Zod 4                      | Valida cada entrada y toda la configuración                                                   |
| Claude (SDK de Anthropic)  | Visión e IA. Con `AI_PROVIDER=mock` responde con ejemplos fijos, sin costo                    |
| pdfkit                     | Exporta documentos a PDF                                                                      |
| Vitest + Supertest         | Pruebas contra la app real y una base de datos de pruebas                                     |

## Puesta en marcha

### 1. Variables de entorno

```bash
cp .env.example .env
```

Todas las variables están explicadas en [.env.example](../../.env.example) y se validan al arrancar: si falta una, la API no arranca y dice cuál.

### 2. Base de datos y almacenamiento (Docker)

```bash
npm run db:up        # PostgreSQL y MinIO
npm run db:migrate   # aplica las migraciones
npm run db:seed      # ajustes, el primer ADMIN y datos de ejemplo
```

### 3. Arrancar la API

```bash
npm run dev:api
```

### 4. Probarla

```bash
curl -s http://localhost:4000/api/health
```

## Cómo está hecho un módulo

Cada función vive en `src/modules/<módulo>/` y tiene las mismas capas:

```
<módulo>.routes.ts       rutas y middlewares (sesión, rol en el Espacio, validación)
<módulo>.controller.ts   solo HTTP: lee la entrada validada y responde { data, meta }
<módulo>.service.ts      reglas del producto; los errores son AppError(code, message, status)
<módulo>.repository.ts   el único que usa Prisma
<módulo>.test.ts         pruebas con Supertest
```

| Módulo                                            | Qué hace                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `auth`, `users`, `follows`                        | Registro, sesión con cookie de renovación, perfiles, fotos de perfil y seguir |
| `spaces`, `space-members`, `space-invites`        | Espacios por modo, miembros con roles y códigos de invitación                 |
| `snaps`                                           | Subida de fotos, lista, borrado y la regla de quién puede ver cada foto       |
| `ai`, `snap-insights`                             | IA: proveedor, cola en segundo plano, prompts versionados y análisis          |
| `documents`, `study`, `ask`                       | Crear con IA, exportar a PDF/Markdown, flashcards, quiz y el chat             |
| `moments`, `posts`, `likes`, `comments`, `social` | Instantes, posts, feed, Explorar, likes y comentarios                         |
| `admin`, `settings`, `app-config`                 | Panel admin, ajustes editables (AppSetting) y la configuración que lee la web |
| `health`                                          | Chequeo de vida                                                               |

## La IA

- Los servicios llaman **tareas** (`src/modules/ai/tasks/`) y las tareas llaman la interfaz `AiProvider`: `anthropic` usa Claude y `mock` responde con los ejemplos de `src/modules/ai/fixtures/`.
- Cada respuesta se valida con Zod y se reintenta una vez si viene mal. Cada llamada queda registrada como `AiRun`, con tokens, costo estimado, duración y error.
- Los prompts son archivos versionados en `src/modules/ai/prompts/` y cada resultado guarda qué versión lo produjo.
- A la IA nunca le llegan correos, teléfonos ni datos de otras personas.

## Endpoints

Todos están documentados en [docs/api.md](../../docs/api.md), con su permiso, cuerpo, respuesta y errores.

## Pruebas

```bash
npm run db:up
npm test -w @snapia/api
```

Usan su propia base (`TEST_DATABASE_URL`), nunca la de desarrollo. La IA siempre es el `mock`.

## Convenciones

Las reglas del proyecto (capas, nombres, nada de valores quemados, commits) están en [CLAUDE.md](../../CLAUDE.md) y en las guías de `.claude/skills/`.

# Snapia — Web

La app que usa la gente, en el celular o en el computador: una PWA hecha con React, pensada primero para el celular.

[← Volver al README del proyecto](../../README.md)

> Los comandos se corren desde la **raíz del repositorio**. La web necesita la API encendida ([apps/api](../api/README.md)).

## Tecnologías

| Pieza                    | Para qué                                                |
| ------------------------ | ------------------------------------------------------- |
| React 19 + TypeScript 6  | Interfaz                                                |
| Vite 8 + vite-plugin-pwa | Servidor de desarrollo, build y app instalable          |
| React Router 8           | Rutas                                                   |
| TanStack Query 5         | Datos de la API, caché y refresco del análisis          |
| Tailwind CSS 4           | Estilos con tokens de diseño propios (claro y oscuro)   |
| i18next                  | Todos los textos, en español, en un solo archivo        |
| react-hook-form + Zod    | Formularios validados con los mismos esquemas de la API |
| react-markdown           | Apuntes, texto extraído y respuestas de la IA           |
| Vitest + Testing Library | Pruebas                                                 |

## Cómo abrirla

```bash
npm run dev:web
```

Abre `http://localhost:5173`. La web llama a la API a través del proxy de Vite (`VITE_API_URL=/api`), así que no hay que configurar CORS.

### En el celular

```bash
npm run dev:web -- --host
```

Abre en el celular, conectado al mismo Wi-Fi, la dirección **Network** que muestra la terminal. Para que las fotos también carguen en el celular, en el `.env` pon `MINIO_BIND_ADDRESS=0.0.0.0` y `S3_ENDPOINT=http://<IP-de-tu-computador>:9000`, y reinicia con `npm run db:down && npm run db:up`.

## Pantallas

| Ruta                        | Pantalla                                                     |
| --------------------------- | ------------------------------------------------------------ |
| `/login`, `/register`       | Ingresar y crear cuenta                                      |
| `/`                         | Inicio: Instantes y feed con like por doble toque            |
| `/spaces`, `/spaces/new`    | Tus Espacios y crear uno nuevo, eligiendo el modo            |
| `/spaces/:id`               | Un Espacio: Snaps, Documentos, Estudio, Preguntar y Miembros |
| `/spaces/:id/snaps/:snapId` | Visor a pantalla completa con el análisis de la IA           |
| `/spaces/:id/compose`       | Crear con IA a partir de los snaps elegidos                  |
| `/documents/:id`            | Editor Markdown con vista previa y descarga PDF/Markdown     |
| `/capture`                  | Cámara: tomar o elegir fotos, elegir Espacio y subir         |
| `/posts/new`                | Nuevo post con el borrador de la IA                          |
| `/explore`                  | Explorar posts públicos por hashtag                          |
| `/profile`, `/u/:username`  | Tu perfil y los perfiles públicos (se ven sin sesión)        |
| `/join/:code`               | Unirse a un Espacio con un código                            |
| `/admin`                    | Panel de administración (solo ADMIN)                         |

## Estructura

```
src/
├── app/           rutas, layouts y proveedores
├── features/      una carpeta por función: pages/, components/, hooks/, api.ts
├── components/    piezas compartidas (botones, Markdown, estados vacíos y de error)
├── config/        env.ts (variables VITE_*) y modes.ts (color e ícono de cada modo)
├── i18n/          locales/es.json: todos los textos de la app
├── lib/           cliente HTTP, paginación, formatos, portapapeles
└── styles/        tokens.css: colores, radios y tipografías
```

## Reglas que conviene saber

- **Ningún texto va en el código**: todo está en `src/i18n/locales/es.json` y se lee con `t('clave')`. Las claves tienen tipos, así que una clave que falta rompe el typecheck.
- **Un solo cliente HTTP** (`src/lib/http.ts`): agrega la sesión, renueva el token una vez si la API responde 401 y sube fotos con barra de progreso.
- **Colores solo con tokens** (`bg-surface`, `text-muted`…). La paleta por defecto de Tailwind está apagada. El color y el ícono de cada modo salen de `src/config/modes.ts`.
- **Nada quemado**: la paleta de colores de los Espacios y los límites de subida vienen de la API (`GET /api/app-config`).

## Configuración

Variables `VITE_*` del `.env` de la raíz, validadas en `src/config/env.ts`:

| Variable                    | Para qué                                                  |
| --------------------------- | --------------------------------------------------------- |
| `VITE_APP_NAME`             | Nombre de la app y de la PWA                              |
| `VITE_API_URL`              | Dirección de la API (`/api` pasa por el proxy de Vite)    |
| `VITE_API_PROXY_TARGET`     | A dónde manda el proxy esas llamadas                      |
| `VITE_WHATSAPP_SHARE_URL`   | Enlace para compartir invitaciones por WhatsApp           |
| `VITE_UPLOAD_IMAGE_QUALITY` | Calidad con la que el navegador achica las fotos al subir |

## Pruebas

```bash
npm test -w @snapia/web
```

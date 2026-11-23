# Arquitectura de Snapia

Cómo están conectadas las piezas y qué pasa, paso a paso, desde que alguien toma una foto hasta que ve lo que entendió la IA.

## Las piezas

```
 Celular / computador                Reloj (Wear OS)
 ┌──────────────────────┐            ┌──────────────────────┐
 │ apps/web (React PWA) │            │ apps/wear (Kotlin)   │
 └──────────┬───────────┘            └──────────┬───────────┘
            │ HTTP/JSON (/api)                   │ HTTP/JSON
            └──────────────┬─────────────────────┘
                           ▼
              ┌──────────────────────────┐        ┌──────────────────┐
              │ apps/api (Express)       │───────▶│ Claude (visión)  │
              │ rutas → controlador →    │        │ o el mock        │
              │ servicio → repositorio   │        └──────────────────┘
              └─────┬──────────────┬─────┘
                    │              │
                    ▼              ▼
            ┌──────────────┐  ┌──────────────┐
            │ PostgreSQL   │  │ MinIO / S3   │
            │ (Prisma)     │  │ fotos WebP   │
            └──────────────┘  └──────────────┘

 packages/shared: esquemas Zod y tipos que usan la API y la web
```

| Pieza             | Responsabilidad                                                                     |
| ----------------- | ----------------------------------------------------------------------------------- |
| `apps/web`        | Toda la experiencia: cámara, Espacios, visor, Crear con IA, estudio, social, admin  |
| `apps/wear`       | Ver y repasar desde el reloj: Espacios, análisis, flashcards, quiz y feed           |
| `apps/api`        | Reglas del producto, permisos, IA, archivos y datos                                 |
| `packages/shared` | Los contratos: qué se envía y qué se recibe en cada endpoint                        |
| PostgreSQL        | Usuarios, Espacios, snaps, análisis, documentos, posts, ajustes y registro de la IA |
| MinIO / S3        | Las fotos y sus miniaturas. Solo se entregan con URLs firmadas que vencen           |

## El recorrido de un snap

1. **Captura.** En la web, la cámara usa `<input type="file" capture="environment" multiple>`. El navegador achica la foto al tamaño máximo que guarda la API (`IMAGE_MAX_SIDE_PX`) y la sube con barra de progreso.
2. **Guardado.** La API revisa que el archivo sea de verdad una imagen permitida, lo gira según su EXIF, **le borra todos los metadatos** (EXIF con GPS, XMP, IPTC) y lo guarda en WebP con una miniatura. El snap queda `PENDING` y la respuesta llega de inmediato: subir nunca espera a la IA.
3. **Análisis en segundo plano.** El evento `snap.created` pone el snap en una cola (`AI_QUEUE_CONCURRENCY` a la vez). La tarea manda a la IA la foto achicada, el prompt del modo del Espacio y datos útiles (materia, proyecto o nicho), sin correos, teléfonos ni nombres.
4. **Validación.** La respuesta debe cumplir el esquema Zod del modo. Si no, se reintenta una vez explicando el error. Cada llamada queda como `AiRun`, con tokens, costo, duración y error.
5. **Resultado.** El snap pasa a `DONE` con su `SnapInsight`, o a `FAILED`. La web pregunta cada `analysis_poll_interval_ms` mientras haya snaps pendientes y refresca la grilla sola.
6. **Uso.** Con varios snaps analizados se crean apuntes, informes o posts (Compose), flashcards, quizzes o preguntas al Espacio. Los textos citan las fotos como `[Snap N]` y la API comprueba que esas citas existan.

## Sesión

- Al entrar, la API devuelve un **token de acceso corto**, que la web guarda solo en memoria, y una **cookie httpOnly** para renovarlo, que rota en cada uso.
- Si una llamada responde 401, la web renueva la sesión **una sola vez** y repite la llamada. Varias renovaciones al tiempo comparten la misma petición.
- El reloj guarda el token en memoria y vuelve a pedir usuario y contraseña cuando vence.

## Permisos

- Cada ruta de un Espacio revisa el rol: `VIEWER` < `EDITOR` < `OWNER`.
- Una foto solo recibe URL firmada para quien la puede ver: los miembros del Espacio, o cualquiera a quien su autor la compartió como Post o Instante (`canViewSnap`).
- El ADMIN administra la app, pero no ve el contenido de Espacios de los que no es miembro.

## Configuración

| Dónde                               | Qué                                                                                        | Cómo se cambia                |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| `.env` (validado con Zod)           | Puertos, URLs, claves, modelo y límites de la IA, tamaños de las fotos                     | Editar `.env` y reiniciar     |
| Tabla `AppSetting`                  | Reglas del producto: duración de los Instantes, paleta, idioma de la IA, precios por token | Panel `/admin`, sin reiniciar |
| `GET /api/app-config`               | Lo que la web necesita saber antes de crear o subir (paleta, límites)                      | Sale de las dos anteriores    |
| `apps/web/src/i18n/locales/es.json` | Todos los textos de la web                                                                 | Editar el archivo             |
| `apps/wear/.../strings.xml`         | Todos los textos del reloj                                                                 | Editar el archivo             |

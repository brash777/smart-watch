# Decisiones técnicas

Las decisiones que dan forma a Snapia y por qué se tomaron.

**1. Un monorepo con los contratos compartidos.** La API, la web y los esquemas viven en el mismo repositorio (npm workspaces). Los esquemas Zod de `packages/shared` validan las entradas en la API y los formularios en la web, así que los dos lados nunca discuten sobre qué es válido.

**2. Nada quemado en el código.** URLs, puertos, claves, el modelo de IA, límites y tiempos van en `.env`, validado con Zod al arrancar: si algo falta, la app no arranca y dice qué. Las reglas que un administrador puede querer cambiar (duración de un Instante, paleta de colores, idioma de la IA, precios por token) son `AppSetting` y se editan en `/admin` sin desplegar de nuevo. Los textos están en archivos de idioma.

**3. La IA detrás de una interfaz.** El código no depende de un proveedor: llama a `AiProvider`, que hoy tiene dos implementaciones, Claude y un `mock` con respuestas de ejemplo. El `mock` permite probar todo y hacer demostraciones sin costo, y pasa por la misma validación, el mismo reintento y el mismo registro que la IA real.

**4. Capturar primero, analizar después.** Subir una foto nunca espera a la IA: el snap se guarda al instante y el análisis corre en una cola en segundo plano. La web pregunta cada cierto tiempo (un ajuste, no un número en el código) solo mientras haya snaps pendientes.

**5. Respuestas de la IA validadas, no confiadas.** La IA contesta llamando una herramienta cuyo esquema sale de Zod. Si la respuesta no cumple, se le devuelve el error y se reintenta una vez; si vuelve a fallar, el error es claro (`AI_INVALID_OUTPUT`). Las citas `[Snap N]` se comprueban contra las fotos que de verdad se enviaron.

**6. Prompts versionados.** Cada prompt es un archivo `nombre.vN.md`. Cambiar un prompt crea una versión nueva y cada resultado guarda qué versión lo produjo, para poder explicar resultados viejos.

**7. Privacidad desde la subida.** Las fotos pierden su EXIF y su GPS antes de guardarse. A la IA no le llegan correos, teléfonos ni nombres; cuando necesita distinguir autores, usa etiquetas neutras (`Member 1`). Cada llamada a la IA queda registrada (`AiRun`) para el panel de costos.

**8. Una sola regla para ver fotos.** Quién puede ver una foto se decide en un solo lugar (`canViewSnap`), y solo esa persona recibe una URL firmada que además vence. Así no hay una pantalla que se olvide de revisar permisos.

**9. Sesión segura sin complicar la app.** El token de acceso vive solo en memoria y la renovación va en una cookie httpOnly que rota. Un script en la página no puede leer la sesión, y si alguien reutiliza una cookie vieja, se cierran todas las sesiones de esa cuenta.

**10. Pensada para el celular.** La web es una PWA que se instala como app, con navegación inferior como Instagram. Usa tokens de diseño propios (la paleta de Tailwind está apagada) y un color con ícono por modo: azul para Estudio, naranja para Trabajo y magenta para Contenido.

**11. El reloj es nativo.** Wear OS no tiene navegador, así que la PWA no sirve en el reloj. La app de `apps/wear` es Kotlin con Compose para Wear OS y habla con la misma API. No usa librerías de red, para que el proyecto sea pequeño y fácil de abrir en Android Studio. En la pantalla pequeña, el Markdown de la IA se muestra como texto limpio.

**12. Una demostración coherente.** Como la demo corre con el `mock`, sus respuestas de ejemplo describen un diagrama de clases UML (un sistema de ventas), que es lo que se fotografía en la presentación.

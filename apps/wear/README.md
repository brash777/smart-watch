# Snapia — Reloj (Wear OS)

La versión de Snapia para reloj: con el celular tomas la foto; en el reloj ves lo que entendió la IA y repasas con flashcards y un quiz, sin sacar el celular.

[← Volver al README del proyecto](../../README.md)

> Este es un proyecto de Android aparte (Gradle). Se abre en **Android Studio** y usa la misma API que la web.

## Tecnologías

| Pieza                                  | Para qué                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| Kotlin 2.4                             | Lenguaje                                                 |
| Compose para Wear OS (Material 3 1.7)  | Pantallas redondas, listas que siguen la curva del reloj |
| Android Gradle Plugin 9.4 + Gradle 9.8 | Build (con wrapper: no hay que instalar Gradle)          |
| `HttpURLConnection` + `org.json`       | Llamadas a la API, sin librerías extra                   |

Android: mínimo API 30 (Wear OS 3), objetivo API 36, compila con API 37.

## Pantallas

| Pantalla   | Qué hace                                                                           |
| ---------- | ---------------------------------------------------------------------------------- |
| Ingresar   | Usuario y contraseña de la misma cuenta del celular                                |
| Menú       | Espacios, Inicio y Cerrar sesión                                                   |
| Espacios   | Tus Espacios con su modo y cuántas fotos tienen                                    |
| Espacio    | Sus fotos con el estado del análisis; en los de Estudio, Flashcards y Quiz         |
| Foto       | Resumen, texto extraído, temas y conceptos (o el puntaje y caption, según el modo) |
| Flashcards | Pregunta; tocas la tarjeta y aparece la respuesta                                  |
| Quiz       | Preguntas de opción múltiple y al final cuántas acertaste                          |
| Inicio     | Los posts de la gente que sigues; doble toque para dar me gusta                    |

## Cómo correrla

### 1. Crear el reloj virtual

En Android Studio: **Device Manager → + → Wear OS → Wear OS Large Round**, con una imagen de sistema **ARM 64** (en Mac con Apple Silicon). Enciéndelo con ▶.

### 2. Encender la API

Desde la raíz del repositorio:

```bash
npm run dev:api
```

### 3. Conectar el reloj con el computador

El reloj busca la API y las fotos en `localhost`. Con el reloj encendido:

```bash
~/Library/Android/sdk/platform-tools/adb reverse tcp:4000 tcp:4000   # API
~/Library/Android/sdk/platform-tools/adb reverse tcp:9000 tcp:9000   # fotos (MinIO)
```

> Si cierras el reloj virtual, al volver a abrirlo hay que repetir este paso. Si no, la app dice "No hay conexión con Snapia".

### 4. Abrir y correr

En Android Studio: **Open → `apps/wear`**, espera a que termine el Gradle sync y dale **Run ▶** con el reloj seleccionado.

O desde la terminal:

```bash
cd apps/wear
./gradlew assembleDebug
~/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Escribir en el reloj

Toca el campo y espera a que abra el teclado. Para los números usa **?123** y confirma con **✓**. La contraseña no se autocorrige ni se pone en mayúscula.

## Configuración

En [gradle.properties](gradle.properties):

| Propiedad        | Para qué                                                               |
| ---------------- | ---------------------------------------------------------------------- |
| `snapia.apiUrl`  | Dirección de la API vista desde el reloj (`http://localhost:4000/api`) |
| `snapia.appName` | Nombre que muestra el reloj                                            |

Se pueden cambiar sin tocar el archivo con `-Psnapia.apiUrl=...` o en `~/.gradle/gradle.properties`. Los textos están en español en `app/src/main/res/values/strings.xml`.

## Estructura

```
app/src/main/
├── java/com/smartwash/snapia/wear/
│   ├── MainActivity.kt   pantallas y navegación (el gesto de volver cierra la pantalla actual)
│   └── SnapiaApi.kt      llamadas a la API, lectura del JSON y limpieza del Markdown para la pantalla pequeña
├── res/values/strings.xml   textos
└── res/xml/network_security_config.xml   permite HTTP solo a localhost (desarrollo)
```

## Límites conocidos

- La sesión vive en memoria: si cierras la app, hay que volver a entrar.
- El reloj no toma fotos: eso se hace desde el celular.

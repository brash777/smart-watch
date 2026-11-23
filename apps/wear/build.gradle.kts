plugins {
    id("com.android.application") version "9.4.1" apply false
    // Pins the Kotlin version that AGP's built-in Kotlin and the Compose compiler share.
    id("org.jetbrains.kotlin.android") version "2.4.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21" apply false
}

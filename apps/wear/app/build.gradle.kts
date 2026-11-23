plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.smartwash.snapia.wear"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.smartwash.snapia.wear"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        val apiUrl = providers.gradleProperty("snapia.apiUrl").get()
        buildConfigField("String", "API_URL", "\"$apiUrl\"")
        resValue("string", "app_name", providers.gradleProperty("snapia.appName").get())
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.wear.compose:compose-material3:1.7.0")
    implementation("androidx.wear.compose:compose-foundation:1.7.0")
}

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "uz.nmpi.board"
    compileSdk = 34

    defaultConfig {
        applicationId = "uz.nmpi.board"
        minSdk = 21          // Android TV (Lollipop+) covers all current boxes
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        // Ship the debug build — it's signed with the debug key so it sideloads
        // onto a TV without a release keystore. (release kept for completeness.)
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
}

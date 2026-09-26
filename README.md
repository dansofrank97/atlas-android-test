# Atlas Financial OS — Android Test App

Offline test APK wrapper for the Atlas UI. It uses sample/demo data only and does not move money or connect to production services.

## Build with GitHub Actions
Push this project to a GitHub repository and run **Build Atlas Test APK**. Download the artifact named `atlas-financial-os-test-apk`.

## Local build
Requires Android SDK 35 and Gradle 8.10.2:

```bash
gradle :app:assembleDebug
```

APK output:
`app/build/outputs/apk/debug/app-debug.apk`

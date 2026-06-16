# NMPI Tablo — Android TV kiosk

Full-screen WebView app that shows the queue board (`/tablo`) on an Android TV.

## Why this exists

Smart-TV built-in browsers have a flaky Web Audio stack: the synthesised chime
plays but the decoded mp3 **voice clips stay silent**. Android's WebView is
Chromium — it decodes the clips fine, and we disable the autoplay-gesture
requirement so the voice plays with no remote interaction:

```kotlin
webView.settings.mediaPlaybackRequiresUserGesture = false
```

## Build

Needs JDK 17 + Android SDK (platform 34, build-tools 34). `local.properties`
points at the SDK.

```bash
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk  (debug-signed, sideloadable)
```

## Configure the board URL

Default is `http://192.168.0.127/tablo` (the on-site box, `BOX_HOST` in
`deploy/.env.local`). To change it on the TV: press **MENU** or **0** on the
remote → type the new URL → OK. It's saved across reboots.

To change the baked-in default, edit `DEFAULT_URL` in
`app/src/main/java/uz/nmpi/board/MainActivity.kt` and rebuild.

## Install on the TV

**USB flash:** copy the APK to a flash drive → plug into the TV → open a file
manager (or install "Downloader" / "Send files to TV") → open the APK → allow
"install from unknown sources" when prompted.

**ADB over network** (TV must have Developer options → USB/Network debugging on):

```bash
adb connect <TV_IP>:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

After install the app appears on the Android TV home row as **NMPI Tablo**.
On first open it loads the board; tap nothing — the voice plays on its own.

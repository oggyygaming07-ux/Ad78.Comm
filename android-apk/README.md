# AD78 Android APK Export Guide (`oggyygaming07-ux/AD78`)

Use **GitHub Actions (Automatic Cloud APK)**, **Android Studio**, or **Capacitor** without changing any AD78 app code.

---

## Option 1: Automatic Cloud APK via `oggyygaming07-ux/AD78` (No Android Studio Needed)
1. Push / export this project to **`https://github.com/oggyygaming07-ux/AD78`**:
   - Either use **Save / Export to GitHub** in AI Studio and select `oggyygaming07-ux/AD78`, **or** download the ZIP and run:
     ```bash
     git init
     git branch -M main
     git remote add origin https://github.com/oggyygaming07-ux/AD78.git
     git add .
     git commit -m "AD78 app + APK builder"
     git push -u origin main
     ```
2. On GitHub, open **`https://github.com/oggyygaming07-ux/AD78/actions`**.
3. Open the **Build AD78 Android APK** workflow run (triggers automatically on push, or click **Run workflow**).
4. Scroll to **Artifacts** and download **`AD78-APK`** (unzip to get **`AD78.apk`**).

---

## Option 2: Direct Android Studio WebView APK
1. Open **Android Studio** → **New Project** → **Empty Views Activity**.
   - **Name:** `AD78`
   - **Package name:** `com.ad78.app`
   - **Language:** Kotlin
2. Replace `app/src/main/AndroidManifest.xml` with `android-apk/AndroidManifest.xml`.
3. Replace `app/src/main/java/com/ad78/app/MainActivity.kt` with `android-apk/MainActivity.kt`.
4. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)** (or **Generate Signed Bundle / APK** for release).

> Keep your Admin Panel separate by opening `/admin` in a browser — users inside the APK only access the AD78 User App.

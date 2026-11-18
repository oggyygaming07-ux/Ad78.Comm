# AD78 Android APK Export Guide

Use **1-Click Export from Admin Panel**, **GitHub Actions (Automatic Cloud APK)**, or **Android Studio** (`AD78-Android-Studio/`).

Live App URL: `https://ais-pre-iqaevtxftokwr3kknyycg3-1002767698932.asia-east1.run.app`

---

## Option 1: Download Export Bundle from Admin Panel (`/admin`)
1. Open `/admin` in your browser → unlock with your Admin PIN → go to **App Config** tab.
2. Click **Download APK Export (.zip)** to download `AD78-APK-Export.zip`.
3. Unzip it and either:
   - Open `AD78-Android-Studio/` directly in **Android Studio** → **Build → Build Bundle(s) / APK(s) → Build APK(s)** to get `app-debug.apk`, **or**
   - Push the project to GitHub (`Build AD78 Android APK` workflow) to get `AD78.apk` automatically in **GitHub Actions → Artifacts**.

---

## Option 2: Automatic Cloud APK via GitHub Actions (No Android Studio Needed)
1. Push / export this project to GitHub (e.g. `https://github.com/oggyygaming07-ux/AD78`):
   - Use **Save / Export to GitHub** in AI Studio, **or** download the ZIP and run:
     ```bash
     git init
     git branch -M main
     git remote add origin https://github.com/oggyygaming07-ux/AD78.git
     git add .
     git commit -m "AD78 app + APK builder"
     git push -u origin main
     ```
2. On GitHub, open the **Actions** tab → **Build AD78 Android APK** workflow (runs automatically on push, or click **Run workflow**).
3. Scroll to **Artifacts** and download **`AD78-APK`** (unzip to get **`AD78.apk`**).

---

## Option 3: Ready-to-Open Android Studio Project (`AD78-Android-Studio`)
1. Open **Android Studio** → **Open** → select the `android-apk/AD78-Android-Studio` folder.
2. Wait for Gradle Sync to finish.
3. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)** (or **Generate Signed Bundle / APK** for release).
4. Your APK will be generated at `app/build/outputs/apk/debug/app-debug.apk`.

> Keep your Admin Panel separate by opening `/admin` in a browser — users inside the APK only access the AD78 User App.

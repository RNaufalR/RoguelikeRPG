# Emberdepths Android Build

This repository is ready for GitHub Actions APK builds.

## Files added
- `capacitor.config.ts`
- `.github/workflows/android.yml`
- `.gitignore`

## How to build
1. Push this repository to GitHub.
2. Open the repo on GitHub.
3. Go to **Actions**.
4. Run **Build Android APK**.
5. Download the artifact named `app-debug-apk`.

## Notes
- The APK produced by the workflow is a debug build.
- The Android platform folder is generated automatically during the workflow.
- If the workflow fails, open the failed run and copy the error text.

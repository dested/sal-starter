# sideload-update

Tells a sideloaded Android build that a newer APK is out on Sal's App Store (https://appstore.dested.com), and sends the person to the store's install page. Android only; iOS and any Play Store install get nothing.

JS fixes still arrive through EAS Update. This is for a new native build (a new versionCode), which EAS Update can't deliver.

## What it does

`useSideloadUpdatePrompt()` runs only when all of these hold:

- `Platform.OS === 'android'`
- the production install (the application id has no `.dev` / `.preview` suffix)
- the installer isn't Google Play (`com.android.vending`); an unknown installer counts as sideloaded

Then, on launch and every time the app comes back to the foreground, at most once every 12 hours (the last check is kept in expo-secure-store), it fetches the manifest with a 5-second timeout. Any failure (offline, a 404, bad JSON) is silent.

- Installed versionCode below `minSupportedVersionCode`: an alert that can't be dismissed, "<app> <version> is ready" / "This version needs the update to keep working." with one button, Update. It comes back on every foreground, with no 12-hour wait, until the new build is installed.
- Below `latest.versionCode`: "<app> <version> is ready" with the release notes, Later and Update.
- Update opens `installPageUrl` in the browser, which downloads and installs the APK. The app never downloads or installs anything and never asks for `REQUEST_INSTALL_PACKAGES`.

## The endpoint

`GET https://appstore.dested.com/api/android/<applicationId>.json`, parsed with `manifest.ts` (a copy of `AndroidManifest` in the appstore repo's `apps/web/server/catalog/contract.ts`, `schema: 1`). The installed version is `Application.nativeBuildVersion` (the Android versionCode); `update-state.ts` decides `none` / `available` / `required` and has a rule test.

## Files

- `index.ts`: `useSideloadUpdatePrompt()`, plus `updateState` and the schema re-exported
- `manifest.ts`: the zod schema
- `update-state.ts` + `update-state.rule.test.ts`: the decision and its cases
- `android/`: Kotlin `installerPackageName()` (`getInstallSourceInfo` on API 30+, `getInstallerPackageName` below; null on any error)

## To add it to an app

1. Copy this folder into the app's `modules/`.
2. Add `useSideloadUpdatePrompt()` to the root layout.
3. Make sure expo-application, expo-secure-store and zod are installed.

It's native code, so the next APK has to be a new build (a dev client built without it just skips the check).

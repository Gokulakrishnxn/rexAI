# EAS Build Instructions for Android APK and iOS

## Prerequisites
- Make sure you're logged into your Expo account: `npx eas-cli login`
- All changes have been committed and pushed to GitHub

## Build Android APK

Run the following command in your terminal:

```bash
cd /Users/gokulakrishnan/rexAI
npx eas-cli build --platform android --profile production
```

**What will happen:**
1. EAS will ask if you want to generate a new Android Keystore → Select **Yes**
2. The build will be queued on EAS servers
3. You'll get a build URL to monitor progress
4. Once complete, you'll get a download link for the APK

## Build iOS App

Run the following command in your terminal:

```bash
cd /Users/gokulakrishnan/rexAI
npx eas-cli build --platform ios --profile production
```

**What will happen:**
1. EAS will ask about iOS credentials
   - If you have an Apple Developer account, select "Use existing credentials" or "Generate new credentials"
   - You may need to provide your Apple ID and App-Specific Password
2. The build will be queued on EAS servers
3. You'll get a build URL to monitor progress
4. Once complete, you'll get an IPA file (for TestFlight/App Store)

## Build Both Platforms at Once

You can also build both platforms simultaneously:

```bash
npx eas-cli build --platform all --profile production
```

## Check Build Status

To check the status of your builds:

```bash
npx eas-cli build:list
```

Or visit: https://expo.dev/accounts/[your-username]/projects/rex-healthify/builds

## Download Builds

Once builds are complete:
- **Android APK**: You can download directly from the EAS dashboard or the link provided
- **iOS IPA**: Download from EAS dashboard, then upload to TestFlight or App Store Connect

## Important Notes

1. **Android**: The production profile builds an APK file that can be directly installed on Android devices
2. **iOS**: You'll need an Apple Developer account ($99/year) to build for iOS
3. **Build Times**: 
   - Android: ~10-15 minutes
   - iOS: ~15-20 minutes
4. **Environment Variables**: All production environment variables are configured in `app.config.js`

## Troubleshooting

If builds fail:
1. Check build logs on the EAS dashboard
2. Ensure all required credentials are set up
3. Verify `app.json` and `eas.json` configurations are correct

## Alternative: Build Locally

If you prefer to build locally:

**Android:**
```bash
npx expo run:android --variant release
```

**iOS (Mac only):**
```bash
npx expo run:ios --configuration Release
```

# Run Rex Healthify on Android via USB cable

When the app is **stuck loading** on your phone over USB, the phone cannot reach the Metro bundler on your Mac. Do this:

## 1. Enable USB debugging on your phone

- Open **Settings → About phone** and tap **Build number** 7 times (Developer mode).
- Go to **Settings → Developer options** and turn on **USB debugging**.

## 2. Connect and allow debugging

- Connect the phone with the USB cable.
- On the phone, when prompted **Allow USB debugging?**, tap **Allow** (and optionally “Always from this computer”).

## 3. Forward Metro port (required for USB)

In a terminal on your Mac, run **once per connection** (or after each cable unplug):

```bash
adb reverse tcp:8081 tcp:8081
```

This makes the phone’s `localhost:8081` point to your Mac’s Metro server.

## 4. Start the app with USB support

From the project folder:

```bash
cd "/Users/gokulakrishnan/rex healthify"
npm run start:android-usb
```

This runs `adb reverse` and then starts Expo and opens the app on the connected device.

**Or** do it in two steps:

1. In one terminal:
   ```bash
   adb reverse tcp:8081 tcp:8081
   npm start
   ```
2. When the Expo menu appears, press **`a`** to open on Android.

## 5. If it still doesn’t load

- Confirm the device is seen: `adb devices`
- If you see “device offline”, unplug and replug the cable, then run `adb reverse tcp:8081 tcp:8081` again.
- Make sure **Expo Go** (or your dev build) is installed on the phone.
- Try closing the app on the phone and pressing **`a`** again in the Expo terminal.

## Optional: use Wi‑Fi instead of USB

If the phone and Mac are on the same Wi‑Fi:

1. Run `npm start`.
2. Start with tunnel: press **`s`** and choose **tunnel**, or run `npx expo start --tunnel`.
3. Scan the QR code with Expo Go. No USB or `adb reverse` needed.

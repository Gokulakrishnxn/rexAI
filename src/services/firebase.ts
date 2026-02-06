import { initializeApp } from "firebase/app";
import {
    getAuth, initializeAuth,
    // @ts-ignore: getReactNativePersistence is available at runtime in Expo but sometimes missing from modular types
    getReactNativePersistence
} from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * FIREBASE CONFIGURATION INSTRUCTIONS:
 * 1. Open your google-services.json (Android) or GoogleService-Info.plist (iOS).
 * 2. Replace the PLACEHOLDER values in your .env or app.config.js with the actual values.
 */

const firebaseConfig = {
    apiKey: Constants.expoConfig?.extra?.firebaseApiKey || "YOUR_API_KEY",
    authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || "YOUR_AUTH_DOMAIN",
    projectId: Constants.expoConfig?.extra?.firebaseProjectId || "YOUR_PROJECT_ID",
    storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || "YOUR_STORAGE_BUCKET",
    messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || "YOUR_SENDER_ID",
    appId: Constants.expoConfig?.extra?.firebaseAppId || "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage for persistence in Expo
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export default app;

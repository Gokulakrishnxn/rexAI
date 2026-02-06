const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

module.exports = ({ config }) => {
    return {
        ...config,
        extra: {
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
            backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'http://10.0.2.2:3001',
            firebaseApiKey: process.env.FIREBASE_API_KEY || "AIzaSyDDoNbspnXR-cxFBWvW5e9k5VYwwJtFEb0",
            firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || "rexai-9f26f.firebaseapp.com",
            firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "rexai-9f26f",
            firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || "rexai-9f26f.firebasestorage.app",
            firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "73893911498",
            firebaseAppId: process.env.FIREBASE_APP_ID || "1:73893911498:android:b767f07bbf01978d358d33",
            ...config.extra,
        },
    };
};

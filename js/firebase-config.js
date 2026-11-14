// Firebase web config for FloodLine. These values are public by design (they identify the
// project, they are not secrets); access is protected by App Check (reCAPTCHA v3) and by the
// allowed domains set in the Firebase and Google Cloud consoles.
// Until the placeholders are replaced, FloodLine reads messages with rules only.

export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// reCAPTCHA v3 site key registered for App Check (public). On localhost a debug token is used instead.
export const RECAPTCHA_SITE_KEY = '';

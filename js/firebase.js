// One Firebase app for the whole page (AI Logic, Auth, Firestore), protected by App Check.
import { FIREBASE_CONFIG, RECAPTCHA_SITE_KEY } from './firebase-config.js';

export const FB = 'https://www.gstatic.com/firebasejs/13.1.0/';
let appPromise = null;

export function firebaseApp() {
  appPromise ||= (async () => {
    const [appMod, checkMod] = await Promise.all([import(`${FB}firebase-app.js`), import(`${FB}firebase-app-check.js`)]);
    const app = appMod.getApps()[0] || appMod.initializeApp(FIREBASE_CONFIG);
    try {
      if (RECAPTCHA_SITE_KEY) checkMod.initializeAppCheck(app, { provider: new checkMod.ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
    } catch (err) {
      console.warn('App Check could not start (offline?). On-device reading still works.', err);
    }
    return app;
  })();
  return appPromise;
}

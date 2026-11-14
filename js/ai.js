// Hybrid AI with Firebase AI Logic: messages are read by Gemini Nano on this device when Chrome has it
// (works with no internet, nothing leaves the phone/laptop), and by Gemini in the cloud otherwise.
// Every answer still goes through FloodLine's checks (guardAi) before it reaches the board.
import { FIREBASE_CONFIG, RECAPTCHA_SITE_KEY } from './firebase-config.js';
import { buildExtractPrompt, parseExtractReply, EXTRACT_SCHEMA } from './core/prompt.js';

const FB = 'https://www.gstatic.com/firebasejs/13.1.0/';
const MODE_NAME = { auto: 'PREFER_ON_DEVICE', device: 'ONLY_ON_DEVICE', cloud: 'ONLY_IN_CLOUD' };
const BATCH = { device: 5, cloud: 10 };
const LM_OPTIONS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };

let sdk = null;
let ai = null;
let loading = null;
const models = {};

export const isConfigured = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && !/^YOUR/.test(FIREBASE_CONFIG.apiKey));

async function load() {
  if (sdk) return sdk;
  if (!loading) {
    loading = (async () => {
      const [appMod, aiMod, checkMod] = await Promise.all([
        import(`${FB}firebase-app.js`), import(`${FB}firebase-ai.js`), import(`${FB}firebase-app-check.js`),
      ]);
      const app = appMod.initializeApp(FIREBASE_CONFIG);
      try {
        if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        if (RECAPTCHA_SITE_KEY) {
          checkMod.initializeAppCheck(app, { provider: new checkMod.ReCaptchaV3Provider(RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
        }
      } catch (err) {
        console.warn('App Check could not start (offline?). On-device reading still works.', err);
      }
      ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
      sdk = aiMod;
      return sdk;
    })();
  }
  return loading;
}

function getModel(mode) {
  if (!models[mode]) {
    models[mode] = sdk.getGenerativeModel(ai, {
      mode: sdk.InferenceMode[MODE_NAME[mode]],
      inCloudParams: {
        generationConfig: { responseMimeType: 'application/json', responseSchema: EXTRACT_SCHEMA, temperature: 0.1 },
      },
      onDeviceParams: {
        createOptions: LM_OPTIONS,
        promptOptions: { responseConstraint: EXTRACT_SCHEMA },
      },
    });
  }
  return models[mode];
}

/** 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported' (no built-in AI in this browser) */
export async function deviceStatus() {
  if (!('LanguageModel' in self)) return 'unsupported';
  try { return await self.LanguageModel.availability(LM_OPTIONS); } catch { return 'unsupported'; }
}

/** Download Gemini Nano (needs a click first; can take a few minutes). */
export async function prepareDevice(onProgress = () => {}) {
  if (!isConfigured()) throw new Error('Firebase is not set up yet.');
  await load();
  await getModel('auto').initializeDeviceModel((v) => onProgress(Math.round(v * 100)));
}

/**
 * Read messages with Gemini. mode: 'auto' (device first, cloud if not available), 'device' or 'cloud'.
 * Returns { xs: guarded extractions (each with .where = 'device' | 'cloud'), where: { device, cloud } }.
 */
export async function readMessages(texts, mode = 'auto', onProgress = () => {}) {
  if (!isConfigured()) throw new Error('AI is not set up yet; messages were read by rules.');
  await load();
  const model = getModel(mode);
  const onDevice = mode === 'device' || (mode === 'auto' && (await deviceStatus()) === 'available');
  const size = onDevice ? BATCH.device : BATCH.cloud;
  const xs = [];
  const where = { device: 0, cloud: 0 };
  for (let i = 0; i < texts.length; i += size) {
    const chunk = texts.slice(i, i + size);
    let result;
    try {
      result = await model.generateContent(buildExtractPrompt(chunk));
    } catch (err) {
      const msg = String(err && err.message || err);
      if (!navigator.onLine) throw new Error('No internet and no on-device model, so messages were read by rules. They will still be on the board.');
      if (/quota|429/i.test(msg)) throw new Error('The free AI quota is used up for now; rules keep working.');
      if (/app.?check|attestation|403/i.test(msg)) throw new Error('The cloud AI refused this site (App Check). On-device reading still works.');
      throw new Error(`AI could not read these messages: ${msg.slice(0, 140)}`);
    }
    const src = result.response.inferenceSource === 'ON_DEVICE' ? 'device' : 'cloud';
    const part = parseExtractReply(result.response.text(), chunk).map((x) => ({ ...x, where: src }));
    where[src] += part.length;
    xs.push(...part);
    onProgress(Math.min(texts.length, i + size), texts.length, src);
  }
  return { xs, where };
}

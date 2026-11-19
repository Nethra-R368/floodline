// Hybrid AI with Firebase AI Logic: messages are read by Gemini Nano on this device when Chrome has it
// (works with no internet, nothing leaves the phone/laptop), and by Gemini in the cloud otherwise.
// Every answer still goes through FloodLine's checks (guardAi) before it reaches the board.
import { FIREBASE_CONFIG } from './firebase-config.js';
import { firebaseApp, FB } from './firebase.js';
import { buildExtractPrompt, parseExtractReply, EXTRACT_SCHEMA } from './core/prompt.js';

const MODE_NAME = { auto: 'PREFER_ON_DEVICE', device: 'ONLY_ON_DEVICE', cloud: 'ONLY_IN_CLOUD' };
// Tried in order; a model that is busy (500/503) hands over to the next one.
const CLOUD_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
const BATCH ={ device: 5, cloud: 10 };
const LM_OPTIONS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };

let sdk = null;
let ai = null;
let loading = null;
const models = {};

export const isConfigured = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && !/^YOUR/.test(FIREBASE_CONFIG.apiKey));

async function load() {
  if (sdk) return sdk;
  loading ||= (async () => {
    const [app, aiMod] = await Promise.all([firebaseApp(), import(`${FB}firebase-ai.js`)]);
    ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });
    sdk = aiMod;
    return sdk;
  })();
  return loading;
}

function getModel(mode, cloudModel = CLOUD_MODELS[0]) {
  const key = `${mode}|${cloudModel}`;
  if (!models[key]) {
    models[key] = sdk.getGenerativeModel(ai, {
      mode: sdk.InferenceMode[MODE_NAME[mode]],
      inCloudParams: {
        model: cloudModel,
        generationConfig: { responseMimeType: 'application/json', responseSchema: EXTRACT_SCHEMA, temperature: 0.1 },
      },
      onDeviceParams: {
        createOptions: LM_OPTIONS,
        promptOptions: { responseConstraint: EXTRACT_SCHEMA },
      },
    }, { timeout: 45000 });
  }
  return models[key];
}

// Busy, timed out or out of free quota: each model has its own quota, so try the next one.
const BUSY = /\b(429|500|503)\b|quota|resource.?exhausted|high demand|overloaded|unavailable|internal|time.?out|expired|abort/i;

// A model that ran out of free quota is skipped for 10 minutes instead of being retried on every message.
const cooldown = new Map();
async function generate(mode, prompt) {
  let last;
  const live = CLOUD_MODELS.filter((m) => !(cooldown.get(m) > Date.now()));
  for (const name of live.length ? live : CLOUD_MODELS.slice(-1)) {
    try {
      const result = await getModel(mode, name).generateContent(prompt);
      result.cloudModel = name;
      return result;
    } catch (err) {
      last = err;
      const msg = String(err && err.message || err);
      if (mode === 'device' || !BUSY.test(msg)) throw err;
      if (/\b429\b|quota|exhausted/i.test(msg)) cooldown.set(name, Date.now() + 10 * 60000);
    }
  }
  throw last;
}

/** 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported' (no built-in AI in this browser) */
// Chrome can take a long time to answer availability() on machines without the model, so never wait on it
// for more than 2.5 s (and remember the answer for a minute): a slow answer means "use the cloud".
let statusCache = null;
export async function deviceStatus() {
  if (!('LanguageModel' in self)) return 'unsupported';
  if (statusCache && Date.now() - statusCache.at < 60000) return statusCache.value;
  const value = await Promise.race([
    self.LanguageModel.availability(LM_OPTIONS).catch(() => 'unsupported'),
    new Promise((r) => setTimeout(() => r('unavailable'), 2500)),
  ]);
  statusCache = { value, at: Date.now() };
  return value;
}

// The first start of Gemini Nano loads a few GB into memory and can take a minute on a laptop.
// Start it in the background as soon as the page opens, and keep one session open so it stays loaded:
// by the time a volunteer pastes the first message, on-device reading takes seconds, with or without internet.
let warm = null;
export const deviceWarmth = { state: 'cold', ms: 0 };
export function warmDevice(onChange = () => {}) {
  if (warm || !('LanguageModel' in self)) return warm;
  const t0 = performance.now();
  deviceWarmth.state = 'warming'; onChange(deviceWarmth);
  warm = self.LanguageModel.create(LM_OPTIONS)
    .then((s) => s.prompt('Reply with OK.').then(() => s))
    .then((s) => { deviceWarmth.state = 'warm'; deviceWarmth.ms = Math.round(performance.now() - t0); onChange(deviceWarmth); return s; })
    .catch(() => { deviceWarmth.state = 'cold'; warm = null; onChange(deviceWarmth); return null; });
  return warm;
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
  const onDevice = mode === 'device' || (mode === 'auto' && (await deviceStatus()) === 'available');
  // "On this device first" with no model on this device: go straight to the cloud instead of letting the SDK probe again.
  if (mode === 'auto' && !onDevice) mode = 'cloud';
  const size = onDevice ? BATCH.device : BATCH.cloud;
  const xs = [];
  const where = { device: 0, cloud: 0 };
  const models = {};
  for (let i = 0; i < texts.length; i += size) {
    const chunk = texts.slice(i, i + size);
    let result;
    try {
      result = await generate(mode, buildExtractPrompt(chunk));
    } catch (err) {
      const msg = String(err && err.message || err);
      if (!navigator.onLine) throw new Error('No internet and no on-device model, so messages were read by rules. They will still be on the board.');
      if (/quota|429/i.test(msg)) throw new Error('The free AI quota is used up for now; rules keep working.');
      if (/app.?check|attestation|403/i.test(msg)) throw new Error('The cloud AI refused this site (App Check). On-device reading still works.');
      throw new Error(`AI could not read these messages: ${msg.slice(0, 140)}`);
    }
    const src = /on_device/i.test(result.response.inferenceSource || '') ? 'device' : 'cloud';
    const part = parseExtractReply(result.response.text(), chunk, src).map((x) => ({ ...x, where: src }));
    where[src] += part.length;
    const label = src === 'device' ? 'gemini-nano (on device)' : result.cloudModel;
    models[label] = (models[label] || 0) + part.length;
    xs.push(...part);
    onProgress(Math.min(texts.length, i + size), texts.length, src);
  }
  return { xs, where, models };
}

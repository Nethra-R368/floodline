// Gemini call from the browser (the user's own key; there is no FloodLine server).
import { buildExtractPrompt, parseExtractReply } from './core/prompt.js';

export const DEFAULT_MODEL = 'gemini-3.8-flash';
// Tried in order when a model is busy (503) or retired (404). gemini-2.5-flash is no longer
// available to new keys, so it is not in the list.
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastGood = null; // the model that answered last time is tried first

export async function askGemini(prompt, key, model = DEFAULT_MODEL) {
  const order = [...new Set([lastGood, model, ...FALLBACK_MODELS].filter(Boolean))];
  let last = '';
  let busy = 0;
  for (const m of order) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      if (!text) throw new Error('Gemini returned an empty answer.');
      lastGood = m;
      return text;
    }
    last = data.error?.message || `HTTP ${res.status}`;
    if ((res.status === 400 || res.status === 401 || res.status === 403) && /API key|permission|unregistered|credential/i.test(last)) throw new Error('Gemini rejected the API key.');
    if (res.status === 429) throw new Error('Gemini free quota used up for now. Rules keep working; try again in a minute.');
    if (res.status >= 500) { busy++; await sleep(800); continue; } // busy: try the next model
    if (res.status === 404) continue; // retired name: try the next model
    throw new Error(`Gemini error: ${last}`);
  }
  throw new Error(busy ? 'Gemini is very busy right now. Messages were read by rules; try again in a few minutes.' : `No Gemini model answered (${last}).`);
}

/** Extract many messages, batched. Returns one guarded extraction per text. */
export async function extractWithGemini(texts, key, model, batch = 10, onProgress = () => {}) {
  const out = [];
  for (let i = 0; i < texts.length; i += batch) {
    const chunk = texts.slice(i, i + batch);
    const reply = await askGemini(buildExtractPrompt(chunk), key, model);
    out.push(...parseExtractReply(reply, chunk));
    onProgress(Math.min(texts.length, i + batch), texts.length);
  }
  return out;
}

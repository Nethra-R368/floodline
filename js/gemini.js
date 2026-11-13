// Gemini call from the browser (the user's own key; there is no FloodLine server).
import { buildExtractPrompt, parseExtractReply } from './core/prompt.js';

const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function askGemini(prompt, key, model) {
  const models = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let last = '';
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
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
        return text;
      }
      last = data.error?.message || `HTTP ${res.status}`;
      if ((res.status === 400 || res.status === 403) && /API key|permission|unregistered/i.test(last)) throw new Error('Gemini rejected the API key.');
      if (res.status === 429) throw new Error('Gemini free quota used up for now. Rules keep working; try AI again in a minute.');
      if (res.status === 404) break;
      if (res.status >= 500 && attempt === 0) { await sleep(1500); continue; }
      throw new Error(`Gemini error: ${last}`);
    }
  }
  throw new Error(`Model "${model}" not found (${last}).`);
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

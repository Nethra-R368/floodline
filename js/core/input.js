// Split whatever volunteers paste into separate messages.
// Understands WhatsApp "Export chat" lines ("[04/12/23, 9:41 pm] Ravi: text" or "04/12/2023, 21:41 - Ravi: text");
// otherwise messages are separated by blank lines.

const WA_LINE = /^‎?\[?(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s?(?:[ap]\.?\s?m\.?)?)\]?\s?(?:-\s)?([^:\n]{1,40}):\s?/i;

export function splitMessages(raw) {
  const text = String(raw || '').replace(/\r/g, '').trim();
  if (!text) return [];
  const lines = text.split('\n');
  if (lines.filter((l) => WA_LINE.test(l)).length >= 1 && WA_LINE.test(lines[0])) {
    const out = [];
    for (const line of lines) {
      const m = line.match(WA_LINE);
      if (m) out.push({ text: line.slice(m[0].length).trim(), sender: m[3].trim(), stamp: `${m[1]} ${m[2]}` });
      else if (out.length) out[out.length - 1].text += `\n${line}`;
    }
    return out.filter((m) => m.text && !/^<media omitted>$|^this message was deleted$/i.test(m.text.trim()));
  }
  return text.split(/\n\s*\n+/).map((t) => ({ text: t.trim() })).filter((m) => m.text);
}

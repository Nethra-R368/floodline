import re, sys, json, glob
D = sys.argv[1]
texts = {}
for f in sorted(glob.glob(D + '/*.ttl')):
    s = open(f, encoding='utf-8', errors='replace').read()
    for blk in s.split('\n\n'):
        m = re.search(r'tw:precedingMessageContent """(.*?)"""', blk, re.S) or re.search(r'tw:precedingMessageContent "(.*?)"\^\^', blk, re.S)
        if not m:
            m = re.search(r'tw:messageContent """(.*?)"""', blk, re.S) or re.search(r'tw:messageContent "(.*?)"\^\^', blk, re.S)
        if not m: continue
        t = re.sub(r'\s+', ' ', m.group(1)).strip()
        if t.startswith('RT @') and '…' in t: continue
        d = re.search(r'tw:sentAt "([^"]+)"', blk)
        texts.setdefault(t, d.group(1) if d else '')
REQ = re.compile(r'\b(stuck|stranded|trapped|rescue|need (a )?boat|boat needed|please help|pls help|plz help|urgent|sos|evacuat|terrace|first floor|1st floor|ground floor|old (man|woman|lady|couple|parents)|elderly|pregnant|bedridden|infant|baby|kids|children|no food|water level|neck|waist|chest|knee)\b', re.I)
OFFER = re.compile(r'\b(offering|available|free food|providing|accommodation available|we have|can host|helpline|verified:)\b', re.I)
cands = [(t, d) for t, d in texts.items() if REQ.search(t) and re.search(r'\d{10}|\d{5}\s?\d{5}|\+91', t) and not OFFER.search(t)]
print('unique tweets', len(texts), 'request candidates', len(cands))
json.dump(cands, open(D + '/cands.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
for t, d in cands[:40]: print('-', d[:16], t[:230])

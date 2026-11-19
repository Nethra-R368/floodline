"""All 593 real rescue-related #ChennaiFloods tweets (2-3 Dec 2015) -> anonymised stream with real timestamps."""
import json, re, hashlib, sys, html, collections
D, OUT, MODE = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else 'write')
C = json.load(open(f'{D}/cands.json', encoding='utf-8'))

def h(s, n):  # deterministic digits
    x = hashlib.sha256(('floodline-real-' + s).encode()).hexdigest()
    return ''.join(str(int(c, 16) % 10) for c in x)[:n]
def old_fake_phone(d): return d[:2] + h(d, len(d) - 2)  # first version (made invalid mobiles from +91 numbers) - kept only to map old recordings
def fake_phone(d):
    """Made-up number that keeps the format: the +91 / 91 / 0 prefix and the first digit of the 10-digit number stay,
    so a mobile stays a valid-looking Indian mobile (starts 6-9) and a landline stays a landline. Same input -> same output."""
    if len(d) < 10: return h(d, len(d))
    return d[:-10] + d[-10] + h(d, 9)

PLACES = set('''velachery velacheri pallikaranai palikaranai tambaram mudichur manali vyasarpadi pulianthope korattur saidapet kotturpuram adyar madipakkam
medavakkam perungudi thoraipakkam thoraipakam semmencherry semmenchery kannagi nanganallur ramapuram rampuram mugalivakkam porur ennore kolathur pallavaram
chromepet chrompet taramani ekkatuthangal ekkattuthangal ekkaduthangal guindy ashok nagar saligramam nandambakkam jafferkhanpet kodambakkam valasaravakkam
manapakkam omr ecr besant anna mylapore tnagar t.nagar nungambakkam vadapalani koyambedu kk west mambalam alandur aalandur perungalathur mudichur
chennai tamil nadu tn india kottur thiruvanmiyur sholinganallur karapakkam okkiyam virugambakkam ambattur avadi poonamallee mogappair anakaputhur
nandanam teynampet egmore royapettah triplicane perambur villivakkam annanagar arumbakkam kilpauk purasawalkam washermenpet tondiarpet royapuram
navalur siruseri kelambakkam medavakkam selaiyur madambakkam sembakkam'''.split())
STOP = set('''contact call cont ph phone mobile mob no number num urgent help pls plz please rescue need needs needed stranded stuck sos emergency boat boats
navy army ndrf ndma police govt government corporation commissioner officer team volunteer volunteers helpline helplines verified rt via the a an and
for with from near opp behind food water medicine shelter family families people person kids children baby mother father mom dad sister brother friend
friends uncle aunt grandma grandpa amma appa thatha paati lady girl boy old elder elderly pregnant twitter whatsapp radio city fm bsnl airtel jio
indian bank atm hospital school college apartment apartments flats flat colony street st road rd main cross avenue nagar garden gardens park tech tower
block lane salai extn extension phase sector east west north south new old first second third 1st 2nd 3rd ground floor terrace if any anyone someone
we they he she his her our my me us them hi hello dear sir madam bro anna akka thambi great god thanks thank you ok okay yes kindly also only just flr ola ist com con req cudntconnect'''.split())

def is_name(cand):
    ws = [w.strip('.').lower() for w in cand.split()]
    return ws and all(w not in PLACES and w not in STOP and len(w) > 1 for w in ws) and not any(w.isdigit() for w in ws)

EXTRA_NAMES = ['Arpan Shukla', 'Donato Jenda', 'Mohammed Khaja', 'Ananthakrishnan', 'Fedrick', 'Shanthi', 'Deepti', 'Sachina Garg', 'Sachina',
               'Balasubramaniam', 'Gajendran', 'Muthuselval', 'Samidurai', 'Suganya', 'Shobana', 'Karthi', 'Saravanbhavan', 'Abinash Ramamoorthy',
               'Abinash', 'Florina', 'Lakshmi C Marar', 'Madura Ganesh', 'Kushal Bajaj', 'Vikram', 'Anushree', 'Navaneetha', 'Poovazhagi', 'Aysha']
PSEUDO = ['Ravi', 'Priya', 'Arjun', 'Meena', 'Karthik', 'Divya', 'Suresh', 'Lakshmi', 'Vijay', 'Anitha', 'Ganesh', 'Kavya', 'Mohan', 'Revathi', 'Bala',
          'Sangeetha', 'Senthil', 'Uma', 'Prakash', 'Nisha', 'Kumar', 'Deepa', 'Siva', 'Janani', 'Arun', 'Keerthi', 'Raja', 'Sowmya', 'Dinesh', 'Malar']
names_seen = collections.Counter()
def pseudo(name):
    names_seen[name] += 1
    return PSEUDO[int(h(name.lower(), 4)) % len(PSEUDO)]

NAME = r"[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z.]{0,15}){0,2}"
PHONE = r"(?<!\d)(?:\+91|91|0)?[ -]?\d{5} ?\d{5}(?!\d)"
STREETW = r"(?:st|street|road|rd|nagar|avenue|colony|lane|cross|main|salai|garden|gardens|apartments?|aptmts?|flats?|block|tower)\b"

def anon(t):
    t = html.unescape(t).replace('\\"', '"').replace('\\r', ' ').replace('\r', ' ').replace('\\', '')
    t = re.sub(r'https?://\S+', '', t)
    t = re.sub(r'(?:^|\s)RT\s+@\w+:?', ' ', t)
    t = re.sub(r'"?@\w+:\s*', '', t) if re.match(r'^\s*"?@\w+:', t) else t
    t = re.sub(r'@\w+', '', t)
    t = re.sub(r'^\s*"?[A-Za-z0-9_]{3,20}:\s+', '', t)  # leftover 'username:' of a manual retweet
    t = re.sub(r'(\(\s*)(' + NAME + r')(\s*\))', lambda m: m.group(1) + (pseudo(m.group(2)) if is_name(m.group(2)) else m.group(2)) + m.group(3), t)
    def ph(m):
        raw = m.group(0); d = re.sub(r'\D', '', raw)
        if not (10 <= len(d) <= 13): return raw
        f = iter(fake_phone(d)); return ''.join(next(f) if ch.isdigit() else ch for ch in raw)
    t = re.sub(r'(?<![\d])\+?\d[\d \-.]{8,16}\d(?![\d])', ph, t)
    t = re.sub(r'(?<![\d])\d{6,9}(?![\d])', lambda m: fake_phone(m.group(0)) if not re.fullmatch(r'6\d{5}', m.group(0)) else m.group(0), t)  # landline groups (keep 6-digit pincodes)
    t = re.sub(r'(\d{5} ?\d{5})(\s*[-–:(]\s*)([a-z][a-z]{2,}(?:\s+[a-z]{3,})?)', lambda m: m.group(1) + m.group(2) + (pseudo(m.group(3)) if is_name(m.group(3)) else m.group(3)), t)
    t = re.sub(r'(?i)\b(stranded|stuck)\s+(' + NAME + r')\s*,', lambda m: m.group(1) + ' ' + (pseudo(m.group(2)) if is_name(m.group(2)) else m.group(2)) + ',', t)
    # names found by reading the output (people, not places): always replaced
    for nm in EXTRA_NAMES: t = re.sub(r"\b" + re.escape(nm) + r"\b", lambda m: pseudo(m.group(0)), t, flags=re.I)
    # names after cue words, and names right before a phone number
    t = re.sub(r'(?i:\b(?:contact|cont|call|reach|mr\.?|mrs\.?|ms\.?|dr\.?|commander|cmdr|cr\.?)\b)(\s*[:\-–]?\s*)(' + NAME + ')',
               lambda m: m.group(0).replace(m.group(2), pseudo(m.group(2))) if is_name(m.group(2)) else m.group(0), t)
    t = re.sub('(' + NAME + r')(\s*[-–:(]?\s*)(?=' + PHONE + ')',
               lambda m: pseudo(m.group(1)) + m.group(2) if is_name(m.group(1)) else m.group(0), t)
    # door / flat numbers
    t = re.sub(r'(?i)\b(no[.:]?|flat\s*no[.:]?|door\s*no[.:]?|plot\s*no[.:]?|fl\s*no|flno|#)\s*(\d{1,5}[a-z]?(?:[/-]\d{1,5}[a-z]?)?)(?![\d])(?![ -]?\d)',  # short door numbers only, never (half of) a phone number
               lambda m: m.group(1) + ' ' + re.sub(r'\d', lambda d: h(m.group(2), 9)[len(d.string[:d.start()]) % 9], m.group(2)), t)
    t = re.sub(r'\b(\d{1,4}[a-zA-Z]?[/-]\d{1,4}[a-zA-Z]?)\b', lambda m: re.sub(r'\d', lambda d: h(m.group(1), 9)[d.start() % 9], m.group(1)), t)
    t = re.sub(r'\b(\d{1,4})(,?\s+)(?=(?:[A-Za-z]+\s){0,3}' + STREETW + ')', lambda m: h(m.group(1), len(m.group(1))).lstrip('0').rjust(len(m.group(1)), '1') + m.group(2), t, flags=re.I)
    # phones were replaced first (above)
    return re.sub(r'\s{2,}', ' ', t).strip(' "')
    # phones last
    t = re.sub(PHONE, lambda m: (lambda d, raw: ''.join(next(it) if ch.isdigit() else ch for it in [iter(fake_phone(d))] for ch in raw))(re.sub(r'\D', '', m.group(0)), m.group(0)), t)
    return re.sub(r'\s{2,}', ' ', t).strip(' "')

MAP = {}  # old made-up 10-digit number -> new made-up number (to re-map recorded AI output)
for _t, _ in C:
    for _m in re.findall(r'\d[\d \-.]{8,16}\d', html.unescape(_t)):
        _d = re.sub(r'\D', '', _m)
        if 10 <= len(_d) <= 13: MAP[old_fake_phone(_d)[-10:]] = fake_phone(_d)[-10:]
rows = []
for text, at in sorted(C, key=lambda x: x[1]):
    # 2015-12-02T14:13:54+00:00 -> minutes after 19:30 IST on 2 Dec
    d, hh, mm, ss = int(at[8:10]), int(at[11:13]), int(at[14:16]), int(at[17:19])
    ist = (d - 2) * 1440 + hh * 60 + mm + ss / 60 + 330
    rows.append({'at': round(ist - (19 * 60 + 30), 2), 'text': anon(text)})
seen = set(); out = []
for r in rows:
    if r['text'] in seen: continue
    seen.add(r['text']); out.append(r)
if MODE == 'names':
    for n, k in names_seen.most_common(): print(k, n)
    sys.exit()
orig_phones = {re.sub(r'\D', '', m)[-10:] for t, _ in C for m in re.findall(PHONE, html.unescape(t))}
body = json.dumps(out, ensure_ascii=False)
leak = [p for p in orig_phones if p in re.sub(r'\D', '', body.replace(' ', ''))]
print('messages', len(out), 'from', len(C), 'orig phones', len(orig_phones), 'leaked', len(leak), 'names replaced', sum(names_seen.values()))
js = ['// 2015 Chennai floods, 2-3 December: every rescue-related tweet in the CC0 archive github.com/OpenLinkedSocialData/ChennaiFloods_tw',
      '// that mentions being stuck, rescue, water or a vulnerable person and contains a phone number, in the order and at the time',
      '// it was posted (at = minutes after 19:30 IST, 2 Dec 2015). Anonymised automatically: every phone number (same real number ->',
      '// same made-up number), @handles, links, door / flat numbers, and names next to a phone number or after contact / call / Dr / Mr.',
      '// Identical copies are dropped; reworded reposts are kept, as they happened.',
      'export const REAL_STREAM = ' + body + ';', '']
open(OUT, 'w', encoding='utf-8').write('\n'.join(js))
json.dump(MAP, open(OUT + '.phonemap.json', 'w'))

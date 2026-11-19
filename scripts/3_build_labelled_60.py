"""Builds js/core/realset.js: 60 real #ChennaiFloods tweets (2 Dec 2015, CC0 dataset), anonymised and hand-labelled."""
import json, re, hashlib, sys
D, OUT = sys.argv[1], sys.argv[2]
S = json.load(open(f'{D}/sample60.json', encoding='utf-8'))

# Person names, @handles and door numbers are replaced by hand (real -> made up); localities, streets and buildings are kept.
NAMES = [
    ('Kushal Bajaj', 'Kumar Bala'), ('Fedrick', 'Ravi'), ('Sachina Garg', 'Priya G'), ('Vikram', 'Arjun'), ('Madura Ganesh', 'Mohan G'),
    ('Ramki', 'Ramu'), ('Vadi', 'Vasu'), ('Abinash Ramamoorthy', 'Anand R'), ('Prakash', 'Senthil'), ('VenkateshKM', 'VenkatR'),
    ('Sriram', 'Srinath'), ('Sajan', 'Sam'), ('Gajendran', 'Ganesh'), ('Cr Tripathi', 'Cr Iyer'), ('commander tripathi', 'commander iyer'),
    ('Commander Arul', 'Commander Joseph'), ('sai siddharth', 'siddhu'), ('Manivasan IAS', 'Mani IAS'), ('Nakeeran', 'Nakul'),
    ('PETER', 'JOHN'), ('Dr Muthuselval', 'Dr Selvam'), ('Samidurai', 'Durai'), ('Sekar', 'Kannan'), ('Dr Lakshmi C Marar', 'Dr Latha M'),
    ('Suganya', 'Sangeetha'), ('Karthi', 'Bala'), ('Shobana', 'Sowmya'), ('Saravanbhavan', 'Sundar'), ('Arun.', 'Arul.'), ('Evera', 'Eva'),
]
DOORS = {7: [('No258', 'No187')], 4: [('35/4', '21/6')], 11: [('209,', '146,')], 16: [('2/3 ', '5/1 ')], 20: [('42 navarathna', '27 navarathna')],
         21: [('no 39 ', 'no 64 ')], 49: [('no 39 ', 'no 64 ')], 31: [('42/93', '18/57')], 37: [('New-12, old-1/1', 'New-31, old-4/2')],
         39: [('42 2nd St', '19 2nd St')], 42: [('AP 595', 'AP 418')], 45: [('49 Mangalambigai', '73 Mangalambigai')], 47: [('K1,', 'K4,')]}

def fake(digits):
    """Same real number -> same made-up number (keeps repeats detectable); keeps the first two digits and the length."""
    h = hashlib.sha256(('floodline-real-' + digits).encode()).hexdigest()
    body = ''.join(str(int(c, 16) % 10) for c in h)[: len(digits) - 2]
    return digits[:2] + body

def anon_text(t, n):
    t = re.sub(r'@\w+', '@user', t)
    t = re.sub(r'https?://\S+', 'https://t.co/link', t)
    for a, b in NAMES: t = t.replace(a, b)
    for a, b in DOORS.get(n, []): t = t.replace(a, b)
    # Phone-like digit runs (optionally split by one space or prefixed with +91 / 0): anonymise every digit, keep the layout.
    def rep(m):
        raw = m.group(0); d = re.sub(r'\D', '', raw)
        if len(d) < 10: return raw
        f = fake(d); it = iter(f)
        return ''.join(next(it) if ch.isdigit() else ch for ch in raw)
    return re.sub(r'(?<!\d)(?:\+91|91|0)?[ -]?\d{5} ?\d{5}(?!\d)', rep, t)

def mob(digits):  # label helper: real mobile -> made-up 10-digit number as FloodLine normalises it
    d = re.sub(r'\D', '', digits)
    return fake(d)[-10:] if len(d) == 10 else fake(d)[-10:]

# Hand labels: (kind, areaId or None, [real mobiles], people or None, [vulnerable], water or None, household or None)
# areaId None = the place is not one of FloodLine's 28 localities (area is then not scored). Landlines are not counted as phones.
R, O, N = 'request', 'offer', 'noise'
L = {
 0: (R, None, ['9940047929'], None, [], None, 'h0'),
 1: (R, 'velachery', ['919381069919'], 1, ['elderly', 'disabled'], None, 'h1'),
 2: (O, 'velachery', ['9381069919'], None, [], None, None),
 3: (R, None, ['9167430924'], 600, [], None, 'h3'),
 4: (R, None, ['9444037228'], 2, [], None, 'h4'),
 5: (R, 'madipakkam', ['9566167279'], None, ['infant', 'medical'], None, 'h5'),
 6: (O, 'velachery', ['9381069919'], None, [], None, None),
 7: (R, 'pallikaranai', ['9788570985'], None, [], None, 'h7'),
 8: (R, 'velachery', ['9940725055'], 1, ['pregnant'], None, 'h8'),
 9: (R, None, ['9888731811', '9986448418'], 2, [], None, 'h9'),
 10: (R, None, ['9884058511'], 40, [], 'roof', 'h10'),
 11: (R, 'ekkatuthangal', ['9840032585'], 1, [], None, 'h11'),
 12: (R, 'ramapuram', ['9788875444'], 1, ['pregnant'], None, 'h12'),
 13: (R, None, ['9940546305'], 2, ['infant'], 'roof', 'h13'),
 14: (R, None, ['9790921996', '9894531581'], None, [], None, 'h14'),
 15: (R, 'velachery', ['9500129227'], None, [], None, 'h15'),
 16: (R, None, ['9003963705'], None, [], None, 'h16'),
 17: (R, 'ekkatuthangal', ['9969049559'], None, [], None, 'h17'),
 18: (R, 'ekkatuthangal', ['9969049559'], None, [], None, 'h17'),
 19: (O, None, ['9790904355'], None, [], None, None),
 20: (R, 'ekkatuthangal', ['9444036675'], 1, ['pregnant'], None, 'h20'),
 21: (R, None, ['9444927969'], None, [], None, 'h21'),
 22: (R, None, ['09840954651'], None, [], 'roof', 'h22'),
 23: (R, None, ['9840595190'], None, [], None, 'h23'),
 24: (O, None, ['8220741384', '9840622192', '8754798540'], None, [], None, None),
 25: (R, 'tambaram', ['9941619940'], None, [], None, 'h25'),
 26: (R, 'tambaram', ['9941619940'], None, [], None, 'h25'),
 27: (R, 'tambaram', ['9941619940'], None, [], None, 'h25'),
 28: (O, None, [], None, [], None, None),
 29: (O, None, ['9790924413', '9444928581'], None, [], None, None),
 30: (O, None, ['9444928581'], None, [], None, None),
 31: (R, None, ['9789091979'], None, [], None, 'h31'),
 32: (O, None, [], None, [], None, None),
 33: (O, None, ['8547159884'], None, [], None, None),
 34: (O, None, ['8547159884'], None, [], None, None),
 35: (R, None, ['8428235879'], 1, [], None, 'h35'),
 36: (O, None, ['9444025002', '9445190200'], None, [], None, None),
 37: (R, None, ['8056055882'], 3, [], None, 'h37'),
 38: (O, 'thoraipakkam', ['9600004509'], None, [], None, None),
 39: (R, None, ['9444656582'], None, [], None, 'h39'),
 40: (O, None, ['8547159884', '9445051077', '9445190012', '9445190013'], None, [], None, None),
 41: (R, 'ekkatuthangal', ['9444472728'], None, [], None, 'h41'),
 42: (R, None, ['9840405196'], None, [], None, 'h42'),
 43: (O, None, ['8547159884', '9445051077', '9445190012', '9445190013'], None, [], None, None),
 44: (O, None, ['7708068600', '9500032669'], None, [], None, None),
 45: (R, 'thoraipakkam', ['9444183924'], None, ['infant'], None, 'h45'),
 46: (R, 'thoraipakkam', ['9840698098'], 20, [], None, 'h46'),
 47: (R, None, ['919884186133'], 70, [], None, 'h47'),
 48: (R, None, ['9444053063'], 20, ['disabled'], None, 'h48'),
 49: (R, None, ['9444927969', '9444112969'], None, [], None, 'h21'),
 50: (O, None, ['7760809370'], None, [], None, None),
 51: (R, None, ['9381016588'], None, [], None, 'h51'),
 52: (R, 'ramapuram', ['9629614678'], 2, [], 'roof', 'h52'),
 53: (R, None, ['9788815444', '9788835444', '9788875444'], 4, [], None, 'h12'),
 54: (R, 'thoraipakkam', ['9994298575'], 1, [], None, 'h54'),
 55: (R, 'thoraipakkam', ['9841195996'], 1, [], None, 'h55'),
 56: (O, None, ['9841067267', '9840183025'], None, [], None, None),
 57: (R, None, ['9840398777'], 40, [], None, 'h57'),
 58: (O, 'ramapuram', ['9940059475'], None, [], None, None),
 59: (R, None, ['9894973085', '9962404814'], None, [], None, 'h59'),
}
assert len(L) == 60
items = []
for s in S:
    n = s['n']; kind, area, phones, people, vul, water, hh = L[n]
    text = anon_text(s['text'], n)
    ph = [fake(re.sub(r'\D', '', p))[-10:] for p in phones]
    for p in ph: assert p in re.sub(r'\D', '', text), (n, p, text)
    items.append({'text': text, 'kind': kind, 'areaId': area, 'phones': ph, 'people': people, 'vulnerable': vul, 'water': water, 'household': hh, 'at': s['at']})
left = [x['text'] for x in items if re.search(r'Kushal|Fedrick|Sachina|Abinash|Gajendran|Muthuselval|Samidurai|Suganya|Shobana|Tripathi', x['text'])]
assert not left, left

js = ['// 60 REAL rescue-related tweets from the 2015 Chennai floods (#ChennaiFloods, 2-3 December 2015), from the CC0 dataset',
      '// github.com/OpenLinkedSocialData/ChennaiFloods_tw. Picked at random (seed 2015) from the 593 tweets that mention being stuck,',
      '// rescue, water level or a vulnerable person AND contain a phone number; offers and helpline lists were left in, because real',
      '// feeds are full of them. Person names, @handles, door numbers and every phone number were replaced with made-up ones (the same',
      '// real number always maps to the same made-up number, so reposts stay detectable). Localities, streets and buildings are as written.',
      '// Hand-labelled AFTER the rules, prompt and gazetteer were written; nothing was tuned on this set.',
      '// areaId null = the place is not one of FloodLine\'s 28 localities (area not scored). Only mobile numbers count as phones.',
      '// household: messages with the same label are about the same people (used to score grouping of repeats).',
      'export const REAL_SET = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';', '']
open(OUT, 'w', encoding='utf-8').write('\n'.join(js))
print('wrote', len(items), 'requests', sum(x['kind'] == R for x in items), 'in-gazetteer areas', sum(bool(x['areaId']) for x in items))

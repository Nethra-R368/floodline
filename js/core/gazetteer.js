// Chennai localities with approximate centre coordinates and spellings people actually type
// (English, Tanglish variants, Tamil script). Coordinates are locality centroids, good enough
// to cluster requests on a map and estimate boat trips; they are not street addresses.

export const AREAS = [
  { id: 'velachery', name: 'Velachery', lat: 12.9815, lng: 80.2180, aliases: ['velachery', 'velacheri', 'vellachery', 'வேளச்சேரி'] },
  { id: 'pallikaranai', name: 'Pallikaranai', lat: 12.9349, lng: 80.2137, aliases: ['pallikaranai', 'pallikarnai', 'pallikaranai marsh', 'பள்ளிக்கரணை'] },
  { id: 'tambaram', name: 'Tambaram', lat: 12.9249, lng: 80.1000, aliases: ['tambaram', 'thambaram', 'தாம்பரம்'] },
  { id: 'mudichur', name: 'Mudichur', lat: 12.9150, lng: 80.0700, aliases: ['mudichur', 'mudichoor', 'முடிச்சூர்'] },
  { id: 'manali-new-town', name: 'Manali New Town', lat: 13.1790, lng: 80.2700, aliases: ['manali new town', 'manali newtown', 'manali pudhu nagar', 'மணலி புதுநகர்'] },
  { id: 'manali', name: 'Manali', lat: 13.1667, lng: 80.2667, aliases: ['manali', 'மணலி'] },
  { id: 'vyasarpadi', name: 'Vyasarpadi', lat: 13.1170, lng: 80.2580, aliases: ['vyasarpadi', 'viyasarpadi', 'வியாசர்பாடி'] },
  { id: 'pulianthope', name: 'Pulianthope', lat: 13.0980, lng: 80.2645, aliases: ['pulianthope', 'puliyanthope', 'புளியந்தோப்பு'] },
  { id: 'korattur', name: 'Korattur', lat: 13.1077, lng: 80.1830, aliases: ['korattur', 'koratur', 'கொரட்டூர்'] },
  { id: 'saidapet', name: 'Saidapet', lat: 13.0213, lng: 80.2231, aliases: ['saidapet', 'saidapettai', 'சைதாப்பேட்டை'] },
  { id: 'kotturpuram', name: 'Kotturpuram', lat: 13.0186, lng: 80.2411, aliases: ['kotturpuram', 'kottur', 'கோட்டூர்புரம்'] },
  { id: 'adyar', name: 'Adyar', lat: 13.0012, lng: 80.2565, aliases: ['adyar', 'adayar', 'அடையாறு'] },
  { id: 'madipakkam', name: 'Madipakkam', lat: 12.9623, lng: 80.1986, aliases: ['madipakkam', 'madipakam', 'மடிப்பாக்கம்'] },
  { id: 'medavakkam', name: 'Medavakkam', lat: 12.9171, lng: 80.1923, aliases: ['medavakkam', 'medavakam', 'மேடவாக்கம்'] },
  { id: 'perungudi', name: 'Perungudi', lat: 12.9654, lng: 80.2461, aliases: ['perungudi', 'பெருங்குடி'] },
  { id: 'thoraipakkam', name: 'Thoraipakkam', lat: 12.9416, lng: 80.2362, aliases: ['thoraipakkam', 'okkiyam thoraipakkam', 'துரைப்பாக்கம்'] },
  { id: 'semmencherry', name: 'Semmencherry', lat: 12.8700, lng: 80.2240, aliases: ['semmencherry', 'semmenchery', 'செம்மஞ்சேரி'] },
  { id: 'kannagi-nagar', name: 'Kannagi Nagar', lat: 12.9070, lng: 80.2400, aliases: ['kannagi nagar', 'kannaginagar', 'கண்ணகி நகர்'] },
  { id: 'nanganallur', name: 'Nanganallur', lat: 12.9806, lng: 80.1897, aliases: ['nanganallur', 'நங்கநல்லூர்'] },
  { id: 'ramapuram', name: 'Ramapuram', lat: 13.0317, lng: 80.1817, aliases: ['ramapuram', 'ராமாபுரம்'] },
  { id: 'mugalivakkam', name: 'Mugalivakkam', lat: 13.0210, lng: 80.1610, aliases: ['mugalivakkam', 'mugalivakam', 'முகலிவாக்கம்'] },
  { id: 'porur', name: 'Porur', lat: 13.0382, lng: 80.1565, aliases: ['porur', 'போரூர்'] },
  { id: 'ennore', name: 'Ennore', lat: 13.2146, lng: 80.3203, aliases: ['ennore', 'ennur', 'எண்ணூர்'] },
  { id: 'kolathur', name: 'Kolathur', lat: 13.1240, lng: 80.2120, aliases: ['kolathur', 'kolatur', 'கொளத்தூர்'] },
  { id: 'pallavaram', name: 'Pallavaram', lat: 12.9675, lng: 80.1491, aliases: ['pallavaram', 'பல்லாவரம்'] },
  { id: 'chromepet', name: 'Chromepet', lat: 12.9516, lng: 80.1462, aliases: ['chromepet', 'chrompet', 'குரோம்பேட்டை'] },
  { id: 'taramani', name: 'Taramani', lat: 12.9863, lng: 80.2432, aliases: ['taramani', 'tharamani', 'தரமணி'] },
  { id: 'ekkatuthangal', name: 'Ekkatuthangal', lat: 13.0170, lng: 80.2050, aliases: ['ekkatuthangal', 'ekkaduthangal', 'ஈக்காட்டுத்தாங்கல்'] },
];

// Longest aliases first so "manali new town" wins over "manali".
const ALIAS_INDEX = AREAS
  .flatMap((a) => a.aliases.map((alias) => ({ alias, area: a })))
  .sort((x, y) => y.alias.length - x.alias.length);

const AREA_BY_ID = new Map(AREAS.map((a) => [a.id, a]));
export const areaById = (id) => AREA_BY_ID.get(id) || null;

const isLatinWordChar = (ch) => /[a-z0-9]/.test(ch || '');

/** Find the first known locality mentioned in a message. Returns the area or null. */
export function findArea(text) {
  const t = String(text || '').toLowerCase();
  let best = null;
  for (const { alias, area } of ALIAS_INDEX) {
    let from = 0;
    while (true) {
      const i = t.indexOf(alias, from);
      if (i === -1) break;
      const latin = /^[a-z]/.test(alias);
      const okLeft = !latin || !isLatinWordChar(t[i - 1]);
      const okRight = !latin || !isLatinWordChar(t[i + alias.length]) || /^(la|le|il|ile|ku|kku)\b/.test(t.slice(i + alias.length));
      if (okLeft && okRight) {
        if (!best || i < best.index) best = { index: i, area };
        break;
      }
      from = i + 1;
    }
    if (best && best.index === 0) break;
  }
  return best ? best.area : null;
}

/** Name an area from free text (e.g. what the AI returned) only if it's in the gazetteer. */
export function resolveArea(name) {
  if (!name) return null;
  const direct = AREAS.find((a) => a.id === name || a.name.toLowerCase() === String(name).toLowerCase());
  return direct || findArea(name);
}

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

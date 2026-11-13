// Hand-written, hand-labelled hard cases. Unlike the generated night, these were NOT written
// from the same templates the rules know: landmarks instead of area names, Tamil number words,
// typos, two phones, advisories that look like requests, offers phrased loosely.
// Label fields: kind, areaId (null = not determinable), phones, people (null = not stated),
// vulnerable, water (null = not stated). Phone numbers are fictional.

export const HARD_SET = [
  { text: 'pls help velachery vijaya nagar 3rd main rd near bus depot. my amma alone 70yrs. her no 98410 22345', kind: 'request', areaId: 'velachery', phones: ['9841022345'], people: 1, vulnerable: ['elderly'], water: null },
  { text: 'Guys anyone in Mudichur?? Varadharajapuram side full water. 2 families on terrace, 9 ppl incl 2 kids', kind: 'request', areaId: 'mudichur', phones: [], people: 9, vulnerable: [], water: 'roof' },
  { text: 'Our house in Pallikaranai Kamakoti nagar, water entered ground floor till 4 feet. Grandpa on oxygen concentrator, power cut, cylinder needed urgently!! Call 9884012345 / 9445012345', kind: 'request', areaId: 'pallikaranai', phones: ['9884012345', '9445012345'], people: null, vulnerable: ['medical', 'elderly'], water: 'waist' },
  { text: 'முடிச்சூர் லட்சுமி நகர் 4வது தெருவில் 5 பேர் சிக்கியுள்ளோம். குழந்தைக்கு பால் இல்லை. 7010012345', kind: 'request', areaId: 'mudichur', phones: ['7010012345'], people: 5, vulnerable: ['infant'], water: null },
  { text: 'Velacheri taramani link rd la en friend family maatikitanga, kazhuthu alavu thanni. 8 month pregnant wife irukanga!!! 9003012345', kind: 'request', areaId: 'velachery', phones: ['9003012345'], people: null, vulnerable: ['pregnant'], water: 'neck' },
  { text: 'Near Phoenix mall backside streets totally flooded, old couple stuck in 1st floor, cant come down. 9840098400', kind: 'request', areaId: 'velachery', phones: ['9840098400'], people: 2, vulnerable: ['elderly'], water: 'roof' },
  { text: 'Update: Mrs. Revathi family at Saidapet Jones Road rescued by NDRF at 4am. thank you all 🙏 dont forward anymore', kind: 'update', areaId: 'saidapet', phones: [], people: null, vulnerable: [], water: null },
  { text: 'I have a tractor and 4 guys, can come to Medavakkam side for shifting people. msg me 9787012345', kind: 'offer', areaId: 'medavakkam', phones: ['9787012345'], people: null, vulnerable: [], water: null },
  { text: 'we r three ppl + dog, Korattur lake road, water knee high now but rising', kind: 'request', areaId: 'korattur', phones: [], people: 3, vulnerable: [], water: 'knee' },
  { text: 'Ennore creek side fishermen colony 40+ families stranded, no food 2 days, kids n elderly. Contact ward councillor 9445500000', kind: 'request', areaId: 'ennore', phones: ['9445500000'], people: null, vulnerable: ['elderly'], water: null },
  { text: "My grandmother is bedridden in Kotturpuram, Chitra Nagar. Water in house till hip. we are in Bangalore can't reach her. Her neighbour Selvi 9361012345", kind: 'request', areaId: 'kotturpuram', phones: ['9361012345'], people: 1, vulnerable: ['medical', 'elderly'], water: 'waist' },
  { text: 'SOS!!!!! Semmenchery. 30 people in Sunnambu kolathur, children & pregnant women. water neck. no boat came since yesterday', kind: 'request', areaId: 'semmencherry', phones: [], people: 30, vulnerable: ['pregnant'], water: 'neck' },
  { text: 'வியாசர்பாடி கல்யாணபுரம் குடும்பம் மீட்கப்பட்டனர். நன்றி. பகிர வேண்டாம்.', kind: 'update', areaId: 'vyasarpadi', phones: [], people: null, vulnerable: [], water: null },
  { text: 'Pulianthope - 2 kids 1 with high fever, no medicine, water waist. Pls send help. 99620 12345', kind: 'request', areaId: 'pulianthope', phones: ['9962012345'], people: null, vulnerable: ['medical'], water: 'waist' },
  { text: 'Okkiyam Thoraipakkam karapakkam area full submerged. My parents (68, 72) on 2nd floor. no power no water 3 days. 9500012345', kind: 'request', areaId: 'thoraipakkam', phones: ['9500012345'], people: 2, vulnerable: ['elderly'], water: 'roof' },
  { text: 'Velachery 100 feet road waterlogged, avoid', kind: 'noise', areaId: 'velachery', phones: [], people: null, vulnerable: [], water: null },
  { text: 'Kaapathunga!! Manali new town, Ezhil nagar. thatha heart patient, 4 per, maadi la irukom. 8925012345', kind: 'request', areaId: 'manali-new-town', phones: ['8925012345'], people: 4, vulnerable: ['medical', 'elderly'], water: 'roof' },
  { text: 'Tambaram West, Kadaperi - our street has 3 ft water, elderly lady 85 living alone, phone not reachable. Her son abroad requesting help. Address: 14, Kamaraj street', kind: 'request', areaId: 'tambaram', phones: [], people: 1, vulnerable: ['elderly'], water: 'waist' },
  { text: 'medavakkam jalladianpet 6 people trapped water rising rapidly. 1 dialysis patient tomorrow schedule. 9840512345', kind: 'request', areaId: 'medavakkam', phones: ['9840512345'], people: 6, vulnerable: ['medical'], water: null },
  { text: 'Adyar river overflowing near Kotturpuram bridge, everyone move to higher floors', kind: 'noise', areaId: 'adyar', phones: [], people: null, vulnerable: [], water: null },
  { text: 'Can anyone help Madipakkam ram nagar 10 families no food since morning! Contact 9176012345', kind: 'request', areaId: 'madipakkam', phones: ['9176012345'], people: null, vulnerable: [], water: null },
  { text: 'chromepet hastinapuram 2 aged people 1 wheelchair, ground floor flooded upto knee. 9445098765', kind: 'request', areaId: 'chromepet', phones: ['9445098765'], people: 2, vulnerable: ['elderly', 'disabled'], water: 'knee' },
  { text: 'போரூர் ஏரி அருகே மூன்று பேர் வீட்டில் சிக்கியுள்ளோம், தண்ணீர் கழுத்து அளவு! உடனடியாக படகு தேவை', kind: 'request', areaId: 'porur', phones: [], people: 3, vulnerable: [], water: 'neck' },
  { text: "Thanks to everyone who shared, my parents in Nanganallur are safe now at relative's place", kind: 'update', areaId: 'nanganallur', phones: [], people: null, vulnerable: [], water: null },
  { text: 'Perungudi - pregnant lady labour pain started!! water waist level, ambulance cant come. 9087612345', kind: 'request', areaId: 'perungudi', phones: ['9087612345'], people: null, vulnerable: ['pregnant'], water: 'waist' },
  { text: 'Fake news: no lake breach in Porur. Dont panic', kind: 'noise', areaId: 'porur', phones: [], people: null, vulnerable: [], water: null },
  { text: 'Korattur: 2 old people stuck in ground floor, water chest level, pls rush. landmark: near Korattur railway station. 9361198765', kind: 'request', areaId: 'korattur', phones: ['9361198765'], people: 2, vulnerable: ['elderly'], water: 'neck' },
  { text: 'IIT Madras staff quarters opposite side, Taramani - 1 yr old baby and mother stuck, house flooded chest deep. 7299012345', kind: 'request', areaId: 'taramani', phones: ['7299012345'], people: 2, vulnerable: ['infant'], water: 'neck' },
  { text: 'Ramapuram Bharathi salai, my father 79 needs insulin, shops closed, cant go out water till knee', kind: 'request', areaId: 'ramapuram', phones: [], people: 1, vulnerable: ['medical', 'elderly'], water: 'knee' },
  { text: 'Need 50 food packets for Kannagi Nagar relief camp, families shifted there from flooded houses. Coordinator 9940012345', kind: 'request', areaId: 'kannagi-nagar', phones: ['9940012345'], people: null, vulnerable: [], water: null },
];

/** Field-by-field accuracy of an extractor on the hard set. Fields only count where labelled. */
export function scoreHardSet(extract, set = HARD_SET) {
  const tally = { kind: [0, 0], area: [0, 0], phones: [0, 0], people: [0, 0], vulnerable: [0, 0], water: [0, 0] };
  const misses = [];
  set.forEach((c, i) => {
    const x = extract(c.text, i);
    const check = (field, ok) => { tally[field][1]++; if (ok) tally[field][0]++; else misses.push({ i, field, text: c.text, want: c[field === 'area' ? 'areaId' : field], got: field === 'area' ? x.areaId : x[field] }); };
    check('kind', x.kind === c.kind);
    if (c.areaId) check('area', x.areaId === c.areaId);
    if (c.kind === 'request') {
      check('phones', c.phones.length === (x.phones || []).length && c.phones.every((p) => (x.phones || []).includes(p)));
      if (c.people != null) check('people', x.people === c.people);
      check('vulnerable', c.vulnerable.length === x.vulnerable.length && c.vulnerable.every((v) => x.vulnerable.includes(v)));
      check('water', (x.water || null) === c.water);
    }
  });
  const pct = ([a, b]) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const fields = Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, pct(v)]));
  const all = Object.values(tally).reduce((s, [a, b]) => [s[0] + a, s[1] + b], [0, 0]);
  return { fields, overall: pct(all), checks: all[1], misses };
}

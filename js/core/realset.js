// 60 REAL rescue-related tweets from the 2015 Chennai floods (#ChennaiFloods, 2-3 December 2015), from the CC0 dataset
// github.com/OpenLinkedSocialData/ChennaiFloods_tw. Picked at random (seed 2015) from the 593 tweets that mention being stuck,
// rescue, water level or a vulnerable person AND contain a phone number; offers and helpline lists were left in, because real
// feeds are full of them. Person names, @handles, door numbers and every phone number were replaced with made-up ones (the same
// real number always maps to the same made-up number, so reposts stay detectable). Localities, streets and buildings are as written.
// Hand-labelled AFTER the rules, prompt and gazetteer were written; nothing was tuned on this set.
// areaId null = the place is not one of FloodLine's 28 localities (area not scored). Only mobile numbers count as phones.
// household: messages with the same label are about the same people (used to score grouping of repeats).
export const REAL_SET = [
 {
  "text": "\"@user: any rescue team in perungalathur call dis 9906123814. Stucked in hme #ChennaiRainsHelp #ChennaiFloods #chennairain\"",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9906123814"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h0",
  "at": "2015-12-02T14:14"
 },
 {
  "text": "A handicap elder person is stuck in Velachery.. Need help.. Contact +916295617301 #ChennaiRainsHelp #ChennaiFloods #chennairain",
  "kind": "request",
  "areaId": "velachery",
  "phones": [
   "6295617301"
  ],
  "people": 1,
  "vulnerable": [
   "elderly",
   "disabled"
  ],
  "water": null,
  "household": "h1",
  "at": "2015-12-02T14:15"
 },
 {
  "text": "Anyone in Velachery that need a boat to rescue them, call 9311932122. Please share #ChennaiFloods @user @user @user",
  "kind": "offer",
  "areaId": "velachery",
  "phones": [
   "9311932122"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T14:15"
 },
 {
  "text": "#ChennaiFloods \"600 of us stuck in 2 adjacent buildings. 200 having no food water. Nandambakkam area. Call Kumar Bala: 91243 38233.\"",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9124338233"
  ],
  "people": 600,
  "vulnerable": [],
  "water": null,
  "household": "h3",
  "at": "2015-12-02T14:16"
 },
 {
  "text": "Stranded parents 21/6 12th avenue vaigai colony 1st cross st Ashok nagar Phones not working. 9442445201 #ChennaiRainsHelp #ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9442445201"
  ],
  "people": 2,
  "vulnerable": [],
  "water": null,
  "household": "h4",
  "at": "2015-12-02T14:20"
 },
 {
  "text": "3 year old baby is in emergency in Madipakkam..they need boat services/doctor. Ph:9534214071 #ChennaiFloods @user",
  "kind": "request",
  "areaId": "madipakkam",
  "phones": [
   "9534214071"
  ],
  "people": null,
  "vulnerable": [
   "infant",
   "medical"
  ],
  "water": null,
  "household": "h5",
  "at": "2015-12-02T14:23"
 },
 {
  "text": "\"@user: Anyone in Velachery that need a boat to rescue them, call 9311932122. Please share #ChennaiFloods @user @user\"",
  "kind": "offer",
  "areaId": "velachery",
  "phones": [
   "9311932122"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T14:24"
 },
 {
  "text": "@user Help very urgent Ravi Flno No187,Srisaibalaji Nagar,Near Siva avenue,Palikaranai,Velacheri Contact 9704821840 #Chennaifloods",
  "kind": "request",
  "areaId": "pallikaranai",
  "phones": [
   "9704821840"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h7",
  "at": "2015-12-02T14:26"
 },
 {
  "text": "A pregnant lady needs help in chennai velachery 2nd main road. 9911445431 #ChennaiRainsHelp pls pls spread it ,,, #ChennaiFloods",
  "kind": "request",
  "areaId": "velachery",
  "phones": [
   "9911445431"
  ],
  "people": 1,
  "vulnerable": [
   "pregnant"
  ],
  "water": null,
  "household": "h8",
  "at": "2015-12-02T14:37"
 },
 {
  "text": "Priya G 9857347000..Arjun 99875 23243-needs rescue..TVH apartments OMR near TCS chennai one @user @user #ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9857347000",
   "9987523243"
  ],
  "people": 2,
  "vulnerable": [],
  "water": null,
  "household": "h9",
  "at": "2015-12-02T15:29"
 },
 {
  "text": "#PrayforChennai AshokNagar 11th avenue,Vishal flats,10Kids 30adlts,grnd flr drwnd water in2 first floor,pls call 9857242361 #ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9857242361"
  ],
  "people": 40,
  "vulnerable": [],
  "water": "roof",
  "household": "h10",
  "at": "2015-12-02T15:30"
 },
 {
  "text": "Mohan G (stranded at 146, defense coloy, 3rd street, Ekkadutangal, guindy, Ph # 9893683349 #ChennaiFloods #ChennaiRains @user",
  "kind": "request",
  "areaId": "ekkatuthangal",
  "phones": [
   "9893683349"
  ],
  "people": 1,
  "vulnerable": [],
  "water": null,
  "household": "h11",
  "at": "2015-12-02T15:35"
 },
 {
  "text": "#Pregnant lady in #labour pain Mukambikai Nagar, Ramapuram ( 9762150343) #ChennaiRainsHelp #ChennaiFloods #Chennai",
  "kind": "request",
  "areaId": "ramapuram",
  "phones": [
   "9762150343"
  ],
  "people": 1,
  "vulnerable": [
   "pregnant"
  ],
  "water": null,
  "household": "h12",
  "at": "2015-12-02T15:47"
 },
 {
  "text": "Urgent: Mother & 4 weeks old baby stuck in terrace Janakiraman St, Jafferkhanpet 9969721318 #ChennaiRainsHelp #ChennaiFloods @user",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9969721318"
  ],
  "people": 2,
  "vulnerable": [
   "infant"
  ],
  "water": "roof",
  "household": "h13",
  "at": "2015-12-02T15:52"
 },
 {
  "text": "#ChennaiFloods #ChennaiRainsHelp INDIAN BANK ATM(Near Global hospital) 10-15 Need help, very urgent. Contact 9743934203, 9834923292",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9743934203",
   "9834923292"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h14",
  "at": "2015-12-02T15:52"
 },
 {
  "text": "HELP! Family with kid stuck behind Chennai Silks, Velachery.Vasu-9515589117 #ChennaiFloods #ChennaiRainsHelp #chennairain",
  "kind": "request",
  "areaId": "velachery",
  "phones": [
   "9515589117"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h15",
  "at": "2015-12-02T15:53"
 },
 {
  "text": "Family at 5/1 First floor,Logaiah St,Velayutham Colony, Saligramam.Ramu(9093019245) from CBE concerned #ChennaiRainsHelp #ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9093019245"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h16",
  "at": "2015-12-02T15:53"
 },
 {
  "text": "People stranded - Defence officer's colony, Ekkattuthangal if can get in touch call 9916645034. #ChennaiFloods #ChennaiRainsHelp",
  "kind": "request",
  "areaId": "ekkatuthangal",
  "phones": [
   "9916645034"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h17",
  "at": "2015-12-02T15:53"
 },
 {
  "text": "user: People stranded - Defence officer's colony, Ekkattuthangal if can get in touch call 9916645034. #ChennaiFloods #ChennaiRainsHelp",
  "kind": "request",
  "areaId": "ekkatuthangal",
  "phones": [
   "9916645034"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h17",
  "at": "2015-12-02T15:54"
 },
 {
  "text": "People stranded @ Adyar,besant,omr,ecr & velachery call Anand R 9775544010 #ChennaiFloods #ChennaiRescue #ChennaiRainsHelp",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "9775544010"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T15:59"
 },
 {
  "text": "#Chennairains #chennaifloods #chennairainshelp Pregnant lady stuck in 27 navarathna gardens ekkattuthangal, labour pain call9453144582",
  "kind": "request",
  "areaId": "ekkatuthangal",
  "phones": [
   "9453144582"
  ],
  "people": 1,
  "vulnerable": [
   "pregnant"
  ],
  "water": null,
  "household": "h20",
  "at": "2015-12-02T16:01"
 },
 {
  "text": "@user: Family stranded at no 64 balakrishnan st jafferkhan st contact Senthil 9450520435 #chennairainrelief2015 #ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9450520435"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h21",
  "at": "2015-12-02T16:10"
 },
 {
  "text": "Pl help Ashok nagar -Thiru Nagar - Appar streetResidents are stranded on Terrace as water entered I floor. 09349591410 #ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9349591410"
  ],
  "people": null,
  "vulnerable": [],
  "water": "roof",
  "household": "h22",
  "at": "2015-12-02T16:13"
 },
 {
  "text": "1000s people stranded n anakaputhur near arunmathi theatre #ChennaiFloods #chennaimicro 9848031380 @user",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9848031380"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h23",
  "at": "2015-12-02T16:22"
 },
 {
  "text": "RESCUE ASHOK NAGAR VenkatR 8232004193 Srinath 9822112767 RESCUE KK NAGAR Sam 8727021390 #ChennaiFloods #ChennaiRainsHelp #ChennaiRain",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "8232004193",
   "9822112767",
   "8727021390"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T16:38"
 },
 {
  "text": "@user Stranded families Ph #: 9983175741 GA Avenue, Sri Meenakshi Nagar, Tambaram 63 #ChennaiFloods #ChennaiRainsHelp",
  "kind": "request",
  "areaId": "tambaram",
  "phones": [
   "9983175741"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h25",
  "at": "2015-12-02T17:06"
 },
 {
  "text": "@user Stranded families Ph #: 9983175741 GA Avenue, Sri Meenakshi Nagar, Tambaram 63 #ChennaiFloods #ChennaiRainsHelp",
  "kind": "request",
  "areaId": "tambaram",
  "phones": [
   "9983175741"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h25",
  "at": "2015-12-02T17:09"
 },
 {
  "text": "@user Stranded families Ph #: 9983175741 GA Avenue, Sri Meenakshi Nagar, Tambaram 63 #ChennaiFloods #ChennaiRainsHelp",
  "kind": "request",
  "areaId": "tambaram",
  "phones": [
   "9983175741"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h25",
  "at": "2015-12-02T17:10"
 },
 {
  "text": "Rescue Boats reached #Jafferkhanpet Phone : 04356533519, 04611457031 Verified. #ChennaiFloods #ChennaiRainsHelp",
  "kind": "offer",
  "areaId": null,
  "phones": [],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T17:28"
 },
 {
  "text": "#RadioCityChennai Ramapuram Boat Rescue Number - 9763605153 Cr Iyer - OMR Boats Rescue 9480043752 #ChennaiFloods",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "9763605153",
   "9480043752"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T17:44"
 },
 {
  "text": "People who are stranded and need boats contact commander iyer who is sending boats Contact 9480043752 #ChennaiRainsHelp #ChennaiFloods",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "9480043752"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T17:52"
 },
 {
  "text": "Need Rescue Ganesh, Jayalakshmi apartment, 18/57, canal bank road, CIT Nagar - Ph - 9730234835 #ChennaiFloods via @user",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9730234835"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h31",
  "at": "2015-12-02T17:56"
 },
 {
  "text": "04240955571 west mambalam rescue number. Verified. #ChennaiRains #ChennaiFloods @user @user @user RT",
  "kind": "offer",
  "areaId": null,
  "phones": [],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T18:01"
 },
 {
  "text": "Commander Joseph can be contacted for evacuation from helicopters for ppl stuck on rooftops. 8540638513 #ChennaiFloods #ChennaiRains",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "8540638513"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T19:06"
 },
 {
  "text": "@user Commander Joseph can be contacted for evacuation from helicopters for ppl stuck on rooftops. 8540638513 #ChennaiFloods",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "8540638513"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T19:08"
 },
 {
  "text": "#ChennaiFloods #shelter needed for tonight.victim(siddhu) stuck@user-bus stop,(koyambedu?).phone: 8447614932",
  "kind": "request",
  "areaId": null,
  "phones": [
   "8447614932"
  ],
  "people": 1,
  "vulnerable": [],
  "water": null,
  "household": "h35",
  "at": "2015-12-02T19:28"
 },
 {
  "text": "@user NDRF Rescue Team at Defense colony is \"Mani IAS 9446411623\"and \"Nakul 9407114334\" #ChennaiRains #ChennaiFloods",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "9446411623",
   "9407114334"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T21:27"
 },
 {
  "text": "emergency fmly of 3 pple are stranded at nandanam. New-31, old-4/2, old tower blck strt, nandanam exten. Cntct no-8048542745.#ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "8048542745"
  ],
  "people": 3,
  "vulnerable": [],
  "water": null,
  "household": "h37",
  "at": "2015-12-02T22:35"
 },
 {
  "text": "Contact:JOHN 9681311482 Rescue mission started at #Thoraipakkam. #ChennaiRainsHelp #ChennaiFloods #ChennaiMicro",
  "kind": "offer",
  "areaId": "thoraipakkam",
  "phones": [
   "9681311482"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-02T23:26"
 },
 {
  "text": "PLEASE HELP FOR A FAMILY IN TNAGAR #ChennaiRainsHelp #ChennaiFloods 19 2nd St Madly Road TNagar 9408536827 https://t.co/link",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9408536827"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h39",
  "at": "2015-12-02T23:57"
 },
 {
  "text": "#ChennaiFloods #ChennaiRainsHelp Helicopter Rescue 8540638513 தாம்பரம் 94134 67354 ஆலந்தூர் 94092 02761 அடையாறு 94152 61524",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "8540638513",
   "9413467354",
   "9409202761",
   "9415261524"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-03T01:18"
 },
 {
  "text": "#ChennaiFloods Lost Contact with Dr Selvam past 36 hours.kindly send rescue. ph 9465813615, 04557021426 near mamcholai ekattuthangal",
  "kind": "request",
  "areaId": "ekkatuthangal",
  "phones": [
   "9465813615"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h41",
  "at": "2015-12-03T01:25"
 },
 {
  "text": "Need boat to rescue urgently AP 418, 16th East Cross, MKB Nagar, Chennai – 39, Contact: 9895782419 #ChennaiRainsHelp #ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9895782419"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h42",
  "at": "2015-12-03T01:31"
 },
 {
  "text": "Helicopter Rescue 8540638513 #Tambaram 94134 67354 #Aalandur 94092 02761 #Adyar 94152 61524 #Perungudi #ChennaiFloods #ChennaiRainsHelp",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "8540638513",
   "9413467354",
   "9409202761",
   "9415261524"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-03T02:00"
 },
 {
  "text": "Trained emergency rescue team with boats : 7732184900 9533353104 (emergency) #ChennaiFloods #ChennaiRainsHelp #chennairain #ChennaiVolunteer",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "7732184900",
   "9533353104"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-03T02:24"
 },
 {
  "text": "HELP!!Family with 3months baby stranded at 73 Mangalambigai nagar,Mehta rd,Thoraipakam,Chennai. Opp MNM jain coll. 9437531514#Chennaifloods",
  "kind": "request",
  "areaId": "thoraipakkam",
  "phones": [
   "9437531514"
  ],
  "people": null,
  "vulnerable": [
   "infant"
  ],
  "water": null,
  "household": "h45",
  "at": "2015-12-03T02:26"
 },
 {
  "text": "#ChennaiFloods #chennairain #chennairains #ChennaiRainsHelp Any boat service in sri sai nagar,thoraipakam?Pls msg to 9874944548. 20 stranded",
  "kind": "request",
  "areaId": "thoraipakkam",
  "phones": [
   "9874944548"
  ],
  "people": 20,
  "vulnerable": [],
  "water": null,
  "household": "h46",
  "at": "2015-12-03T02:56"
 },
 {
  "text": "#ChennaiRainsHelp #ChennaiFloods Got msg:URGENT 70+ lives:K4, Bhatia Garden, Manapakkam Main road (Near MIOT hosp). Durai+919260248923.",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9260248923"
  ],
  "people": 70,
  "vulnerable": [],
  "water": null,
  "household": "h47",
  "at": "2015-12-03T03:42"
 },
 {
  "text": "@user @user Need a boat to access 20 visually challenged children 9440400724 #ChennaiFloods",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9440400724"
  ],
  "people": 20,
  "vulnerable": [
   "disabled"
  ],
  "water": null,
  "household": "h48",
  "at": "2015-12-03T04:30"
 },
 {
  "text": "Family stranded at no 64 balakrishnan st jafferkhanpet contact Senthil 9450520435 /9431521321 #ChennaiFloods #ChennaiRainsHelp",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9450520435",
   "9431521321"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h21",
  "at": "2015-12-03T04:46"
 },
 {
  "text": "If you are stuck and you need a #phonerecharge please text your number and network to 7740079192 #ChennaiFloods #ChennaiRainsHelp",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "7740079192"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-03T04:51"
 },
 {
  "text": "#help Kannan near to valasaravakkam need a help, his mom died he need to rescue her body No :9311354296 #ChennaiFloods #ChennaiRainsHelp",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9311354296"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h51",
  "at": "2015-12-03T04:59"
 },
 {
  "text": "#ChennaiFloods : Dr Latha M 9648136482, @user 2 people are stuck, they r in terrace, please save them by #boat. Pls help Urgent",
  "kind": "request",
  "areaId": "ramapuram",
  "phones": [
   "9648136482"
  ],
  "people": 2,
  "vulnerable": [],
  "water": "roof",
  "household": "h52",
  "at": "2015-12-03T05:14"
 },
 {
  "text": "Urgent Help need to 4 woman in this address.Cont Sangeetha 9731222633,9784531324,9762150343 #ChennaiRainsHelp #ChennaiFloods #சென்னைமழைஉதவி",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9731222633",
   "9784531324",
   "9762150343"
  ],
  "people": 4,
  "vulnerable": [],
  "water": null,
  "household": "h12",
  "at": "2015-12-03T05:29"
 },
 {
  "text": "@user Unable to contact frnds bro Bala(9990510055) residing at Arihant escapade apartment #Thoraipakkam #ChennaiFloods.pls help",
  "kind": "request",
  "areaId": "thoraipakkam",
  "phones": [
   "9990510055"
  ],
  "people": 1,
  "vulnerable": [],
  "water": null,
  "household": "h54",
  "at": "2015-12-03T05:55"
 },
 {
  "text": "A girl is struckd in #thoraipakkam.She cried..Pls help her...Sowmya- 9880341070 #Chennairains #Chennaifloods #ChennaiMicro (1)",
  "kind": "request",
  "areaId": "thoraipakkam",
  "phones": [
   "9880341070"
  ],
  "people": 1,
  "vulnerable": [],
  "water": null,
  "household": "h55",
  "at": "2015-12-03T06:03"
 },
 {
  "text": "People who are stranded in Ashok Nagar area Rescue help coordinated by Sundar - 9874124017, 9861135041 https://t.co/link",
  "kind": "offer",
  "areaId": null,
  "phones": [
   "9874124017",
   "9861135041"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-03T06:21"
 },
 {
  "text": "40 kids in Kodambakkam need food 9847449033 #ChennaiFloods #ChennaiRainsHelp @user @user @user @user",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9847449033"
  ],
  "people": 40,
  "vulnerable": [],
  "water": null,
  "household": "h57",
  "at": "2015-12-03T06:22"
 },
 {
  "text": "contact for Rescue/Assistance Ramapuram -Roshan 9959938095 ..share .. #chennairains #chennaifloods",
  "kind": "offer",
  "areaId": "ramapuram",
  "phones": [
   "9959938095"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": null,
  "at": "2015-12-03T06:31"
 },
 {
  "text": "#ChennaiFloods #ChennaiRainsHelp #ChennaiMicro **Urgent Help 4 @user fellows Arul.-9814201103. Eva-9912481106 with 300 families",
  "kind": "request",
  "areaId": null,
  "phones": [
   "9814201103",
   "9912481106"
  ],
  "people": null,
  "vulnerable": [],
  "water": null,
  "household": "h59",
  "at": "2015-12-03T06:50"
 }
];

// ─── Atlas Arcade Static Data Constants ──────────────────────────────────────
// Ported directly from the original Atlas_arcade_codex/index.html

export const ACCENT = '#FF7A4D'
export const OCEAN_COLOR = '#AFDCEC'
export const GREEN = '#22A36A'
export const RED = '#FF5A5F'
export const AMBER = '#FFB020'
export const GREY = '#E3DDD1'
export const RIVER_COLOR = '#2C6FBF'
export const PARK_COLOR = '#168A55'
export const PALETTE = ['#F6D9A8','#CFE8C0','#BFE1E6','#E9CFE4','#F4CBC0','#D9D7F0']

export const CONT_ORDER = ['Africa','Europe','Asia','North America','South America','Oceania']

export const CONT_COLOR: Record<string, string> = {
  Africa: '#E8920E',
  Europe: '#6C5CE7',
  Asia: '#E0563B',
  'North America': '#2FA37A',
  'South America': '#C9489B',
  Oceania: '#2C9AD6',
}

// [numericId, displayName] pairs per continent
export const CONT_DATA: Record<string, [number, string][]> = {
  Europe: [
    [250,'France'],[276,'Germany'],[826,'United Kingdom'],[380,'Italy'],[724,'Spain'],
    [620,'Portugal'],[372,'Ireland'],[528,'Netherlands'],[56,'Belgium'],[756,'Switzerland'],
    [40,'Austria'],[616,'Poland'],[203,'Czechia'],[703,'Slovakia'],[348,'Hungary'],
    [642,'Romania'],[100,'Bulgaria'],[300,'Greece'],[752,'Sweden'],[578,'Norway'],
    [246,'Finland'],[208,'Denmark'],[352,'Iceland'],[804,'Ukraine'],[112,'Belarus'],
    [688,'Serbia'],[191,'Croatia'],[70,'Bosnia & Herzegovina'],[8,'Albania'],
    [440,'Lithuania'],[428,'Latvia'],[233,'Estonia'],[498,'Moldova'],[705,'Slovenia'],
    [807,'North Macedonia'],[499,'Montenegro'],[442,'Luxembourg'],[470,'Malta'],
    [196,'Cyprus'],[20,'Andorra'],[438,'Liechtenstein'],[492,'Monaco'],[674,'San Marino'],
  ],
  Asia: [
    [156,'China'],[356,'India'],[392,'Japan'],[410,'South Korea'],[408,'North Korea'],
    [496,'Mongolia'],[643,'Russia'],[398,'Kazakhstan'],[860,'Uzbekistan'],[795,'Turkmenistan'],
    [417,'Kyrgyzstan'],[762,'Tajikistan'],[4,'Afghanistan'],[586,'Pakistan'],[364,'Iran'],
    [368,'Iraq'],[682,'Saudi Arabia'],[887,'Yemen'],[512,'Oman'],[784,'United Arab Emirates'],
    [760,'Syria'],[400,'Jordan'],[376,'Israel'],[422,'Lebanon'],[792,'Turkey'],
    [764,'Thailand'],[704,'Vietnam'],[116,'Cambodia'],[418,'Laos'],[104,'Myanmar'],
    [458,'Malaysia'],[360,'Indonesia'],[608,'Philippines'],[50,'Bangladesh'],[524,'Nepal'],
    [144,'Sri Lanka'],[64,'Bhutan'],[268,'Georgia'],[51,'Armenia'],[31,'Azerbaijan'],
    [634,'Qatar'],[414,'Kuwait'],[48,'Bahrain'],[702,'Singapore'],[96,'Brunei'],
    [158,'Taiwan'],[462,'Maldives'],[626,'Timor-Leste'],[275,'Palestine'],
  ],
  Africa: [
    [818,'Egypt'],[504,'Morocco'],[12,'Algeria'],[788,'Tunisia'],[434,'Libya'],
    [729,'Sudan'],[728,'South Sudan'],[231,'Ethiopia'],[232,'Eritrea'],[404,'Kenya'],
    [834,'Tanzania'],[800,'Uganda'],[646,'Rwanda'],[108,'Burundi'],[566,'Nigeria'],
    [288,'Ghana'],[384,"Côte d'Ivoire"],[686,'Senegal'],[466,'Mali'],[562,'Niger'],
    [148,'Chad'],[120,'Cameroon'],[180,'DR Congo'],[178,'Congo'],[24,'Angola'],
    [894,'Zambia'],[716,'Zimbabwe'],[710,'South Africa'],[516,'Namibia'],[72,'Botswana'],
    [508,'Mozambique'],[450,'Madagascar'],[706,'Somalia'],[478,'Mauritania'],[266,'Gabon'],
    [324,'Guinea'],[854,'Burkina Faso'],[454,'Malawi'],[430,'Liberia'],[694,'Sierra Leone'],
    [140,'Central African Rep.'],[204,'Benin'],[768,'Togo'],[426,'Lesotho'],[748,'Eswatini'],
    [262,'Djibouti'],[226,'Equatorial Guinea'],[270,'Gambia'],[624,'Guinea-Bissau'],
    [174,'Comoros'],[132,'Cape Verde'],[678,'São Tomé & Príncipe'],[480,'Mauritius'],
    [690,'Seychelles'],[732,'Western Sahara'],
  ],
  'North America': [
    [840,'United States'],[124,'Canada'],[484,'Mexico'],[320,'Guatemala'],[84,'Belize'],
    [340,'Honduras'],[222,'El Salvador'],[558,'Nicaragua'],[188,'Costa Rica'],[591,'Panama'],
    [192,'Cuba'],[214,'Dominican Republic'],[332,'Haiti'],[388,'Jamaica'],
    [780,'Trinidad & Tobago'],[44,'Bahamas'],[304,'Greenland'],[52,'Barbados'],
    [28,'Antigua & Barbuda'],[308,'Grenada'],[212,'Dominica'],[662,'Saint Lucia'],
    [670,'Saint Vincent & Grenadines'],[659,'Saint Kitts & Nevis'],
  ],
  'South America': [
    [76,'Brazil'],[32,'Argentina'],[152,'Chile'],[604,'Peru'],[170,'Colombia'],
    [862,'Venezuela'],[218,'Ecuador'],[68,'Bolivia'],[600,'Paraguay'],[858,'Uruguay'],
    [328,'Guyana'],[740,'Suriname'],
  ],
  Oceania: [
    [36,'Australia'],[554,'New Zealand'],[598,'Papua New Guinea'],[242,'Fiji'],
    [90,'Solomon Islands'],[548,'Vanuatu'],[882,'Samoa'],[776,'Tonga'],[296,'Kiribati'],
    [583,'Micronesia'],[584,'Marshall Islands'],[585,'Palau'],[520,'Nauru'],[798,'Tuvalu'],
  ],
}

// ─── River Systems (Ganga scope, matching original) ──────────────────────────

export interface RiverSystem {
  key: string
  name: string
  color: string
  bounds: [[number,number],[number,number]]
  blurb: string
}

export const RIVER_SYSTEMS: RiverSystem[] = [
  {key:'ganga_ref', name:'Ganga River System', color:'#2C6FBF',
   bounds:[[75.0,21.6],[89.2,31.4]], blurb:'Ganga, Yamuna and key NCERT/UPSC tributaries'},
]

export interface RiverData {
  id: number
  name: string
  sys: string
  major: boolean
  points: [number,number][]
  geo?: { type: string; coordinates: [number,number][] }
  label?: { point: [number,number]; angle: number; size?: number; name?: string } | null
  labelName?: string
  src?: { type: string; name: string; place: string }
}

// Ganga schematic traces
const GANGA_TRACES: Record<string, [number,number][]> = {
  Ganga:[[78.65,30.15],[78.35,29.75],[78.25,29.15],[78.75,28.35],[79.6,27.4],[80.4,26.65],[81.25,25.9],[81.85,25.43],[82.8,25.35],[83.8,25.42],[85.13,25.59],[86.0,25.28],[87.05,24.98],[87.85,24.79],[88.15,24.1]],
  Yamuna:[[78.45,30.95],[77.9,30.25],[77.38,29.35],[77.22,28.62],[77.7,27.65],[78.1,27.18],[78.55,26.55],[79.2,26.1],[80.2,25.75],[81.1,25.55],[81.85,25.43]],
  Brahmaputra:[[95.35,28.05],[95.05,27.72],[94.45,27.45],[93.7,27.15],[92.85,26.78],[92.1,26.45],[91.35,26.15],[90.55,26.02],[89.95,25.92]],
  Ramganga:[[79.2,30.05],[79.05,29.55],[79.18,28.95],[79.55,28.25],[80.0,27.52],[80.25,26.95],[80.55,26.5]],
  Gomti:[[80.1,28.55],[80.42,27.95],[80.88,27.25],[81.25,26.65],[81.78,26.1],[82.35,25.78],[83.0,25.55]],
  Ghaghara:[[81.25,29.55],[81.65,28.85],[81.95,28.05],[82.25,27.15],[82.75,26.45],[83.45,25.95],[84.45,25.62]],
  Gandak:[[84.35,28.05],[84.55,27.25],[84.72,26.45],[84.88,25.95],[85.13,25.59]],
  'Burhi Gandak':[[85.35,27.0],[85.45,26.45],[85.58,25.95],[85.9,25.62]],
  Koshi:[[86.55,27.6],[87.05,27.55],[87.45,27.15],[87.55,26.45],[87.28,25.85],[87.85,24.79]],
  Mahananda:[[88.2,26.85],[88.15,26.3],[88.05,25.75],[87.95,25.15],[87.9,24.62]],
  Tamsa:[[80.35,24.15],[80.85,24.55],[81.35,24.95],[82.0,25.2]],
  Son:[[81.75,22.75],[82.35,23.25],[83.1,23.75],[83.85,24.2],[84.55,24.72],[85.0,25.2]],
  Punpun:[[84.0,24.15],[84.45,24.55],[84.8,25.0],[85.05,25.5]],
  Dibang:[[95.9,28.55],[95.65,28.15],[95.4,27.85],[95.12,27.62]],
  Lohit:[[97.15,28.1],[96.55,27.85],[96.0,27.65],[95.55,27.55],[95.05,27.5]],
  Dhansiri:[[94.0,25.8],[93.75,26.05],[93.45,26.25],[93.15,26.42]],
  Teesta:[[88.6,27.7],[88.65,27.15],[88.55,26.65],[88.7,26.25],[88.85,25.85]],
  Subansiri:[[93.55,28.45],[93.8,27.95],[94.0,27.5],[94.05,27.25]],
  Hindon:[[77.55,30.1],[77.45,29.55],[77.38,29.0],[77.38,28.5],[77.45,28.25]],
  Sharda:[[80.2,30.4],[80.35,29.8],[80.55,29.15],[80.8,28.55],[81.05,28.0],[81.35,27.6]],
  Tons:[[78.1,31.0],[77.85,30.65],[77.65,30.35],[77.72,30.05]],
  Chambal:[[75.55,22.55],[75.35,23.2],[75.55,24.0],[76.15,24.55],[76.9,25.02],[77.7,25.52],[78.55,26.02],[79.25,26.45]],
  Banas:[[74.1,25.25],[74.65,25.05],[75.15,24.75],[75.55,24.55]],
  Sindh:[[77.65,23.75],[77.78,24.38],[77.92,25.1],[78.28,25.72],[78.7,26.18]],
  'Kali Sindh':[[76.0,22.6],[76.28,23.28],[76.45,24.0],[76.68,24.68],[77.05,25.1]],
  Parbati:[[76.72,22.95],[76.82,23.52],[76.92,24.15],[77.12,24.75]],
  Betwa:[[77.7,23.2],[78.05,23.85],[78.45,24.45],[79.0,24.95],[79.55,25.45],[80.0,25.9]],
  Dhasan:[[78.65,23.45],[78.82,24.05],[79.05,24.62],[79.45,25.12],[79.78,25.55]],
  Ken:[[80.0,23.55],[80.2,24.15],[80.4,24.75],[80.62,25.35],[80.85,25.85]],
  Rihand:[[82.7,23.45],[82.58,24.0],[82.82,24.5],[83.25,24.86]],
  Koel:[[84.15,23.0],[84.55,23.42],[84.82,24.0],[85.0,24.52]],
  Damodar:[[85.15,23.72],[85.95,23.62],[86.75,23.52],[87.42,23.4],[88.18,23.18]],
  Hooghly:[[88.15,24.1],[88.22,23.45],[88.28,22.85],[88.35,22.35],[88.36,21.75]],
  'Padma River':[[88.15,24.1],[88.95,23.88],[89.65,23.55],[90.22,23.22],[90.75,22.92]],
}

const GANGA_SOURCES: Record<string, [string,string,string]> = {
  Ganga:['glacier','Gangotri Glacier (Gaumukh)','Uttarakhand'],
  Yamuna:['glacier','Yamunotri Glacier','Uttarakhand'],
  Brahmaputra:['glacier','Angsi Glacier / Tsangpo headwaters','Tibet'],
  Ramganga:['hills','Garhwal Hills','Uttarakhand'],
  Gomti:['lake','Gomat Taal area','Uttar Pradesh'],
  Ghaghara:['glacier','Mapchachungo Glacier / Karnali headwaters','Himalaya'],
  Gandak:['glacier','Nepal Himalaya','Nepal'],
  Koshi:['mountain','Himalayas near Everest','Nepal / Tibet'],
  Mahananda:['hills','Darjeeling Hills','West Bengal'],
  Son:['hills','Amarkantak Plateau','Madhya Pradesh'],
  Chambal:['hills','Janapav Hills','Madhya Pradesh'],
  Betwa:['hills','Vindhya Range','Madhya Pradesh'],
  Ken:['hills','Kaimur Range','Madhya Pradesh'],
  Teesta:['lake','Tso Lhamo Lake','Sikkim'],
  Lohit:['mountain','Eastern Himalayas','Arunachal Pradesh / Tibet'],
  Dibang:['mountain','Mishmi Hills','Arunachal Pradesh'],
  Subansiri:['mountain','Himalayas','Arunachal Pradesh'],
  Sharda:['glacier','Milam Glacier / Kali headwaters','Kumaon Himalaya'],
  Tons:['glacier','Bandarpunch range','Western Himalaya'],
  Banas:['hills','Aravalli Range','Rajasthan'],
  Sindh:['hills','Malwa Plateau','Madhya Pradesh'],
  'Kali Sindh':['hills','Vindhya Range','Madhya Pradesh'],
  Parbati:['hills','Vindhya Range','Madhya Pradesh'],
  Dhasan:['hills','Bundelkhand uplands','Madhya Pradesh'],
  Rihand:['hills','Chota Nagpur Plateau','Chhattisgarh'],
  Koel:['hills','Chota Nagpur Plateau','Jharkhand'],
  Damodar:['hills','Chota Nagpur Plateau','Jharkhand'],
  Hooghly:['river','Lower Ganga distributary','West Bengal'],
  'Padma River':['river','Lower Ganga distributary','Bangladesh'],
}

const GANGA_LABELS: Record<string, {point:[number,number]; angle: number; size?:number; name?:string}> = {
  Ganga:{point:[82.35,25.25], angle:22, size:12.5},
  Yamuna:{point:[78.05,27.1], angle:73},
  Hindon:{point:[77.32,29.25], angle:82},
  Tons:{point:[77.85,30.45], angle:-23},
  Ramganga:{point:[79.65,28.25], angle:75},
  Gomti:{point:[81.55,26.4], angle:72},
  Ghaghara:{point:[82.45,27.05], angle:80},
  Gandak:{point:[84.78,26.5], angle:83},
  'Burhi Gandak':{point:[85.65,26.1], angle:78, name:'BURHI GANDAK', size:9},
  Koshi:{point:[87.45,26.65], angle:74},
  Mahananda:{point:[88.05,25.75], angle:80},
  Son:{point:[83.7,24.05], angle:10},
  Punpun:{point:[84.65,24.9], angle:65},
  Chambal:{point:[76.95,25.35], angle:25},
  Banas:{point:[74.7,25.0], angle:-25},
  Sindh:{point:[78.05,25.25], angle:73},
  'Kali Sindh':{point:[76.45,23.55], angle:82, name:'KALI SINDH', size:9.5},
  Parbati:{point:[76.85,23.85], angle:83},
  Betwa:{point:[78.7,24.7], angle:73},
  Dhasan:{point:[79.1,24.35], angle:82},
  Ken:{point:[80.45,24.7], angle:76},
  Rihand:{point:[82.85,24.25], angle:82},
  Koel:{point:[84.65,23.85], angle:35},
  Damodar:{point:[86.8,23.7], angle:-8},
  Hooghly:{point:[88.32,22.65], angle:84},
  'Padma River':{point:[89.65,23.35], angle:18, name:'PADMA RIVER', size:9.5},
}

const GANGA_PRACTICE_NAMES = new Set([
  'Ganga','Yamuna','Ramganga','Gomti','Ghaghara','Gandak','Burhi Gandak','Koshi','Mahananda',
  'Son','Punpun','Hindon','Sharda','Tons','Chambal','Banas','Sindh','Kali Sindh','Parbati',
  'Betwa','Dhasan','Ken','Rihand','Koel','Damodar','Hooghly','Padma River',
])

function buildRiver(id: number, name: string, sys: string, major: boolean): RiverData {
  const pts = GANGA_TRACES[name] ?? [[0,0]]
  const src = GANGA_SOURCES[name]
  const lbl = GANGA_LABELS[name] ?? null
  return {
    id, name, sys, major,
    points: pts,
    geo: { type: 'LineString', coordinates: pts },
    label: lbl,
    labelName: lbl?.name,
    src: src ? { type: src[0], name: src[1], place: src[2] } : undefined,
  }
}

export const RIVERS: RiverData[] = [
  buildRiver(6101,'Ganga','ganga_ref',true),
  buildRiver(6102,'Yamuna','ganga_ref',true),
  buildRiver(6103,'Brahmaputra','ganga_ref',true),
  buildRiver(6104,'Ramganga','ganga_ref',false),
  buildRiver(6105,'Gomti','ganga_ref',false),
  buildRiver(6106,'Ghaghara','ganga_ref',false),
  buildRiver(6107,'Gandak','ganga_ref',false),
  buildRiver(6108,'Koshi','ganga_ref',false),
  buildRiver(6109,'Mahananda','ganga_ref',false),
  buildRiver(6110,'Tamsa','ganga_ref',false),
  buildRiver(6111,'Son','ganga_ref',false),
  buildRiver(6112,'Punpun','ganga_ref',false),
  buildRiver(6113,'Dibang','ganga_ref',false),
  buildRiver(6114,'Lohit','ganga_ref',false),
  buildRiver(6115,'Dhansiri','ganga_ref',false),
  buildRiver(6116,'Teesta','ganga_ref',false),
  buildRiver(6117,'Subansiri','ganga_ref',false),
  buildRiver(6118,'Hindon','ganga_ref',false),
  buildRiver(6119,'Sharda','ganga_ref',false),
  buildRiver(6120,'Tons','ganga_ref',false),
  buildRiver(6121,'Chambal','ganga_ref',false),
  buildRiver(6122,'Betwa','ganga_ref',false),
  buildRiver(6123,'Ken','ganga_ref',false),
  buildRiver(6124,'Banas','ganga_ref',false),
  buildRiver(6125,'Sindh','ganga_ref',false),
  buildRiver(6126,'Kali Sindh','ganga_ref',false),
  buildRiver(6127,'Parbati','ganga_ref',false),
  buildRiver(6128,'Dhasan','ganga_ref',false),
  buildRiver(6129,'Rihand','ganga_ref',false),
  buildRiver(6130,'Koel','ganga_ref',false),
  buildRiver(6131,'Damodar','ganga_ref',false),
  buildRiver(6132,'Hooghly','ganga_ref',false),
  buildRiver(6133,'Padma River','ganga_ref',false),
  buildRiver(6134,'Burhi Gandak','ganga_ref',false),
].filter(r => GANGA_PRACTICE_NAMES.has(r.name))

// ─── World CDN URL ────────────────────────────────────────────────────────────
export const WORLD_TOPO_URL = '/data/countries-110m.json'

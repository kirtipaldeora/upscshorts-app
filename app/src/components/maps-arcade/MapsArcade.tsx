import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import * as topojson from 'topojson-client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowRotateRight,
  faBullseye,
  faChevronLeft,
  faChevronRight,
  faCompass,
  faEarthAsia,
  faLightbulb,
  faLocationDot,
  faMinus,
  faMountainSun,
  faPaw,
  faPlus,
  faSeedling,
  faWater,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import { useAppStore } from '@/stores/useAppStore'
import { PenniLoader } from '@/components/layout/PenniLoader'
import { asset } from '@/utils/asset'
import { EASE, gsap, reducedMotion } from '@/anim/animations'
import {
  MapSVG,
  type AtlasAnswer,
  type AtlasCountry,
  type AtlasMode,
  type AtlasPark,
  type AtlasPhase,
  type AtlasRiver,
  type AtlasView,
  type MapSVGHandle,
} from './MapSVG'
import { WORLD_PHYSICAL_FEATURES } from './worldPhysicalData'

const AtlasGlobe = lazy(() => import('./AtlasGlobe').then(module => ({ default: module.AtlasGlobe })))

type Screen = 'home' | 'world-menu' | 'physical-menu' | 'world-river-menu' | 'india-menu' | 'river-menu' | 'park-menu' | 'park-learn' | 'setup' | 'play' | 'results'
type AppKind = 'world' | 'india' | null
type Category = 'countries' | 'world-rivers' | 'mountains' | 'rivers' | 'parks' | null

interface AtlasState {
  screen: Screen
  app: AppKind
  category: Category
  continent: string | null
  riverSystem: string | null
  parkRegion: string | null
  parkLearnState: string | null
  parkLearnParkId: number | null
  setupCount: number
  setupMode: AtlasMode
  mode: AtlasMode
  queue: QuizItem[]
  qIndex: number
  target: QuizItem | null
  choices: Choice[]
  chosenId: string | number | null
  score: number
  streak: number
  best: number
  correctCount: number
  wrongList: QuizItem[]
  answerHistory: QuizAnswer[]
  hintsLeft: number
  hintUsed: boolean
  removedChoiceId: string | number | null
  toast: Toast | null
}

interface LoadedData {
  countries: AtlasCountry[]
  indiaStates: FeatureCollection
  parks: AtlasPark[]
  parkRegions: ParkRegion[]
  rivers: AtlasRiver[]
}

interface Toast {
  kind: 'correct' | 'wrong' | 'hint' | 'level'
  text: string
}

interface Choice {
  id: string | number
  name: string
}

interface QuizAnswer extends AtlasAnswer {
  mode?: AtlasMode
  choices?: Choice[]
  toast?: Toast
  hintUsed?: boolean
  removedChoiceId?: string | number | null
}

interface QuizItem {
  id: string | number
  name: string
  continent?: string
  state?: string
  region?: string
  kind?: 'river' | 'mountain'
  source?: { type: string; name: string; place: string }
}

interface ParkRegion {
  key: string
  name: string
  color: string
  blurb: string
  bounds?: [[number, number], [number, number]]
}

const ORDER = ['Africa', 'Europe', 'Asia', 'North America', 'South America', 'Oceania']
const CONT_COLOR: Record<string, string> = {
  Africa: '#d79124',
  Europe: '#7064da',
  Asia: '#c95d4f',
  'North America': '#2e9a72',
  'South America': '#bf5291',
  Oceania: '#2f92c4',
}

const CONT_DATA: Record<string, [number, string][]> = {
  Europe: [[250, 'France'], [276, 'Germany'], [826, 'United Kingdom'], [380, 'Italy'], [724, 'Spain'], [620, 'Portugal'], [372, 'Ireland'], [528, 'Netherlands'], [56, 'Belgium'], [756, 'Switzerland'], [40, 'Austria'], [616, 'Poland'], [203, 'Czechia'], [348, 'Hungary'], [642, 'Romania'], [100, 'Bulgaria'], [300, 'Greece'], [752, 'Sweden'], [578, 'Norway'], [246, 'Finland'], [208, 'Denmark'], [352, 'Iceland'], [804, 'Ukraine'], [112, 'Belarus'], [688, 'Serbia'], [191, 'Croatia'], [70, 'Bosnia and Herzegovina'], [8, 'Albania'], [440, 'Lithuania'], [428, 'Latvia'], [233, 'Estonia'], [498, 'Moldova'], [442, 'Luxembourg'], [705, 'Slovenia'], [703, 'Slovakia'], [196, 'Cyprus'], [807, 'North Macedonia'], [499, 'Montenegro']],
  Asia: [[156, 'China'], [356, 'India'], [392, 'Japan'], [410, 'South Korea'], [408, 'North Korea'], [496, 'Mongolia'], [643, 'Russia'], [398, 'Kazakhstan'], [860, 'Uzbekistan'], [417, 'Kyrgyzstan'], [762, 'Tajikistan'], [4, 'Afghanistan'], [586, 'Pakistan'], [364, 'Iran'], [368, 'Iraq'], [682, 'Saudi Arabia'], [512, 'Oman'], [784, 'United Arab Emirates'], [400, 'Jordan'], [376, 'Israel'], [422, 'Lebanon'], [792, 'Turkey'], [764, 'Thailand'], [704, 'Vietnam'], [116, 'Cambodia'], [418, 'Laos'], [104, 'Myanmar'], [458, 'Malaysia'], [360, 'Indonesia'], [608, 'Philippines'], [50, 'Bangladesh'], [524, 'Nepal'], [144, 'Sri Lanka'], [64, 'Bhutan'], [702, 'Singapore'], [626, 'Timor-Leste'], [275, 'Palestine'], [634, 'Qatar'], [414, 'Kuwait'], [795, 'Turkmenistan'], [760, 'Syria'], [51, 'Armenia'], [158, 'Taiwan'], [31, 'Azerbaijan'], [268, 'Georgia'], [96, 'Brunei'], [887, 'Yemen']],
  Africa: [[818, 'Egypt'], [504, 'Morocco'], [12, 'Algeria'], [788, 'Tunisia'], [434, 'Libya'], [729, 'Sudan'], [231, 'Ethiopia'], [232, 'Eritrea'], [404, 'Kenya'], [834, 'Tanzania'], [800, 'Uganda'], [646, 'Rwanda'], [566, 'Nigeria'], [288, 'Ghana'], [384, "Cote d'Ivoire"], [686, 'Senegal'], [466, 'Mali'], [562, 'Niger'], [148, 'Chad'], [120, 'Cameroon'], [180, 'DR Congo'], [178, 'Congo'], [24, 'Angola'], [894, 'Zambia'], [716, 'Zimbabwe'], [710, 'South Africa'], [516, 'Namibia'], [72, 'Botswana'], [508, 'Mozambique'], [450, 'Madagascar'], [706, 'Somalia'], [732, 'Western Sahara'], [426, 'Lesotho'], [478, 'Mauritania'], [204, 'Benin'], [768, 'Togo'], [324, 'Guinea'], [624, 'Guinea-Bissau'], [430, 'Liberia'], [694, 'Sierra Leone'], [854, 'Burkina Faso'], [140, 'Central African Republic'], [266, 'Gabon'], [226, 'Equatorial Guinea'], [454, 'Malawi'], [748, 'Eswatini'], [108, 'Burundi'], [270, 'Gambia'], [262, 'Djibouti'], [728, 'South Sudan']],
  'North America': [[840, 'United States'], [124, 'Canada'], [484, 'Mexico'], [320, 'Guatemala'], [84, 'Belize'], [340, 'Honduras'], [222, 'El Salvador'], [558, 'Nicaragua'], [188, 'Costa Rica'], [591, 'Panama'], [192, 'Cuba'], [214, 'Dominican Republic'], [332, 'Haiti'], [388, 'Jamaica'], [304, 'Greenland'], [44, 'Bahamas'], [630, 'Puerto Rico'], [780, 'Trinidad and Tobago']],
  'South America': [[76, 'Brazil'], [32, 'Argentina'], [152, 'Chile'], [604, 'Peru'], [170, 'Colombia'], [862, 'Venezuela'], [218, 'Ecuador'], [68, 'Bolivia'], [600, 'Paraguay'], [858, 'Uruguay'], [328, 'Guyana'], [740, 'Suriname']],
  Oceania: [[36, 'Australia'], [554, 'New Zealand'], [598, 'Papua New Guinea'], [242, 'Fiji'], [90, 'Solomon Islands'], [548, 'Vanuatu'], [882, 'Samoa'], [776, 'Tonga'], [296, 'Kiribati'], [540, 'New Caledonia']],
}

const RIVER_SYSTEMS = [
  { key: 'ganga_ref', name: 'Ganga River System', color: '#2d72c4', blurb: 'Major NCERT tributaries of the northern plains' },
  { key: 'indus_ref', name: 'Indus River System', color: '#2b9b91', blurb: 'Indus and the five rivers of the Punjab' },
  { key: 'brahmaputra_ref', name: 'Brahmaputra River System', color: '#4b78c8', blurb: 'Brahmaputra and key Himalayan tributaries' },
  { key: 'narmada_ref', name: 'Narmada River System', color: '#7e6bc9', blurb: 'West-flowing trunk and central Indian tributaries' },
  { key: 'mahanadi_ref', name: 'Mahanadi River System', color: '#d08c3f', blurb: 'Mahanadi basin from Chhattisgarh to Odisha' },
  { key: 'godavari_ref', name: 'Godavari River System', color: '#3f9f78', blurb: 'Godavari and major Deccan tributaries' },
  { key: 'krishna_ref', name: 'Krishna River System', color: '#c66278', blurb: 'Krishna and major peninsular tributaries' },
]

const CURATED_RIVER_NAMES: Record<string, readonly string[]> = {
  ganga_ref: [
    'Ganga', 'Yamuna', 'Tons', 'Hindon', 'Ramganga', 'Ghaghara', 'Gomti', 'Rapti', 'Gandak', 'Kosi',
    'Mahananda', 'Son', 'Rihand', 'North Koel', 'Damodar', 'Hooghly', 'Padma', 'Chambal', 'Banas',
    'Sind', 'Kali Sindh', 'Parbati', 'Betwa', 'Dhasan', 'Ken',
  ],
  indus_ref: ['Indus', 'Jhelum', 'Chenab', 'Ravi', 'Beas', 'Sutlej'],
  brahmaputra_ref: [
    'Brahmaputra', 'Subansiri', 'Kameng', 'Manas', 'Aie', 'Teesta', 'Dibang', 'Lohit',
    'Burhi Dihing', 'Dhansiri', 'Kopili', 'Barak', 'Surma', 'Meghna',
  ],
  narmada_ref: ['Narmada', 'Hiran', 'Kolar', 'Orsang', 'Tawa', 'Shakkar', 'Sher', 'Banjar', 'Burhner'],
  mahanadi_ref: ['Mahanadi', 'Seonath', 'Kharun', 'Hasdeo', 'Mand', 'Ib', 'Jonk', 'Ong', 'Indra', 'Tel'],
  godavari_ref: [
    'Godavari', 'Pravara', 'Manjira', 'Purna', 'Penganga', 'Wardha', 'Wainganga', 'Pranahita', 'Manair',
    'Indravati', 'Sabari', 'Kinnerasani',
  ],
  krishna_ref: [
    'Krishna', 'Bhima', 'Koyna', 'Panchganga', 'Dudhganga', 'Ghataprabha', 'Malaprabha', 'Don',
    'Tungabhadra', 'Tunga', 'Bhadra', 'Dindi', 'Musi', 'Munneru',
  ],
}

const CURATED_RIVER_SYSTEM = new Map(
  Object.entries(CURATED_RIVER_NAMES).flatMap(([system, names]) => names.map(name => [name, system] as const)),
)

function riverDisplayName(name: string): string { return name }

const CURATED_DISPLAY_NAMES = new Set(
  Object.values(CURATED_RIVER_NAMES).flat().map(riverDisplayName),
)

interface ParkStateContext {
  rivers: readonly string[]
  landscape: string
  wildlife: string
}

const PARK_STATE_CONTEXT: Record<string, ParkStateContext> = {
  'Andaman and Nicobar Islands': { rivers: [], landscape: 'Island rainforest, coral reefs and mangroves', wildlife: 'Dugong and marine turtles' },
  'Andhra Pradesh': { rivers: ['Godavari', 'Krishna'], landscape: 'Eastern Ghats and Godavari-Krishna valleys', wildlife: 'Gaur and leopard' },
  'Arunachal Pradesh': { rivers: ['Brahmaputra', 'Subansiri', 'Kameng', 'Dibang', 'Lohit'], landscape: 'Eastern Himalaya and dense evergreen forest', wildlife: 'Red panda and clouded leopard' },
  Assam: { rivers: ['Brahmaputra', 'Manas', 'Aie', 'Dhansiri', 'Kopili', 'Barak'], landscape: 'Brahmaputra floodplain, grassland and foothill forest', wildlife: 'One-horned rhinoceros' },
  Bihar: { rivers: ['Ganga', 'Gandak', 'Kosi'], landscape: 'Terai forest along the Himalayan foothills', wildlife: 'Bengal tiger' },
  Chhattisgarh: { rivers: ['Mahanadi', 'Hasdeo', 'Indravati'], landscape: 'Sal forest, plateau and limestone caves', wildlife: 'Wild water buffalo' },
  Goa: { rivers: [], landscape: 'Western Ghats evergreen forest', wildlife: 'Gaur' },
  Gujarat: { rivers: ['Narmada'], landscape: 'Dry forest, grassland and coral coast', wildlife: 'Asiatic lion and blackbuck' },
  Haryana: { rivers: ['Yamuna'], landscape: 'Shivalik forest and seasonal wetland', wildlife: 'Asian elephant and migratory waterbirds' },
  'Himachal Pradesh': { rivers: ['Sutlej', 'Beas', 'Ravi', 'Chenab'], landscape: 'Western Himalaya, alpine meadow and cold desert', wildlife: 'Snow leopard and western tragopan' },
  'Jammu and Kashmir': { rivers: ['Jhelum', 'Chenab'], landscape: 'Kashmir valley and temperate Himalayan forest', wildlife: 'Hangul' },
  Jharkhand: { rivers: ['Damodar', 'North Koel'], landscape: 'Chota Nagpur plateau and dry deciduous forest', wildlife: 'Asian elephant' },
  Karnataka: { rivers: ['Krishna', 'Bhima', 'Tungabhadra'], landscape: 'Western Ghats and southern dry forest', wildlife: 'Tiger and Asian elephant' },
  Kerala: { rivers: [], landscape: 'Western Ghats shola-grassland and rainforest', wildlife: 'Nilgiri tahr and lion-tailed macaque' },
  Ladakh: { rivers: ['Indus'], landscape: 'Trans-Himalayan cold desert', wildlife: 'Snow leopard' },
  'Madhya Pradesh': { rivers: ['Narmada', 'Chambal', 'Betwa', 'Ken', 'Son'], landscape: 'Central Indian highlands and dry deciduous forest', wildlife: 'Tiger, barasingha and cheetah' },
  Maharashtra: { rivers: ['Godavari', 'Krishna', 'Wardha', 'Wainganga'], landscape: 'Deccan plateau, teak forest and coastal hills', wildlife: 'Bengal tiger and leopard' },
  Manipur: { rivers: ['Barak'], landscape: 'Floating wetland and forested hill ranges', wildlife: 'Sangai' },
  Meghalaya: { rivers: ['Surma', 'Meghna'], landscape: 'Garo-Khasi hills and subtropical forest', wildlife: 'Red panda and Asian elephant' },
  Mizoram: { rivers: ['Barak'], landscape: 'Mizo hills and tropical evergreen forest', wildlife: 'Hoolock gibbon' },
  Nagaland: { rivers: ['Dhansiri'], landscape: 'Naga hills and tropical forest', wildlife: 'Great hornbill' },
  Odisha: { rivers: ['Mahanadi', 'Tel', 'Ong'], landscape: 'Eastern Ghats forest, mangroves and delta coast', wildlife: 'Saltwater crocodile and tiger' },
  Rajasthan: { rivers: ['Chambal', 'Banas'], landscape: 'Thar desert, Aravalli forest and wetland', wildlife: 'Great Indian bustard and tiger' },
  Sikkim: { rivers: ['Teesta'], landscape: 'Eastern Himalayan alpine and temperate forest', wildlife: 'Snow leopard and red panda' },
  'Tamil Nadu': { rivers: [], landscape: 'Western Ghats, dry forest and coral coast', wildlife: 'Nilgiri tahr and dugong' },
  Telangana: { rivers: ['Godavari', 'Krishna'], landscape: 'Deccan scrub and urban forest islands', wildlife: 'Blackbuck and spotted deer' },
  Tripura: { rivers: [], landscape: 'Low hill rainforest and bamboo forest', wildlife: 'Clouded leopard' },
  'Uttar Pradesh': { rivers: ['Ganga', 'Yamuna', 'Ghaghara'], landscape: 'Terai grassland, sal forest and wetlands', wildlife: 'Swamp deer and Bengal tiger' },
  Uttarakhand: { rivers: ['Ganga', 'Yamuna', 'Ramganga'], landscape: 'Himalayan glaciers, alpine meadow and sal forest', wildlife: 'Bengal tiger and snow leopard' },
  'West Bengal': { rivers: ['Ganga', 'Hooghly', 'Teesta', 'Mahananda'], landscape: 'Himalayan foothills, Terai and mangrove delta', wildlife: 'Bengal tiger and one-horned rhinoceros' },
}

const PARK_WILDLIFE: Record<string, string> = {
  'Dachigam National Park': 'Hangul',
  'Hemis National Park': 'Snow leopard',
  'Jim Corbett National Park': 'Bengal tiger',
  'Nanda Devi National Park': 'Snow leopard',
  'Rajaji National Park': 'Asian elephant',
  'Valley of Flowers National Park': 'Himalayan pollinators and alpine flora',
  'Kaziranga National Park': 'One-horned rhinoceros',
  'Manas National Park': 'Pygmy hog and golden langur',
  'Raimona National Park': 'Golden langur',
  'Dihing Patkai National Park': 'White-winged duck',
  'Nameri National Park': 'Asian elephant',
  'Orang National Park': 'One-horned rhinoceros',
  'Namdapha National Park': 'Clouded leopard',
  'Mouling National Park': 'Red panda',
  'Keibul Lamjao National Park': 'Sangai',
  'Murlen National Park': 'Hoolock gibbon',
  'Phawngpui National Park': 'Asian black bear',
  'Clouded Leopard National Park': 'Clouded leopard',
  'Balphakram National Park': 'Red panda',
  'Nokrek National Park': 'Asian elephant',
  'Kuno National Park': 'Cheetah',
  'Kanha National Park': 'Hard-ground barasingha',
  'Panna National Park': 'Bengal tiger',
  'Gir Forest National Park': 'Asiatic lion',
  'Desert National Park': 'Great Indian bustard',
  'Keoladeo National Park': 'Migratory waterbirds',
  'Bhitarkanika National Park': 'Saltwater crocodile',
  'Simlipal National Park': 'Bengal tiger and Asian elephant',
  'Papikonda National Park': 'Gaur',
  'Silent Valley National Park': 'Lion-tailed macaque',
  'Eravikulam National Park': 'Nilgiri tahr',
  'Bandipur National Park': 'Bengal tiger and Asian elephant',
  'Nagarhole National Park': 'Asian elephant',
  'Kudremukh National Park': 'Lion-tailed macaque',
  'Mukurthi National Park': 'Nilgiri tahr',
  'Gulf of Mannar Marine National Park': 'Dugong',
  'Sundarbans National Park': 'Bengal tiger',
  'Khangchendzonga National Park': 'Snow leopard and red panda',
  'Dudhwa National Park': 'Swamp deer and Bengal tiger',
}

interface ParkPrelimsProfile {
  rivers?: readonly string[]
  mapRivers?: readonly string[]
  facts: readonly string[]
}

const PARK_PRELIMS: Record<string, ParkPrelimsProfile> = {
  'Dachigam National Park': { rivers: ['Dagwan stream', 'Jhelum basin'], mapRivers: ['Jhelum'], facts: ['Main stronghold of the Hangul in the Kashmir Valley.', 'Its lower and upper zones span temperate forest to alpine habitat.', 'Locate it near Srinagar and the Zabarwan range.'] },
  'Hemis National Park': { rivers: ['Indus'], mapRivers: ['Indus'], facts: ['A high-altitude cold-desert park in Ladakh.', 'Important snow leopard landscape in the Trans-Himalaya.', 'Place it north of the main Himalayan range.'] },
  'Great Himalayan National Park': { rivers: ['Tirthan', 'Sainj'], mapRivers: ['Beas'], facts: ['A UNESCO World Heritage natural site in Himachal Pradesh.', 'Protects western Himalayan temperate and alpine ecosystems.', 'Western tragopan is an important species cue.'] },
  'Jim Corbett National Park': { rivers: ['Ramganga'], mapRivers: ['Ramganga'], facts: ['India’s oldest national park and a major Project Tiger landscape.', 'Ramganga is the key river-map linkage.', 'It lies in the Shivalik-Terai transition of Uttarakhand.'] },
  'Nanda Devi National Park': { rivers: ['Rishi Ganga', 'Dhauli Ganga'], mapRivers: ['Ganga'], facts: ['Part of the Nanda Devi and Valley of Flowers UNESCO site.', 'A high Himalayan park around the Nanda Devi massif.', 'Snow leopard and bharal are important fauna cues.'] },
  'Valley of Flowers National Park': { rivers: ['Pushpawati', 'Alaknanda basin'], mapRivers: ['Ganga'], facts: ['A UNESCO natural site known for alpine meadows.', 'It lies in the upper Alaknanda basin of Uttarakhand.', 'Remember endemic alpine flora, not only charismatic fauna.'] },
  'Rajaji National Park': { rivers: ['Ganga'], mapRivers: ['Ganga'], facts: ['A Shivalik-Terai elephant landscape across three Uttarakhand districts.', 'The Ganga cuts through the broader protected landscape.', 'It forms part of the north-western elephant range.'] },
  'Kaziranga National Park': { rivers: ['Brahmaputra'], mapRivers: ['Brahmaputra'], facts: ['A UNESCO World Heritage site on the Brahmaputra floodplain.', 'Known for the greater one-horned rhinoceros.', 'Annual flooding maintains its tall grassland-wetland mosaic.'] },
  'Manas National Park': { rivers: ['Manas'], mapRivers: ['Manas'], facts: ['A UNESCO natural site along the Bhutan foothills.', 'Also associated with tiger reserve and biosphere reserve status.', 'Pygmy hog and golden langur are high-value species cues.'] },
  'Raimona National Park': { rivers: ['Sankosh'], mapRivers: ['Manas'], facts: ['Located in western Assam along the Bhutan border.', 'Golden langur is its flagship prelims cue.', 'It strengthens a transboundary forest corridor.'] },
  'Dihing Patkai National Park': { rivers: ['Dihing'], mapRivers: ['Burhi Dihing'], facts: ['Protects lowland rainforest in eastern Assam.', 'White-winged wood duck is an important species association.', 'Remember it as a rainforest park, not a floodplain grassland park.'] },
  'Dibru-Saikhowa National Park': { rivers: ['Brahmaputra', 'Lohit'], mapRivers: ['Brahmaputra', 'Lohit'], facts: ['A river-island and floodplain landscape in eastern Assam.', 'Known for wetlands, grasslands and feral horses.', 'Its ecology is shaped by the Brahmaputra-Lohit system.'] },
  'Nameri National Park': { rivers: ['Jia-Bhoroli'], mapRivers: ['Kameng'], facts: ['A foothill forest park on the Assam-Arunachal boundary.', 'Jia-Bhoroli is the lower course of the Kameng.', 'Important for elephants and riverine bird habitat.'] },
  'Orang National Park': { rivers: ['Brahmaputra'], mapRivers: ['Brahmaputra'], facts: ['A compact Brahmaputra north-bank floodplain park.', 'One-horned rhinoceros, tiger and grassland birds are key cues.', 'Compare its habitat with Kaziranga.'] },
  'Namdapha National Park': { rivers: ['Noa-Dihing'], mapRivers: ['Burhi Dihing'], facts: ['A large Eastern Himalayan park in Arunachal Pradesh.', 'Extends from tropical forest to high-elevation habitat.', 'Known for exceptional cat diversity, including clouded leopard.'] },
  'Mouling National Park': { rivers: ['Siang basin'], mapRivers: ['Brahmaputra', 'Dibang'], facts: ['An Eastern Himalayan protected landscape in Arunachal Pradesh.', 'Dense forest and steep elevation gradients drive high diversity.', 'Red panda is an important high-altitude species cue.'] },
  'Keibul Lamjao National Park': { rivers: ['Loktak Lake'], mapRivers: [], facts: ['The world’s only floating national park, on Loktak Lake.', 'Its habitat is formed by floating phumdis.', 'It is the last natural refuge of the Sangai.'] },
  'Clouded Leopard National Park': { rivers: [], mapRivers: [], facts: ['Located within the Sepahijala landscape of Tripura.', 'Named after the arboreal clouded leopard.', 'Associate it with north-eastern tropical forest.'] },
  'Khangchendzonga National Park': { rivers: ['Teesta headwaters'], mapRivers: ['Teesta'], facts: ['India’s first UNESCO mixed World Heritage site.', 'Combines sacred cultural landscape with Eastern Himalayan ecology.', 'Snow leopard and red panda are key fauna cues.'] },
  'Valmiki National Park': { rivers: ['Gandak'], mapRivers: ['Gandak'], facts: ['Bihar’s only national park, in the Terai Arc landscape.', 'It adjoins Nepal’s Chitwan protected landscape.', 'Tiger, gharial and Gandak river linkages are important.'] },
  'Betla National Park': { rivers: ['North Koel'], mapRivers: ['North Koel'], facts: ['Located within the Palamau Tiger Reserve landscape.', 'A Chota Nagpur plateau sal-forest park in Jharkhand.', 'North Koel is the key river linkage.'] },
  'Kuno National Park': { rivers: ['Kuno'], mapRivers: ['Chambal'], facts: ['The principal site of India’s cheetah reintroduction programme.', 'Located in the Chambal landscape of Madhya Pradesh.', 'Dry deciduous forest and open woodland are key habitat cues.'] },
  'Kanha National Park': { rivers: ['Banjar', 'Halon'], mapRivers: ['Narmada'], facts: ['A central Indian tiger reserve in the Maikal landscape.', 'Famous for recovery of the hard-ground barasingha.', 'Sal forest and meadow form its classic habitat mosaic.'] },
  'Panna National Park': { rivers: ['Ken'], mapRivers: ['Ken'], facts: ['The Ken river cuts through this Madhya Pradesh tiger landscape.', 'Also a biosphere reserve and tiger reintroduction success story.', 'Link it with the Vindhyan plateau.'] },
  'Gir Forest National Park': { rivers: ['Hiran', 'Shetrunji basin'], mapRivers: ['Hiran'], facts: ['The only wild home of the Asiatic lion.', 'A dry deciduous and thorn-forest landscape in Gujarat.', 'Do not confuse it with African savanna protected areas.'] },
  'Marine National Park, Gulf of Kutch': { rivers: [], mapRivers: [], facts: ['India’s first marine national park.', 'Protects coral reefs, mangroves and intertidal islands.', 'Dugong, corals and tidal ecology are key prelims links.'] },
  'Desert National Park': { rivers: [], mapRivers: [], facts: ['A Thar desert ecosystem in western Rajasthan.', 'A major stronghold of the Great Indian bustard.', 'Sand dunes, rocky surfaces and sparse grassland dominate.'] },
  'Keoladeo National Park': { rivers: ['Gambhir', 'Banganga system'], mapRivers: ['Banas'], facts: ['A managed wetland and UNESCO World Heritage site at Bharatpur.', 'Also a Ramsar site important for migratory waterbirds.', 'Its wetland character depends heavily on regulated water supply.'] },
  'Ranthambore National Park': { rivers: ['Banas', 'Chambal basin'], mapRivers: ['Banas', 'Chambal'], facts: ['A tiger landscape at the Aravalli-Vindhya junction.', 'Dry deciduous forest surrounds the historic Ranthambore fort.', 'Place it in eastern Rajasthan, not the Thar core.'] },
  'Bhitarkanika National Park': { rivers: ['Brahmani', 'Baitarani'], mapRivers: [], facts: ['A mangrove wetland in the Brahmani-Baitarani delta.', 'Known for saltwater crocodiles and rich estuarine biodiversity.', 'The nearby Gahirmatha coast is famous for Olive Ridley nesting.'] },
  'Simlipal National Park': { rivers: ['Budhabalanga headwaters'], mapRivers: [], facts: ['Part of a biosphere reserve and tiger reserve in Odisha.', 'Combines sal forest, plateau and prominent waterfalls.', 'Tiger, elephant and giant squirrel are important fauna cues.'] },
  'Indravati National Park': { rivers: ['Indravati'], mapRivers: ['Indravati'], facts: ['A major protected landscape in Bastar, Chhattisgarh.', 'Wild water buffalo and tiger are important associations.', 'Indravati is a tributary of the Godavari.'] },
  'Papikonda National Park': { rivers: ['Godavari'], mapRivers: ['Godavari'], facts: ['Protects the Godavari gorge through the Eastern Ghats.', 'Gaur is an important large-mammal cue.', 'Locate it along the Andhra Pradesh Godavari valley.'] },
  'Silent Valley National Park': { rivers: ['Kunthipuzha'], mapRivers: [], facts: ['A tropical evergreen forest in the Nilgiri landscape.', 'Kunthipuzha is a tributary of the Bharathapuzha.', 'Lion-tailed macaque is the flagship prelims association.'] },
  'Eravikulam National Park': { rivers: [], mapRivers: [], facts: ['A high-elevation shola-grassland park in Kerala.', 'Best known for the Nilgiri tahr.', 'Neelakurinji mass flowering is a recurring ecology cue.'] },
  'Periyar National Park': { rivers: ['Periyar'], mapRivers: [], facts: ['A Western Ghats tiger and elephant reserve around Periyar lake.', 'The reservoir is central to its landscape identity.', 'Associate it with Kerala, not Tamil Nadu.'] },
  'Bandipur National Park': { rivers: ['Kabini basin'], mapRivers: [], facts: ['Part of the Nilgiri Biosphere Reserve and a tiger reserve.', 'Forms a contiguous landscape with Nagarhole, Mudumalai and Wayanad.', 'Tiger and elephant corridors are the key linkage.'] },
  'Nagarhole National Park': { rivers: ['Kabini'], mapRivers: [], facts: ['Also known as Rajiv Gandhi National Park in Karnataka.', 'Kabini links its wildlife landscape with Bandipur.', 'Part of the Nilgiri Biosphere Reserve.'] },
  'Kudremukh National Park': { rivers: ['Tunga', 'Bhadra', 'Netravati headwaters'], mapRivers: ['Tunga', 'Bhadra'], facts: ['A Western Ghats shola-grassland landscape.', 'Important river headwaters rise in the massif.', 'Lion-tailed macaque and endemic biodiversity are key cues.'] },
  'Mukurthi National Park': { rivers: [], mapRivers: [], facts: ['A high-altitude shola-grassland park in the Nilgiris.', 'Nilgiri tahr is its flagship species.', 'It lies within the Nilgiri Biosphere Reserve.'] },
  'Gulf of Mannar Marine National Park': { rivers: [], mapRivers: [], facts: ['Protects coral reefs, seagrass beds and islands off Tamil Nadu.', 'Dugong is the flagship marine mammal cue.', 'It forms part of the Gulf of Mannar Biosphere Reserve.'] },
  'Dudhwa National Park': { rivers: ['Suheli', 'Ghaghara basin'], mapRivers: ['Ghaghara'], facts: ['A Terai grassland and sal-forest park in Uttar Pradesh.', 'Swamp deer and tiger are major species associations.', 'It forms part of the wider Dudhwa Tiger Reserve.'] },
  'Sundarbans National Park': { rivers: ['Ganga-Brahmaputra-Meghna delta'], mapRivers: ['Ganga', 'Hooghly'], facts: ['A tidal mangrove landscape and UNESCO World Heritage site.', 'Also a Ramsar site and tiger reserve.', 'Salinity, tides and distributaries shape its ecology.'] },
  'Jaldapara National Park': { rivers: ['Torsa'], mapRivers: ['Teesta'], facts: ['A Terai-Dooars grassland park in northern West Bengal.', 'Known for the one-horned rhinoceros.', 'Locate it east of the Teesta in the Himalayan foothills.'] },
  'Neora Valley National Park': { rivers: ['Neora'], mapRivers: ['Teesta'], facts: ['An Eastern Himalayan forest park in northern West Bengal.', 'Red panda is an important species cue.', 'Its elevation range supports subtropical to temperate forest.'] },
}

const NATURAL_EARTH_RIVER_NAMES: Record<string, string> = {
  Ganga: 'Ganges',
  Yamuna: 'Yamuna',
  Ghaghara: 'Ghaghara',
  Gandak: 'Gandak',
  Son: 'Son',
  Chambal: 'Chambal',
  Banas: 'Banas',
  Parbati: 'Parbati',
  Betwa: 'Betwa',
  Indus: 'Indus',
  Jhelum: 'Jhelum',
  Chenab: 'Chenab',
  Ravi: 'Ravi',
  Beas: 'Beas',
  Sutlej: 'Sutlej',
  Brahmaputra: 'Brahmaputra',
  Teesta: 'Teesta',
  Manas: 'Manas',
  Narmada: 'Narmada',
  Mahanadi: 'Mahanadi',
  Tel: 'Tel',
  Godavari: 'Godavari',
  Wainganga: 'Wainganga',
  Indravati: 'Indravati',
  Krishna: 'Krishna',
  Bhima: 'Bhima',
  Tungabhadra: 'Tungabhadra',
}

const RIVER_DETAILS: Record<string, { region: string; source?: NonNullable<AtlasRiver['source']>; major?: boolean }> = {
  Indus: {
    region: 'Tibet, Ladakh and Pakistan',
    source: { type: 'lake', name: 'Near Lake Mansarovar', place: 'Tibetan Plateau' },
    major: true,
  },
  Jhelum: {
    region: 'Kashmir Valley and Pakistan',
    source: { type: 'spring', name: 'Verinag Spring', place: 'Jammu and Kashmir' },
  },
  Chenab: {
    region: 'Himachal Pradesh, Jammu and Pakistan',
    source: { type: 'confluence', name: 'Chandra-Bhaga confluence', place: 'Tandi, Himachal Pradesh' },
  },
  Ravi: {
    region: 'Himachal Pradesh, Punjab and Pakistan',
    source: { type: 'hills', name: 'Near Rohtang Pass', place: 'Himachal Pradesh' },
  },
  Beas: {
    region: 'Himachal Pradesh and Punjab',
    source: { type: 'glacier', name: 'Beas Kund', place: 'Himachal Pradesh' },
  },
  Sutlej: {
    region: 'Tibet, Himachal Pradesh and Punjab',
    source: { type: 'lake', name: 'Near Rakshastal', place: 'Tibetan Plateau' },
  },
  Brahmaputra: {
    region: 'Tibet, Arunachal Pradesh, Assam and Bangladesh',
    source: { type: 'glacier', name: 'Chemayungdung region', place: 'Tibetan Plateau' },
    major: true,
  },
  Narmada: {
    region: 'Madhya Pradesh, Maharashtra and Gujarat',
    source: { type: 'hills', name: 'Amarkantak Plateau', place: 'Madhya Pradesh' },
    major: true,
  },
  Mahanadi: {
    region: 'Chhattisgarh and Odisha',
    source: { type: 'hills', name: 'Sihawa Hills', place: 'Chhattisgarh' },
    major: true,
  },
  Godavari: {
    region: 'Deccan Plateau to the Bay of Bengal',
    source: { type: 'hills', name: 'Trimbakeshwar', place: 'Maharashtra' },
    major: true,
  },
  Krishna: {
    region: 'Western Ghats to the Bay of Bengal',
    source: { type: 'hills', name: 'Near Mahabaleshwar', place: 'Maharashtra' },
    major: true,
  },
}

const RIVER_TRACES: (Omit<AtlasRiver, 'geometry'> & { coordinates: [number, number][] })[] = [
  { id: 6101, name: 'Ganga', system: 'ganga_ref', region: 'North India plains', major: true, source: { type: 'glacier', name: 'Gangotri Glacier', place: 'Uttarakhand' }, coordinates: [[78.65, 30.15], [78.25, 29.15], [79.6, 27.4], [81.25, 25.9], [82.8, 25.35], [85.13, 25.59], [87.05, 24.98], [88.15, 24.1]], labelPoint: [82.4, 25.25], labelAngle: 15 },
  { id: 6102, name: 'Yamuna', system: 'ganga_ref', region: 'Yamuna basin', major: true, source: { type: 'glacier', name: 'Yamunotri Glacier', place: 'Uttarakhand' }, coordinates: [[78.45, 30.95], [77.9, 30.25], [77.22, 28.62], [78.1, 27.18], [79.2, 26.1], [81.85, 25.43]], labelPoint: [78.05, 27.2], labelAngle: 72 },
  { id: 6103, name: 'Brahmaputra', system: 'ganga_ref', region: 'North-East India', major: true, source: { type: 'glacier', name: 'Tsangpo headwaters', place: 'Tibet' }, coordinates: [[95.35, 28.05], [94.45, 27.45], [92.85, 26.78], [91.35, 26.15], [89.95, 25.92]], labelPoint: [92.6, 26.65], labelAngle: -13 },
  { id: 6104, name: 'Ramganga', system: 'ganga_ref', region: 'Uttarakhand and Uttar Pradesh', coordinates: [[79.2, 30.05], [79.18, 28.95], [79.55, 28.25], [80.25, 26.95]], labelPoint: [79.65, 28.25], labelAngle: 75 },
  { id: 6105, name: 'Gomti', system: 'ganga_ref', region: 'Uttar Pradesh', source: { type: 'lake', name: 'Gomat Taal', place: 'Uttar Pradesh' }, coordinates: [[80.1, 28.55], [80.88, 27.25], [81.78, 26.1], [83.0, 25.55]], labelPoint: [81.55, 26.4], labelAngle: 72 },
  { id: 6106, name: 'Ghaghara', system: 'ganga_ref', region: 'Himalayan tributary', coordinates: [[81.25, 29.55], [81.95, 28.05], [82.75, 26.45], [84.45, 25.62]], labelPoint: [82.45, 27.05], labelAngle: 80 },
  { id: 6107, name: 'Gandak', system: 'ganga_ref', region: 'Bihar and Nepal Himalaya', coordinates: [[84.35, 28.05], [84.72, 26.45], [85.13, 25.59]], labelPoint: [84.78, 26.5], labelAngle: 83 },
  { id: 6108, name: 'Koshi', system: 'ganga_ref', region: 'Bihar and Nepal', coordinates: [[86.55, 27.6], [87.45, 27.15], [87.28, 25.85], [87.85, 24.79]], labelPoint: [87.45, 26.65], labelAngle: 74 },
  { id: 6109, name: 'Mahananda', system: 'ganga_ref', region: 'North Bengal and Bihar', coordinates: [[88.2, 26.85], [88.05, 25.75], [87.9, 24.62]], labelPoint: [88.05, 25.75], labelAngle: 80 },
  { id: 6110, name: 'Son', system: 'ganga_ref', region: 'Amarkantak to Bihar', source: { type: 'hills', name: 'Amarkantak Plateau', place: 'Madhya Pradesh' }, coordinates: [[81.75, 22.75], [83.1, 23.75], [84.55, 24.72], [85.0, 25.2]], labelPoint: [83.7, 24.05], labelAngle: 10 },
  { id: 6111, name: 'Chambal', system: 'ganga_ref', region: 'Rajasthan and Madhya Pradesh', source: { type: 'hills', name: 'Janapav Hills', place: 'Madhya Pradesh' }, coordinates: [[75.55, 22.55], [75.55, 24.0], [76.9, 25.02], [79.25, 26.45]], labelPoint: [76.95, 25.35], labelAngle: 25 },
  { id: 6112, name: 'Betwa', system: 'ganga_ref', region: 'Bundelkhand', coordinates: [[77.7, 23.2], [78.45, 24.45], [79.55, 25.45], [80.0, 25.9]], labelPoint: [78.7, 24.7], labelAngle: 73 },
  { id: 6113, name: 'Ken', system: 'ganga_ref', region: 'Bundelkhand', coordinates: [[80.0, 23.55], [80.4, 24.75], [80.85, 25.85]], labelPoint: [80.45, 24.7], labelAngle: 76 },
  { id: 6114, name: 'Damodar', system: 'ganga_ref', region: 'Jharkhand and West Bengal', source: { type: 'hills', name: 'Chota Nagpur Plateau', place: 'Jharkhand' }, coordinates: [[85.15, 23.72], [86.75, 23.52], [88.18, 23.18]], labelPoint: [86.8, 23.7], labelAngle: -8 },
  { id: 6115, name: 'Hooghly', system: 'ganga_ref', region: 'Lower Ganga distributary', coordinates: [[88.15, 24.1], [88.28, 22.85], [88.36, 21.75]], labelPoint: [88.32, 22.65], labelAngle: 84 },
  { id: 6116, name: 'Teesta', system: 'ganga_ref', region: 'Sikkim and North Bengal', source: { type: 'lake', name: 'Tso Lhamo Lake', place: 'Sikkim' }, coordinates: [[88.6, 27.7], [88.55, 26.65], [88.85, 25.85]], labelPoint: [88.55, 26.7], labelAngle: 80 },
  { id: 6117, name: 'Lohit', system: 'ganga_ref', region: 'Arunachal Pradesh', coordinates: [[97.15, 28.1], [96.0, 27.65], [95.05, 27.5]], labelPoint: [96.0, 27.75], labelAngle: -12 },
  { id: 6118, name: 'Subansiri', system: 'ganga_ref', region: 'Arunachal Pradesh', coordinates: [[93.55, 28.45], [93.8, 27.95], [94.05, 27.25]], labelPoint: [93.8, 27.95], labelAngle: 78 },
]

const INITIAL: AtlasState = {
  screen: 'home',
  app: null,
  category: null,
  continent: null,
  riverSystem: null,
  parkRegion: null,
  parkLearnState: null,
  parkLearnParkId: null,
  setupCount: 10,
  setupMode: 'locate',
  mode: 'locate',
  queue: [],
  qIndex: 0,
  target: null,
  choices: [],
  chosenId: null,
  score: 0,
  streak: 0,
  best: 0,
  correctCount: 0,
  wrongList: [],
  answerHistory: [],
  hintsLeft: 0,
  hintUsed: false,
  removedChoiceId: null,
  toast: null,
}

function shuffle<T>(items: T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function normalizeStateName(name: string): string {
  const aliases: Record<string, string> = {
    andamanandnicobar: 'andamannicobar',
    andamanandnicobarislands: 'andamannicobar',
    jammuandkashmir: 'jammukashmir',
    jammukashmir: 'jammukashmir',
    nctofdelhi: 'delhi',
    delhinct: 'delhi',
    odisha: 'orissa',
    orissa: 'orissa',
    uttarakhand: 'uttarakhand',
    uttaranchal: 'uttarakhand',
    puducherry: 'puducherry',
    pondicherry: 'puducherry',
  }
  const key = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z]/g, '')
  return aliases[key] ?? key
}

function multiplier(streak: number): number {
  if (streak < 3) return 1
  if (streak < 6) return 2
  if (streak < 9) return 3
  if (streak < 12) return 4
  return 5
}

function curriculumRivers(rivers: AtlasRiver[], system: string | null): AtlasRiver[] {
  return rivers.filter(r => CURATED_DISPLAY_NAMES.has(r.name) && (!system || r.system === system))
}

function riverItems(rivers: AtlasRiver[], system: string | null): QuizItem[] {
  return curriculumRivers(rivers, system).map(r => ({
    id: r.id,
    name: r.name,
    region: r.region,
    source: r.source,
  }))
}

function parkItems(parks: AtlasPark[], region: string | null): QuizItem[] {
  return parks.filter(p => !region || p.region === region).map(p => ({
    id: p.id,
    name: p.name,
    state: p.state,
    region: p.region,
  }))
}

function cleanRegionName(name: string): string {
  return name.replace(/^Region\s+\d+\s+.\s+/, '')
}

async function loadData(): Promise<LoadedData> {
  const [world, states, parksRaw, riverRaw, naturalEarthRivers, cwcRivers] = await Promise.all([
    fetch(asset('data/countries-110m.json')).then(r => r.json()) as Promise<Topology>,
    fetch(asset('data/india-states.json')).then(r => r.json()) as Promise<FeatureCollection>,
    fetch(asset('data/india-national-parks.json')).then(r => r.json()) as Promise<{ regions: ParkRegion[]; parks: AtlasPark[] }>,
    fetch(asset('data/india-rivers-osm.geojson')).then(r => r.json()).catch(() => null) as Promise<FeatureCollection | null>,
    fetch(asset('data/india-rivers-ne-10m.geojson')).then(r => r.json()).catch(() => null) as Promise<FeatureCollection | null>,
    fetch(asset('data/india-rivers-curriculum-v2.geojson')).then(r => r.json()).catch(() => null) as Promise<FeatureCollection | null>,
  ])
  const features = (topojson.feature(world, world.objects.countries) as unknown as FeatureCollection).features
  const byFeatureId = new Map(features.map(f => [Number(f.id), f]))
  const countries: AtlasCountry[] = []
  ORDER.forEach(continent => {
    CONT_DATA[continent].forEach(([id, fallback]) => {
      const feature = byFeatureId.get(id)
      if (!feature) return
      countries.push({
        id,
        name: String((feature.properties as { name?: string } | undefined)?.name ?? fallback),
        continent,
        feature,
      })
    })
  })
  return {
    countries,
    indiaStates: states,
    parks: parksRaw.parks,
    parkRegions: parksRaw.regions,
    rivers: loadRiverGeometry(riverRaw, naturalEarthRivers, cwcRivers),
  }
}

const rivers: AtlasRiver[] = RIVER_TRACES.map(r => ({
  ...r,
  geometry: { type: 'LineString', coordinates: r.coordinates } as Geometry,
}))

type RiverPoint = [number, number]

function riverPointDistance(a: RiverPoint, b: RiverPoint): number {
  const meanLat = ((a[1] + b[1]) / 2) * Math.PI / 180
  return Math.hypot((a[0] - b[0]) * Math.cos(meanLat), a[1] - b[1])
}

function riverLineLength(line: RiverPoint[]): number {
  let length = 0
  for (let index = 1; index < line.length; index += 1) {
    length += riverPointDistance(line[index - 1], line[index])
  }
  return length
}

function practiceReadyRiverGeometry(geometry: Geometry): geometry is Geometry {
  if (geometry.type !== 'LineString') return false
  const line = geometry.coordinates.map(point => [point[0], point[1]] as RiverPoint)
  if (line.length < 12 || riverLineLength(line) < 0.35) return false
  const longitudes = line.map(point => point[0])
  const latitudes = line.map(point => point[1])
  return Math.max(...longitudes) - Math.min(...longitudes) >= 0.15
    || Math.max(...latitudes) - Math.min(...latitudes) >= 0.15
}

function continuousRiverGeometry(geometry: Geometry): Geometry {
  if (geometry.type !== 'MultiLineString') return geometry
  const chains = geometry.coordinates
    .filter(line => line.length > 1)
    .map(line => line.map(point => [point[0], point[1]] as RiverPoint))
  const maxJoinGap = 0.12

  while (chains.length > 1) {
    let closest: { first: number; second: number; gap: number; join: 'end-start' | 'end-end' | 'start-end' | 'start-start' } | null = null
    for (let first = 0; first < chains.length; first += 1) {
      for (let second = first + 1; second < chains.length; second += 1) {
        const a = chains[first]
        const b = chains[second]
        const candidates = [
          { gap: riverPointDistance(a[a.length - 1], b[0]), join: 'end-start' as const },
          { gap: riverPointDistance(a[a.length - 1], b[b.length - 1]), join: 'end-end' as const },
          { gap: riverPointDistance(a[0], b[b.length - 1]), join: 'start-end' as const },
          { gap: riverPointDistance(a[0], b[0]), join: 'start-start' as const },
        ]
        for (const candidate of candidates) {
          if (candidate.gap > maxJoinGap || (closest && candidate.gap >= closest.gap)) continue
          closest = { first, second, ...candidate }
        }
      }
    }
    if (!closest) break

    const a = chains[closest.first]
    const b = chains[closest.second]
    const joined = closest.join === 'end-start'
      ? a.concat(b.slice(1))
      : closest.join === 'end-end'
        ? a.concat(b.slice().reverse().slice(1))
        : closest.join === 'start-end'
          ? b.concat(a.slice(1))
          : b.slice().reverse().concat(a.slice(1))
    chains[closest.first] = joined
    chains.splice(closest.second, 1)
  }

  const mainCourse = chains.sort((a, b) => riverLineLength(b) - riverLineLength(a))[0]
  return mainCourse ? { type: 'LineString', coordinates: mainCourse } : geometry
}

function naturalEarthRiverGeometry(data: FeatureCollection | null, riverName: string): Geometry | null {
  const naturalEarthName = NATURAL_EARTH_RIVER_NAMES[riverName]
  if (!naturalEarthName || !data?.features.length) return null
  const lines = data.features
    .filter(feature => {
      const props = feature.properties as { name?: string; name_en?: string; name_alt?: string } | null
      return [props?.name, props?.name_en, props?.name_alt].includes(naturalEarthName)
    })
    .flatMap(feature => {
      if (feature.geometry.type === 'LineString') return [feature.geometry.coordinates]
      if (feature.geometry.type === 'MultiLineString') return feature.geometry.coordinates
      return []
    })
  if (!lines.length) return null
  return continuousRiverGeometry({ type: 'MultiLineString', coordinates: lines })
}

function loadRiverGeometry(
  data: FeatureCollection | null,
  naturalEarthData: FeatureCollection | null,
  cwcData: FeatureCollection | null,
): AtlasRiver[] {
  if (!data?.features?.length && !naturalEarthData?.features.length && !cwcData?.features.length) return []
  const fallbackByName = new Map(rivers.map(r => [r.name, r]))
  const osmByName = new Map(
    (data?.features ?? []).map(feature => [String((feature.properties as { name?: string } | null)?.name ?? ''), feature]),
  )
  const cwcByName = new Map(
    (cwcData?.features ?? []).map(feature => [String((feature.properties as { name?: string } | null)?.name ?? ''), feature]),
  )
  return [...CURATED_RIVER_SYSTEM.entries()]
    .map(([name, system]) => {
      const feature = osmByName.get(name)
      const cwcFeature = cwcByName.get(name)
      const naturalEarthGeometry = naturalEarthRiverGeometry(naturalEarthData, name)
      const osmGeometry = feature?.geometry ? continuousRiverGeometry(feature.geometry) : null
      const cwcGeometry = cwcFeature?.geometry ?? null
      const candidates = system === 'indus_ref'
        ? [naturalEarthGeometry, cwcGeometry, osmGeometry]
        : [cwcGeometry, naturalEarthGeometry, osmGeometry]
      const geometry = candidates
        .find((candidate): candidate is Geometry => Boolean(candidate && practiceReadyRiverGeometry(candidate)))
      if (!geometry) return null
      const fallback = fallbackByName.get(name)
      const details = RIVER_DETAILS[name]
      const systemName = RIVER_SYSTEMS.find(item => item.key === system)?.name ?? 'India river system'
      return {
        id: fallback?.id ?? Math.abs(name.split('').reduce((n, ch) => ((n * 31 + ch.charCodeAt(0)) >>> 0), 0)),
        name: riverDisplayName(name),
        system,
        region: fallback?.region ?? details?.region ?? systemName,
        major: fallback?.major ?? details?.major ?? ['Ganga', 'Yamuna'].includes(name),
        source: fallback?.source ?? details?.source,
        geometry,
        labelPoint: fallback?.labelPoint,
        labelAngle: fallback?.labelAngle,
      } satisfies AtlasRiver
    })
    .filter(Boolean) as AtlasRiver[]
}

export function MapsArcade() {
  const setOverlay = useAppStore(s => s.setOverlay)
  const overlayScreen = useAppStore(s => s.overlayScreen)
  const setScreen = useAppStore(s => s.setScreen)
  const [loaded, setLoaded] = useState<LoadedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<AtlasState>(INITIAL)
  const [parkFactsOpen, setParkFactsOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 700)
  const mapRef = useRef<MapSVGHandle>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | null>(null)
  const advanceTimer = useRef<number | null>(null)
  const mapRivers = useMemo(() => curriculumRivers(loaded?.rivers ?? [], null), [loaded])

  useEffect(() => {
    let live = true
    loadData()
      .then(data => { if (live) setLoaded(data) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (state.category !== 'rivers' || !state.queue.length) return
    const validNames = new Set(
      (CURATED_RIVER_NAMES[state.riverSystem ?? ''] ?? []).map(riverDisplayName),
    )
    if (state.queue.every(item => validNames.has(item.name))) return
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    setState(prev => ({
      ...INITIAL,
      app: 'india',
      category: 'rivers',
      screen: 'river-menu',
      toast: { kind: 'hint', text: 'River maps updated. Choose a basin to begin a clean round.' },
      setupCount: prev.setupCount,
    }))
  }, [state.category, state.queue, state.riverSystem])

  useEffect(() => {
    const root = rootRef.current
    if (!root || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.atlas-topbar', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.42, ease: EASE.out, clearProps: 'transform,opacity' })
      gsap.fromTo('.atlas-stage', { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.58, delay: 0.06, ease: EASE.out, clearProps: 'transform,opacity' })
    }, root)
    return () => { ctx.revert() }
  }, [])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(panel, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.32, ease: EASE.out, clearProps: 'transform,opacity' })
      gsap.fromTo(
        panel.querySelectorAll('.atlas-india-card, .atlas-park-card, .atlas-park-overview, .atlas-park-learn-toolbar, .atlas-park-lesson-title, .atlas-park-lesson-context>div, .atlas-park-lesson-actions'),
        { opacity: 0, y: 14, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.36, stagger: 0.035, delay: 0.05, ease: EASE.out, clearProps: 'transform,opacity' },
      )
    }, panel)
    return () => { ctx.revert() }
  }, [state.screen, state.qIndex, state.chosenId, state.parkLearnState, state.parkLearnParkId])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    }
  }, [])

  const countriesByContinent = useMemo(() => {
    const map: Record<string, AtlasCountry[]> = {}
    loaded?.countries.forEach(c => {
      map[c.continent] = map[c.continent] ?? []
      map[c.continent].push(c)
    })
    return map
  }, [loaded])

  const currentView: AtlasView = state.screen === 'home' || state.screen === 'world-menu'
    ? 'world'
    : state.app === 'world'
      ? state.category === 'countries'
        ? 'continent'
        : 'world-physical'
      : state.category === 'rivers'
        ? 'river-system'
        : state.category === 'parks'
          ? 'parks'
          : 'india'

  const phase: AtlasPhase = state.screen === 'park-learn'
    ? 'learn'
    : state.screen === 'play'
      ? state.answerHistory[state.qIndex] ? 'answered' : 'playing'
      : state.screen === 'results'
        ? 'results'
        : 'browse'

  const mapTargetId = state.target ? answerId(state.target) : null
  const activeTopic = topicTitle()
  const total = currentPool().length
  const accuracy = state.queue.length ? Math.round((state.correctCount / state.queue.length) * 100) : 0
  const activeLearnState = state.screen === 'park-learn' ? currentParkLearnState() : null
  const activeLearnParks = state.screen === 'park-learn'
    ? (loaded?.parks ?? []).filter(park => (!state.parkRegion || park.region === state.parkRegion) && (!activeLearnState || park.state === activeLearnState))
    : []
  const activeLearnPark = activeLearnParks.find(park => park.id === state.parkLearnParkId) ?? activeLearnParks[0] ?? null
  const activeLearnRiverNames = activeLearnPark
    ? [...(PARK_PRELIMS[activeLearnPark.name]?.mapRivers ?? PARK_STATE_CONTEXT[activeLearnPark.state]?.rivers ?? [])]
    : []
  const activePracticeRegion = state.screen === 'play' && state.category === 'parks'
    ? (state.target?.region ?? state.parkRegion)
    : null
  const activePracticeState = state.screen === 'play' && state.category === 'parks' && phase === 'answered' && state.target?.state
    ? normalizeStateName(state.target.state)
    : null
  const useWorldGlobe = currentView === 'world' || currentView === 'continent'
    || currentView === 'world-physical'
  const physicalKind = state.category === 'world-rivers'
    ? 'river'
    : state.category === 'mountains'
      ? 'mountain'
      : null

  function patch(patchState: Partial<AtlasState>) {
    setState(prev => ({ ...prev, ...patchState }))
  }

  function showToast(toast: Toast, delay = 1800) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    patch({ toast })
    toastTimer.current = window.setTimeout(() => {
      setState(prev => prev.toast === toast ? { ...prev, toast: null } : prev)
    }, delay)
  }

  function currentPool(): QuizItem[] {
    if (!loaded) return []
    if (state.app === 'world' && state.category === 'world-rivers') {
      return WORLD_PHYSICAL_FEATURES
        .filter(feature => feature.kind === 'river' && (!state.continent || feature.continent === state.continent))
        .map(feature => ({ id: feature.id, name: feature.name, region: feature.region, kind: feature.kind }))
    }
    if (state.app === 'world' && state.category === 'mountains') {
      return WORLD_PHYSICAL_FEATURES
        .filter(feature => feature.kind === 'mountain')
        .map(feature => ({ id: feature.id, name: feature.name, region: feature.region, kind: feature.kind }))
    }
    if (state.app === 'world' && state.continent) {
      return (countriesByContinent[state.continent] ?? []).map(c => ({ id: c.id, name: c.name, continent: c.continent }))
    }
    if (state.app === 'india' && state.category === 'rivers') return riverItems(loaded.rivers, state.riverSystem)
    if (state.app === 'india' && state.category === 'parks') return parkItems(loaded.parks, state.parkRegion)
    return []
  }

  function answerId(item: QuizItem): string | number {
    if (state.app === 'india' && state.category === 'parks') return normalizeStateName(item.state ?? '')
    return item.id
  }

  function itemName(id: string | number | null, category = state.category): string | null {
    if (id == null || !loaded) return null
    const idStr = String(id)
    if (category === 'parks') {
      const stateFeature = loaded.indiaStates.features.find(f => {
        const name = String((f.properties as { NAME_1?: string })?.NAME_1 ?? '')
        return normalizeStateName(name) === idStr
      })
      return String((stateFeature?.properties as { NAME_1?: string } | undefined)?.NAME_1 ?? id)
    }
    const physical = WORLD_PHYSICAL_FEATURES.find(feature => feature.id === idStr)
    if (physical) return physical.name
    const river = loaded.rivers.find(r => String(r.id) === idStr)
    if (river) return river.name
    const country = loaded.countries.find(c => String(c.id) === idStr)
    return country?.name ?? null
  }

  function makeChoices(item: QuizItem): Choice[] {
    if (!loaded) return []
    if (state.category === 'parks') {
      const allStates = [...new Set(loaded.parks.map(p => p.state))]
      const regionalStates = [...new Set(loaded.parks.filter(p => !state.parkRegion || p.region === state.parkRegion).map(p => p.state))]
      const pool = (regionalStates.length >= 3 ? regionalStates : allStates).filter(s => s !== item.state)
      return shuffle([
        { id: normalizeStateName(item.state ?? ''), name: item.state ?? '' },
        ...shuffle(pool).slice(0, 2).map(s => ({ id: normalizeStateName(s), name: s })),
      ])
    }
    if (state.app === 'world' && (state.category === 'world-rivers' || state.category === 'mountains')) {
      const pool = currentPool().filter(p => String(p.id) !== String(item.id))
      return shuffle([item, ...shuffle(pool).slice(0, 2)]).map(p => ({ id: p.id, name: p.name }))
    }
    const pool = currentPool().filter(p => String(p.id) !== String(item.id))
    return shuffle([item, ...shuffle(pool).slice(0, 2)]).map(p => ({ id: p.id, name: p.name }))
  }

  function startQuiz(sourceList?: QuizItem[]) {
    const pool = sourceList?.length ? sourceList : currentPool()
    if (!pool.length) {
      showToast({ kind: 'hint', text: 'No items available for this topic yet.' })
      return
    }
    const count = sourceList?.length ? sourceList.length : Math.max(1, Math.min(pool.length, state.setupCount || pool.length))
    const queue = shuffle(pool).slice(0, count)
    const mode = state.setupMode
    const first = queue[0]
    setState(prev => ({
      ...prev,
      screen: 'play',
      mode,
      queue,
      qIndex: 0,
      target: first,
      choices: mode === 'name' ? makeChoicesForContext(first, pool) : [],
      chosenId: null,
      score: 0,
      streak: 0,
      best: 0,
      correctCount: 0,
      wrongList: [],
      answerHistory: [],
      hintsLeft: Math.max(2, Math.ceil(queue.length / 3)),
      hintUsed: false,
      removedChoiceId: null,
      toast: null,
    }))
  }

  function makeChoicesForContext(item: QuizItem, sourcePool: QuizItem[]): Choice[] {
    if (!loaded) return []
    if (state.category === 'parks') {
      const allStates = [...new Set(loaded.parks.map(p => p.state))]
      const regionalStates = [...new Set(loaded.parks.filter(p => !state.parkRegion || p.region === state.parkRegion).map(p => p.state))]
      const pool = (regionalStates.length >= 3 ? regionalStates : allStates).filter(s => s !== item.state)
      return shuffle([
        { id: normalizeStateName(item.state ?? ''), name: item.state ?? '' },
        ...shuffle(pool).slice(0, 2).map(s => ({ id: normalizeStateName(s), name: s })),
      ])
    }
    if (state.app === 'world' && (state.category === 'world-rivers' || state.category === 'mountains')) {
      const pool = sourcePool.filter(p => String(p.id) !== String(item.id))
      return shuffle([item, ...shuffle(pool).slice(0, 2)]).map(p => ({ id: p.id, name: p.name }))
    }
    const pool = sourcePool.filter(p => String(p.id) !== String(item.id))
    return shuffle([item, ...shuffle(pool).slice(0, 2)]).map(p => ({ id: p.id, name: p.name }))
  }

  function loadQuestion(index: number) {
    const target = state.queue[index]
    if (!target) {
      patch({ screen: 'results' })
      return
    }
    const hist = state.answerHistory[index]
    patch({
      qIndex: index,
      target,
      choices: hist?.mode === 'name'
        ? (hist.choices ?? [])
        : state.mode === 'name'
          ? makeChoices(target)
          : [],
      chosenId: hist?.chosenId ?? null,
      hintUsed: Boolean(hist?.hintUsed),
      removedChoiceId: hist?.removedChoiceId ?? null,
      toast: hist?.toast ?? null,
    })
  }

  function advance() {
    const next = state.qIndex + 1
    if (next >= state.queue.length) {
      patch({ screen: 'results', toast: null })
      return
    }
    loadQuestion(next)
  }

  const onAnswer = useCallback((id: string | number) => {
    setState(prev => {
      if (prev.screen !== 'play' || prev.answerHistory[prev.qIndex] || !prev.target) return prev
      const targetId = prev.app === 'india' && prev.category === 'parks'
        ? normalizeStateName(prev.target.state ?? '')
        : prev.target.id
      const correct = String(id) === String(targetId)
      const m = multiplier(prev.streak)
      const points = correct ? 100 * m : 0
      const nextStreak = correct ? prev.streak + 1 : 0
      const clicked = (() => {
        if (!loaded || id == null) return null
        const idStr = String(id)
        if (prev.category === 'parks') {
          const stateFeature = loaded.indiaStates.features.find(f => {
            const name = String((f.properties as { NAME_1?: string })?.NAME_1 ?? '')
            return normalizeStateName(name) === idStr
          })
          return String((stateFeature?.properties as { NAME_1?: string } | undefined)?.NAME_1 ?? id)
        }
        const river = loaded.rivers.find(r => String(r.id) === idStr)
        if (river) return river.name
        const physical = WORLD_PHYSICAL_FEATURES.find(feature => feature.id === idStr)
        if (physical) return physical.name
        const country = loaded.countries.find(c => String(c.id) === idStr)
        return country?.name ?? null
      })()
      const msg = correct
        ? prev.app === 'world'
          ? (m > 1 ? `Map hit. +${points} points · x${m} combo.` : `Map hit. +${points} points.`)
          : (m > 1 ? `Correct. +${points} points · x${m} combo.` : `Correct. +${points} points.`)
        : prev.app === 'world'
          ? `${clicked ? `${clicked}. ` : ''}Lock onto ${prev.target.name} next time.`
          : prev.category === 'parks'
            ? `${clicked ? `${clicked}. ` : ''}${prev.target.name} is in ${prev.target.state}.`
            : `${clicked ? `${clicked}. ` : ''}The answer is ${prev.target.name}.`
      const answer: QuizAnswer = {
        targetId,
        chosenId: id,
        correct,
        mode: prev.mode,
        choices: prev.choices,
        toast: { kind: correct ? 'correct' : 'wrong', text: msg },
        hintUsed: prev.hintUsed,
        removedChoiceId: prev.removedChoiceId,
        park: prev.category === 'parks' ? {
          name: prev.target.name,
          lon: loaded?.parks.find(p => String(p.id) === String(prev.target?.id))?.lon ?? 0,
          lat: loaded?.parks.find(p => String(p.id) === String(prev.target?.id))?.lat ?? 0,
        } : undefined,
      }
      const history = prev.answerHistory.slice()
      history[prev.qIndex] = answer
      const wrongList = correct || prev.wrongList.some(w => String(w.id) === String(prev.target?.id))
        ? prev.wrongList
        : prev.wrongList.concat(prev.target)
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
      if (prev.category !== 'parks') {
        advanceTimer.current = window.setTimeout(() => {
          setState(s => {
            const next = s.qIndex + 1
            if (s.screen !== 'play') return s
            if (next >= s.queue.length) return { ...s, screen: 'results', toast: null }
            const target = s.queue[next]
            return {
              ...s,
              qIndex: next,
              target,
              choices: s.mode === 'name' ? makeChoicesForContext(target, s.queue) : [],
              chosenId: null,
              hintUsed: false,
              removedChoiceId: null,
              toast: null,
            }
          })
        }, prev.app === 'world' ? 1450 : prev.category === 'rivers' ? 1500 : 1000)
      }
      return {
        ...prev,
        chosenId: id,
        score: prev.score + points,
        streak: nextStreak,
        best: Math.max(prev.best, nextStreak),
        correctCount: correct ? prev.correctCount + 1 : prev.correctCount,
        wrongList,
        answerHistory: history,
        toast: answer.toast ?? null,
      }
    })
  }, [loaded])

  function skip() {
    if (state.answerHistory[state.qIndex]) {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
      advance()
      return
    }
    onAnswer('__skip__')
  }

  function previous() {
    if (state.qIndex <= 0) return
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    loadQuestion(state.qIndex - 1)
  }

  function useHint() {
    if (!state.target || state.hintsLeft <= 0 || state.hintUsed || state.answerHistory[state.qIndex]) return
    if (state.mode === 'locate') {
      const text = state.category === 'parks'
        ? `Hint: ${state.target.state}`
        : state.category === 'rivers'
          ? `Hint: flows through ${state.target.region}`
          : state.category === 'world-rivers'
            ? `Hint: ${state.target.region}`
            : state.category === 'mountains'
              ? `Hint: ${state.target.region}`
              : `Hint: starts with ${state.target.name[0]}`
      patch({ hintsLeft: state.hintsLeft - 1, hintUsed: true })
      showToast({ kind: 'hint', text }, 2200)
      return
    }
    const correct = answerId(state.target)
    const removable = state.choices.filter(c => String(c.id) !== String(correct) && String(c.id) !== String(state.removedChoiceId))
    const drop = shuffle(removable)[0]
    if (!drop) return
    patch({ hintsLeft: state.hintsLeft - 1, hintUsed: true, removedChoiceId: drop.id })
    showToast({ kind: 'hint', text: 'One option removed.' }, 1600)
  }

  function switchMode(mode: AtlasMode) {
    if (state.answerHistory[state.qIndex] || !state.target || mode === state.mode) return
    patch({
      mode,
      choices: mode === 'name' ? makeChoices(state.target) : [],
      chosenId: null,
      removedChoiceId: null,
      toast: null,
    })
  }

  function topicTitle() {
    if (state.app === 'world' && state.category === 'world-rivers') return state.continent ? `${state.continent} Rivers` : 'World Rivers'
    if (state.app === 'world' && state.category === 'mountains') return 'Mountains and Ranges'
    if (state.app === 'world') return state.continent ?? 'World Mapping'
    if (state.category === 'rivers') return RIVER_SYSTEMS.find(s => s.key === state.riverSystem)?.name ?? 'India Rivers'
    if (state.category === 'parks') return loaded?.parkRegions.find(r => r.key === state.parkRegion)?.name ? cleanRegionName(loaded.parkRegions.find(r => r.key === state.parkRegion)!.name) : 'National Parks'
    if (state.app === 'india') return 'India Mapping'
    return 'Atlas Arcade'
  }

  function currentParkLearnState(): string | null {
    if (!loaded || state.screen !== 'park-learn') return null
    const states = [...new Set(loaded.parks.filter(p => !state.parkRegion || p.region === state.parkRegion).map(p => p.state))].sort()
    return state.parkLearnState ?? states[0] ?? null
  }

  function goBack() {
    if (state.screen === 'home') {
      if (overlayScreen === 'maps-arcade') setOverlay(null)
      else setScreen('feed')
      return
    }
    if (state.screen === 'play' || state.screen === 'results') {
      if (state.category === 'rivers') patch({ screen: 'setup', toast: null })
      else if (state.category === 'parks') patch({ screen: 'setup', toast: null })
      else patch({ screen: 'setup', toast: null })
      return
    }
    if (state.screen === 'setup') {
      if (state.app === 'world' && state.category === 'world-rivers') patch({ screen: 'world-river-menu', continent: null, toast: null })
      else if (state.app === 'world' && state.category === 'mountains') patch({ screen: 'physical-menu', continent: null, toast: null })
      else if (state.app === 'world') patch({ screen: 'world-menu', continent: null, toast: null })
      else if (state.category === 'rivers') patch({ screen: 'river-menu', toast: null })
      else patch({ screen: 'park-menu', toast: null })
      return
    }
    if (state.screen === 'river-menu' || state.screen === 'park-menu' || state.screen === 'park-learn') {
      patch({ screen: 'india-menu', category: null, riverSystem: null, parkRegion: null, toast: null })
      return
    }
    if (state.screen === 'world-river-menu') {
      patch({ screen: 'physical-menu', continent: null, toast: null })
      return
    }
    if (state.screen === 'world-menu' || state.screen === 'physical-menu' || state.screen === 'india-menu') {
      setState(INITIAL)
    }
  }

  function openSetup(next: Partial<AtlasState>) {
    const poolCount = next.category === 'rivers'
      ? riverItems(loaded?.rivers ?? rivers, next.riverSystem ?? null).length
      : next.category === 'parks'
        ? parkItems(loaded?.parks ?? [], next.parkRegion ?? null).length
        : next.category === 'world-rivers'
          ? WORLD_PHYSICAL_FEATURES.filter(feature => feature.kind === 'river' && (!next.continent || feature.continent === next.continent)).length
          : next.category === 'mountains'
            ? WORLD_PHYSICAL_FEATURES.filter(feature => feature.kind === 'mountain').length
            : (countriesByContinent[next.continent ?? ''] ?? []).length
    patch({
      ...next,
      screen: 'setup',
      setupCount: Math.min(next.category === 'rivers' ? poolCount : 10, poolCount || 10),
      setupMode: 'locate',
      toast: null,
    })
  }

  function focusPark(park: AtlasPark) {
    if (state.screen === 'park-learn') {
      patch({ parkLearnParkId: park.id })
      return
    }
    showToast({ kind: 'hint', text: `${park.name.replace(/ National Park/g, '')}: ${park.state}` }, 1800)
  }

  function renderHome() {
    return (
      <div ref={panelRef} className="atlas-panel atlas-home-panel">
        <div className="atlas-intro">
          <span>Geography practice</span>
          <h3>Choose a map drill</h3>
          <p>Practice through focused rounds. Penni will handle the questions, feedback and review list.</p>
        </div>
        <div className="atlas-home-grid">
          <button onClick={() => patch({ app: 'world', screen: 'world-menu', category: 'countries' })}>
            <FontAwesomeIcon icon={faEarthAsia} />
            <span><b>World Mapping</b><i>Countries by continent</i></span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <button onClick={() => patch({ app: 'world', screen: 'physical-menu', category: null })}>
            <FontAwesomeIcon icon={faMountainSun} />
            <span><b>Physical Features</b><i>Rivers and mountain chains on a globe</i></span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <button onClick={() => patch({ app: 'india', screen: 'india-menu' })}>
            <FontAwesomeIcon icon={faCompass} />
            <span><b>India Mapping</b><i>Rivers and national parks</i></span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>
    )
  }

  function renderWorldMenu() {
    return (
      <div ref={panelRef} className="atlas-panel">
        <div className="atlas-panel-head">
          <span>World Mapping</span>
          <h3>Choose a continent</h3>
        </div>
        <div className="atlas-list-grid">
          {ORDER.map(name => {
            const count = countriesByContinent[name]?.length ?? 0
            if (!count) return null
            return (
              <button key={name} onClick={() => openSetup({ app: 'world', category: 'countries', continent: name })}>
                <i style={{ background: CONT_COLOR[name] }} />
                <span><b>{name}</b><em>{count} countries</em></span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  function renderPhysicalMenu() {
    const riverCount = WORLD_PHYSICAL_FEATURES.filter(feature => feature.kind === 'river').length
    const mountainCount = WORLD_PHYSICAL_FEATURES.filter(feature => feature.kind === 'mountain').length
    return (
      <div ref={panelRef} className="atlas-panel atlas-india-panel">
        <div className="atlas-panel-head">
          <span>World Physical Features</span>
          <h3>Choose the layer</h3>
          <p>Trace rivers and mountain chains directly on the globe.</p>
        </div>
        <div className="atlas-india-grid">
          <button className="atlas-india-card river world-river" onClick={() => patch({ app: 'world', category: 'world-rivers', continent: null, screen: 'world-river-menu' })}>
            <i><FontAwesomeIcon icon={faWater} /></i>
            <span><b>World Rivers</b><em>{riverCount} rivers · practice by continent</em></span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <button className="atlas-india-card mountains" onClick={() => openSetup({ app: 'world', category: 'mountains', continent: null })}>
            <i><FontAwesomeIcon icon={faMountainSun} /></i>
            <span><b>Mountains</b><em>{mountainCount} range chains with ridge markers</em></span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>
    )
  }

  function renderWorldRiverMenu() {
    const continents = ORDER
      .map(name => ({
        name,
        count: WORLD_PHYSICAL_FEATURES.filter(feature => feature.kind === 'river' && feature.continent === name).length,
      }))
      .filter(item => item.count > 0)
    const totalRivers = WORLD_PHYSICAL_FEATURES.filter(feature => feature.kind === 'river').length
    return (
      <div ref={panelRef} className="atlas-panel">
        <div className="atlas-panel-head">
          <span>World Rivers</span>
          <h3>Practice by continent</h3>
          <p>Each round keeps the globe framed on the continent so it feels like a quiz, not a guided tour.</p>
        </div>
        <div className="atlas-park-overview">
          <div>
            <span>Full river drill</span>
            <b>All Continents</b>
            <em>{totalRivers} river trajectories</em>
          </div>
          <button onClick={() => openSetup({ app: 'world', category: 'world-rivers', continent: null })}>
            Practice all
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
        <div className="atlas-list-grid">
          {continents.map(item => (
            <button key={item.name} onClick={() => openSetup({ app: 'world', category: 'world-rivers', continent: item.name })}>
              <i style={{ background: CONT_COLOR[item.name] }} />
              <span><b>{item.name}</b><em>{item.count} rivers visible together</em></span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderIndiaMenu() {
    const riverCount = riverItems(loaded?.rivers ?? rivers, null).length
    const parkCount = loaded?.parks.length ?? 0
    return (
      <div ref={panelRef} className="atlas-panel atlas-india-panel">
        <div className="atlas-panel-head">
          <span>India Mapping</span>
          <h3>Choose your terrain</h3>
          <p>Smooth India practice for rivers, states and national parks.</p>
        </div>
        <div className="atlas-india-grid">
          <button className="atlas-india-card river" onClick={() => patch({ screen: 'river-menu', app: 'india', category: 'rivers', riverSystem: null })}>
            <i><FontAwesomeIcon icon={faWater} /></i>
            <span><b>Rivers</b><em>{riverCount} traced river paths</em></span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <button className="atlas-india-card parks" onClick={() => patch({ screen: 'park-menu', app: 'india', category: 'parks', parkRegion: null })}>
            <i><FontAwesomeIcon icon={faSeedling} /></i>
            <span><b>National Parks</b><em>{parkCount} parks by region and state</em></span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>
    )
  }

  function renderRiverMenu() {
    return (
      <div ref={panelRef} className="atlas-panel">
        <div className="atlas-panel-head">
          <span>India Rivers</span>
          <h3>Choose a system</h3>
          <p>Focused NCERT river sets for clean map recall.</p>
        </div>
        <div className="atlas-list-grid">
          {RIVER_SYSTEMS.map(sys => (
            <button key={sys.key} onClick={() => openSetup({ app: 'india', category: 'rivers', riverSystem: sys.key })}>
              <i style={{ background: sys.color }} />
              <span><b>{sys.name}</b><em>{riverItems(loaded?.rivers ?? rivers, sys.key).length} rivers · {sys.blurb}</em></span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderParkMenu() {
    const allParkCount = loaded?.parks.length ?? 0
    return (
      <div ref={panelRef} className="atlas-panel atlas-wide-panel atlas-park-panel">
        <div className="atlas-panel-head">
          <span>National Parks</span>
          <h3>Pick a clean route</h3>
          <p>Learn parks by region, then practice the visible set.</p>
        </div>
        <div className="atlas-park-overview">
          <div>
            <span>Full India drill</span>
            <b>All National Parks</b>
            <em>{allParkCount} parks across India</em>
          </div>
          <button onClick={() => openSetup({ app: 'india', category: 'parks', parkRegion: null })}>
            Practice all
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
        <div className="atlas-park-grid">
          {loaded?.parkRegions.map(reg => (
            <article className="atlas-park-card" key={reg.key} style={{ '--region': reg.color } as CSSProperties}>
              <div className="atlas-park-card-head">
                <i />
                <span>{loaded.parks.filter(p => p.region === reg.key).length} parks</span>
              </div>
              <b>{cleanRegionName(reg.name)}</b>
              <p>{reg.blurb}</p>
              <div>
                <button onClick={() => {
                  const firstState = [...new Set(loaded.parks.filter(p => p.region === reg.key).map(p => p.state))].sort()[0] ?? null
                  const firstPark = loaded.parks.find(park => park.region === reg.key && park.state === firstState)
                  patch({
                    app: 'india',
                    category: 'parks',
                    screen: 'park-learn',
                    parkRegion: reg.key,
                    parkLearnState: firstState,
                    parkLearnParkId: firstPark?.id ?? null,
                  })
                }}>Learn</button>
                <button onClick={() => openSetup({ app: 'india', category: 'parks', parkRegion: reg.key })}>Practice</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    )
  }

  function renderParkLearn() {
    const states = [...new Set((loaded?.parks ?? []).filter(p => !state.parkRegion || p.region === state.parkRegion).map(p => p.state))].sort()
    const selected = currentParkLearnState()
    const visible = (loaded?.parks ?? []).filter(p => (!state.parkRegion || p.region === state.parkRegion) && (!selected || p.state === selected))
    const park = visible.find(item => item.id === state.parkLearnParkId) ?? visible[0] ?? null
    const parkIndex = park ? visible.findIndex(item => item.id === park.id) : 0
    const stateIndex = selected ? states.indexOf(selected) : 0
    const context = selected ? PARK_STATE_CONTEXT[selected] : null
    const wildlife = park ? (PARK_WILDLIFE[park.name] ?? context?.wildlife ?? 'Protected wildlife habitat') : 'Protected wildlife habitat'
    const prelims = park ? PARK_PRELIMS[park.name] : null
    const prelimsFacts = prelims?.facts ?? [
      `Locate it in ${selected}.`,
      `Associate it with ${wildlife.toLowerCase()}.`,
      `Connect it with ${context?.landscape.toLowerCase() ?? 'its protected landscape'}.`,
    ]
    const riverNames = prelims?.rivers ?? context?.rivers ?? []
    const riverLabel = riverNames.length ? riverNames.slice(0, 4).join(' · ') : 'No major river cue'

    const selectState = (nextState: string) => {
      const firstPark = (loaded?.parks ?? []).find(item => (!state.parkRegion || item.region === state.parkRegion) && item.state === nextState)
      patch({ parkLearnState: nextState, parkLearnParkId: firstPark?.id ?? null })
    }

    const stepPark = (direction: -1 | 1) => {
      if (!visible.length) return
      const nextIndex = (parkIndex + direction + visible.length) % visible.length
      patch({ parkLearnParkId: visible[nextIndex].id })
    }

    const stepState = (direction: -1 | 1) => {
      if (!states.length) return
      const nextIndex = (stateIndex + direction + states.length) % states.length
      selectState(states[nextIndex])
    }

    return (
      <div ref={panelRef} className="atlas-park-learn-ui">
        <nav className="atlas-park-learn-toolbar" aria-label="National park navigation">
          <button className="atlas-park-nav-button previous" onClick={() => stepPark(-1)} aria-label="Previous national park">
            <FontAwesomeIcon icon={faChevronLeft} />
            <span>Previous park</span>
          </button>
          <label className="atlas-park-picker">
            <span>National park</span>
            <select value={park?.id ?? ''} onChange={event => patch({ parkLearnParkId: Number(event.target.value) })}>
              {visible.map(item => <option key={item.id} value={item.id}>{item.name.replace(/ National Park/g, '')}</option>)}
            </select>
          </label>
          <button className="atlas-park-nav-button next" onClick={() => stepPark(1)} aria-label="Next national park">
            <span>Next park</span>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </nav>

        {park && (
          <section className="atlas-park-lesson-dock" key={park.id}>
            <div className="atlas-park-lesson-title">
              <span>{selected} · {parkIndex + 1} of {visible.length}</span>
              <h3>{park.name.replace(/ National Park/g, '')}</h3>
              <p><FontAwesomeIcon icon={faPaw} /> {wildlife}</p>
            </div>

            <div className="atlas-park-lesson-context">
              <div>
                <FontAwesomeIcon icon={faSeedling} />
                <span>Landscape</span>
                <b>{context?.landscape ?? 'Protected landscape'}</b>
              </div>
              <div>
                <FontAwesomeIcon icon={faWater} />
                <span>Rivers on map</span>
                <b>{riverLabel}</b>
              </div>
            </div>

            <div className={`atlas-park-prelims ${parkFactsOpen ? 'open' : ''}`}>
              <button onClick={() => setParkFactsOpen(open => !open)} aria-expanded={parkFactsOpen}>
                <span><FontAwesomeIcon icon={faLightbulb} /> Prelims focus</span>
                <b>{prelimsFacts.length} cues</b>
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
              {parkFactsOpen && (
                <ul>
                  {prelimsFacts.map(fact => <li key={fact}>{fact}</li>)}
                </ul>
              )}
            </div>

            <div className="atlas-park-lesson-actions">
              <div className="atlas-park-state-nav">
                <button onClick={() => stepState(-1)} aria-label="Previous state or union territory">
                  <FontAwesomeIcon icon={faChevronLeft} />
                  <span>Previous state</span>
                </button>
                <label>
                  <span>State / UT</span>
                  <select value={selected ?? ''} onChange={event => selectState(event.target.value)}>
                    {states.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <small>{stateIndex + 1} of {states.length}</small>
                </label>
                <button onClick={() => stepState(1)} aria-label="Next state or union territory">
                  <span>Next state</span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
              <button className="atlas-primary-mini" onClick={() => startQuiz(parkItems(visible, state.parkRegion))}>
                Practice state
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </section>
        )}
      </div>
    )
  }

  function renderSetup() {
    const presets = [5, 8, 10, 15, 20].filter(n => n < total)
    return (
      <div ref={panelRef} className="atlas-panel">
        <div className="atlas-panel-head">
          <span>{state.app === 'world' ? 'World Mapping' : 'India Mapping'}</span>
          <h3>{activeTopic}</h3>
          <p>{total} items available</p>
        </div>
        <div className="atlas-setup-block">
          <label>Questions</label>
          <div className="atlas-counts">
            {presets.map(n => <button key={n} className={state.setupCount === n ? 'on' : ''} onClick={() => patch({ setupCount: n })}>{n}</button>)}
            <button className={state.setupCount === total ? 'on' : ''} onClick={() => patch({ setupCount: total })}>All {total}</button>
          </div>
        </div>
        <div className="atlas-mode-grid">
          <button className={state.setupMode === 'locate' ? 'on' : ''} onClick={() => patch({ setupMode: 'locate' })}>
            <FontAwesomeIcon icon={faLocationDot} />
            <span><b>Find it</b><i>{state.category === 'parks' ? 'Click the state or UT' : 'Click the feature on the map'}</i></span>
          </button>
          <button className={state.setupMode === 'name' ? 'on' : ''} onClick={() => patch({ setupMode: 'name' })}>
            <FontAwesomeIcon icon={faBullseye} />
            <span><b>Name it</b><i>Identify the highlighted answer</i></span>
          </button>
        </div>
        <button className="atlas-start" onClick={() => startQuiz()}>
          Start drill
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
    )
  }

  function renderPlay() {
    if (!state.target) return null
    const hist = state.answerHistory[state.qIndex]
    const targetSource = state.target.source
    const comboPct = Math.min(state.streak, 12) / 12 * 100
    return (
      <>
        <div ref={panelRef} className={`atlas-question ${hist ? (hist.correct ? 'ok' : 'no') : ''}`}>
          <div>
            <span>{state.mode === 'locate' ? (state.category === 'parks' ? 'Select the state/UT' : 'Find on the map') : 'Name the highlighted feature'}</span>
            <h3>{state.mode === 'locate' || state.category === 'parks' ? state.target.name : activeTopic}</h3>
            {state.target.region && state.category !== 'parks' && <p>{state.target.region}</p>}
          </div>
          <div className="atlas-combo">
            <b>x{multiplier(state.streak)}</b>
            <i><strong style={{ width: `${comboPct}%` }} /></i>
          </div>
        </div>

        {state.mode === 'name' && (
          <div className="atlas-choice-row">
            {state.choices.map(choice => {
              const correct = state.target ? String(choice.id) === String(answerId(state.target)) : false
              const picked = String(choice.id) === String(state.chosenId)
              const removed = String(choice.id) === String(state.removedChoiceId) && !hist
              return (
                <button
                  key={choice.id}
                  className={`${hist ? (correct ? 'ok' : picked ? 'no' : 'dim') : ''} ${removed ? 'removed' : ''}`}
                  onClick={() => onAnswer(choice.id)}
                  disabled={Boolean(hist) || removed}
                >
                  {choice.name}
                </button>
              )
            })}
          </div>
        )}

        {targetSource && hist && (
          <div className="atlas-source-card">
            <FontAwesomeIcon icon={faMountainSun} />
            <span><b>{targetSource.name}</b><i>{targetSource.place}</i></span>
          </div>
        )}

        <div className="atlas-controls">
          <button onClick={previous} disabled={state.qIndex === 0}><FontAwesomeIcon icon={faChevronLeft} /> Previous</button>
          <button onClick={useHint} disabled={state.hintsLeft <= 0 || state.hintUsed || Boolean(hist)}><FontAwesomeIcon icon={faLightbulb} /> Hint {state.hintsLeft}</button>
          <button onClick={skip}>{hist ? 'Next' : 'Skip'} <FontAwesomeIcon icon={faChevronRight} /></button>
        </div>
      </>
    )
  }

  function renderResults() {
    return (
      <div ref={panelRef} className="atlas-results">
        <div className="qz-ring" style={{ '--p': accuracy } as CSSProperties}>
          <div className="qz-ring-inner">
            <b>{accuracy}<i>%</i></b>
            <span>{state.correctCount} / {state.queue.length}</span>
          </div>
        </div>
        <h3>{state.wrongList.length ? 'Drill complete' : 'Perfect run'}</h3>
        <p>{state.score} points · best streak {state.best}</p>
        {state.wrongList.length > 0 && (
          <div className="atlas-missed">
            <b>Review next</b>
            {state.wrongList.slice(0, 5).map(item => <span key={item.id}>{item.name}</span>)}
          </div>
        )}
        <div className="atlas-result-actions">
          {state.wrongList.length > 0 && <button onClick={() => startQuiz(state.wrongList)}>Practice missed</button>}
          <button onClick={() => startQuiz()}><FontAwesomeIcon icon={faArrowRotateRight} /> Restart</button>
          <button onClick={() => patch({ screen: state.category === 'rivers' ? 'river-menu' : state.category === 'parks' ? 'park-menu' : state.category === 'world-rivers' ? 'world-river-menu' : state.category === 'mountains' ? 'physical-menu' : 'world-menu', continent: state.category === 'world-rivers' ? null : state.continent, toast: null })}>Choose topic</button>
        </div>
      </div>
    )
  }

  function renderOverlay() {
    if (loading) return <PenniLoader label="Loading map data" full />
    if (!loaded) return <div className="atlas-loading">Map data could not be loaded.</div>
    if (state.screen === 'home') return renderHome()
    if (state.screen === 'world-menu') return renderWorldMenu()
    if (state.screen === 'physical-menu') return renderPhysicalMenu()
    if (state.screen === 'world-river-menu') return renderWorldRiverMenu()
    if (state.screen === 'india-menu') return renderIndiaMenu()
    if (state.screen === 'river-menu') return renderRiverMenu()
    if (state.screen === 'park-menu') return renderParkMenu()
    if (state.screen === 'park-learn') return renderParkLearn()
    if (state.screen === 'setup') return renderSetup()
    if (state.screen === 'play') return renderPlay()
    if (state.screen === 'results') return renderResults()
    return null
  }

  return (
    <div ref={rootRef} className="atlas-screen">
      <div className="atlas-topbar">
        <button onClick={goBack} aria-label="Back">
          <FontAwesomeIcon icon={state.screen === 'home' ? faXmark : faArrowLeft} />
        </button>
        <div>
          <span>{state.app === 'india' ? 'India Map Quiz' : state.app === 'world' ? 'World Map Quiz' : 'Maps Practice'}</span>
          <h2>{activeTopic}</h2>
        </div>
        {state.screen === 'play' ? (
          <div className="atlas-score">
            <b>{Math.min(state.qIndex + 1, state.queue.length)}</b><i>/ {state.queue.length}</i>
            <strong>{state.score}</strong>
          </div>
        ) : <span style={{ width: 42 }} />}
      </div>

      <div className={`atlas-stage ${useWorldGlobe ? 'atlas-stage-globe' : ''} ${state.screen === 'park-learn' ? 'atlas-stage-park-learn' : ''}`}>
        {loaded && useWorldGlobe ? (
          <Suspense fallback={<PenniLoader label="Spinning up globe" full />}>
            <AtlasGlobe
              view={currentView}
              mode={state.mode}
              phase={phase}
              countries={loaded.countries}
              physicalFeatures={WORLD_PHYSICAL_FEATURES}
              physicalKind={physicalKind}
              activeContinent={state.continent}
              targetId={mapTargetId}
              chosenId={state.chosenId}
              onAnswer={onAnswer}
            />
          </Suspense>
        ) : loaded && (
          <MapSVG
            ref={mapRef}
            view={currentView}
            mode={state.mode}
            phase={phase}
            countries={loaded.countries}
            indiaStates={loaded.indiaStates}
            rivers={mapRivers}
            parks={loaded.parks}
            activeContinent={state.continent}
            activeRiverSystem={state.riverSystem}
            activeParkRegion={state.parkRegion}
            activePracticeRegion={activePracticeRegion}
            activeParkState={activeLearnState}
            activeParkId={activeLearnPark?.id ?? null}
            learnRiverNames={activeLearnRiverNames}
            activePracticeState={activePracticeState}
            stateName={normalizeStateName}
            targetId={mapTargetId}
            chosenId={state.chosenId}
            history={state.answerHistory}
            onAnswer={onAnswer}
            onParkFocus={focusPark}
          />
        )}

        {!useWorldGlobe && (
          <div className="atlas-zoom">
            <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><FontAwesomeIcon icon={faPlus} /></button>
            <button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><FontAwesomeIcon icon={faMinus} /></button>
            <button onClick={() => mapRef.current?.resetZoom()} aria-label="Reset zoom"><FontAwesomeIcon icon={faCompass} /></button>
          </div>
        )}

        <div className="atlas-overlay">
          {renderOverlay()}
        </div>

        {state.toast && (
          <div className={`atlas-toast ${state.toast.kind}`}>
            {state.toast.text}
          </div>
        )}
      </div>
    </div>
  )
}

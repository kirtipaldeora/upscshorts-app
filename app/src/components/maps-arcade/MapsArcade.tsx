import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import * as topojson from 'topojson-client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowRotateRight,
  faBullseye,
  faChevronRight,
  faCompass,
  faEarthAsia,
  faLightbulb,
  faLocationDot,
  faMinus,
  faMountainSun,
  faPlus,
  faRotateLeft,
  faSeedling,
  faWater,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import { useAppStore } from '@/stores/useAppStore'
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

export interface WorldPhysicalFeature {
  id: string
  name: string
  kind: 'river' | 'mountain'
  continent: string
  region: string
  clue: string
  coordinates: [number, number][]
  labelPoint?: [number, number]
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
  { key: 'ganga_ref', name: 'Ganga River System', color: '#2d72c4', blurb: 'Ganga, Yamuna and key UPSC tributaries' },
]

const WORLD_PHYSICAL_FEATURES: WorldPhysicalFeature[] = [
  { id: 'wr-nile', name: 'Nile', kind: 'river', continent: 'Africa', region: 'North-East Africa', clue: 'Flows north through Sudan and Egypt to the Mediterranean Sea', coordinates: [[29.9, -3.4], [31.8, 0.4], [32.7, 4.7], [31.6, 8.4], [32.5, 12.1], [31.8, 16.1], [31.2, 20.2], [30.7, 24.3], [31.2, 27.2], [30.4, 31.2]], labelPoint: [31.7, 17.0] },
  { id: 'wr-congo', name: 'Congo', kind: 'river', continent: 'Africa', region: 'Central Africa', clue: 'Large equatorial basin river crossing the Congo rainforest', coordinates: [[28.8, -11.8], [26.2, -8.9], [23.6, -5.6], [21.3, -2.3], [18.6, 0.0], [16.5, -0.5], [15.3, -2.7], [14.2, -4.8], [12.4, -6.0]], labelPoint: [18.3, -2.2] },
  { id: 'wr-niger', name: 'Niger', kind: 'river', continent: 'Africa', region: 'West Africa', clue: 'Forms a great arc through Mali and Nigeria before reaching the Gulf of Guinea', coordinates: [[-10.7, 9.6], [-8.2, 11.1], [-5.7, 13.4], [-3.4, 16.4], [1.4, 16.8], [4.2, 14.1], [6.6, 12.2], [7.4, 9.6], [6.4, 5.4]], labelPoint: [1.6, 14.8] },
  { id: 'wr-zambezi', name: 'Zambezi', kind: 'river', continent: 'Africa', region: 'Southern Africa', clue: 'Flows east across southern Africa and includes Victoria Falls', coordinates: [[24.3, -11.4], [22.8, -13.2], [23.2, -15.4], [25.8, -17.8], [28.8, -17.9], [31.0, -16.5], [33.8, -17.2], [36.2, -18.6]], labelPoint: [29.0, -17.7] },
  { id: 'wr-amazon', name: 'Amazon', kind: 'river', continent: 'South America', region: 'South America', clue: 'Crosses the equatorial rainforest from the Andes to the Atlantic', coordinates: [[-75.2, -5.0], [-73.5, -4.6], [-70.2, -4.1], [-66.1, -3.8], [-62.2, -3.2], [-58.5, -2.9], [-54.6, -2.4], [-51.2, -1.6], [-49.5, -1.3]], labelPoint: [-61.2, -3.2] },
  { id: 'wr-parana', name: 'Parana', kind: 'river', continent: 'South America', region: 'Brazil-Paraguay-Argentina', clue: 'A major south-flowing river system of the La Plata basin', coordinates: [[-47.5, -20.1], [-50.8, -22.4], [-53.7, -24.0], [-54.8, -25.7], [-56.3, -27.3], [-58.6, -30.0], [-59.7, -32.7], [-58.4, -34.3]], labelPoint: [-55.7, -27.0] },
  { id: 'wr-orinoco', name: 'Orinoco', kind: 'river', continent: 'South America', region: 'Venezuela and Colombia', clue: 'Drains northern South America into the Atlantic', coordinates: [[-66.1, 2.4], [-67.8, 4.2], [-67.2, 6.2], [-65.4, 7.5], [-63.6, 8.1], [-61.4, 8.8], [-60.7, 9.6]], labelPoint: [-65.2, 7.2] },
  { id: 'wr-sao-francisco', name: 'Sao Francisco', kind: 'river', continent: 'South America', region: 'Eastern Brazil', clue: 'Important river of eastern Brazil flowing to the Atlantic', coordinates: [[-46.2, -20.3], [-44.2, -17.8], [-43.5, -14.7], [-42.1, -11.8], [-40.8, -9.8], [-37.7, -10.5]], labelPoint: [-42.7, -14.2] },
  { id: 'wr-yangtze', name: 'Yangtze', kind: 'river', continent: 'Asia', region: 'China', clue: 'China’s longest river, flowing east to the East China Sea', coordinates: [[91.2, 33.4], [95.2, 32.2], [99.8, 30.9], [103.2, 29.5], [106.6, 29.6], [110.4, 30.1], [114.3, 30.6], [118.8, 31.4], [121.5, 31.2]], labelPoint: [108.2, 30.1] },
  { id: 'wr-yellow', name: 'Yellow River', kind: 'river', continent: 'Asia', region: 'Northern China', clue: 'The Huang He makes a broad bend through the North China region', coordinates: [[96.2, 35.2], [100.4, 36.2], [104.2, 36.6], [106.5, 39.2], [110.2, 40.4], [112.8, 37.7], [116.0, 36.0], [119.2, 37.7]], labelPoint: [109.4, 39.3] },
  { id: 'wr-mekong', name: 'Mekong', kind: 'river', continent: 'Asia', region: 'South-East Asia', clue: 'Flows from the Tibetan Plateau through mainland South-East Asia', coordinates: [[94.9, 33.2], [97.4, 29.6], [99.4, 25.5], [100.4, 22.0], [101.6, 20.8], [103.0, 18.1], [104.2, 16.2], [105.5, 13.4], [106.8, 9.8]], labelPoint: [102.8, 18.2] },
  { id: 'wr-ganga-brahmaputra', name: 'Ganga-Brahmaputra', kind: 'river', continent: 'Asia', region: 'Indian subcontinent', clue: 'The Himalayan-fed river system draining into the Bay of Bengal', coordinates: [[78.7, 30.1], [79.8, 28.0], [81.8, 25.5], [85.1, 25.6], [88.1, 24.1], [91.2, 24.0], [92.7, 25.0], [91.0, 23.2], [90.4, 22.5]], labelPoint: [87.5, 24.8] },
  { id: 'wr-indus', name: 'Indus', kind: 'river', continent: 'Asia', region: 'Tibet-Pakistan-Arabian Sea', clue: 'Flows from the Tibetan region through Pakistan to the Arabian Sea', coordinates: [[81.7, 31.1], [78.2, 33.4], [75.3, 34.5], [72.4, 33.0], [71.4, 30.3], [69.6, 27.8], [68.2, 25.2], [67.4, 24.1]], labelPoint: [71.5, 30.2] },
  { id: 'wr-danube', name: 'Danube', kind: 'river', continent: 'Europe', region: 'Central and Eastern Europe', clue: 'Flows across Europe into the Black Sea', coordinates: [[8.2, 48.0], [10.2, 48.4], [12.5, 48.2], [14.6, 48.1], [16.4, 48.2], [19.0, 47.5], [21.2, 45.8], [24.8, 44.3], [27.8, 45.2], [29.6, 45.2]], labelPoint: [18.7, 47.0] },
  { id: 'wr-volga', name: 'Volga', kind: 'river', continent: 'Europe', region: 'Russia', clue: 'Europe’s longest river, draining into the Caspian Sea', coordinates: [[33.0, 57.2], [36.0, 56.8], [38.4, 57.6], [42.1, 56.5], [45.9, 55.8], [48.4, 53.2], [46.8, 50.2], [46.3, 48.7], [47.8, 46.3]], labelPoint: [45.4, 53.6] },
  { id: 'wr-rhine', name: 'Rhine', kind: 'river', continent: 'Europe', region: 'Western Europe', clue: 'Flows from the Alps toward the North Sea', coordinates: [[8.7, 46.6], [8.2, 47.6], [7.6, 48.6], [7.8, 49.8], [6.9, 50.8], [6.2, 51.7], [4.7, 52.1]], labelPoint: [7.2, 50.0] },
  { id: 'wr-dnieper', name: 'Dnieper', kind: 'river', continent: 'Europe', region: 'Eastern Europe', clue: 'Flows south through Belarus and Ukraine to the Black Sea', coordinates: [[33.4, 55.9], [31.6, 53.6], [30.5, 51.5], [30.5, 50.4], [31.1, 49.0], [32.4, 47.5], [32.3, 46.5]], labelPoint: [31.0, 50.0] },
  { id: 'wr-mississippi', name: 'Mississippi-Missouri', kind: 'river', continent: 'North America', region: 'Central United States', clue: 'A major drainage system of the central United States', coordinates: [[-111.2, 45.9], [-106.0, 44.8], [-101.4, 43.2], [-96.6, 41.3], [-92.4, 39.4], [-90.2, 35.0], [-91.1, 32.1], [-90.1, 29.1]], labelPoint: [-94.5, 38.2] },
  { id: 'wr-mackenzie', name: 'Mackenzie', kind: 'river', continent: 'North America', region: 'North-West Canada', clue: 'Flows north-west through Canada to the Arctic Ocean', coordinates: [[-117.2, 55.1], [-116.2, 58.4], [-118.6, 61.0], [-121.1, 63.7], [-123.2, 66.1], [-134.8, 68.8]], labelPoint: [-121.2, 63.4] },
  { id: 'wr-st-lawrence', name: 'St. Lawrence', kind: 'river', continent: 'North America', region: 'Great Lakes to Atlantic', clue: 'Connects the Great Lakes system with the Atlantic', coordinates: [[-83.0, 42.3], [-79.2, 43.2], [-76.5, 44.2], [-73.6, 45.5], [-70.2, 47.1], [-64.5, 49.0]], labelPoint: [-73.5, 45.8] },
  { id: 'wr-colorado', name: 'Colorado', kind: 'river', continent: 'North America', region: 'Western United States', clue: 'Carves the Grand Canyon and drains toward the Gulf of California', coordinates: [[-105.8, 40.4], [-108.8, 39.1], [-111.5, 37.2], [-112.1, 36.1], [-114.5, 34.3], [-114.8, 32.2]], labelPoint: [-111.7, 36.5] },
  { id: 'wr-yukon', name: 'Yukon', kind: 'river', continent: 'North America', region: 'Alaska and Canada', clue: 'Flows across Yukon and Alaska to the Bering Sea', coordinates: [[-134.6, 60.7], [-137.4, 62.2], [-141.0, 64.1], [-146.3, 65.0], [-151.2, 64.7], [-164.5, 62.6]], labelPoint: [-146.0, 64.3] },
  { id: 'wr-murray-darling', name: 'Murray-Darling', kind: 'river', continent: 'Oceania', region: 'South-East Australia', clue: 'Australia’s major river basin across the south-east', coordinates: [[148.2, -26.2], [147.6, -29.0], [146.0, -31.5], [144.6, -34.2], [142.5, -34.9], [139.0, -35.5]], labelPoint: [145.2, -33.2] },
  { id: 'wr-sepik', name: 'Sepik', kind: 'river', continent: 'Oceania', region: 'Papua New Guinea', clue: 'One of Papua New Guinea’s major rivers flowing to the Bismarck Sea', coordinates: [[141.0, -4.4], [142.6, -4.0], [144.2, -4.1], [145.6, -4.2], [146.6, -3.9]], labelPoint: [144.2, -4.0] },
  { id: 'mt-himalayas', name: 'Himalayas', kind: 'mountain', continent: 'Asia', region: 'Asia', clue: 'The young fold mountain arc north of the Indian subcontinent', coordinates: [[72.8, 35.5], [77.1, 34.1], [81.2, 30.7], [85.3, 28.2], [89.4, 27.8], [95.0, 28.7]], labelPoint: [84.8, 29.6] },
  { id: 'mt-andes', name: 'Andes', kind: 'mountain', continent: 'South America', region: 'South America', clue: 'The long western mountain chain of South America', coordinates: [[-77.8, 8.4], [-76.2, -5.2], [-72.4, -15.8], [-70.2, -25.1], [-70.8, -34.4], [-72.4, -45.1]], labelPoint: [-72.2, -22.0] },
  { id: 'mt-rockies', name: 'Rocky Mountains', kind: 'mountain', continent: 'North America', region: 'North America', clue: 'Major western mountain system of North America', coordinates: [[-121.0, 55.5], [-116.8, 50.7], [-113.4, 45.2], [-109.8, 40.4], [-106.0, 36.4], [-105.0, 32.4]], labelPoint: [-112.0, 43.0] },
  { id: 'mt-alps', name: 'Alps', kind: 'mountain', continent: 'Europe', region: 'Europe', clue: 'Arc-shaped European range across France, Switzerland, Italy and Austria', coordinates: [[5.9, 45.6], [7.5, 46.0], [9.4, 46.4], [11.2, 46.6], [13.4, 47.0]], labelPoint: [9.4, 46.5] },
  { id: 'mt-atlas', name: 'Atlas Mountains', kind: 'mountain', continent: 'Africa', region: 'North Africa', clue: 'Mountain system across Morocco, Algeria and Tunisia', coordinates: [[-9.6, 31.0], [-6.2, 32.0], [-2.4, 34.2], [2.6, 35.3], [8.4, 35.4]], labelPoint: [-2.4, 34.1] },
  { id: 'mt-urals', name: 'Ural Mountains', kind: 'mountain', continent: 'Europe', region: 'Russia', clue: 'North-south range often used as a Europe-Asia boundary', coordinates: [[59.4, 67.8], [58.8, 62.4], [59.8, 57.5], [59.2, 53.2], [58.0, 50.0]], labelPoint: [59.2, 57.0] },
  { id: 'mt-great-dividing', name: 'Great Dividing Range', kind: 'mountain', continent: 'Oceania', region: 'Australia', clue: 'Eastern Australian highland chain', coordinates: [[145.6, -16.7], [150.0, -24.0], [151.5, -31.5], [148.2, -37.2]], labelPoint: [150.4, -28.0] },
]

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

function riverItems(rivers: AtlasRiver[], system: string | null): QuizItem[] {
  return rivers.filter(r => !system || r.system === system).map(r => ({
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
  const [world, states, parksRaw, riverRaw] = await Promise.all([
    fetch(asset('data/countries-110m.json')).then(r => r.json()) as Promise<Topology>,
    fetch(asset('data/india-states.json')).then(r => r.json()) as Promise<FeatureCollection>,
    fetch(asset('data/india-national-parks.json')).then(r => r.json()) as Promise<{ regions: ParkRegion[]; parks: AtlasPark[] }>,
    fetch(asset('data/india-rivers-osm.geojson')).then(r => r.json()).catch(() => null) as Promise<FeatureCollection | null>,
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
    rivers: loadRiverGeometry(riverRaw),
  }
}

const rivers: AtlasRiver[] = RIVER_TRACES.map(r => ({
  ...r,
  geometry: { type: 'LineString', coordinates: r.coordinates } as Geometry,
}))

function loadRiverGeometry(data: FeatureCollection | null): AtlasRiver[] {
  if (!data?.features?.length) return rivers
  const fallbackByName = new Map(rivers.map(r => [r.name, r]))
  const traced = data.features
    .filter(feature => String((feature.properties as { sys?: string } | undefined)?.sys ?? '') === 'ganga_ref')
    .map(feature => {
      const props = feature.properties as { name?: string; sys?: string } | undefined
      const name = props?.name
      if (!name || !feature.geometry) return null
      const fallback = fallbackByName.get(name)
      return {
        id: fallback?.id ?? Math.abs(name.split('').reduce((n, ch) => ((n * 31 + ch.charCodeAt(0)) >>> 0), 0)),
        name,
        system: props?.sys ?? 'ganga_ref',
        region: fallback?.region ?? 'Ganga river system',
        major: fallback?.major ?? ['Ganga', 'Yamuna', 'Brahmaputra'].includes(name),
        source: fallback?.source,
        geometry: feature.geometry,
        labelPoint: fallback?.labelPoint,
        labelAngle: fallback?.labelAngle,
      } satisfies AtlasRiver
    })
    .filter(Boolean) as AtlasRiver[]
  return traced.length ? traced : rivers
}

export function MapsArcade() {
  const setOverlay = useAppStore(s => s.setOverlay)
  const overlayScreen = useAppStore(s => s.overlayScreen)
  const setScreen = useAppStore(s => s.setScreen)
  const [loaded, setLoaded] = useState<LoadedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<AtlasState>(INITIAL)
  const mapRef = useRef<MapSVGHandle>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | null>(null)
  const advanceTimer = useRef<number | null>(null)

  useEffect(() => {
    let live = true
    loadData()
      .then(data => { if (live) setLoaded(data) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

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
        panel.querySelectorAll('.atlas-india-card, .atlas-park-card, .atlas-park-overview, .atlas-chip-scroll button'),
        { opacity: 0, y: 14, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.36, stagger: 0.035, delay: 0.05, ease: EASE.out, clearProps: 'transform,opacity' },
      )
    }, panel)
    return () => { ctx.revert() }
  }, [state.screen, state.qIndex, state.chosenId])

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
      }, prev.app === 'world' ? 1450 : prev.category === 'rivers' || prev.category === 'parks' ? 1500 : 1000)
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
                  patch({ app: 'india', category: 'parks', screen: 'park-learn', parkRegion: reg.key, parkLearnState: firstState })
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
    const regionName = loaded?.parkRegions.find(r => r.key === state.parkRegion)?.name
    return (
      <div ref={panelRef} className="atlas-learn-strip">
        <div className="atlas-learn-summary">
          <span>{regionName ? cleanRegionName(regionName) : 'Learn mode'}</span>
          <b>{selected ?? 'Select state'}</b>
          <em>{visible.length} parks visible</em>
        </div>
        <div className="atlas-chip-scroll">
          {states.map(st => (
            <button key={st} className={st === selected ? 'on' : ''} onClick={() => patch({ parkLearnState: st })}>{st}</button>
          ))}
        </div>
        <button className="atlas-primary-mini" onClick={() => {
          const pool = parkItems(loaded?.parks ?? [], state.parkRegion).filter(p => !selected || p.state === selected)
          startQuiz(pool)
        }}>Practice visible</button>
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
          <button onClick={previous} disabled={state.qIndex === 0}><FontAwesomeIcon icon={faRotateLeft} /> Previous</button>
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
    if (loading) return <div className="atlas-loading">Loading map data...</div>
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

      <div className={`atlas-stage ${useWorldGlobe ? 'atlas-stage-globe' : ''}`}>
        {loaded && useWorldGlobe ? (
          <Suspense fallback={<div className="atlas-globe-loading">Spinning up globe...</div>}>
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
            rivers={loaded.rivers}
            parks={loaded.parks}
            activeContinent={state.continent}
            activeRiverSystem={state.riverSystem}
            activeParkRegion={state.parkRegion}
            activePracticeRegion={activePracticeRegion}
            activeParkState={activeLearnState}
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

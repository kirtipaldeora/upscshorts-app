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

type Screen = 'home' | 'world-menu' | 'india-menu' | 'river-menu' | 'park-menu' | 'park-learn' | 'setup' | 'play' | 'results'
type AppKind = 'world' | 'india' | null
type Category = 'countries' | 'rivers' | 'parks' | null

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
  { key: 'ganga_ref', name: 'Ganga River System', color: '#2d72c4', blurb: 'Ganga, Yamuna and key UPSC tributaries' },
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
      ? 'continent'
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
      if (state.app === 'world') patch({ screen: 'world-menu', continent: null, toast: null })
      else if (state.category === 'rivers') patch({ screen: 'river-menu', toast: null })
      else patch({ screen: 'park-menu', toast: null })
      return
    }
    if (state.screen === 'river-menu' || state.screen === 'park-menu' || state.screen === 'park-learn') {
      patch({ screen: 'india-menu', category: null, riverSystem: null, parkRegion: null, toast: null })
      return
    }
    if (state.screen === 'world-menu' || state.screen === 'india-menu') {
      setState(INITIAL)
    }
  }

  function openSetup(next: Partial<AtlasState>) {
    const poolCount = next.category === 'rivers'
      ? riverItems(loaded?.rivers ?? rivers, next.riverSystem ?? null).length
      : next.category === 'parks'
        ? parkItems(loaded?.parks ?? [], next.parkRegion ?? null).length
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
          <button onClick={() => patch({ screen: state.category === 'rivers' ? 'river-menu' : state.category === 'parks' ? 'park-menu' : 'world-menu', toast: null })}>Choose topic</button>
        </div>
      </div>
    )
  }

  function renderOverlay() {
    if (loading) return <div className="atlas-loading">Loading map data...</div>
    if (!loaded) return <div className="atlas-loading">Map data could not be loaded.</div>
    if (state.screen === 'home') return renderHome()
    if (state.screen === 'world-menu') return renderWorldMenu()
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

/** Colors of the 3D scene. Canvas textures and materials read these directly. */
export interface SceneColors {
  background: string;
  /** Fill of the round plate behind each hexagram drawing. */
  plate: string;
  yangLine: string;
  yinLine: string;
  /** The plate ring blends from `ringYin` (no yang lines) to `ringYang` (six yang lines). */
  ringYin: string;
  ringYang: string;
  label: string;
  labelOutline: string;
  edge: string;
  edgeOpacity: number;
  /** Opacity of the ordinary edges while a hexagram is selected. */
  edgeOpacityWithSelection: number;
  guide: string;
  guideOpacity: number;
  /** The six highlighted edges of the selected hexagram. */
  changeEdge: string;
  halo: string;
  haloOpacity: number;
  relations: RelationColors;
}

export interface RelationColors {
  opposite: string;
  reversed: string;
  nuclear: string;
}

export interface Theme {
  key: string;
  name: string;
  description: string;
  scheme: 'dark' | 'light';
  /** CSS custom properties, without the leading "--". */
  css: Record<string, string>;
  scene: SceneColors;
}

const INK_GOLD: Theme = {
  key: 'ink-gold',
  name: '墨金',
  description: '近黑的墨色底，只用一种旧金色作强调，阴阳靠明暗区分。',
  scheme: 'dark',
  css: {
    bg: '#0d0d0f',
    surface: '#141416',
    'surface-raised': '#1d1d20',
    overlay: 'rgba(20, 20, 22, 0.94)',
    card: 'rgba(233, 228, 216, 0.035)',
    border: 'rgba(233, 228, 216, 0.1)',
    'border-strong': 'rgba(233, 228, 216, 0.22)',
    text: '#e9e4d8',
    'text-muted': '#a39e92',
    'text-faint': '#6f6b62',
    accent: '#c9a96a',
    'accent-soft': 'rgba(201, 169, 106, 0.12)',
    yang: '#d8bc80',
    yin: '#8a8579',
    link: '#c9b68c',
    vignette: 'rgba(0, 0, 0, 0.5)',
    shadow: 'rgba(0, 0, 0, 0.6)',
  },
  scene: {
    background: '#0d0d0f',
    plate: 'rgba(21, 21, 24, 0.97)',
    yangLine: '#d8bc80',
    yinLine: '#8a8579',
    ringYin: '#55524b',
    ringYang: '#c9a96a',
    label: '#e9e4d8',
    labelOutline: 'rgba(13, 13, 15, 0.92)',
    edge: '#b8b0a0',
    edgeOpacity: 0.42,
    edgeOpacityWithSelection: 0.13,
    guide: '#8a8579',
    guideOpacity: 0.16,
    changeEdge: '#d8bc80',
    halo: '#c9a96a',
    haloOpacity: 0.42,
    relations: { opposite: '#c97a66', reversed: '#7fae9f', nuclear: '#9d97c0' },
  },
};

const RICE_PAPER: Theme = {
  key: 'rice-paper',
  name: '宣纸',
  description: '浅色：宣纸底、浓淡两种墨色，选中时用朱砂红，像线装书。',
  scheme: 'light',
  css: {
    bg: '#f3eee3',
    surface: '#faf6ec',
    'surface-raised': '#efe8d9',
    overlay: 'rgba(250, 246, 236, 0.95)',
    card: 'rgba(60, 50, 30, 0.04)',
    border: 'rgba(40, 34, 26, 0.13)',
    'border-strong': 'rgba(40, 34, 26, 0.28)',
    text: '#26221c',
    'text-muted': '#6b6357',
    'text-faint': '#998f80',
    accent: '#a8392b',
    'accent-soft': 'rgba(168, 57, 43, 0.09)',
    yang: '#26221c',
    yin: '#978c7b',
    link: '#8a3226',
    vignette: 'rgba(120, 100, 70, 0.14)',
    shadow: 'rgba(60, 45, 20, 0.22)',
  },
  scene: {
    background: '#f3eee3',
    plate: 'rgba(250, 246, 236, 0.98)',
    yangLine: '#26221c',
    yinLine: '#978c7b',
    ringYin: '#bfb5a2',
    ringYang: '#26221c',
    label: '#26221c',
    labelOutline: 'rgba(243, 238, 227, 0.94)',
    edge: '#4f473c',
    edgeOpacity: 0.3,
    edgeOpacityWithSelection: 0.12,
    guide: '#978c7b',
    guideOpacity: 0.26,
    changeEdge: '#a8392b',
    halo: '#a8392b',
    haloOpacity: 0.22,
    relations: { opposite: '#2f6f8f', reversed: '#4e7d5b', nuclear: '#7d5a94' },
  },
};

export const THEMES: Theme[] = [INK_GOLD, RICE_PAPER];
export const DEFAULT_THEME = INK_GOLD;

const STORAGE_KEY = 'hexagram-sphere-theme';

/** Returns the theme the viewer chose last time, or the default one. */
export function loadSavedTheme(): Theme {
  try {
    const savedKey = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.find((theme) => theme.key === savedKey) ?? DEFAULT_THEME;
  } catch {
    // Storage can be unavailable, for example in a private window.
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme.key);
  } catch {
    // The choice then lasts only until the page is closed.
  }
}

/** Writes the page colors of a theme to the document as CSS custom properties. */
export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.css)) {
    root.style.setProperty(`--${name}`, value);
  }
  root.style.setProperty('--relation-opposite', theme.scene.relations.opposite);
  root.style.setProperty('--relation-reversed', theme.scene.relations.reversed);
  root.style.setProperty('--relation-nuclear', theme.scene.relations.nuclear);
  root.style.colorScheme = theme.scheme;
}

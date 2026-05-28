// Chrp Design System — React Native theme tokens
// Mirrors the Chameleon Design System (CDS) brand-tapin.css token values.
// Dark-mode navy palette, 5 team colour ramps, typography scale.

// ─── Typography ───────────────────────────────────────────────────────────────

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  displayRegular: 'SpaceGrotesk_400Regular',
  ui: 'Geist_400Regular',
  uiMedium: 'Geist_500Medium',
  uiSemiBold: 'Geist_600SemiBold',
  uiBold: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
  monoBold: 'GeistMono_600SemiBold',
} as const;

// Fallback font families for system font usage
export const fontFamilies = {
  display: 'SpaceGrotesk_700Bold',
  ui: 'Geist_400Regular',
  mono: 'GeistMono_400Regular',
} as const;

// ─── Navy ramp — "rink" ───────────────────────────────────────────────────────

export const navy = {
  0: '#FFFFFF',
  50: '#F4F6FB',
  100: '#E5EAF2',
  200: '#C5CDE0',
  300: '#97A2BC',
  400: '#5F6B85',
  500: '#364056',
  600: '#1F2A40',
  700: '#131B2E',
  800: '#0B1220',
  900: '#050810',
  1000: '#000000',
} as const;

// ─── Ice ramp — "frost" ───────────────────────────────────────────────────────

export const ice = {
  50: '#EEF3FB',
  100: '#DBE5F4',
  200: '#B6CBE9',
  300: '#8AAAD8',
  400: '#5E89C6',
  500: '#3F6BAA',
  600: '#2F5285',
  700: '#213A60',
  800: '#14233D',
  900: '#0A1326',
} as const;

// ─── Team colour ramps ────────────────────────────────────────────────────────

export type TeamKey = 'trashdogs' | 'ember' | 'verdant' | 'solstice' | 'aurora';

export interface TeamColors {
  50: string;
  100: string;
  300: string;
  500: string;
  700: string;
  900: string;
  on: string; // text colour on top of team-500
}

export const teams: Record<TeamKey, TeamColors> = {
  trashdogs: {
    50: '#E8ECFF',
    100: '#C6CEFF',
    300: '#6979F0',
    500: '#2540D6',
    700: '#1A2EA0',
    900: '#0E195E',
    on: '#FFFFFF',
  },
  ember: {
    50: '#FFE9EC',
    100: '#FFC1C9',
    300: '#F36B7C',
    500: '#D6253F',
    700: '#9B1024',
    900: '#4D0712',
    on: '#FFFFFF',
  },
  verdant: {
    50: '#E3F9EE',
    100: '#B7EFD4',
    300: '#4ED599',
    500: '#0E9A5E',
    700: '#07673F',
    900: '#032D1B',
    on: '#FFFFFF',
  },
  solstice: {
    50: '#FFF4DE',
    100: '#FFE0A8',
    300: '#FFC04A',
    500: '#F59E0B',
    700: '#B26706',
    900: '#4D2D02',
    on: '#0B1220', // dark text on bright gold
  },
  aurora: {
    50: '#F3E8FF',
    100: '#DDC0FF',
    300: '#B07AFF',
    500: '#7C3FE5',
    700: '#5024A6',
    900: '#270F58',
    on: '#FFFFFF',
  },
};

// ─── Status colours ───────────────────────────────────────────────────────────

export const status = {
  success: {
    light: '#86EFAC',
    pure: '#22C55E',
    dark: '#15803D',
    subtle: 'rgba(34,197,94,0.16)',
  },
  alert: {
    light: '#FCD34D',
    pure: '#F59E0B',
    dark: '#B45309',
    subtle: 'rgba(245,158,11,0.16)',
  },
  error: {
    light: '#FCA5A5',
    pure: '#EF4444',
    dark: '#B91C1C',
    subtle: 'rgba(239,68,68,0.18)',
  },
  info: {
    light: '#93C5FD',
    pure: '#3B82F6',
    dark: '#1D4ED8',
    subtle: 'rgba(59,130,246,0.16)',
  },
} as const;

// ─── Dark-mode semantic tokens (the app always runs in dark mode) ─────────────

export const dark = {
  // App surfaces
  appBg: navy[800],
  appNeutral: navy[700],
  modal: navy[700],
  tabBar: navy[700],
  neutral: navy[600],
  neutralSubtle: navy[700],
  neutralBold: navy[500],
  disabled: navy[700],
  overlay: 'rgba(0,0,0,0.60)',

  // Text
  text: navy[100],
  textBold: navy[50],
  textBolder: '#FFFFFF',
  textSubtle: navy[300],
  textDisabled: navy[400],

  // Borders
  border: navy[500],
  borderSubtle: navy[600],
  borderBold: navy[300],

  // Elevation
  elevation1: '0 4px 12px 0 rgba(0,0,0,0.45)',
  elevation2: '0 8px 24px 0 rgba(0,0,0,0.55)',
} as const;

// ─── Typography scale ─────────────────────────────────────────────────────────

export const type = {
  // Display — Space Grotesk
  displayXL: { fontSize: 48, lineHeight: 52, letterSpacing: -1.5, fontFamily: fonts.display },
  displayL:  { fontSize: 40, lineHeight: 44, letterSpacing: -1.2, fontFamily: fonts.display },
  displayM:  { fontSize: 34, lineHeight: 38, letterSpacing: -0.8, fontFamily: fonts.displaySemi },
  displayS:  { fontSize: 28, lineHeight: 32, letterSpacing: -0.5, fontFamily: fonts.displaySemi },

  // Heading — Space Grotesk
  headingXXL: { fontSize: 26, lineHeight: 30, letterSpacing: -0.4, fontFamily: fonts.display },
  headingXL:  { fontSize: 22, lineHeight: 26, letterSpacing: -0.3, fontFamily: fonts.display },
  headingL:   { fontSize: 18, lineHeight: 22, letterSpacing: -0.2, fontFamily: fonts.display },
  headingM:   { fontSize: 16, lineHeight: 20, letterSpacing: -0.1, fontFamily: fonts.displayMedium },

  // Body — Geist
  bodyL:  { fontSize: 16, lineHeight: 24, fontFamily: fonts.ui },
  bodyM:  { fontSize: 14, lineHeight: 20, fontFamily: fonts.ui },
  bodyS:  { fontSize: 13, lineHeight: 18, fontFamily: fonts.ui },
  bodyXS: { fontSize: 11, lineHeight: 16, fontFamily: fonts.ui },

  // Mono — Geist Mono
  monoL:  { fontSize: 16, lineHeight: 22, fontFamily: fonts.mono },
  monoM:  { fontSize: 14, lineHeight: 20, fontFamily: fonts.mono },
  monoS:  { fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontFamily: fonts.mono },
  monoXS: { fontSize: 10, lineHeight: 14, letterSpacing: 1.4, fontFamily: fonts.mono },

  // Label — Geist
  labelL: { fontSize: 15, lineHeight: 20, fontFamily: fonts.uiSemiBold },
  labelM: { fontSize: 13, lineHeight: 18, fontFamily: fonts.uiMedium },
  labelS: { fontSize: 11, lineHeight: 14, fontFamily: fonts.uiMedium },
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
  48: 48,
  56: 56,
  64: 64,
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const radius = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

// ─── Helper: get team colours for the active team ─────────────────────────────

export function teamColors(key: TeamKey = 'trashdogs'): TeamColors {
  return teams[key];
}

// Default export — everything bundled
const theme = { fonts, navy, ice, teams, status, dark, type, spacing, radius, teamColors };
export default theme;

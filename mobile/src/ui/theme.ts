/**
 * SecureVoult on the phone: the web app's palette (gold on near-black in dark
 * mode, deeper gold on warm paper in light mode), so the apps feel like one product.
 */
import { useColorScheme } from 'react-native';

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceHi: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  gold: string;
  goldInk: string;
  goldSoft: string;
  danger: string;
  dangerSoft: string;
  ok: string;
  warn: string;
  /** Item type accents, as on the web vault tabs. */
  type: Record<'login' | 'note' | 'card' | 'identity' | 'document' | 'bank' | 'wifi', string>;
}

const dark: Theme = {
  dark: true,
  bg: '#111212',
  surface: '#191A1A',
  surfaceHi: '#222423',
  border: '#2B2D2C',
  text: '#F3EFE7',
  textDim: '#A39D93',
  textFaint: '#6E6A64',
  gold: '#CDA24C',
  goldInk: '#151514',
  goldSoft: 'rgba(205,162,76,0.14)',
  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.14)',
  ok: '#3DD68C',
  warn: '#F0B44C',
  type: { login: '#CDA24C', note: '#F2C94C', card: '#7CC4F8', identity: '#B9A3F5', document: '#5FD4A5', bank: '#F5A35C', wifi: '#5ED0E0' },
};

const light: Theme = {
  dark: false,
  bg: '#F8F6F2',
  surface: '#FFFFFF',
  surfaceHi: '#F1EEE8',
  border: '#E3DED5',
  text: '#1B1C1C',
  textDim: '#6B655D',
  textFaint: '#9C968D',
  gold: '#A2782F',
  goldInk: '#FCFAF6',
  goldSoft: 'rgba(162,120,47,0.12)',
  danger: '#D1292F',
  dangerSoft: 'rgba(209,41,47,0.10)',
  ok: '#16884F',
  warn: '#B7791F',
  type: { login: '#A2782F', note: '#B98A0E', card: '#2A7FC1', identity: '#7059C9', document: '#178A61', bank: '#C26A1C', wifi: '#13889A' },
};

export function useTheme(): Theme {
  return useColorScheme() === 'light' ? light : dark;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = {
  title: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16 },
  small: { fontSize: 14 },
  tiny: { fontSize: 12 },
  mono: { fontFamily: 'monospace', fontSize: 17, letterSpacing: 0.5 },
};

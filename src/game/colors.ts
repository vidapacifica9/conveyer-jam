import { ParcelColor, SymbolShape } from '../types/game';

export interface ColorTheme {
  name: string;
  fill: string;
  light: string;
  dark: string;
  border: string;
  glow: string;
  text: string;
  shape: SymbolShape;
}

export const PARCEL_COLORS: Record<ParcelColor, ColorTheme> = {
  red: {
    name: 'Red',
    fill: '#EF4444',
    light: '#FCA5A5',
    dark: '#B91C1C',
    border: '#991B1B',
    glow: 'rgba(239, 68, 68, 0.55)',
    text: '#FFFFFF',
    shape: 'star',
  },
  blue: {
    name: 'Blue',
    fill: '#3B82F6',
    light: '#93C5FD',
    dark: '#1D4ED8',
    border: '#1E40AF',
    glow: 'rgba(59, 130, 246, 0.55)',
    text: '#FFFFFF',
    shape: 'circle',
  },
  yellow: {
    name: 'Yellow',
    fill: '#FACC15',
    light: '#FEF08A',
    dark: '#CA8A04',
    border: '#A16207',
    glow: 'rgba(250, 204, 21, 0.55)',
    text: '#1E293B',
    shape: 'triangle',
  },
  green: {
    name: 'Green',
    fill: '#22C55E',
    light: '#86EFAC',
    dark: '#15803D',
    border: '#166534',
    glow: 'rgba(34, 197, 94, 0.55)',
    text: '#FFFFFF',
    shape: 'diamond',
  },
  purple: {
    name: 'Purple',
    fill: '#A855F7',
    light: '#D8B4FE',
    dark: '#7E22CE',
    border: '#6B21A8',
    glow: 'rgba(168, 85, 247, 0.55)',
    text: '#FFFFFF',
    shape: 'hexagon',
  },
};

export const ALL_COLORS: ParcelColor[] = ['red', 'blue', 'yellow', 'green', 'purple'];

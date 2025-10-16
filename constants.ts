import { ElementType } from './types';

export const ELEMENTS = ["Feuer", "Wasser", "Erde", "Luft", "Blitz", "Eis", "Magie"] as const;

export const ABILITIES = [
    "Funke",      // Stärke 0
    "Strahl",     // Stärke 1
    "Flamme",     // Stärke 2
    "Glut",       // Stärke 3
    "Feuerball",  // Stärke 4
    "Inferno",    // Stärke 5
    "Nova",       // Stärke 6
    "Supernova",  // Stärke 7
    "Apokalypse", // Stärke 8
    "Weltenbrand",// Stärke 9
    "Akolyth",    // Stärke 10 (Bube)
    "Priesterin", // Stärke 11 (Dame)
    "Elementar",  // Stärke 12 (Koenig)
    "Avatar"      // Stärke 13 (Ass)
] as const;


export const ELEMENT_HIERARCHIE: Record<ElementType, Partial<Record<ElementType, number>>> = {
    "Wasser": {"Feuer": 3, "Erde": 1, "Luft": -3, "Blitz": -3, "Eis": 3},
    "Feuer": {"Erde": 3, "Luft": 1, "Wasser": -3, "Eis": 1, "Blitz": 1},
    "Erde": {"Luft": 3, "Wasser": -1, "Feuer": -3, "Blitz": 3, "Eis": 1},
    "Luft": {"Wasser": 3, "Erde": -1, "Feuer": -3, "Eis": 3, "Blitz": -1},
    "Blitz": {"Wasser": 3, "Erde": 1, "Feuer": 1, "Luft": -3, "Eis": -1},
    "Eis": {"Feuer": 3, "Erde": 1, "Wasser": -3, "Luft": 1, "Blitz": 3},
    "Magie": {"Feuer": 1, "Wasser": 1, "Erde": 1, "Luft": 1, "Blitz": 2, "Eis": 2},
};

export const ELEMENT_EFFECTS: Record<ElementType, string> = {
    "Feuer": "Effekt bei Sieg: -1 Gegnertoken.",
    "Wasser": "Effekt bei Sieg: +1 Eigene Tokens, -1 Gegnertoken.",
    "Erde": "Effekt bei Sieg: +1 Eigene Tokens.",
    "Luft": "Effekt bei Sieg: +2 Eigene Tokens.",
    "Blitz": "Effekt bei Sieg: +1 Zusätzlicher Token.",
    "Eis": "Effekt bei Sieg: -1 Gegnertoken.",
    "Magie": "Kein direkter Kampfeffekt. Beeinflusst das Spiel auf andere Weise.",
};

// FIX: Removed explicit type annotation on HEROES that caused a circular dependency.
// By using 'as const', TypeScript can infer the precise type, which is then used 
// in types.ts to create the HeroName type without a circular reference.
export const HEROES = {
    "Drache": {"Element": "Feuer", "Bonus": 2},
    "Zauberer": {"Element": "Magie", "Bonus": 3},
} as const;

// FIX: Removed explicit type annotation on WEATHER_EFFECTS that caused a circular dependency.
// 'as const' allows for type inference, breaking the circular reference with WeatherType.
export const WEATHER_EFFECTS = {
    "Regen": {"Wasser": 1, "Feuer": -1},
    "Windsturm": {"Luft": 2, "Erde": -1},
    "Erdbeben": {}
} as const;

export const START_TOKENS = 5;
export const HAND_SIZE = 4;

export const ELEMENT_COLORS: Record<ElementType, { from: string, to: string, icon: string }> = {
    "Feuer": { from: 'from-red-500', to: 'to-orange-400', icon: '🔥' },
    "Wasser": { from: 'from-blue-500', to: 'to-cyan-400', icon: '💧' },
    "Erde": { from: 'from-green-500', to: 'to-lime-400', icon: '🌱' },
    "Luft": { from: 'from-yellow-200', to: 'to-gray-100', icon: '🌬️' },
    "Blitz": { from: 'from-yellow-400', to: 'to-yellow-300', icon: '⚡' },
    "Eis": { from: 'from-cyan-200', to: 'to-blue-300', icon: '🧊' },
    "Magie": { from: 'from-purple-500', to: 'to-indigo-400', icon: '✨' },
};
import { ElementType } from './types';

export const ELEMENTS = [
    "Feuer",
    "Wasser",
    "Erde",
    "Luft",
    "Blitz",
    "Eis",
    "Magie",
    "Schatten",
    "Licht",
    "Chaos"
] as const;

export const CARD_TYPES = [
    {
        name: "Artefakt" as const,
        description: "Dauerhafte Objekte, die das Spielfeld verstärken und langfristige Buffs erzeugen.",
        defaultCharges: undefined,
    },
    {
        name: "Beschwörung" as const,
        description: "Temporäre Einheiten mit begrenzter Lebensdauer, die Schaden absorbieren oder verursachen.",
        defaultLifespan: 3,
    },
    {
        name: "Runenstein" as const,
        description: "Einmalige Power-Karten, die Wetter oder globale Effekte auslösen.",
        defaultCharges: 1,
    },
    {
        name: "Verbündeter" as const,
        description: "Unterstützer, die Synergien verstärken und Elementarresonanz fördern.",
        defaultCharges: undefined,
    },
    {
        name: "Segen/Fluch" as const,
        description: "Temporäre Modifikatoren, die Spieler oder Arena beeinflussen.",
        defaultLifespan: 2,
    },
] as const;

export const ABILITY_MECHANIC_DEFINITIONS = {
    "Ketteneffekte": {
        summary: "Folgeaktionen nach Aktivierung bestimmter Karten.",
        weight: 1.5,
    },
    "Elementarresonanz": {
        summary: "Bonusschaden, wenn mehrere Karten desselben Elements aktiv sind.",
        weight: 2,
    },
    "Überladung": {
        summary: "Hohe Spitzenwerte mit anschließendem Eigenrisiko.",
        weight: 2.5,
    },
    "Fusion": {
        summary: "Kombiniere Karten zu mächtigen neuen Formen.",
        weight: 3,
    },
    "Wetterbindung": {
        summary: "Stärke schwankt je nach aktuellem Wetter.",
        weight: 1.8,
    },
    "Verbündeter": {
        summary: "Verstärkt verbundene Karten desselben Themas oder Elements.",
        weight: 1.3,
    },
    "Segen/Fluch": {
        summary: "Verleiht kurzfristige Vorteile oder Nachteile auf Spieler- bzw. Arenaseite.",
        weight: 1.1,
    },
} as const;

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

export const ABILITY_MECHANICS: Record<typeof ABILITIES[number], (keyof typeof ABILITY_MECHANIC_DEFINITIONS)[]> = {
    "Funke": ["Ketteneffekte"],
    "Strahl": ["Wetterbindung"],
    "Flamme": ["Elementarresonanz"],
    "Glut": ["Ketteneffekte"],
    "Feuerball": ["Überladung"],
    "Inferno": ["Elementarresonanz", "Überladung"],
    "Nova": ["Fusion"],
    "Supernova": ["Fusion", "Überladung"],
    "Apokalypse": ["Fusion", "Elementarresonanz"],
    "Weltenbrand": ["Fusion", "Überladung", "Ketteneffekte"],
    "Akolyth": ["Verbündeter"],
    "Priesterin": ["Segen/Fluch"],
    "Elementar": ["Elementarresonanz", "Wetterbindung"],
    "Avatar": ["Fusion", "Elementarresonanz", "Wetterbindung"],
} as const;


export const ELEMENT_HIERARCHIE: Record<ElementType, Partial<Record<ElementType, number>>> = {
    "Wasser": {"Feuer": 3, "Erde": 1, "Luft": -3, "Blitz": -3, "Eis": 3, "Chaos": -2},
    "Feuer": {"Erde": 3, "Luft": 1, "Wasser": -3, "Eis": 1, "Blitz": 1, "Schatten": 2},
    "Erde": {"Luft": 3, "Wasser": -1, "Feuer": -3, "Blitz": 3, "Eis": 1, "Chaos": 1},
    "Luft": {"Wasser": 3, "Erde": -1, "Feuer": -3, "Eis": 3, "Blitz": -1, "Schatten": -2},
    "Blitz": {"Wasser": 3, "Erde": 1, "Feuer": 1, "Luft": -3, "Eis": -1, "Schatten": 2, "Chaos": -1},
    "Eis": {"Feuer": 3, "Erde": 1, "Wasser": -3, "Luft": 1, "Blitz": 3, "Chaos": -2},
    "Magie": {"Feuer": 1, "Wasser": 1, "Erde": 1, "Luft": 1, "Blitz": 2, "Eis": 2, "Schatten": 3, "Licht": -2},
    "Schatten": {"Licht": 3, "Magie": -2, "Chaos": 1},
    "Licht": {"Schatten": 3, "Magie": 2, "Chaos": -1},
    "Chaos": {"Magie": 1, "Licht": 2, "Schatten": -2, "Feuer": -1, "Blitz": 2},
};

export const ELEMENT_EFFECTS: Record<ElementType, string> = {
    "Feuer": "Effekt bei Sieg: -1 Gegnertoken.",
    "Wasser": "Effekt bei Sieg: +1 Eigene Tokens, -1 Gegnertoken.",
    "Erde": "Effekt bei Sieg: +1 Eigene Tokens.",
    "Luft": "Effekt bei Sieg: +2 Eigene Tokens.",
    "Blitz": "Effekt bei Sieg: +1 Zusätzlicher Token.",
    "Eis": "Effekt bei Sieg: -1 Gegnertoken.",
    "Magie": "Kein direkter Kampfeffekt. Beeinflusst das Spiel auf andere Weise.",
    "Schatten": "Effekt bei Sieg: Stehle 1 Token, sofern verfügbar.",
    "Licht": "Effekt bei Sieg: Heile 1 Token für dich oder einen Verbündeten.",
    "Chaos": "Effekt bei Sieg: Würfle den Vorteil aus (±1 Token).",
};

export const ELEMENT_SYNERGIES = [
    { elements: ["Wasser", "Blitz"] as ElementType[], label: "Überladung", modifier: 2, description: "Wasser leitet Blitzenergie für zusätzlichen Schaden." },
    { elements: ["Feuer", "Erde"] as ElementType[], label: "Lavafeld", modifier: 1.5, description: "Glühende Lava erschwert gegnerische Bewegungen." },
    { elements: ["Licht", "Schatten"] as ElementType[], label: "Balancebruch", modifier: 2.5, description: "Polarität bricht das Gleichgewicht des Gegners." },
    { elements: ["Eis", "Luft"] as ElementType[], label: "Frostwind", modifier: 1.2, description: "Schneidender Wind verlangsamt Gegner." },
    { elements: ["Erde", "Licht"] as ElementType[], label: "Lebendige Bastion", modifier: 1.8, description: "Die Erde wird vom Licht gestärkt und regeneriert." },
] as const;

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
    "Schatten": { from: 'from-gray-900', to: 'to-purple-900', icon: '🜄' },
    "Licht": { from: 'from-amber-200', to: 'to-yellow-100', icon: '🌟' },
    "Chaos": { from: 'from-rose-500', to: 'to-fuchsia-500', icon: '🌀' },
};
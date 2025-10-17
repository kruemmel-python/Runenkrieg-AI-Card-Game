import {
    CARD_TYPES,
    ELEMENTS,
    ABILITIES,
    ABILITY_MECHANIC_DEFINITIONS,
    ABILITY_MECHANICS,
} from '../constants';
import { AbilityMechanicName, Card, CardTypeName, ElementType, ValueType } from '../types';

const STORAGE_KEY = 'runenkrieg-custom-cards';
const MAX_GENERATED_CARDS = 200;

type CatalogListener = (cards: Card[]) => void;

const cloneCard = (card: Card): Card => ({
    ...card,
    mechanics: [...card.mechanics],
});

const BASE_CARD_POOL: Card[] = (() => {
    const baseCards: Card[] = [];
    ELEMENTS.forEach((element, elementIndex) => {
        ABILITIES.forEach((ability, abilityIndex) => {
            const typeConfig = CARD_TYPES[(elementIndex + abilityIndex) % CARD_TYPES.length];
            baseCards.push({
                element,
                wert: ability,
                id: `${element}-${ability}-${elementIndex}-${abilityIndex}`,
                cardType: typeConfig.name,
                mechanics: [...(ABILITY_MECHANICS[ability] ?? [])],
                lifespan: typeConfig.defaultLifespan,
                charges: typeConfig.defaultCharges,
                origin: 'core',
            });
        });
    });
    return baseCards;
})();

let customCardsCache: Card[] | null = null;
let inMemoryFallback: Card[] = [];
let listeners: CatalogListener[] = [];

const isBrowserEnvironment = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const sanitizeMechanics = (mechanics: unknown[]): AbilityMechanicName[] => {
    const unique: AbilityMechanicName[] = [];
    mechanics.forEach((entry) => {
        if (typeof entry !== 'string') {
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(ABILITY_MECHANIC_DEFINITIONS, entry)) {
            return;
        }
        const mechanicName = entry as AbilityMechanicName;
        if (!unique.includes(mechanicName)) {
            unique.push(mechanicName);
        }
    });
    return unique;
};

const normalizeCardType = (cardType: unknown) => {
    if (typeof cardType === 'string') {
        const match = CARD_TYPES.find((entry) => entry.name === cardType);
        if (match) {
            return match;
        }
    }
    return CARD_TYPES[0];
};

const normalizeElement = (element: unknown, fallbackIndex: number): ElementType => {
    if (typeof element === 'string' && (ELEMENTS as readonly string[]).includes(element)) {
        return element as ElementType;
    }
    return ELEMENTS[fallbackIndex % ELEMENTS.length];
};

const normalizeAbility = (ability: unknown, fallbackIndex: number): ValueType => {
    if (typeof ability === 'string' && (ABILITIES as readonly string[]).includes(ability)) {
        return ability as ValueType;
    }
    const maxIndex = ABILITIES.length - 1;
    return ABILITIES[Math.min(fallbackIndex, maxIndex)];
};

const normalizeStoredCard = (candidate: any, index: number): Card => {
    const element = normalizeElement(candidate?.element, index);
    const wert = normalizeAbility(candidate?.wert, index);
    const typeConfig = normalizeCardType(candidate?.cardType);
    const mechanics = sanitizeMechanics(Array.isArray(candidate?.mechanics) ? candidate.mechanics : []);
    const id = typeof candidate?.id === 'string' ? candidate.id : `custom-${Date.now()}-${index}`;
    const lifespan = typeof candidate?.lifespan === 'number' ? candidate.lifespan : typeConfig.defaultLifespan;
    const charges = typeof candidate?.charges === 'number' ? candidate.charges : typeConfig.defaultCharges;

    return {
        element,
        wert,
        id,
        cardType: typeConfig.name,
        mechanics,
        lifespan,
        charges,
        origin: 'custom',
    };
};

const readStoredCustomCards = (): Card[] => {
    let stored: unknown = [];
    if (isBrowserEnvironment()) {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                stored = JSON.parse(raw);
            }
        } catch (error) {
            console.error('Konnte benutzerdefinierte Karten nicht laden:', error);
            stored = [];
        }
    } else {
        stored = inMemoryFallback;
    }

    if (!Array.isArray(stored)) {
        return [];
    }

    return stored.map((entry, index) => normalizeStoredCard(entry, index));
};

const ensureCustomCache = (): Card[] => {
    if (customCardsCache === null) {
        customCardsCache = readStoredCustomCards();
    }
    return customCardsCache;
};

const persistCustomCards = (cards: Card[]): void => {
    customCardsCache = cards.map((card) => ({
        ...card,
        mechanics: [...card.mechanics],
        origin: 'custom',
    }));

    if (isBrowserEnvironment()) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customCardsCache));
        } catch (error) {
            console.error('Konnte benutzerdefinierte Karten nicht speichern:', error);
        }
    } else {
        inMemoryFallback = customCardsCache.map(cloneCard);
    }
};

const notifyListeners = () => {
    const snapshot = getAllCards();
    listeners.forEach((listener) => listener(snapshot));
};

export const getBaseCards = (): Card[] => BASE_CARD_POOL.map(cloneCard);

export const getCustomCards = (): Card[] => ensureCustomCache().map(cloneCard);

export const getAllCards = (): Card[] => [...getBaseCards(), ...getCustomCards()];

const clampCount = (count: number): number => {
    if (!Number.isFinite(count)) {
        return 1;
    }
    const floored = Math.floor(count);
    if (floored <= 0) {
        return 1;
    }
    return Math.min(floored, MAX_GENERATED_CARDS);
};

export interface CardGenerationRequest {
    count: number;
    cardType: CardTypeName;
    mechanics: AbilityMechanicName[];
}

export const generateCustomCardSet = ({
    count,
    cardType,
    mechanics,
}: CardGenerationRequest): Card[] => {
    const safeCount = clampCount(count);
    const typeConfig = normalizeCardType(cardType);
    const sanitizedMechanics = sanitizeMechanics(mechanics);
    const timestamp = Date.now();

    const generated: Card[] = [];
    for (let index = 0; index < safeCount; index += 1) {
        const abilityIndex = Math.min(index, ABILITIES.length - 1);
        generated.push({
            element: ELEMENTS[index % ELEMENTS.length],
            wert: ABILITIES[abilityIndex],
            id: `custom-${timestamp}-${index}`,
            cardType: typeConfig.name,
            mechanics: sanitizedMechanics,
            lifespan: typeConfig.defaultLifespan,
            charges: typeConfig.defaultCharges,
            origin: 'custom',
        });
    }

    return generated;
};

export const registerCustomCards = (cards: Card[]): void => {
    if (cards.length === 0) {
        return;
    }
    const cache = ensureCustomCache();
    const merged = [...cache];
    cards.forEach((card) => {
        merged.push({
            ...card,
            mechanics: [...card.mechanics],
            origin: 'custom',
        });
    });
    persistCustomCards(merged);
    notifyListeners();
};

export const generateAndStoreCustomCards = (request: CardGenerationRequest): Card[] => {
    const cards = generateCustomCardSet(request);
    registerCustomCards(cards);
    return cards;
};

const shuffleInPlace = (cards: Card[]): void => {
    for (let i = cards.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
};

export const buildShuffledDeck = (): Card[] => {
    const deck = getAllCards().map(cloneCard);
    shuffleInPlace(deck);
    return deck;
};

export const getRandomCardTemplate = (): Card => {
    const catalog = getAllCards();
    if (catalog.length === 0) {
        throw new Error('Keine Karten im Katalog verfügbar.');
    }
    const template = catalog[Math.floor(Math.random() * catalog.length)];
    return cloneCard(template);
};

export const subscribeToCardCatalog = (listener: CatalogListener): (() => void) => {
    listeners.push(listener);
    listener(getAllCards());
    return () => {
        listeners = listeners.filter((existing) => existing !== listener);
    };
};

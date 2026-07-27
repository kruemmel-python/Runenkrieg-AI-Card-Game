import { ABILITIES } from '../../constants';
import { ElementType, HeroName, ValueType, WeatherType } from '../../types';

export const clampTokenDelta = (delta: number): number => Math.max(-5, Math.min(5, delta));

export const parseCardLabel = (
    cardLabel: string
): { element: ElementType; ability: ValueType } => {
    const [element, ...abilityParts] = cardLabel.split(' ');
    return {
        element: element as ElementType,
        ability: abilityParts.join(' ') as ValueType,
    };
};

export const abilityIndex = (value: ValueType): number => ABILITIES.indexOf(value);

export const DEFAULT_WILSON_Z = 1.96;

export const wilsonInterval = (wins: number, trials: number, z: number = DEFAULT_WILSON_Z) => {
    if (trials === 0) {
        return { lower: 0, upper: 1, width: 1 };
    }

    const pHat = wins / trials;
    const denominator = 1 + (z ** 2) / trials;
    const center = pHat + (z ** 2) / (2 * trials);
    const margin = z * Math.sqrt((pHat * (1 - pHat)) / trials + (z ** 2) / (4 * trials ** 2));
    const lower = Math.max(0, (center - margin) / denominator);
    const upper = Math.min(1, (center + margin) / denominator);
    return { lower, upper, width: upper - lower };
};

export const computeEvidenceScore = (lower: number, upper: number): number => {
    const width = upper - lower;
    return 0.7 * lower + 0.3 * (1 - Math.min(0.5, width));
};

export const computeEntropy = (probabilities: number[]): number => {
    const filtered = probabilities.filter((p) => p > 0);
    if (filtered.length === 0) {
        return 0;
    }
    return -filtered.reduce((sum, value) => sum + value * Math.log2(value), 0);
};

export const determineWave = (
    trials: number,
    winRate: number,
    intervalWidth: number,
): { wave: 1 | 2 | 3; target: number } => {
    if (trials < 25) {
        return { wave: 1, target: 25 };
    }
    if (trials < 50) {
        return { wave: 2, target: 50 };
    }
    if (trials < 100 && (winRate < 0.25 || intervalWidth > 0.3)) {
        return { wave: 3, target: 100 };
    }
    return { wave: 3, target: trials };
};

export type ResamplingPriority = 'MAX' | 'HIGH' | 'MED' | 'NORMAL';

export const assignPriority = (
    trials: number,
    wilsonLower: number,
    winRate: number,
    tokenDelta: number,
): ResamplingPriority => {
    if (trials === 0) return 'MAX';
    if (trials < 10 && wilsonLower < 0.5) return 'HIGH';
    if (winRate < 0.25 && tokenDelta >= 3) return 'HIGH';
    if (trials < 25 && wilsonLower < 0.6) return 'MED';
    return 'NORMAL';
};

export const buildContextKey = (params: {
    playerCard: string;
    weather: WeatherType;
    playerHero: HeroName;
    aiHero: HeroName;
    tokenDelta: number;
}): string => {
    const clampedDelta = clampTokenDelta(params.tokenDelta);
    return `${params.playerCard}|${params.weather}|${params.playerHero}vs${params.aiHero}|delta:${clampedDelta}`;
};

export type FocusContext = {
    playerCard: string;
    aiCard: string;
    weather: WeatherType;
    playerHero: HeroName;
    aiHero: HeroName;
    tokenDelta: number;
    sampleRate: number;
    targetAiWinRate: number;
    priorWeight: number;
};

export type FocusContextDetail = FocusContext & {
    contextKey: string;
    clampedDelta: number;
};

export const WEAK_CONTEXT_FOCUS: FocusContextDetail[] = [
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Chaos Avatar',
        weather: 'Erdbeben',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.03,
        targetAiWinRate: 0.68,
        priorWeight: 6,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Erdbeben',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Elementar',
        aiCard: 'Chaos Avatar',
        weather: 'Erdbeben',
        playerHero: 'Drache',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.025,
        targetAiWinRate: 0.62,
        priorWeight: 5,
        contextKey: buildContextKey({
            playerCard: 'Licht Elementar',
            weather: 'Erdbeben',
            playerHero: 'Drache',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Luft Elementar',
        aiCard: 'Schatten Avatar',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Zauberer',
        tokenDelta: 5,
        sampleRate: 0.025,
        targetAiWinRate: 0.6,
        priorWeight: 5,
        contextKey: buildContextKey({
            playerCard: 'Luft Elementar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Zauberer',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Elementar',
        aiCard: 'Licht Avatar',
        weather: 'Regen',
        playerHero: 'Drache',
        aiHero: 'Zauberer',
        tokenDelta: 5,
        sampleRate: 0.025,
        targetAiWinRate: 0.65,
        priorWeight: 5,
        contextKey: buildContextKey({
            playerCard: 'Licht Elementar',
            weather: 'Regen',
            playerHero: 'Drache',
            aiHero: 'Zauberer',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Schatten Avatar',
        aiCard: 'Magie Elementar',
        weather: 'Windsturm',
        playerHero: 'Drache',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.58,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Schatten Avatar',
            weather: 'Windsturm',
            playerHero: 'Drache',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Luft Avatar',
        aiCard: 'Luft Flamme',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 3,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Luft Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 3,
        }),
        clampedDelta: clampTokenDelta(3),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Luft Akolyth',
        weather: 'Erdbeben',
        playerHero: 'Drache',
        aiHero: 'Zauberer',
        tokenDelta: 4,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Erdbeben',
            playerHero: 'Drache',
            aiHero: 'Zauberer',
            tokenDelta: 4,
        }),
        clampedDelta: clampTokenDelta(4),
    },
    {
        playerCard: 'Luft Avatar',
        aiCard: 'Feuer Flamme',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Zauberer',
        tokenDelta: 4,
        sampleRate: 0.02,
        targetAiWinRate: 0.58,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Luft Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Zauberer',
            tokenDelta: 4,
        }),
        clampedDelta: clampTokenDelta(4),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Magie Supernova',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 4,
        sampleRate: 0.02,
        targetAiWinRate: 0.62,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 4,
        }),
        clampedDelta: clampTokenDelta(4),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Chaos Avatar',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.025,
        targetAiWinRate: 0.66,
        priorWeight: 6,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Wasser Avatar',
        weather: 'Regen',
        playerHero: 'Drache',
        aiHero: 'Zauberer',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Regen',
            playerHero: 'Drache',
            aiHero: 'Zauberer',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Luft Elementar',
        weather: 'Windsturm',
        playerHero: 'Zauberer',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.58,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Windsturm',
            playerHero: 'Zauberer',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Luft Avatar',
        aiCard: 'Magie Avatar',
        weather: 'Windsturm',
        playerHero: 'Drache',
        aiHero: 'Drache',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Luft Avatar',
            weather: 'Windsturm',
            playerHero: 'Drache',
            aiHero: 'Drache',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
    {
        playerCard: 'Licht Avatar',
        aiCard: 'Erde Avatar',
        weather: 'Regen',
        playerHero: 'Drache',
        aiHero: 'Zauberer',
        tokenDelta: 5,
        sampleRate: 0.02,
        targetAiWinRate: 0.6,
        priorWeight: 4,
        contextKey: buildContextKey({
            playerCard: 'Licht Avatar',
            weather: 'Regen',
            playerHero: 'Drache',
            aiHero: 'Zauberer',
            tokenDelta: 5,
        }),
        clampedDelta: clampTokenDelta(5),
    },
];

export const FOCUS_CONTEXT_INDEX = WEAK_CONTEXT_FOCUS.reduce<
    Map<string, FocusContextDetail[]>
>((map, detail) => {
    const existing = map.get(detail.contextKey) ?? [];
    existing.push(detail);
    map.set(detail.contextKey, existing);
    return map;
}, new Map());

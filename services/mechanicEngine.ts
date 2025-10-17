import { Card, ElementType, GameHistoryEntry, WeatherType, Winner } from '../types';
import { ELEMENT_SYNERGIES, WEATHER_EFFECTS } from '../constants';

type MechanicOwner = 'player' | 'ai';

export const evaluateElementSynergy = (
    card: Card,
    handSnapshot: Card[],
    history: GameHistoryEntry[],
    owner: MechanicOwner
): number => {
    let synergyBonus = 0;

    if (card.mechanics.includes('Elementarresonanz')) {
        const sameElementInPlay = history.filter(entry => {
            const playedCard = owner === 'player' ? entry.playerCard : entry.aiCard;
            return playedCard?.element === card.element;
        }).length;
        const sameElementInHand = handSnapshot.filter(c => c.element === card.element).length;
        const resonanceStacks = sameElementInPlay + sameElementInHand;
        if (resonanceStacks >= 2) {
            synergyBonus += 2 + 0.5 * (resonanceStacks - 2);
        }
    }

    ELEMENT_SYNERGIES.forEach(synergy => {
        if (!synergy.elements.includes(card.element)) return;
        const otherElement = synergy.elements.find(el => el !== card.element)!;
        const historyHasOther = history.some(entry => {
            const ally = owner === 'player' ? entry.playerCard : entry.aiCard;
            return ally?.element === otherElement;
        });
        const handHasOther = handSnapshot.some(c => c.element === otherElement);
        if (historyHasOther || handHasOther) {
            synergyBonus += synergy.modifier;
        }
    });

    if (card.mechanics.includes('Fusion')) {
        const fusionPartners = handSnapshot.filter(
            c => c.element !== card.element && c.mechanics.includes('Fusion')
        ).length;
        if (fusionPartners > 0) {
            synergyBonus += 1 + fusionPartners * 0.5;
        }
    }

    if (card.mechanics.includes('Ketteneffekte')) {
        const lastEntry = history[history.length - 1];
        if (lastEntry) {
            const previousCard = owner === 'player' ? lastEntry.playerCard : lastEntry.aiCard;
            if (previousCard && previousCard.mechanics.includes('Ketteneffekte')) {
                synergyBonus += 1.5;
            }
        }
    }

    return synergyBonus;
};

export const evaluateRiskAndWeather = (
    card: Card,
    ownTokens: number,
    opponentTokens: number,
    currentWeather: WeatherType
): number => {
    const weatherEffectBonus = (WEATHER_EFFECTS[currentWeather] as Partial<Record<ElementType, number>>)[card.element] || 0;
    let mechanicAdjustment = weatherEffectBonus;

    if (card.mechanics.includes('Überladung')) {
        const pressure = Math.max(0, opponentTokens - ownTokens);
        mechanicAdjustment += pressure >= 2 ? 2 : -1;
    }

    if (card.mechanics.includes('Wetterbindung')) {
        mechanicAdjustment += weatherEffectBonus >= 0 ? weatherEffectBonus + 1 : weatherEffectBonus - 1;
    }

    if (card.cardType === 'Segen/Fluch') {
        mechanicAdjustment += ownTokens < opponentTokens ? 1.5 : -0.5;
    }

    if (card.cardType === 'Artefakt') {
        mechanicAdjustment += 0.5;
    }

    if (card.cardType === 'Beschwörung' && card.lifespan) {
        mechanicAdjustment += Math.max(0, 4 - card.lifespan) * 0.25;
    }

    return mechanicAdjustment;
};

interface MechanicEffectParams {
    winner: Winner;
    playerCard: Card;
    aiCard: Card;
    weather: WeatherType;
    remainingPlayerHand: Card[];
    remainingAiHand: Card[];
    basePlayerTokens: number;
    baseAiTokens: number;
    history: GameHistoryEntry[];
}

export const resolveMechanicEffects = ({
    winner,
    playerCard,
    aiCard,
    weather,
    remainingPlayerHand,
    remainingAiHand,
    basePlayerTokens,
    baseAiTokens,
    history,
}: MechanicEffectParams): { playerTokens: number; aiTokens: number; messages: string[] } => {
    let tokens = { player: basePlayerTokens, ai: baseAiTokens };
    const messages: string[] = [];

    const applyMechanics = (
        card: Card | null,
        owner: MechanicOwner,
        didWin: boolean,
        remainingHand: Card[]
    ) => {
        if (!card) return;

        const ownerKey = owner === 'player' ? 'player' : 'ai';
        const opponentKey = owner === 'player' ? 'ai' : 'player';

        if (card.mechanics.includes('Ketteneffekte') && didWin) {
            const lastEntry = history[history.length - 1];
            if (lastEntry) {
                const previousCard = owner === 'player' ? lastEntry.playerCard : lastEntry.aiCard;
                const ownerWinner: Winner = owner === 'player' ? 'spieler' : 'gegner';
                if (previousCard?.mechanics.includes('Ketteneffekte') && lastEntry.winner === ownerWinner) {
                    tokens[opponentKey] = Math.max(0, tokens[opponentKey] - 1);
                    messages.push(
                        owner === 'player'
                            ? 'Ketteneffekte: Deine Kombinationsattacke entzieht dem Gegner einen zusätzlichen Token.'
                            : 'Ketteneffekte: Die KI-Kombination kostet dich einen weiteren Token.'
                    );
                }
            }
        }

        if (card.mechanics.includes('Elementarresonanz') && didWin) {
            const resonanceCount =
                history.filter(entry => {
                    const pastCard = owner === 'player' ? entry.playerCard : entry.aiCard;
                    return pastCard?.element === card.element;
                }).length + 1;
            if (resonanceCount >= 3) {
                tokens[ownerKey] += 1;
                messages.push(
                    owner === 'player'
                        ? 'Elementarresonanz: Deine Linie pulsiert – +1 Token.'
                        : 'Elementarresonanz: Die KI bündelt ihr Element und erhält +1 Token.'
                );
            }
        }

        if (card.mechanics.includes('Überladung')) {
            tokens[ownerKey] = Math.max(0, tokens[ownerKey] - 1);
            messages.push(
                owner === 'player'
                    ? 'Überladung: Die immense Macht kostet dich 1 Token.'
                    : 'Überladung: Die KI erleidet 1 Token Überlastungsschaden.'
            );
        }

        if (card.mechanics.includes('Wetterbindung')) {
            const modifier = (WEATHER_EFFECTS[weather] as Partial<Record<ElementType, number>>)[card.element] ?? 0;
            if (modifier > 0) {
                tokens[ownerKey] += modifier;
                messages.push(
                    owner === 'player'
                        ? `Wetterbindung: ${weather} stärkt dich (+${modifier} Token).`
                        : `Wetterbindung: ${weather} stärkt die KI (+${modifier} Token).`
                );
            } else if (modifier < 0) {
                const loss = Math.min(tokens[ownerKey], Math.abs(modifier));
                tokens[ownerKey] -= loss;
                if (loss > 0) {
                    messages.push(
                        owner === 'player'
                            ? `Wetterbindung: ${weather} schwächt dich (-${loss} Token).`
                            : `Wetterbindung: ${weather} schwächt die KI (-${loss} Token).`
                    );
                }
            }
        }

        if (card.mechanics.includes('Verbündeter')) {
            const allies = remainingHand.filter(handCard => handCard.element === card.element).length;
            if (allies > 0) {
                tokens[ownerKey] += 1;
                messages.push(
                    owner === 'player'
                        ? 'Verbündete sammeln sich: +1 Token.'
                        : 'Die Verbündeten der KI sichern ihr +1 Token.'
                );
            }
        }

        if (card.mechanics.includes('Segen/Fluch')) {
            if (tokens[ownerKey] < tokens[opponentKey]) {
                tokens[ownerKey] += 1;
                messages.push(
                    owner === 'player'
                        ? 'Segen: Deine Kräfte erholen sich (+1 Token).'
                        : 'Segen: Die KI regeneriert einen Token.'
                );
            } else {
                tokens[opponentKey] = Math.max(0, tokens[opponentKey] - 1);
                messages.push(
                    owner === 'player'
                        ? 'Fluch: Der Gegner verliert einen Token.'
                        : 'Fluch: Du verlierst einen Token.'
                );
            }
        }
    };

    applyMechanics(playerCard, 'player', winner === 'spieler', remainingPlayerHand);
    applyMechanics(aiCard, 'ai', winner === 'gegner', remainingAiHand);

    return {
        playerTokens: Math.max(0, tokens.player),
        aiTokens: Math.max(0, tokens.ai),
        messages,
    };
};

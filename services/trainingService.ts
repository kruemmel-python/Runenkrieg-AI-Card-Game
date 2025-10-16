import { Card, ElementType, RoundResult, TrainedModel, ValueType, WeatherType, Winner, HeroName } from '../types';
import { ELEMENTS, ABILITIES, WEATHER_EFFECTS, ELEMENT_HIERARCHIE, HEROES } from '../constants';

// --- Simulation Logic (now mirrors real game logic) ---

// Helper to calculate value in simulation, mirroring the main game logic
function calculateTotalValueInSim(
    ownCard: Card,
    opponentCard: Card,
    hero: HeroName,
    ownTokens: number,
    opponentTokens: number,
    currentWeather: WeatherType
): number {
    const baseValue = ABILITIES.indexOf(ownCard.wert);
    const weatherEffectBonus = (WEATHER_EFFECTS[currentWeather] as Record<ElementType, number>)[ownCard.element] || 0;
    const elementBonus = ELEMENT_HIERARCHIE[ownCard.element]?.[opponentCard.element] ?? 0;
    const heroBonus = HEROES[hero].Element === ownCard.element ? HEROES[hero].Bonus : 0;
    const moraleBonus = Math.min(4, Math.floor(Math.max(0, ownTokens - opponentTokens) / 2));
    return baseValue + weatherEffectBonus + elementBonus + heroBonus + moraleBonus;
}

// Helper to apply element effects in simulation
function applyElementEffect(winner: Winner, winnerCard: Card, pTokens: number, aTokens: number): [number, number] {
    let newPlayerTokens = pTokens;
    let newAiTokens = aTokens;
    if (winner !== 'unentschieden') {
        switch (winnerCard.element) {
            case "Feuer": winner === "spieler" ? newAiTokens-- : newPlayerTokens--; break;
            case "Wasser": winner === "spieler" ? (newPlayerTokens++, newAiTokens--) : (newAiTokens++, newPlayerTokens--); break;
            case "Erde": winner === "spieler" ? newPlayerTokens++ : newAiTokens++; break;
            case "Luft": winner === "spieler" ? newPlayerTokens += 2 : newAiTokens += 2; break;
            case "Blitz": winner === "spieler" ? newPlayerTokens++ : newAiTokens++; break;
            case "Eis": winner === "spieler" ? newAiTokens-- : newPlayerTokens--; break;
        }
    }
    return [newPlayerTokens, newAiTokens];
}


function determineWinnerInSim(playerCard: Card, aiCard: Card, playerHero: HeroName, aiHero: HeroName, pTokens: number, aTokens: number, weather: WeatherType): Winner {
    const playerTotal = calculateTotalValueInSim(playerCard, aiCard, playerHero, pTokens, aTokens, weather);
    const aiTotal = calculateTotalValueInSim(aiCard, playerCard, aiHero, aTokens, pTokens, weather);

    if (playerTotal > aiTotal) return "spieler";
    if (aiTotal > playerTotal) return "gegner";
    return "unentschieden";
}

function generateDeck(): Card[] {
    const deck: Card[] = [];
    for (const element of ELEMENTS) {
        for (const wert of ABILITIES) {
            deck.push({ element, wert, id: `${element}-${wert}` });
        }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}


export function simulateGames(numGames: number): RoundResult[] {
    const allData: RoundResult[] = [];
    const heroNames = Object.keys(HEROES) as HeroName[];

    for (let i = 0; i < numGames; i++) {
        const deck = generateDeck();
        let playerHand = deck.slice(0, 4);
        let aiHand = deck.slice(4, 8);
        let talon = deck.slice(8);
        let playerTokens = 5;
        let aiTokens = 5;
        
        // Random heroes for each simulated game
        const playerHero = heroNames[Math.floor(Math.random() * heroNames.length)];
        const aiHero = heroNames[Math.floor(Math.random() * heroNames.length)];

        while (playerTokens > 0 && aiTokens > 0 && playerHand.length > 0 && aiHand.length > 0) {
            const weather = Object.keys(WEATHER_EFFECTS)[Math.floor(Math.random() * Object.keys(WEATHER_EFFECTS).length)] as WeatherType;
            
            const playerCard = playerHand.splice(Math.floor(Math.random() * playerHand.length), 1)[0];
            const aiCard = aiHand.splice(Math.floor(Math.random() * aiHand.length), 1)[0];
            
            const winner = determineWinnerInSim(playerCard, aiCard, playerHero, aiHero, playerTokens, aiTokens, weather);

            // UPDATED: Apply accurate element effects
            const winnerCard = winner === 'spieler' ? playerCard : aiCard;
            [playerTokens, aiTokens] = applyElementEffect(winner, winnerCard, playerTokens, aiTokens);
            
            playerTokens = Math.max(0, playerTokens);
            aiTokens = Math.max(0, aiTokens);

            allData.push({
                spieler_karte: `${playerCard.element} ${playerCard.wert}`,
                gegner_karte: `${aiCard.element} ${aiCard.wert}`,
                spieler_token: playerTokens,
                gegner_token: aiTokens,
                wetter: weather,
                spieler_held: playerHero,
                gegner_held: aiHero,
                gewinner: winner,
            });

            if (talon.length > 0 && playerHand.length < 4) playerHand.push(talon.pop()!);
            if (talon.length > 0 && aiHand.length < 4) aiHand.push(talon.pop()!);
        }
    }
    return allData;
}


// --- Training Logic (now context-aware) ---

// This builds a model: for each (player card + weather), what AI card has the best win rate?
export function trainModel(simulationData: RoundResult[]): TrainedModel {
    const modelData = new Map<string, Map<string, { wins: number; total: number }>>();

    for (const round of simulationData) {
        // UPDATED: Context-aware key
        const contextKey = `${round.spieler_karte}|${round.wetter}`;
        const aiCardKey = round.gegner_karte;

        if (!modelData.has(contextKey)) {
            modelData.set(contextKey, new Map());
        }
        const aiCardMap = modelData.get(contextKey)!;

        if (!aiCardMap.has(aiCardKey)) {
            aiCardMap.set(aiCardKey, { wins: 0, total: 0 });
        }
        const stats = aiCardMap.get(aiCardKey)!;

        stats.total += 1;
        if (round.gewinner === 'gegner') {
            stats.wins += 1;
        }
    }

    const predict = (playerCard: Card, aiHand: Card[], gameState: any): Card => {
        // UPDATED: Use weather from gameState for context
        const contextKey = `${playerCard.element} ${playerCard.wert}|${gameState.weather}`;
        const possiblePlays = modelData.get(contextKey);

        if (!possiblePlays || aiHand.length === 0) {
            // Fallback to highest value card if no data or no cards
            const sortedHand = [...aiHand].sort((a, b) => ABILITIES.indexOf(b.wert) - ABILITIES.indexOf(a.wert));
            return sortedHand[0] || aiHand[Math.floor(Math.random() * aiHand.length)];
        }

        let bestCard: Card | null = null;
        let bestWinRate = -1;

        for (const cardInHand of aiHand) {
            const cardInHandKey = `${cardInHand.element} ${cardInHand.wert}`;
            const stats = possiblePlays.get(cardInHandKey);
            
            if (stats && stats.total > 0) {
                const winRate = stats.wins / stats.total;
                if (winRate > bestWinRate) {
                    bestWinRate = winRate;
                    bestCard = cardInHand;
                }
            }
        }
        
        // If no card in hand has data, play one with highest value
        if (!bestCard) {
             const sortedHand = [...aiHand].sort((a, b) => ABILITIES.indexOf(b.wert) - ABILITIES.indexOf(a.wert));
             return sortedHand[0];
        }

        return bestCard;
    };

    return { predict };
}
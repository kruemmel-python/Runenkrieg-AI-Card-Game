
import { GoogleGenAI } from "@google/genai";
import { GameHistoryEntry, Winner, HeroName } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function generateGameStory(
  history: GameHistoryEntry[],
  finalWinner: Winner,
  playerHero: HeroName,
  aiHero: HeroName
): Promise<string> {
    if (!API_KEY) {
        return "Gemini API key is not configured. Could not generate story.";
    }

    const gameFlow = history.map(entry => 
        `Runde ${entry.round}: Spieler (${entry.playerCard.element} ${entry.playerCard.wert}) vs KI (${entry.aiCard.element} ${entry.aiCard.wert}). Wetter: ${entry.weather}. Gewinner: ${entry.winner}. Tokens: Spieler ${entry.playerTokens}, KI ${entry.aiTokens}.`
    ).join('\n');

    const winnerText = finalWinner === 'spieler' ? 'der tapfere Spieler' : (finalWinner === 'gegner' ? 'die listige KI' : 'niemand, es war ein Unentschieden');

    const prompt = `
Du bist ein epischer Barde in der Welt von Runenkrieg. Deine Aufgabe ist es, eine kurze, spannende und aufregende Geschichte über eine gerade beendete Schlacht zu schreiben.

Hier sind die Details der Schlacht:
- Held des Spielers: ${playerHero}
- Held der KI: ${aiHero}
- Der endgültige Sieger der Schlacht war: ${winnerText}.

Hier ist der detaillierte Verlauf der Schlacht, Runde für Runde:
${gameFlow}

Schreibe nun eine fesselnde Zusammenfassung dieser Schlacht. Beginne dramatisch, beschreibe einen Höhepunkt und ende mit dem glorreichen Sieg oder der tragischen Niederlage. Halte die Geschichte kurz, aber packend. Sprich den Spieler direkt mit "Du" an, wenn du über seine Aktionen schreibst.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        return response.text;
    } catch (error) {
        console.error("Error generating story with Gemini:", error);
        return "Ein Fehler ist aufgetreten, als die Geschichte des Kampfes geschrieben wurde. Der Barde ist heiser.";
    }
}

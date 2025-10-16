
import { GoogleGenAI } from "@google/genai";
import { GameHistoryEntry, Winner, HeroName } from "../types";

const envKey = (
  import.meta.env.VITE_GEMINI_API_KEY ??
  import.meta.env.VITE_API_KEY ??
  ""
).trim();
let cachedApiKey = envKey.length > 0 ? envKey : undefined;
let client: GoogleGenAI | null = cachedApiKey ? new GoogleGenAI({ apiKey: cachedApiKey }) : null;

if (!cachedApiKey) {
  console.warn("Gemini API key not set. Gemini features are optional and currently disabled.");
}

function getClient(apiKeyOverride?: string): GoogleGenAI | null {
  const normalizedOverride = apiKeyOverride?.trim();
  const effectiveKey = normalizedOverride || cachedApiKey;

  if (!effectiveKey) {
    return null;
  }

  if (!client || cachedApiKey !== effectiveKey) {
    client = new GoogleGenAI({ apiKey: effectiveKey });
    cachedApiKey = effectiveKey;
  }

  return client;
}

export async function generateGameStory(
  history: GameHistoryEntry[],
  finalWinner: Winner,
  playerHero: HeroName,
  aiHero: HeroName,
  apiKeyOverride?: string
): Promise<string> {
    const geminiClient = getClient(apiKeyOverride);
    if (!geminiClient) {
        return "Gemini ist deaktiviert oder nicht konfiguriert.";
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
        const response = await geminiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error generating story with Gemini:", error);
        return "Ein Fehler ist aufgetreten, als die Geschichte des Kampfes geschrieben wurde. Der Barde ist heiser.";
    }
}

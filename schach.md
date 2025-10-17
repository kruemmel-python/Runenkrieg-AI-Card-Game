
# 🧠 Runenkrieg & Schach – Simulation, Training und Spielverhalten  
### *Bio-inspirierte Resonanzarchitektur für adaptive Lernsysteme*

> **Autor:** Ralf Krümmel  
> **Projekt:** Runenkrieg-AI-Card-Game  
> **Lizenz:** MIT  
> **Version:** 1.0  
> **Letzte Aktualisierung:** Oktober 2025  

---

## 🧩 Abstract

Dieses Projekt dokumentiert zwei vollständig implementierte, voneinander lernende KI-Systeme:

1. **Runenkrieg KI (Codex-Simulation)** – ein kontextbasiertes, statistisches Lernmodell für das Kartenspiel *Runenkrieg*  
2. **Schach KI (Arena-Simulation)** – dieselbe Lernlogik, übertragen auf Schachpositionen (FEN-basierter Kontext)

Beide Systeme trainieren durch **Selbst-Spiel-Simulationen**, speichern Ergebnisse in einem **Kontext-Wörterbuch** und wählen Aktionen nach der **Wilson-Untergrenze (95 %)** ihrer Siegquote.  
Das Modell ist **biologisch inspiriert** – es verwendet keine Gradienten, sondern baut „Erfahrungsfelder“, die durch Entropie-Analyse stabilisiert werden.  

---

## 🧠 Teil I – Runenkrieg KI (Das Karten-Codex)

### 🎯 Ziel & Strategie

| Aspekt | Beschreibung |
|:---|:---|
| **Ziel** | Maximierung der *Wilson-Untergrenze* der Siegquote im Kontext |
| **Untrainiert** | Gewichtete Heuristik (`evaluateCard`) zur Bewertung der Karten |
| **Trainiert** | Auswahl aus `trainedModel` nach höchster *angepasster* Wilson-Untergrenze; Soft-WTA bei Unsicherheit |

### ⚙️ Kontextdefinition
**Schlüsselstruktur:**  
```

Spielerkarte | Wetter | HeldenMatchup | delta:±k

````
*(Token-Delta auf ±5 begrenzt)*

### 📊 Heuristik
```text
Score = Σ(Basisstärke·1.1)
      + Σ(Wetter·1.2)
      + Σ(Mechanik·1.15)
      + Σ(Synergie)
      + Σ(Konter)
      + Σ(Heldenaffinität·1.25)
      + Σ(Risiko/Druck)
````

Mechaniken: Element-Hierarchie, Wetter-Effekte, Fusion, Resonanz, Überladung usw.

### 🧮 Training (Sparse Dictionary Learning)

1. Aggregation aller `RoundResult`s nach Kontext
2. Zählung der Aktionen & Siege
3. Berechnung der **Wilson-Untergrenze**
4. Bildung eines adaptiven Entscheidungsmodells (`predict`)

### 🔁 Exploration

* **Stabil:** deterministisch (kleine Temperatur τ)
* **Unsicher:** Temperatur ↑ → Soft-WTA, Top-2-Mix
* **Alert:** Entropie H < 0.3 → Überanpassung, Exploration erzwingen

Formel:

```math
H = -∑ p(a) · log₂ p(a)
```

---

## ♟️ Teil II – Schach KI (Die Taktische Arena)

### 🎯 Ziel & Strategie

| Aspekt        | Beschreibung                                                     |
| :------------ | :--------------------------------------------------------------- |
| **Ziel**      | Auswahl des Zugs mit maximalem *Expected Score*                  |
| **Heuristik** | `evaluateMoveHeuristic`: Material, Zentrum, Rochade, Entwicklung |
| **Kontext**   | **FEN-Key**: streng (komplett) / locker (Brett + Zugrecht)       |

Formel:

```math
ExpectedScore = P(Sieg) + 0.5·P(Remis)
```

### 🧮 Lernprozess

1. Simulation mit `SimpleChess` (Selbstpartien)
2. Aggregation der (FEN, Zug)-Paare
3. Berechnung von *Expected Score* + *Confidence*
4. Auswahl des besten Zugs (höchster Qualitätswert)

---

## 🌐 Teil III – Gemini-Integration (Der Epische Barde)

Nach jeder Partie generiert **Google Gemini 2.5 Flash** eine kurze, epische Geschichte über den Kampf.

* Eingabe: `gameHistory`
* Prompt: Rolle „Epischer Barde“ + Fakten + dramatischer Ton
* Ausgabe: Erzählung im „Spiel Vorbei!“-Screen

Diese narrative Schicht übersetzt technische Daten in emotionale Sprache und stärkt die Immersion.

---

## ⚛️ Teil IV – Architektur-Details & Domänen-Transfer

### 🔢 Kernmetriken

| Metrik                        | Formel                            | Bedeutung                  |
| :---------------------------- | :-------------------------------- | :------------------------- |
| **Wilson-Untergrenze (95 %)** | *robuste Schätzung der Siegquote* | Qualität                   |
| **Expected Score**            | `P(win) + 0.5·P(draw)`            | Schach-Leistungsmaß        |
| **Entropie H**                | `−∑ p(a) log₂ p(a)`               | Vielfalt / Stabilität      |
| **Soft-WTA**                  | `p(a) ∝ exp(Score(a)/τ)`          | Exploration / Exploitation |

### 🧮 Pseudocode (beide Domänen)

```python
for episode in range(N):
    state = initial_state()
    while not terminal(state):
        actions = enumerate_actions(state)
        p = softmax(heuristic(state, a) / τ)
        a = sample(p)
        step(state, a)
        log(state, a, outcome)

group_by_context()
for context, action_stats in data:
    expected = (wins + 0.5*draws) / n
    wilson = wilson_lower_bound(wins, n)
    adjusted = adjust(wilson, penalties)
predict(context) = argmax_a adjusted
if H(context) < 0.3 or wilson < 0.6:
    τ *= 1.25
```

### 🔄 Resonanz-Mapping

| Runenkrieg-Mechanik | Schach-Analogon    | Messgröße                           |
| :------------------ | :----------------- | :---------------------------------- |
| Überladung          | Opfer / Initiative | Opfer-Frequenz, Folge-Kontrolle     |
| Elementarresonanz   | Figurensynergien   | Mobilitätsverlust Gegner            |
| Wetterbindung       | Brettstruktur      | Anteil strukturprägender Bauernzüge |

### 🧭 Diagramm

```mermaid
sequenceDiagram
    box "Client/Browser"
        participant User
        participant ReactApp as App.tsx
        participant GameBoard as components/GameBoard.tsx
        participant ChessArena as components/ChessArena.tsx
        participant CardComponent as components/Card.tsx
        participant Spinner as components/Spinner.tsx
    end

    box "Frontend Logic & Services"
        participant GameLogicHook as hooks/useGameLogic.ts
        participant CardCatalogService as services/cardCatalogService.ts
        participant AIService as services/aiService.ts
        participant AIDecisionEngine as services/aiDecisionEngine.ts
        participant MechanicEngine as services/mechanicEngine.ts
        participant FusionService as services/fusionService.ts
        participant GeminiService as services/geminiService.ts
        participant ChessAIService as services/chessAiService.ts
        participant SimpleChessEngine as services/chessEngine.ts
    end

    box "External Systems"
        participant GoogleGeminiAPI as Google Gemini API
        participant LocalStorage as Browser LocalStorage
    end

    User->>ReactApp: App laden
    activate ReactApp
    ReactApp->>GameBoard: Standardansicht rendern (currentView='card')
    activate GameBoard

    GameBoard->>LocalStorage: Gemini-Einstellungen laden
    activate LocalStorage
    LocalStorage-->>GameBoard: Einstellungen
    deactivate LocalStorage

    GameBoard->>GameLogicHook: useGameLogic() initialisieren
    activate GameLogicHook
    GameLogicHook->>CardCatalogService: buildShuffledDeck()
    activate CardCatalogService
    CardCatalogService-->>GameLogicHook: Deck
    deactivate CardCatalogService
    GameLogicHook-->>GameBoard: Spielzustand (Hände, Tokens, Helden)
    deactivate GameLogicHook

    GameBoard->>CardComponent: Spieler- & KI-Hände rendern
    GameBoard->>GameBoard: Status & Wetter anzeigen

    loop Game Rounds
        User->>GameBoard: Karte spielen
        activate GameBoard
        GameBoard->>GameLogicHook: playCard(playerCardId)
        activate GameLogicHook

        GameLogicHook->>AIService: chooseCard(playerCard, aiHand, gameState)
        activate AIService
        alt AI ist trainiert
            AIService->>AIService: trainedModel.predict()
        else AI ist nicht trainiert
            AIService->>AIDecisionEngine: generateAiPlayOptions()
            activate AIDecisionEngine
            AIDecisionEngine->>FusionService: createFusionCard() (optional)
            activate FusionService
            FusionService-->>AIDecisionEngine: Fusionskarte
            deactivate FusionService
            AIDecisionEngine-->>AIService: Bewertete Spieloptionen
            deactivate AIDecisionEngine
            AIService->>AIService: Beste Karte auswählen (Heuristik)
        end
        AIService-->>GameLogicHook: aiCard
        deactivate AIService

        GameLogicHook->>MechanicEngine: resolveMechanicEffects(roundData)
        activate MechanicEngine
        MechanicEngine-->>GameLogicHook: Aktualisierte Tokens & Nachrichten
        deactivate MechanicEngine

        GameLogicHook-->>GameBoard: Aktualisierter Spielzustand
        deactivate GameLogicHook
        GameBoard->>CardComponent: Gespielte Karten & Hände aktualisieren
        GameBoard->>GameBoard: Statusmeldungen anzeigen
    end

    alt Spiel beendet (gamePhase='gameOver')
        GameBoard->>GameBoard: "Spiel Vorbei!" anzeigen
        GameBoard->>Spinner: Spinner anzeigen (während Geschichte generiert wird)
        activate Spinner
        GameBoard->>GeminiService: generateGameStory(history, winner, ...)
        activate GeminiService
        GeminiService->>GoogleGeminiAPI: Prompt senden
        activate GoogleGeminiAPI
        GoogleGeminiAPI-->>GeminiService: Generierte Geschichte
        deactivate GoogleGeminiAPI
        GeminiService-->>GameBoard: Geschichte
        deactivate GeminiService
        deactivate Spinner
        GameBoard->>GameBoard: Geschichte anzeigen
        User->>GameBoard: "Neues Spiel" klicken
        GameBoard->>GameLogicHook: startGame()
        deactivate GameBoard
    end

    User->>GameBoard: "Zur Schach-Arena" klicken
    deactivate GameBoard
    GameBoard->>ReactApp: handleSwitchView('chess')
    ReactApp->>ChessArena: Ansicht rendern
    activate ChessArena

    ChessArena->>ChessAIService: chooseChessMove(fen, color)
    activate ChessAIService
    ChessAIService->>SimpleChessEngine: generateLegalMoves()
    activate SimpleChessEngine
    SimpleChessEngine-->>ChessAIService: Legale Züge
    deactivate SimpleChessEngine
    alt Schach-KI ist trainiert
        ChessAIService->>ChessAIService: trainedModel.chooseMove()
    else Schach-KI ist nicht trainiert
        ChessAIService->>ChessAIService: Heuristischen Zug wählen
    end
    ChessAIService-->>ChessArena: Zugvorschlag
    deactivate ChessAIService
    ChessArena->>ChessArena: Zug ausführen / anzeigen
    deactivate ChessArena
    deactivate ReactApp
```

---

## 📈 Beispielanalyse (Runenkrieg)

* **Gesamtrunden:** 14 831 035
* **Siegquote (Spieler / KI):** 49.4 % / 49.7 %
* **Ø beste Siegquote:** 99.3 %
* **Mechanik-Wirksamkeit:**

  * *Wetterbindung* 69.0 % (+29.2 %)
  * *Fusion* 67.5 % (+28.6 %)
  * *Überladung* 40.2 % (–12.9 %)
  * *Ketteneffekte* 27.2 % (–29.2 %)

Diese nahezu ausgeglichene Bilanz bestätigt: **kein Overfitting, stabile Generalisierung**.

---

## 💡 Erkenntnisse

* Die Architektur **lernt Gleichgewicht** – das Spielverhalten bleibt natürlich, ohne deterministische Muster.
* **Biologisch inspiriertes Lernen** erzeugt *robuste Anpassung* statt maximaler Exploitation.
* Die **Domänenübertragbarkeit** (Runenkrieg → Schach) beweist, dass dieselbe Methodik symbolische und taktische Räume abdecken kann.

---

## 🧰 Code-Snippets

**TypeScript – Expected Score & Wilson Lower**

```ts
export function expectedScore(s: Stat) {
  return s.n ? (s.wins + 0.5 * s.draws) / s.n : 0;
}
export function wilsonLower95(wins: number, n: number) {
  if (n <= 0) return 0;
  const z = 1.96, p = wins / n;
  const denom = 1 + (z*z)/n;
  const center = (p + (z*z)/(2*n)) / denom;
  const half = (z * Math.sqrt((p*(1-p) + (z*z)/(4*n))/n)) / denom;
  return Math.max(0, center - half);
}
```

**TypeScript – Entropie**

```ts
export function entropy(probs: number[]): number {
  return -probs.reduce((h, p) => h + (p > 0 ? p * Math.log2(p) : 0), 0);
}
```

---

## 📚 Glossar

| Begriff          | Bedeutung                                         |
| :--------------- | :------------------------------------------------ |
| **Kontext-Key**  | Spielzustandssignatur (Runenkrieg) / FEN (Schach) |
| **Lift**         | Leistungssteigerung gegenüber Baseline            |
| **Evidenzscore** | Kombiniert Siegquote und Intervallbreite          |
| **Temperatur τ** | Regelt Exploration ↔ Exploitation                 |

---

## 🧭 Lizenz

Dieses Projekt steht unter der **MIT-Lizenz**.
Verwendung, Anpassung und Forschung ausdrücklich erlaubt – bitte unter Namensnennung:

```
© 2025 Ralf Krümmel – Runenkrieg & Schach KI Systeme
```

---

## 📎 Verweise

* 🗂 GitHub: [github.com/kruemmel-python/Runenkrieg-AI-Card-Game](https://github.com/kruemmel-python/Runenkrieg-AI-Card-Game)
* 🧮 Trainingsberichte & Analysen: *docs/training-dashboard.md*
* 🎨 UI-Screens & Karten-Assets: *assets/*
* 🧠 Schach-Modul: *modules/chessArena/*

---

> 💬 *„Gleichgewicht ist Intelligenz – nicht Dominanz.“*
> — *Ralf Krümmel, Entwickler der Runenkrieg-KI*

## Dieses Projekt ist in den Branches




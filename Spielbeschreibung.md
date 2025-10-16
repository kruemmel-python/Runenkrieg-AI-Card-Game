# Runenkrieg: Spielbeschreibung & KI-Leitfaden

Dieses Dokument erklärt die Regeln von Runenkrieg, wie das Spiel gespielt wird und wie die künstliche Intelligenz im Hintergrund funktioniert und von Ihnen trainiert werden kann.

## 1. Spielablauf

### Das Ziel
Dein Ziel in Runenkrieg ist es, die Lebenspunkte (Tokens) deines Gegners auf 0 zu reduzieren, bevor er deine auf 0 reduziert. Jeder Spieler startet mit 5 Tokens.

### Eine Runde spielen
1.  **Wähle eine Karte:** Du beginnst jede Runde. Wähle eine Karte aus deiner Hand, indem du darauf klickst. Jede Karte hat ein Element und eine Fähigkeit mit einer bestimmten Grundstärke.
2.  **KI kontert:** Die KI wird basierend auf deiner Wahl eine eigene Karte ausspielen. Ob sie dies zufällig tut oder eine strategische Entscheidung trifft, hängt davon ab, ob du sie trainiert hast.
3.  **Auswertung:** Die Stärke beider Karten wird verglichen, um einen Sieger für die Runde zu ermitteln. Die Gesamtstärke berechnet sich aus fünf Komponenten:
    *   **Grundwert:** Jede Fähigkeit hat eine feste Grundstärke (z.B. "Funke" hat Stärke 0, "Avatar" hat Stärke 13).
    *   **Wetter-Bonus:** Das in jeder Runde zufällig bestimmte Wetter kann bestimmte Elemente stärken oder schwächen. Eine Feuerkarte ist im Regen zum Beispiel weniger effektiv.
    *   **Element-Bonus:** Elemente haben Stärken und Schwächen gegeneinander (z.B. Wasser ist stark gegen Feuer und erhält einen Bonus, ist aber schwach gegen Luft).
    *   **Helden-Bonus:** Dein Held gibt dir einen Bonus, wenn du eine Karte spielst, die zu seinem Element gehört.
    *   **Moral-Bonus:** Du erhältst einen Stärkebonus, wenn du mehr Tokens besitzt als dein Gegner. Dieser Bonus wächst mit dem Vorsprung und simuliert die erhöhte Kampfmoral deiner Truppen.
4.  **Effekte & Nachziehen:** Die Siegerkarte der Runde löst ihren Element-Effekt aus, der meist die Token-Anzahl der Spieler beeinflusst. Danach ziehen beide Spieler eine Karte vom Stapel nach, solange dieser nicht leer ist.

### Spielende
Das Spiel endet, wenn eine der folgenden Bedingungen erfüllt ist:
*   Ein Spieler hat 0 oder weniger Tokens. Der Spieler mit mehr Tokens gewinnt das Spiel.
*   Beide Spieler haben keine Karten mehr auf der Hand und der Nachziehstapel ist leer. Der Spieler mit mehr Tokens gewinnt.
*   Bei exakt gleicher Token-Anzahl am Ende ist das Spiel ein Unentschieden.

Nach jedem abgeschlossenen Spiel fasst der epische Barde Gemini den Kampfverlauf in einer einzigartigen, spannenden Geschichte zusammen, um deine Heldentaten (oder deine Niederlage) zu verewigen.

## 2. Die KI: Simulation & Training

Die KI in Runenkrieg lernt durch einen Prozess, der von der Funktionsweise des menschlichen Gehirns inspiriert ist. Du kannst diesen Prozess im "KI Training"-Bereich selbst steuern und die KI zu einem besseren Gegner machen.

### Schritt 1: Simulation
*   **Zweck:** Um zu lernen, braucht die KI Erfahrungen in Form von Daten. Die Simulation ist eine Fabrik, die diese Daten erzeugt, indem sie Tausende von kompletten Spielen im Schnelldurchlauf durchspielt.
*   **Funktion:** Die Funktion `simulateGames` spielt die von dir gewählte Anzahl an Partien, wobei beide Spieler rein zufällige Züge machen. Jeder einzelne Zug und dessen Ergebnis (wer hat was gespielt, wie war das Wetter, wer hat gewonnen, wie war der Token-Stand) wird als Datensatz für das spätere Training gespeichert.
*   **Ergebnis:** Eine riesige Sammlung von Spieldaten, die als Trainingsgrundlage für die KI dient. Je mehr Simulationen, desto besser die Datenbasis.

### Schritt 2: Training (Der "BioVision"-Ansatz)
*   **Zweck:** Die KI analysiert die gesammelten Spieldaten, um Muster zu erkennen und eine Strategie zu entwickeln. Sie lernt, welche Karten in welchen Situationen die besten Antworten sind.
*   **Was wird trainiert?** Wir trainieren keine undurchsichtige "Black Box"-KI. Stattdessen verwenden wir ein effizientes, **biologisch inspiriertes Modell**, das Aspekte der visuellen Verarbeitung im Gehirn nachahmt. Man nennt diesen Ansatz **Sparse Dictionary Learning**.

#### Wie funktioniert das Training?
1.  **Merkmale extrahieren:** Zuerst wird jeder Spielzug in eine für den Computer verständliche, numerische Sprache übersetzt – einen sogenannten "Feature-Vektor". Dieser Vektor enthält alle relevanten Informationen: welche Karten gespielt wurden, die Token-Anzahl, das Wetter usw.

2.  **Muster-Wörterbuch lernen (Dictionary Learning):** Die KI lernt nun ein "Wörterbuch" aus fundamentalen Spielmustern (sogenannten Atomen). Man kann sich das so vorstellen: Anstatt sich jeden einzelnen der Tausenden Spielzüge zu merken, lernt die KI die grundlegenden "Bausteine" eines guten oder schlechten Zuges.

3.  **Spärliche Aktivierung (Sparsity):** Das Besondere an diesem Modell ist die "Spärlichkeit" (Sparsity). Wenn die KI einen neuen, unbekannten Spielzug sieht, versucht sie nicht, ihn mit allen gelernten Mustern abzugleichen. Stattdessen beschreibt sie den Zug durch eine **Kombination von nur sehr wenigen** Mustern aus ihrem Wörterbuch. Dies ist inspiriert davon, wie im Gehirn für eine bestimmte Aufgabe nur eine kleine Teilmenge von Neuronen gleichzeitig aktiv ist. Dieser Ansatz ist extrem ressourcenschonend und effizient.

4.  **k-Winner-Take-All (k-WTA):** Dieser Mechanismus sorgt für die Spärlichkeit. Von allen möglichen Mustern im Wörterbuch werden nur die `k` (z.B. 16) relevantesten zur Beschreibung der Situation herangezogen. Alle anderen werden ignoriert.

5.  **Entscheidung treffen:** Auf Basis dieser "spärlichen" Repräsentation der Spielsituation trifft ein einfacher Klassifikator die finale Entscheidung: Welche Karte aus der eigenen Hand führt gegen die gespielte Karte des Gegners, **unter Berücksichtigung des aktuellen Wetters**, mit der höchsten statistischen Wahrscheinlichkeit zum Sieg?

Wenn du auf "Trainiere KI" klickst, durchläuft die KI diesen Prozess. Anschließend nutzt sie das neu erlernte Modell, um ihre Züge zu wählen, anstatt nur zufällig eine Karte zu spielen.
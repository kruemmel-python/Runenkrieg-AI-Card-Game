# KI-System-Dokumentation für Runenkrieg

## Einleitung

Dieses Dokument beschreibt das KI-System des Runenkrieg-Kartenspiels, insbesondere wie Simulationen für Trainingseinheiten ablaufen und wie das KI-Training selbst funktioniert. Ziel ist es, ein Verständnis für die Mechanismen zu schaffen, die es der KI ermöglichen, strategische Entscheidungen zu treffen und sich kontinuierlich zu verbessern.

Das Runenkrieg-Kartenspiel ist ein rundenbasiertes Strategiespiel, bei dem Spieler Karten ausspielen, um ihre Gegner zu besiegen. Die KI muss in der Lage sein, die Spielregeln zu verstehen, den Spielzustand zu analysieren und optimale Züge auszuwählen.

## Simulationsablauf für Trainingseinheiten

### Was ist die Simulation?

Die Simulation ist ein Kernbestandteil des KI-Trainingsprozesses. Sie ermöglicht es, eine große Anzahl von Spielen in einer kontrollierten Umgebung schnell und effizient durchzuführen, ohne auf menschliche Interaktion angewiesen zu sein. Jede Simulation ist ein vollständiges Spiel von Anfang bis Ende, bei dem die KI entweder gegen sich selbst, gegen eine andere KI-Version oder gegen eine vordefinierte Logik antritt.

### Wie funktioniert die Simulation?

Der `trainingService.ts` ist für die Orchestrierung der Simulationen zuständig. Er initiiert und verwaltet die Spielinstanzen, die für das Training benötigt werden.

1.  **Spielinitialisierung:** Für jede Simulation wird ein neues Spiel initialisiert. Dies beinhaltet das Mischen der Decks, das Austeilen der Startkarten und das Festlegen des Startspielers.
2.  **Rundenbasierter Ablauf:** Das Spiel läuft rundenbasiert ab, genau wie ein normales Spiel.
    *   **Zugphase:** Wenn ein Spieler (oder eine KI) am Zug ist, wird der aktuelle Spielzustand an die entscheidende Instanz (z.B. `aiService.ts`) übergeben.
    *   **Entscheidungsfindung:** Die KI analysiert den Spielzustand (verfügbare Karten auf der Hand, Karten auf dem Spielfeld, Lebenspunkte, Runen, Friedhof, etc.) und wählt basierend auf ihrer aktuellen Strategie den besten Zug aus. Dies kann das Ausspielen einer Karte, das Aktivieren einer Fähigkeit oder das Passen sein.
    *   **Zugausführung:** Der ausgewählte Zug wird im Spiel ausgeführt, was zu einer Aktualisierung des Spielzustands führt.
3.  **Spielende:** Das Spiel endet, wenn eine der Siegbedingungen erfüllt ist (z.B. Lebenspunkte des Gegners auf Null reduziert, Deck leer und keine Karten mehr ziehbar).
4.  **Ergebnisprotokollierung:** Nach jedem Spiel werden wichtige Informationen wie der Gewinner, die Dauer des Spiels, die gespielten Züge und möglicherweise Zwischenstände protokolliert. Diese Daten sind entscheidend für das spätere Training.

### Warum wird simuliert?

*   **Effizienz:** Simulationen ermöglichen es, Tausende oder sogar Millionen von Spielen in kurzer Zeit durchzuführen, was für das Training von maschinellen Lernmodellen unerlässlich ist.
*   **Kontrollierte Umgebung:** Die Simulationsumgebung ist deterministisch und reproduzierbar. Dies ist wichtig, um die Auswirkungen von Änderungen an der KI-Logik oder den Trainingsparametern genau bewerten zu können.
*   **Datenbeschaffung:** Jede Simulation generiert wertvolle Daten über Spielzustände und die entsprechenden optimalen Züge, die als Trainingsdaten für die KI verwendet werden können.
*   **Risikofreies Experimentieren:** Neue Strategien oder KI-Modelle können in der Simulation getestet werden, ohne das Risiko einzugehen, die Leistung in einer Live-Umgebung zu beeinträchtigen.

## KI-Training

### Was ist das KI-Training?

Das KI-Training ist der Prozess, bei dem die KI lernt, bessere Entscheidungen im Spiel zu treffen. Es nutzt die Daten aus den Simulationen, um die internen Parameter oder Modelle der KI anzupassen, sodass sie in zukünftigen Spielen erfolgreicher ist.

### Wie funktioniert das KI-Training?

Der `aiService.ts` ist der zentrale Dienst für die KI-Logik und das Training. Er beherbergt das eigentliche KI-Modell und die Algorithmen, die für die Entscheidungsfindung und das Lernen verantwortlich sind.

1.  **Datensammlung:** Wie oben beschrieben, werden durch Simulationen große Mengen an Spieldaten gesammelt. Diese Daten umfassen Spielzustände, die von der KI getroffenen Entscheidungen und die Ergebnisse dieser Entscheidungen (Gewinn/Verlust).
2.  **Modellauswahl:** Je nach Komplexität und Anforderungen kann die KI verschiedene Lernansätze verwenden:
    *   **Regelbasierte KI:** Eine grundlegende KI könnte auf einem Satz von vordefinierten Regeln basieren (z.B. "Spiele immer die Karte, die den meisten Schaden verursacht"). Diese Regeln können manuell optimiert werden.
    *   **Monte-Carlo Tree Search (MCTS):** Eine fortgeschrittenere KI könnte MCTS verwenden, um zukünftige Spielzustände zu simulieren und den besten Zug basierend auf den Ergebnissen dieser internen Simulationen zu finden. Das Training würde hier die Bewertungsfunktion für die Knoten im Baum verbessern.
    *   **Reinforcement Learning (RL):** Die anspruchsvollste Methode, bei der die KI durch "Versuch und Irrtum" lernt. Sie erhält Belohnungen für gute Züge (z.B. Schaden verursachen, Spiel gewinnen) und Bestrafungen für schlechte Züge. Ein neuronales Netz könnte verwendet werden, um eine Politik (welchen Zug man machen soll) oder eine Wertfunktion (wie gut ein Spielzustand ist) zu lernen.
3.  **Modellaktualisierung:** Basierend auf den gesammelten Daten und dem gewählten Lernalgorithmus wird das KI-Modell aktualisiert.
    *   Bei regelbasierten Systemen könnten dies Anpassungen an den Prioritäten der Regeln sein.
    *   Bei MCTS könnte die Bewertungsfunktion, die die Knoten im Suchbaum bewertet, durch ein neuronales Netz ersetzt und trainiert werden.
    *   Bei Reinforcement Learning werden die Gewichte und Biases eines neuronalen Netzes angepasst, um die Vorhersagen der Politik oder Wertfunktion zu verbessern.
4.  **Evaluierung:** Nach einer Trainingsphase wird die neue Version der KI gegen die vorherige Version oder eine Benchmark-KI in weiteren Simulationen getestet, um ihre Leistungsverbesserung zu bewerten.
5.  **Iterativer Prozess:** Der gesamte Prozess der Datensammlung, des Trainings und der Evaluierung ist iterativ. Die KI lernt kontinuierlich, indem sie neue Daten generiert und ihr Modell immer wieder verfeinert.

### Warum wird die KI trainiert?

*   **Leistungsverbesserung:** Das Hauptziel ist es, die KI so zu verbessern, dass sie immer bessere Entscheidungen trifft und eine größere Gewinnwahrscheinlichkeit gegen menschliche Spieler oder andere KIs hat.
*   **Anpassungsfähigkeit:** Durch Training kann die KI lernen, sich an verschiedene Spielstile, Deckzusammenstellungen und Metas anzupassen.
*   **Entdeckung neuer Strategien:** Eine gut trainierte KI kann möglicherweise Strategien entdecken, die für menschliche Spieler nicht offensichtlich waren.
*   **Robuste Entscheidungsfindung:** Das Training hilft der KI, auch in komplexen oder unerwarteten Spielsituationen robuste und logische Entscheidungen zu treffen.
*   **Automatisierung der Entwicklung:** Anstatt jede Regel manuell zu programmieren, kann die KI durch Training selbstständig lernen, was zu einer effizienteren Entwicklung führt.

Zusammenfassend lässt sich sagen, dass die Kombination aus schnellen Simulationen und einem iterativen Trainingsprozess es dem Runenkrieg-KI-System ermöglicht, sich kontinuierlich zu verbessern und ein herausfordernder Gegner zu sein.
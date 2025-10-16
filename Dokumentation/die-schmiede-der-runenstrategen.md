# Die Schmiede der Runenstrategen: Einblicke in das KI-System von Runenkrieg

Von: Ralf Krümmel der Entwickler

Tags: Künstliche Intelligenz, Kartenspiel, Spieleentwicklung, Maschinelles Lernen, Simulation, Training, Runenkrieg, Entwicklerbericht, Sparse Dictionary Learning, BioVision

---

Als Ralf Krümmel, der Entwickler hinter 'Runenkrieg', habe ich mich einer faszinierenden Herausforderung gestellt: ein Kartenspiel zu erschaffen, dessen künstliche Intelligenz nicht nur reagiert, sondern lernt, sich anpasst und den Spieler auf immer neue Weise fordert. Dieses Dokument ist Ihr Schlüssel zu den Mechanismen, die unserer KI Leben einhauchen – von den schnellen, virtuellen Schlachten in unseren Simulationslaboren bis hin zur komplexen neuronalen Anpassung, die sie zu einem wahren Runenstrategen macht. Tauchen Sie mit mir ein in die Welt der Daten, Algorithmen und des iterativen Lernens, die das Herzstück der intelligenten Gegner von Runenkrieg bilden.

## Das Herz der Intelligenz: Runenkriegs KI-System im Überblick

Das rundenbasierte Strategiespiel "Runenkrieg" fordert Spieler heraus, ihre Gegner durch geschicktes Ausspielen von Elementarkarten zu bezwingen. Meine Vision war es, einen KI-Gegner zu entwickeln, der die Spielregeln nicht nur versteht, sondern auch in der Lage ist, den komplexen Spielzustand zu analysieren und optimale Züge auszuwählen. Ein solches System muss sich kontinuierlich verbessern können, um langfristig eine spannende und dynamische Herausforderung zu bieten. Die Architektur, die wir dafür gewählt haben, ist modular und setzt auf zwei Säulen: die Simulation und das Training.

## Das Labor der Erkenntnis: Der Simulationsablauf

### Die Notwendigkeit der virtuellen Schlacht

Die Simulation ist der Grundstein unseres KI-Trainingsprozesses. Sie ermöglicht es uns, eine immense Anzahl von Spielen in einer kontrollierten und vor allem schnellen Umgebung durchzuführen. Ohne menschliche Interaktion können Tausende, ja sogar Millionen von Partien in kürzester Zeit absolviert werden. Jede Simulation ist ein vollständiges Spiel, das von Anfang bis Ende durchgespielt wird – sei es, dass die KI gegen sich selbst, gegen eine ältere Version oder gegen eine vordefinierte Logik antritt. Dies garantiert eine deterministische und reproduzierbare Umgebung, die für die präzise Bewertung von KI-Logikänderungen unerlässlich ist.

Die Vorteile liegen auf der Hand:

*   **Effizienz:** Was für menschliche Spieler Tage oder Wochen dauern würde, erledigt die Simulation in Minuten. Dies ist entscheidend für das Training von maschinellen Lernmodellen.
*   **Kontrollierte Umgebung:** Die Reproduzierbarkeit erlaubt es uns, die Auswirkungen kleiner Anpassungen an der KI-Logik oder den Trainingsparametern exakt zu messen.
*   **Datenbeschaffung:** Jede gespielte Runde generiert wertvolle Daten über Spielzustände, getroffene Züge und deren Ergebnisse. Diese Datensätze bilden die Lebensader für das spätere Training.
*   **Risikofreies Experimentieren:** Neue Strategien können in der Simulation ausgiebig getestet werden, ohne die Performance in einer Live-Umgebung zu gefährden.

### Die Choreografie der Daten: Wie die Simulation funktioniert

Die Orchestrierung dieser virtuellen Schlachten liegt in der Verantwortung des `trainingService.ts`. Dieser Dienst initiiert und verwaltet jede einzelne Spielinstanz, die für das Training benötigt wird:

1.  **Spielinitialisierung:** Zu Beginn jeder Simulation wird ein neues Spiel von Grund auf initialisiert. Dazu gehören das Mischen der Decks, das Austeilen der Starthände und die Festlegung des Startspielers.
2.  **Rundenbasierter Ablauf:** Das Spiel entfaltet sich Runde für Runde, analog zu einer echten Partie:
    *   **Zugphase:** Wenn ein Spieler – oder in diesem Fall eine KI – am Zug ist, wird der aktuelle Spielzustand (Karten auf der Hand, Spielfeld, Lebenspunkte, Runen, Friedhof etc.) an die entscheidungsfindende Instanz, den `aiService.ts`, übergeben.
    *   **Entscheidungsfindung:** Die KI analysiert diesen Spielzustand und wählt basierend auf ihrer aktuellen Strategie den vermeintlich besten Zug aus. Das kann das Ausspielen einer Karte, das Aktivieren einer Fähigkeit oder das Passen sein.
    *   **Zugausführung:** Der gewählte Zug wird im Spiel ausgeführt, was umgehend zu einer Aktualisierung des Spielzustands führt.
3.  **Spielende:** Eine Simulation endet, sobald eine der vordefinierten Siegbedingungen erfüllt ist – sei es, dass die Lebenspunkte eines Gegners auf Null sinken oder die Decks leer sind und keine Karten mehr gezogen werden können.
4.  **Ergebnisprotokollierung:** Nach jeder abgeschlossenen Partie werden wichtige Metadaten wie der Gewinner, die Spieldauer, die gespielten Züge und relevante Zwischenstände akribisch protokolliert. Diese Daten sind das Gold, das wir für das nachfolgende Training benötigen.

## Die Geburt der Strategie: Das KI-Training

### Vom Datensatz zur Entscheidungsfindung

Das KI-Training ist der eigentliche Lernprozess, bei dem unsere KI ihre Fähigkeit verfeinert, im Spiel optimale Entscheidungen zu treffen. Es nutzt die riesigen Datenmengen, die durch die Simulationen generiert wurden, um die internen Parameter und Modelle der KI so anzupassen, dass sie in zukünftigen Partien erfolgreicher agiert. Hierbei ist der `aiService.ts` der zentrale Knotenpunkt, der das KI-Modell und die Lernalgorithmen beherbergt.

1.  **Datensammlung:** Die oben beschriebenen Simulationen liefern kontinuierlich große Mengen an Spieldaten. Diese Daten umfassen detaillierte Spielzustände, die von der KI getroffenen Entscheidungen und die daraus resultierenden Ergebnisse (Gewinn oder Verlust).
2.  **Modellauswahl und der "BioVision"-Ansatz:** Je nach Komplexität und Anforderungen können verschiedene Lernansätze zum Einsatz kommen. Während grundlegende KIs auf festen Regeln basieren und fortgeschrittenere auf Monte-Carlo Tree Search (MCTS) setzen könnten, habe ich mich für einen innovativen, **biologisch inspirierten Ansatz** entschieden: das **Sparse Dictionary Learning** mit **k-Winner-Take-All (k-WTA)**. Dieser "BioVision"-Ansatz ist effizient und ahmt Aspekte der visuellen Verarbeitung im Gehirn nach:
    *   **Merkmale extrahieren:** Jeder Spielzug wird in einen numerischen "Feature-Vektor" übersetzt, der alle relevanten Informationen wie gespielte Karten, Token-Anzahl und Wetter enthält.
    *   **Muster-Wörterbuch lernen (Dictionary Learning):** Die KI lernt ein "Wörterbuch" aus fundamentalen Spielmustern (sogenannten Atomen). Statt sich jeden einzelnen Spielzug zu merken, lernt die KI die grundlegenden "Bausteine" guter oder schlechter Züge.
    *   **Spärliche Aktivierung (Sparsity):** Wenn die KI einen neuen Spielzug sieht, beschreibt sie diesen durch eine Kombination von nur sehr wenigen Mustern aus ihrem Wörterbuch. Dies ist inspiriert von der spärlichen Aktivierung von Neuronen im Gehirn und ist extrem ressourcenschonend.
    *   **k-Winner-Take-All (k-WTA):** Dieser Mechanismus gewährleistet die Spärlichkeit, indem nur die `k` (z.B. 16) relevantesten Muster aus dem Wörterbuch zur Beschreibung einer Situation herangezogen werden.
    *   **Entscheidung treffen:** Basierend auf dieser "spärlichen" Repräsentation trifft ein einfacher Klassifikator die Entscheidung, welche Karte aus der Hand des Spielers die höchste statistische Wahrscheinlichkeit hat, gegen die gegnerische Karte unter Berücksichtigung des aktuellen Wetters zu gewinnen.
3.  **Modellaktualisierung:** Basierend auf den gesammelten Daten und dem gewählten Lernalgorithmus wird das KI-Modell aktualisiert. Im Falle unseres "BioVision"-Ansatzes werden die "Atome" des Wörterbuchs und die Art ihrer Kombination verfeinert.
4.  **Evaluierung:** Nach jeder Trainingsphase wird die neue Version der KI gegen ihre Vorgängerversion oder eine Benchmark-KI in weiteren Simulationen getestet, um ihre Leistungsverbesserung objektiv zu bewerten.
5.  **Iterativer Prozess:** Der gesamte Prozess aus Datensammlung, Training und Evaluierung ist iterativ. Die KI lernt kontinuierlich, indem sie neue Daten generiert und ihr Modell immer wieder verfeinert.

### Warum die KI nie aufhört zu lernen

Das Training ist nicht nur ein einmaliger Schritt, sondern ein kontinuierlicher Zyklus, der aus mehreren Gründen unerlässlich ist:

*   **Leistungsverbesserung:** Das primäre Ziel ist es, die KI kontinuierlich zu optimieren, damit sie immer bessere strategische Entscheidungen trifft und eine höhere Gewinnwahrscheinlichkeit gegen menschliche Spieler oder andere KIs hat.
*   **Anpassungsfähigkeit:** Durch Training kann die KI lernen, sich an unterschiedliche Spielstile, Deckzusammenstellungen und Metas anzupassen, was sie zu einem vielseitigen Gegner macht.
*   **Entdeckung neuer Strategien:** Eine gut trainierte KI ist in der Lage, Strategien zu entdecken, die für menschliche Spieler möglicherweise nicht offensichtlich waren, und so das Spiel auf neue Weisen zu bereichern.
*   **Robuste Entscheidungsfindung:** Das Training hilft der KI, auch in komplexen oder unerwarteten Spielsituationen robuste und logische Entscheidungen zu treffen.
*   **Automatisierung der Entwicklung:** Statt jede Regel manuell zu programmieren, lernt die KI durch Training selbstständig, was zu einer effizienteren und skalierbareren Entwicklung führt.

## Ein Blick hinter die Kulissen: Die Architektur und ihre Werkzeuge

Als Entwickler war es mir wichtig, eine robuste und zugleich transparente Architektur zu schaffen. Die gesamte Anwendung ist eine Single-Page Application (SPA), die auf React.js und TypeScript basiert. Dies ermöglicht eine deklarative und komponentenbasierte Entwicklung, die die Wartbarkeit erheblich verbessert. Vite als Build-Tool sorgt für eine blitzschnelle Entwicklungsumgebung.

Die Kernfunktionalität ist in dedizierten Diensten gekapselt:

*   Der `trainingService.ts` ist das Rückgrat unserer Simulations-Engine.
*   Der `aiService.ts` ist der zentrale Dienst für die KI-Logik und das Training, der die Entscheidungsfindung des trainierten Modells orchestriert.
*   Eine Besonderheit ist der `geminiService.ts`, der die Google Gemini API integriert. Nach jeder abgeschlossenen Partie verwandelt ein "epischer Barde" (unterstützt durch Gemini) den Kampfverlauf in eine einzigartige, spannende Geschichte, die das Spielerlebnis auf eine ganz neue Ebene hebt.

## Fazit

Die Kombination aus schnellen, datengenerierenden Simulationen und einem iterativen, biologisch inspirierten Trainingsprozess ermöglicht es dem "Runenkrieg"-KI-System, sich kontinuierlich zu verbessern und ein immer herausfordernderer Gegner zu sein. Als Ralf Krümmel bin ich stolz auf die Transparenz und Effizienz dieses Ansatzes, der zeigt, wie intelligente Agenten in komplexen Spielumgebungen entstehen können. Das "Runenkrieg KI-Kartenspiel" ist somit nicht nur ein Spiel, sondern auch eine interaktive Lernplattform, die die Prinzipien des maschinellen Lernens erlebbar macht.

## Quellen

*   React.js: [https://react.dev/](https://react.dev/)
*   TypeScript: [https://www.typescriptlang.org/](https://www.typescriptlang.org/)
*   Vite: [https://vitejs.dev/](https://vitejs.dev/)
*   Tailwind CSS: [https://tailwindcss.com/](https://tailwindcss.com/)
*   Google Gemini API: [https://ai.google.dev/models/gemini](https://ai.google.dev/models/gemini)
*   MIT License: [https://opensource.org/licenses/MIT](https://opensource.org/licenses/MIT)

---

*Dieser Artikel wurde von Ralf Krümmel der Entwickler verfasst und mit Hilfe von künstlicher Intelligenz erstellt.*
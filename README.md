# Benutzerhandbuch: Runenkrieg KI-Kartenspiel

_Willkommen bei Runenkrieg, einem spannenden digitalen Kartenspiel, in dem Sie sich einem intelligenten KI-Gegner stellen. Dieses Handbuch führt Sie durch die Regeln des Spiels, die Benutzeroberfläche und erklärt, wie Sie die künstliche Intelligenz (KI) des Gegners trainieren können, um ein noch herausfordernderes Spielerlebnis zu schaffen. Ihr Ziel ist es, die Lebenspunkte (Tokens) Ihres Gegners auf Null zu reduzieren, indem Sie strategisch Karten ausspielen und die Elemente sowie Heldenboni zu Ihrem Vorteil nutzen. Nach jeder Partie fasst ein epischer Barde (unterstützt durch Gemini) Ihre Heldentaten in einer einzigartigen Geschichte zusammen._

## 1. Erste Schritte: Installation und Start

Um das Runenkrieg KI-Kartenspiel lokal zu starten, benötigen Sie **Node.js** auf Ihrem System.

Führen Sie die folgenden Schritte in Ihrer Kommandozeile aus:

1.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```
2.  **Gemini API-Schlüssel setzen (optional, für Bardengeschichten):**
    Erstellen Sie eine Datei namens `.env.local` im Hauptverzeichnis des Projekts und fügen Sie Ihren Gemini API-Schlüssel hinzu:
    ```
    GEMINI_API_KEY=Ihre_Gemini_API_Key_hier
    ```
    *Hinweis:* Sie können das Spiel auch ohne Gemini API-Schlüssel spielen. Die Geschichtenfunktion ist dann deaktiviert, kann aber später im Spiel aktiviert und konfiguriert werden.
3.  **Anwendung starten:**
    ```bash
    npm run dev
    ```
    Die Anwendung wird in Ihrem Webbrowser geöffnet, normalerweise unter `http://localhost:3000`.

## 2. Die Benutzeroberfläche (GUI) im Überblick

Die Anwendung bietet zwei Hauptansichten: das **Spielbrett** und das **KI-Trainingszentrum**.

### 2.1 Das Spielbrett

Das Spielbrett ist die Hauptansicht, in der Sie gegen die KI antreten. Es ist in mehrere Bereiche unterteilt:

*   **Obere Leiste:**
    *   **KI-Informationen:** Zeigt den Namen des KI-Helden und seine aktuellen Tokens an.
    *   **Wetteranzeige:** Zeigt das aktuelle Wetter der Runde an, das Boni und Mali für bestimmte Elemente beeinflusst.
    *   **Gemini-Einstellungen:** Eine Checkbox "Gemini aktivieren" und ein Eingabefeld für den "Gemini API Key". Hier können Sie die Story-Generierung aktivieren/deaktivieren und Ihren API-Schlüssel eingeben.
    *   **"KI Training"-Button:** Wechselt zur Ansicht des KI-Trainingszentrums.
*   **KI-Hand:** Zeigt die verdeckten Karten der KI an. Sie können die Karten nicht sehen, aber die Anzahl der Karten in der Hand der KI ist sichtbar.
*   **Gespielte Karten:** In der Mitte des Bildschirms sehen Sie die von Ihnen und der KI in der aktuellen Runde gespielten Karten. Der Gewinner der Runde wird visuell hervorgehoben.
*   **Ihre Hand:** Zeigt Ihre verfügbaren Karten an. Klicken Sie auf eine Karte, um sie zu spielen. Wenn Sie den Mauszeiger über eine Karte bewegen, sehen Sie Details zu ihrer Stärke und ihrem Elementeffekt.
*   **Untere Leiste:**
    *   **Ihre Informationen:** Zeigt Ihren Namen ("Du"), den Namen Ihres Helden und Ihre aktuellen Tokens an.
    *   **Statusanzeige:** Informiert Sie über den aktuellen Spielstatus (z.B. "Du bist am Zug", "Runde X: Spieler gewinnt den Stich!").

### 2.2 Das KI-Trainingszentrum

Diese Ansicht ist für das Management und Training der KI vorgesehen. Sie ist in folgende Bereiche gegliedert:

*   **Titel und Beschreibung:** "KI Trainingszentrum" und eine kurze Erklärung.
*   **Aktueller KI-Status:** Informiert Sie, ob die KI bereits trainiert ist oder zufällige Züge macht.
*   **Schritt 1: Simulation:**
    *   **Eingabefeld "Anzahl der Simulationen":** Hier geben Sie ein, wie viele Spiele die KI simulieren soll, um Daten zu sammeln.
    *   **"Simuliere X Spiele"-Button:** Startet den Simulationsprozess.
    *   **Statusmeldung:** Zeigt den Fortschritt der Simulation an.
*   **Schritt 2: Training:**
    *   **"Trainiere KI mit Daten"-Button:** Startet den Trainingsprozess basierend auf den gesammelten Simulationsdaten.
    *   **Statusmeldung:** Zeigt den Fortschritt des Trainings an.
*   **Simulationsanalyse:** Zeigt detaillierte Statistiken der durchgeführten Simulationen an (Siegquoten, häufigste Karten, Wetter etc.).
*   **Trainingsanalyse:** Zeigt Ergebnisse des KI-Trainings an, einschließlich der Abdeckung von Spielkontexten und dem "stärksten Szenario", das die KI gelernt hat.
*   **"Zurück zum Spiel"-Button:** Wechselt zurück zur Spielbrett-Ansicht.

### 2.3 Neue Kartentypen, Elemente und Synergien

Runenkrieg wurde um zusätzliche Kartentypen und Elemente erweitert, um langfristige Strategien zu belohnen:

*   **Kartentypen:** Artefakte (dauerhafte Buffs), Beschwörungen (temporäre Einheiten), Runensteine (einmalige globale Effekte), Verbündete (Synergie-Verstärker) sowie Segen/Flüche (zeitlich begrenzte Modifikatoren).
*   **Neue Elemente:** Schatten, Licht, Chaos und zusätzliche Kombinationseffekte für bestehende Elemente wie Wasser + Blitz → Überladung oder Feuer + Erde → Lavafeld.
*   **Fähigkeitsmechaniken:** Karten können Ketteneffekte, Elementarresonanz, Überladung, Fusion oder Wetterbindung besitzen. Diese Mechaniken werden in der Karten-Detailansicht erläutert.
*   **Synergie-Anzeige:** Sobald du eine Karte hoverst, siehst du neben dem Elementeffekt auch den Kartentyp, aktive Mechaniken sowie mögliche Laufzeiten oder Ladungen.

## 3. Das Spiel spielen: Schritt-für-Schritt-Anleitung

Runenkrieg ist ein rundenbasiertes Kartenspiel, bei dem Sie gegen eine KI antreten. Ziel ist es, die Lebenspunkte (Tokens) Ihres Gegners auf 0 zu reduzieren, bevor er Ihre auf 0 reduziert. Beide Spieler starten mit 5 Tokens.

### 3.1 Eine neue Partie starten

1.  Beim ersten Start der Anwendung beginnt automatisch eine neue Partie.
2.  Wenn eine Partie beendet ist, erscheint ein "Spiel Vorbei!"-Bildschirm. Klicken Sie auf den Button **"Neues Spiel"**, um eine weitere Partie zu beginnen.

### 3.2 Eine Runde spielen

1.  **Warten auf Ihren Zug:** Die Statusanzeige in der unteren Leiste informiert Sie, wenn Sie am Zug sind ("Du bist am Zug. Wähle eine Karte.").
2.  **Karte auswählen:** Klicken Sie auf eine der Karten in Ihrer Hand, um sie auszuspielen. Jede Karte hat ein **Element** (z.B. Feuer, Wasser) und eine **Fähigkeit** (z.B. Funke, Avatar), die ihre Grundstärke bestimmt.
3.  **KI kontert:** Nachdem Sie eine Karte gespielt haben, wählt die KI automatisch eine Karte aus ihrer Hand aus. Auch ohne Training nutzt sie nun Synergieerkennung, Elementarrelationen und Risikobewertungen, um passende Konter zu finden.
4.  **Rundenauswertung:**
    *   Beide gespielten Karten werden in der Mitte des Bildschirms angezeigt.
    *   Das **Wetter** für die aktuelle Runde wird bestimmt und angezeigt.
    *   Die **Gesamtstärke** beider Karten wird berechnet. Diese Stärke setzt sich zusammen aus:
        *   **Grundwert:** Die feste Stärke der Fähigkeit (z.B. "Avatar" hat Stärke 13).
        *   **Wetter-Bonus:** Das Wetter kann bestimmte Elemente stärken oder schwächen (z.B. Feuerkarten sind im Regen weniger effektiv).
        *   **Element-Bonus:** Elemente haben Stärken und Schwächen gegeneinander (z.B. Wasser ist stark gegen Feuer).
        *   **Helden-Bonus:** Ihr Held gibt Ihnen einen Bonus, wenn Sie eine Karte spielen, die zu seinem Element gehört.
        *   **Moral-Bonus:** Sie erhalten einen Stärkebonus, wenn Sie mehr Tokens besitzen als Ihr Gegner.
        *   **Synergie-Boni:** Ketteneffekte, Elementarresonanz und Fusionsmöglichkeiten erhöhen die Gesamtstärke, wenn passende Karten bereits gespielt oder auf der Hand sind.
    *   Der Gewinner der Runde wird ermittelt und seine Karte wird visuell hervorgehoben.
5.  **Effekte anwenden & Karten nachziehen:**
    *   Die Gewinnerkarte der Runde löst ihren **Element-Effekt** aus, der die Token-Anzahl der Spieler beeinflusst (z.B. Feuer reduziert Gegnertokens, Luft erhöht eigene Tokens).
    *   Danach ziehen beide Spieler eine Karte vom Stapel nach, solange dieser nicht leer ist und ihre Hand nicht voll ist (max. 4 Karten).

#### Aktive Fähigkeitsmechaniken

*   **Ketteneffekte:** Gewinne zwei Runden in Folge mit Karten, die Ketteneffekte besitzen, und dein Gegner verliert einen zusätzlichen Token durch den Folgeangriff.
*   **Elementarresonanz:** Wiederhole dein Element. Nach drei erfolgreichen Einsätzen desselben Elements erhältst du dank der Resonanz einen weiteren Token.
*   **Überladung:** Mächtige Karten mit Überladung zahlen immer einen Preis – nach dem Ausspielen sinkt der eigene Token-Vorrat um 1, unabhängig vom Rundenergebnis.
*   **Wetterbindung:** Karten, die an Wetter gebunden sind, verstärken oder schwächen sich sofort um Token entsprechend des aktuellen Wetters.
*   **Verbündeter:** Unterstützerkarten schenken dir einen zusätzlichen Token, wenn sich noch Karten desselben Elements in deiner Hand befinden.
*   **Segen/Fluch:** Liegt dein Tokenstand zurück, heilt der Segen einen Token. Liegt er vorn, schwächt der Fluch den Gegner um einen Token.
*   **Fusion:** Besitzt du zwei Karten mit der Mechanik „Fusion“, klicke sie nacheinander an, um eine neue, verstärkte Karte zu erschaffen. Ein erneuter Klick auf die zuerst gewählte Karte bricht die Fusion ab und spielt die Karte normal aus.

### 3.3 Spielende

Das Spiel endet, wenn eine der folgenden Bedingungen erfüllt ist:

*   Ein Spieler hat **0 oder weniger Tokens**. Der Spieler mit mehr Tokens gewinnt.
*   Beide Spieler haben **keine Karten mehr auf der Hand** und der Nachziehstapel ist leer. Der Spieler mit mehr Tokens gewinnt.
*   Bei **exakt gleicher Token-Anzahl** am Ende ist das Spiel ein Unentschieden.

Nach dem Spiel wird der "Spiel Vorbei!"-Bildschirm angezeigt. Wenn Gemini aktiviert ist, schreibt ein Barde eine Geschichte über Ihre Schlacht.

## 4. KI-Training: Die Intelligenz Ihres Gegners formen

Das KI-Trainingszentrum ermöglicht es Ihnen, die künstliche Intelligenz des Gegners zu verbessern, indem Sie sie durch Simulationen lernen lassen. Dies geschieht in zwei Hauptschritten:

### 4.1 Schritt 1: Simulationen durchführen

1.  **Wechseln Sie zum KI-Trainingszentrum:** Klicken Sie auf dem Spielbrett oben rechts auf den Button **"KI Training"**.
2.  **Anzahl der Simulationen festlegen:** Im Bereich "Schritt 1: Simulation" sehen Sie ein Eingabefeld "Anzahl der Simulationen". Geben Sie hier ein, wie viele Spiele die KI im Schnelldurchlauf spielen soll (z.B. 1000, 5000, 10000). Je mehr Simulationen, desto mehr Daten stehen für das Training zur Verfügung.
3.  **Simulation starten:** Klicken Sie auf den Button **"Simuliere X Spiele"**. Die Anwendung wird nun die angegebene Anzahl von Spielen im Hintergrund durchführen. Währenddessen sehen Sie einen Lade-Spinner und eine Statusmeldung.
4.  **Simulationsanalyse:** Nach Abschluss der Simulationen wird eine "Simulationsanalyse" angezeigt. Diese gibt Ihnen Einblicke in die Ergebnisse der simulierten Spiele, z.B. die Siegquoten von Spieler und KI, die häufigsten gespielten Karten oder das beliebteste Wetter. Dies hilft Ihnen zu verstehen, welche Daten gesammelt wurden.

### 4.2 Schritt 2: KI trainieren

1.  **Training starten:** Nachdem Sie Simulationen durchgeführt haben und "Simulation abgeschlossen!" angezeigt wird, klicken Sie im Bereich "Schritt 2: Training" auf den Button **"Trainiere KI mit Daten"**.
2.  **Trainingsprozess:** Die KI analysiert nun die gesammelten Spieldaten, um Muster zu erkennen und eine Strategie zu entwickeln. Sie lernt, welche Karten in welchen Situationen die besten Antworten sind. Dieser Prozess ist vom menschlichen Gehirn inspiriert und verwendet einen effizienten, biologisch inspirierten Ansatz namens **Sparse Dictionary Learning**.
3.  **Trainingsanalyse:** Nach Abschluss des Trainings wird eine "Trainingsanalyse" angezeigt. Diese zeigt Ihnen:
    *   **Kontexte insgesamt:** Die Anzahl der verschiedenen Spielsituationen, die die KI gelernt hat.
    *   **Gut abgedeckte Kontexte:** Wie viele dieser Situationen mit ausreichend Daten trainiert wurden.
    *   **Kontexte mit wenig Daten:** Situationen, für die mehr Simulationen hilfreich wären.
    *   **Ø beste Siegquote:** Die durchschnittliche Siegquote, die die KI in den gelernten Kontexten erzielen kann.
    *   **Stärkstes Szenario:** Ein Beispiel für eine Spielsituation, in der die KI eine besonders hohe Siegquote gelernt hat, und welche Karte sie dort am besten einsetzt.
4.  **KI-Status aktualisiert:** Der "Aktueller KI-Status" wird auf "KI wurde mit neuen Daten trainiert und ist aktiv." aktualisiert. Die KI wird nun ihre neu erlernte Strategie in zukünftigen Spielen anwenden.

### 4.3 Adaptive KI ohne Training

Auch im untrainierten Zustand bewertet die KI nun Karten anhand von Elementrelationen, Synergien (z.B. Überladung oder Fusion), Wettervorteilen und Risikoabschätzungen. Sie versucht, thematische Decks des Gegners zu erkennen und kontert bevorzugt dominante Elemente. Ein Training mit Simulationsdaten verbessert diese Strategie zusätzlich.

### 4.4 Zurück zum Spiel

Klicken Sie auf den Button **"Zurück zum Spiel"**, um zum Spielbrett zurückzukehren und gegen die nun trainierte KI anzutreten.

## 5. Gemini-Integration: Die Sage von Runenkrieg

Das Runenkrieg-Spiel bietet die Möglichkeit, nach jeder Partie eine einzigartige Geschichte über den Kampfverlauf zu generieren, geschrieben von einem "epischen Barden" (unterstützt durch Google Gemini).

### 5.1 Gemini aktivieren und konfigurieren

1.  **Auf dem Spielbrett:** In der oberen Leiste des Spielbretts finden Sie eine Checkbox **"Gemini aktivieren"** und ein Eingabefeld **"Gemini API Key"**.
2.  **Aktivieren:** Setzen Sie ein Häkchen bei "Gemini aktivieren".
3.  **API-Schlüssel eingeben:** Geben Sie Ihren persönlichen Gemini API-Schlüssel in das Textfeld ein. Dieser Schlüssel wird lokal in Ihrem Browser gespeichert, sodass Sie ihn nicht bei jedem Start neu eingeben müssen.
    *   *Hinweis:* Wenn Sie keinen API-Schlüssel haben oder Gemini nicht nutzen möchten, lassen Sie die Checkbox deaktiviert. Es wird dann keine Geschichte generiert.

### 5.2 Geschichten generieren

1.  Sobald Gemini aktiviert und ein gültiger API-Schlüssel hinterlegt ist, wird nach jedem Spielende automatisch versucht, eine Geschichte zu generieren.
2.  Auf dem "Spiel Vorbei!"-Bildschirm sehen Sie einen Lade-Spinner und die Meldung "Der Barde schreibt die Geschichte Eures Kampfes...".
3.  Nach kurzer Zeit erscheint die generierte Geschichte im Bereich **"Die Sage von Runenkrieg"**.
4.  Sollte es Probleme bei der Generierung geben (z.B. ungültiger API-Schlüssel, Netzwerkfehler), erhalten Sie eine entsprechende Fehlermeldung anstelle der Geschichte.

## 6. Fehlerbehebung und Häufig gestellte Fragen (FAQ)

### 6.1 Das Spiel startet nicht oder zeigt Fehler an.
*   **Prüfen Sie die Installation:** Stellen Sie sicher, dass Sie alle Abhängigkeiten mit `npm install` installiert haben.
*   **Node.js Version:** Vergewissern Sie sich, dass Node.js korrekt installiert ist und eine unterstützte Version verwendet wird.
*   **Browser-Konsole:** Öffnen Sie die Entwicklerkonsole Ihres Browsers (meist F12) und suchen Sie nach Fehlermeldungen. Diese können Hinweise auf das Problem geben.

### 6.2 Die KI macht nur zufällige Züge.
*   Die KI ist standardmäßig nicht trainiert. Wechseln Sie zum **"KI Training"**-Zentrum und führen Sie die Schritte zur **Simulation** und zum **Training** durch, um die KI zu verbessern.
*   Überprüfen Sie den "Aktueller KI-Status" im Trainingszentrum. Er sollte "KI wurde mit neuen Daten trainiert und ist aktiv." anzeigen, wenn das Training erfolgreich war.

### 6.3 Es wird keine Bardengeschichte generiert.
*   **Gemini aktiviert?** Stellen Sie sicher, dass die Checkbox "Gemini aktivieren" auf dem Spielbrett angehakt ist.
*   **API-Schlüssel vorhanden?** Überprüfen Sie, ob Sie einen gültigen Gemini API-Schlüssel in das entsprechende Feld eingegeben haben. Ein leerer oder ungültiger Schlüssel verhindert die Generierung.
*   **Netzwerkverbindung:** Eine aktive Internetverbindung ist erforderlich, um die Gemini-API zu kontaktieren.
*   **Fehlermeldung:** Achten Sie auf die Meldung auf dem "Spiel Vorbei!"-Bildschirm. Sie gibt Aufschluss darüber, warum keine Geschichte generiert werden konnte.

### 6.4 Was bedeuten die Werte in der Simulations- und Trainingsanalyse?
*   **Siegquote:** Der Prozentsatz der Runden oder Spiele, die ein Spieler (oder die KI) gewonnen hat.
*   **Ø Token nach Runden:** Der durchschnittliche Token-Stand des Spielers/der KI nach jeder Runde in den Simulationen.
*   **Kontexte:** Bezieht sich auf spezifische Spielsituationen (Kombination aus gespielter Spielerkarte, Wetter, Helden und Token-Differenz), für die die KI gelernt hat, wie sie am besten reagiert.
*   **Stärkstes Szenario:** Zeigt eine spezifische Spielsituation, in der die KI die höchste Siegwahrscheinlichkeit gelernt hat, wenn sie eine bestimmte Karte spielt.


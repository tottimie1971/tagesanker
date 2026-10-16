# Tagesanker

Tagesanker ist eine deutschsprachige, reizarm gestaltete Tagesplan-App. Sie speichert Aufgaben und Punkte lokal im Browser und kann als PWA installiert werden.

## Funktionen

- Tagesaufgaben mit optionaler Uhrzeit und flexible Aufgaben ohne feste Zeit
- 10 Punkte für jeden erstmalig erledigten Schritt; kein Streak- oder Strafsystem
- kurze Tipps, situationsbezogene Rückmeldungen und ein freiwilliger Check-in
- Zwei-Minuten-Starttimer für den Einstieg in eine Aufgabe
- lokale Speicherung und Offline-App-Shell über den Service Worker
- optionale Erinnerung nach 30 Minuten, solange die Seite geöffnet bleibt
- optionale Synchronisierung zwischen Geräten mit einem eigenen Supabase-Konto

## Start

Für Installation und Offline-Betrieb muss die App über HTTPS bereitgestellt werden, weil Browser Service Worker in `file://`-Seiten nicht zulassen. Auf Android öffnest du die HTTPS-Adresse in Chrome und wählst „App installieren“ oder „Zum Startbildschirm hinzufügen“. Auf dem iPhone öffnest du sie in Safari, tippst auf „Teilen“ und wählst „Zum Home-Bildschirm“.

Für einen lokalen Test im Projektordner kannst du `python -m http.server 8000` starten und anschließend `http://localhost:8000` öffnen. Diese lokale Adresse funktioniert nur auf diesem Computer; für die Installation auf dem Handy braucht die App eine HTTPS-Adresse.

## Veröffentlichung

Das öffentliche Repository `tottimie1971/tagesanker` wird über GitHub Pages direkt aus dem Branch `main` und dem Stammordner veröffentlicht. Änderungen an `main` werden automatisch übernommen. Die App-Adresse lautet `https://tottimie1971.github.io/tagesanker/`.

Der App-Code ist in diesem Fall öffentlich einsehbar. Aufgaben, Punkte und Erinnerungszeiten werden nicht mitveröffentlicht.

## Cloud-Synchronisierung einrichten

Die App verwendet Supabase Auth und eine Tabelle, die durch Row Level Security auf das angemeldete Konto beschränkt ist. Solange die Projektkonfiguration leer ist, bleibt die App lokal nutzbar.

1. Erstelle ein Supabase-Projekt unter [supabase.com](https://supabase.com).
2. Öffne im Supabase-Dashboard den SQL Editor und führe `supabase/setup.sql` aus.
3. Kopiere die Project URL und den `anon`-/Publishable Key aus **Project Settings → API Keys** in `supabase-config.js`.
4. Trage in **Authentication → URL Configuration** als Site URL `https://tottimie1971.github.io/tagesanker/` ein. Ergänze als Redirect URLs `https://tottimie1971.github.io/tagesanker/**` und `http://localhost:8000/**`.
5. Veröffentliche `supabase-config.js` im öffentlichen GitHub-Repository. Der Publishable-/Anon-Key ist für Browser-Apps gedacht; Row Level Security schützt die Daten.
6. Öffne die veröffentlichte App, erstelle mit deiner E-Mail-Adresse ein Konto und bestätige den Link in der E-Mail.

**Nie** den `service_role`-Key oder ein Datenbankpasswort in `supabase-config.js`, GitHub oder den Browser-Code eintragen. Diese Schlüssel umgehen den Zugriffsschutz. Der Supabase-E-Mail-Versand für neue Projekte ist begrenzt; für häufiger genutzte Konten kann ein eigener SMTP-Dienst erforderlich sein.

Nach der Anmeldung werden Plan und Punkte beim Öffnen, nach Änderungen, bei erneutem Onlinegehen und über „Jetzt synchronisieren“ abgeglichen. Löschungen werden mitgeführt. Gleichzeitige Änderungen an derselben Aufgabe werden anhand des letzten Änderungszeitpunkts zusammengeführt; die Punktzahl wird nicht verringert.

Aufgaben und Punkte bleiben zusätzlich in IndexedDB und als Rückfallkopie lokal. Die App bittet den Browser, diesen Speicher vor automatischer Bereinigung zu schützen; die Entscheidung hängt vom Gerät und Browser ab. Löschen der Browserdaten entfernt die lokale Kopie, aber nicht den Cloud-Stand. Eine Kontolöschung ist in der App noch nicht eingebaut. Zuverlässige Hintergrund-Push-Mitteilungen sind ebenfalls noch nicht enthalten.
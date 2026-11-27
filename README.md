> **Kaizen-Gym**: versione per tutti di Kaizen, in sviluppo e non pubblicata. Nasce come copia dell'app personale del 27/11/2026, senza dati personali, con un progetto Supabase separato e senza deploy automatico. Piano: documento "Kaizen per tutti".

# Metodo Kaizen

Web app installabile (PWA) per registrare gli allenamenti nella palestra di casa e seguire la **costanza** nel tempo.
Tutto in italiano, pensata per il telefono, funziona offline. I dati restano sul dispositivo (IndexedDB), senza login e senza server.

- **Kaizen decide quanto:** +1 ripetizione o il più piccolo aumento di carico, sempre 2-3 ripetizioni di margine.
- **Presentarsi decide se:** nei giorni no c'è la seduta minima (10-15 minuti), che conta come seduta fatta.

Stack: Vite, React, TypeScript, Tailwind CSS, Dexie (IndexedDB), Recharts, vite-plugin-pwa.

## Avvio in locale

Serve Node.js 20 o più recente.

```bash
npm install
npm run dev        # sviluppo su http://localhost:5173
npm test           # test della logica (progressione, costanza, calcio)
npm run build      # build di produzione in dist/
npm run preview    # prova la build (service worker compreso) su http://localhost:4173
```

Per provarla dal telefono sulla stessa rete Wi-Fi: `npm run dev -- --host` e apri l'indirizzo mostrato.
L'installazione e l'offline funzionano solo in HTTPS (o su localhost), quindi per l'uso vero serve il deploy.

## Deploy su GitHub Pages

L'app va compilata prima di essere pubblicata: se Pages pubblica direttamente `main` vedi una pagina bianca.
Per questo c'è il workflow `.github/workflows/deploy.yml`, che a ogni push su `main` esegue i test, compila l'app
con il percorso giusto (`/Kaizen/`) e mette il risultato sul branch **`gh-pages`**.

Impostazione una tantum, dopo il primo giro del workflow (quando il branch `gh-pages` esiste):
1. Su GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. Branch: **`gh-pages`**, cartella **`/ (root)`**, poi **Save**.
3. Dopo un minuto l'app è su `https://<tuo-utente>.github.io/Kaizen/`.

Note:
- Pages su repository privati richiede un piano GitHub a pagamento; con il piano gratuito il repository deve essere pubblico.
- Per ripubblicare senza modifiche: **Actions → Build e pubblica su gh-pages → Run workflow**.

## Installazione sul telefono

- **iPhone (Safari):** apri l'indirizzo dell'app → tasto Condividi → **Aggiungi alla schermata Home**.
- **Android (Chrome):** apri l'indirizzo → menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").

Dopo la prima apertura l'app funziona anche senza connessione. Gli aggiornamenti si installano da soli alla riapertura successiva.

Su iPhone la vibrazione a fine recupero non è supportata da Safari: suona un breve bip (tieni la suoneria attiva).

## Backup dei dati

I dati vivono **solo** nel browser del telefono. Se disinstalli l'app o cancelli i dati del browser, li perdi. Quindi:

- **Altro → Dati e backup → Esporta tutto (JSON)** scarica un file con tutto: sedute, modelli, misure, partite, revisioni.
  Salvalo su Drive o iCloud, oppure mandalo a te stesso.
- **Importa backup (JSON)** sostituisce i dati attuali con quelli del file (utile per cambiare telefono).
- **Esporta allenamenti (CSV)** crea un file con una riga per serie, separato da `;`, che si apre in Excel o Fogli.
- **Copia riepilogo per il coach** copia un testo markdown con l'ultima seduta o la settimana, da incollare in chat.
- Se l'ultimo backup ha più di 14 giorni, la schermata Oggi te lo ricorda.
- Le **foto dei progressi** non entrano nel JSON (sarebbe enorme): hanno un backup ZIP separato in **Altro → Foto dei progressi**
  (Esporta ZIP / Importa ZIP). L'importazione aggiunge le foto mancanti e salta quelle già presenti.

## Dati precaricati

Al primo avvio l'app carica: inizio progetto 16/11/2026, altezza 172 cm, le misure del 16/11, i modelli A, B, C e Minima,
la Seduta A del 16/11, le sedute saltate del 19/11 e 22/11, la malattia del 23/11, l'allenamento di calcio del mercoledì
e le partite del 20/11 e 27/11. Tutto si modifica dall'app.

## Regole dell'app

- **Costanza:** obiettivo 3 sedute a settimana. Ogni giorno di malattia toglie 1 seduta dal previsto. La striscia conta le settimane
  consecutive con almeno 2 sedute (o con il previsto ridotto raggiunto). La settimana in corso non rompe la striscia finché non finisce.
- **Progressione:** se l'ultima volta hai completato tutte le serie con RIR ≥ 2 → +1 ripetizione fino al massimo della fascia, poi
  il più piccolo aumento di carico e si torna al minimo della fascia. RIR sotto 2, serie non completate o RIR non segnato → stesso
  obiettivo. Dolore → nessuna progressione. Fermo da più di 7 giorni → circa -10% di carico.
- **Calcio:** avviso se fai gambe il giorno della partita, il giorno prima, oppure martedì o giovedì in una settimana con partita il venerdì.

- **Stallo:** 3 sedute di fila senza progressi (stesse ripetizioni e stesso carico, oppure RIR sotto 2) → seduta di scarico a circa -10%,
  poi si riparte dal carico di prima. Se lo stallo si ripete dopo lo scarico, l'app suggerisce una variante. Dolore in 2 sedute di fila
  sullo stesso esercizio → sostituiscilo e senti un medico o un fisioterapista. L'app suggerisce soltanto: la scheda la cambi tu.
- **Mai a cedimento:** nessuna funzione spinge test di massimale. Sfide personalizzate con parole come "cedimento" o "massimale" vengono rifiutate.

## Novità della versione 2

L'aggiornamento non cancella niente: lo schema del database passa alla versione 2 aggiungendo solo tabelle nuove,
e una migrazione completa i dati esistenti (categorie delle sedute saltate, bilancieri, esercizi per il rank).

- **Foto dei progressi** (Altro → Foto): fronte e lato ogni 4 settimane, compresse a circa 1080 px. In fase di scatto vedi la foto
  precedente in trasparenza per metterti nella stessa posizione. Confronto affiancato o con cursore. Backup ZIP separato.
- **Promemoria** (Altro → Promemoria): scegli giorni, ora e durata e scarica un file `.ics` da importare nel calendario (vedi sotto).
  In Oggi compare "Oggi è giorno di palestra"; dopo le 21:00, se non hai registrato niente, la Seduta minima diventa il pulsante principale.
- **Sfide dure** (Altro → Sfide): si sbloccano dopo almeno 8 settimane dall'inizio e con costanza ≥ 80% nelle ultime 4 settimane.
  Al massimo una ogni 3 settimane, mai nelle 48 ore prima di una partita né il giorno dopo. 4 sfide pronte più quelle tue.
  Una sfida riuscita diventa una medaglia nel barattolo; una non riuscita si segna e basta, senza penalità.
- **Calcolatore dischi**: in Impostazioni → Attrezzatura metti dischi e bilancieri. Durante la seduta, sugli esercizi col bilanciere,
  il pulsante 🧮 dice quali dischi mettere per lato (o il carico più vicino sotto e sopra) e calcola il totale dai dischi.
  La progressione usa i salti davvero possibili con i tuoi dischi.
- **Analisi delle sedute saltate** (Progressi → Saltate): ogni seduta saltata ha una categoria (videogiochi, sonno, impegni, lavoro,
  pigrizia, altro); grafico per mese e la frase "Il tuo nemico n.1".
- **Lettera del giorno 1**: la scrivi al primo avvio. Puoi modificarla, ma l'originale resta. Ricompare a schermo intero dopo una seduta
  saltata e quando sei fermo da più di 5 giorni (i giorni di malattia non contano).
- **Barattolo dei successi** (Altro → Successi): ogni successo è ✅ Verificato, ⚠ Non confermato dai dati o 📝 Dichiarato.
  Record e sfide riuscite entrano da soli. "Apri il barattolo" ne pesca uno a caso.
- **Rank** (Progressi → Rank): per panca, trazioni, dip, curl EZ, stacco e military l'app stima il massimale dalla serie migliore
  delle ultime 4 settimane (carico × (1 + (ripetizioni + RIR) / 30), solo serie da 1 a 10 ripetizioni) e lo divide per il peso corporeo.
  Trazioni e dip contano peso corporeo più zavorra. 23 livelli da Rame a Super Lega, soglie modificabili in Impostazioni.
  Il rank generale è la media dei rank. Non serve mai fare test di massimale: bastano le sedute normali.
- Il **riepilogo per il coach** e il **punto del mese** includono stallo, dolore, analisi delle saltate e successi nuovi.

## Novità della versione 3

Anche qui il database passa alla versione 3 aggiungendo solo la tabella degli obiettivi: niente viene cancellato.

- **Obiettivi** (Altro → Obiettivi): al massimo 3 attivi. Costanza (settimane di fila), Esercizio (ripetizioni e carico),
  Rank (livello successivo), Corpo (peso o vita, con ritmo massimo di 0,5 kg a settimana) e Abitudine (settimane senza sedute saltate).
  Ogni obiettivo si divide in tappe piccole che seguono la progressione dell'app; in Oggi vedi solo la prossima tappa.
  Le tappe e i traguardi entrano da soli nel barattolo come ✅ Verificato. Nessuna scadenza, solo un ritmo stimato.
- **6 sfide nuove**: Il nemico n.1, Ritorno immediato, Telefono in un'altra stanza, Cinque minuti di plank, Cento piegamenti,
  Due settimane perfette (dalla settimana 12).
- **Primi successi** nel barattolo, inseriti una volta sola all'aggiornamento e verificati sul registro quando possibile.

## Promemoria nel calendario (.ics)

L'app non manda notifiche push: crea un evento ricorrente nel calendario del telefono, con un avviso prima dell'allenamento.

1. Apri **Altro → Promemoria**, scegli i giorni, l'ora, la durata e quanti minuti prima vuoi l'avviso.
2. Tocca **Crea e apri il file calendario** (oppure **Scarica il file .ics**).

**iPhone**
- Se si apre il menu di condivisione, scegli **Calendario** e poi **Aggiungi tutti**.
- Se il file viene scaricato, apri l'app **File → Download**, tocca `kaizen-palestra.ics` e poi **Aggiungi tutti**.
- Controlla che il calendario scelto sia quello giusto e che in Impostazioni → Calendario le notifiche siano attive.

**Android**
- Apri il file scaricato dalla notifica o dall'app **File → Download** e scegli **Google Calendar**, poi **Importa** e il tuo account.
- Se Google Calendar non apre il file: su un computer vai su calendar.google.com → ⚙️ Impostazioni → **Importa ed esporta**,
  carica il file `.ics` e scegli il calendario.

Se cambi giorni o orario, elimina dal calendario la serie vecchia ("Palestra – Metodo Kaizen") e importa il file nuovo.

## Struttura

```
src/db.ts             schema IndexedDB (Dexie)
src/seed.ts           dati iniziali
src/lib/progression.ts  logica Kaizen
src/lib/stats.ts      costanza, striscia, grafici, record
src/lib/football.ts   partite, avvisi gambe, giorni consigliati
src/lib/exportData.ts backup JSON, CSV, riepilogo coach
src/migrations.ts     migrazione alla versione 2 (non cancella niente)
src/lib/plates.ts     calcolatore dischi
src/lib/stall.ts      stallo e dolore
src/lib/rank.ts       massimale stimato e livelli
src/lib/challenges.ts sblocco e date delle sfide
src/lib/derived.ts    successi automatici, verifica, analisi saltate
src/lib/photos.ts     compressione e ZIP delle foto
src/lib/ics.ts        file calendario
src/lib/goals.ts      obiettivi a tappe
src/pages/            schermate
scripts/make-icons.mjs  rigenera le icone PNG da public/favicon.svg
```

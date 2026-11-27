# Kaizen-Gym: privacy, email e backup

Cose da fare **fuori dal codice** prima di far entrare altre persone (anche solo per la beta).

## 1. Database: funzioni di cancellazione
In Supabase (progetto **kaizen-gym**) → SQL Editor → New query: incolla `supabase/02-cancellazione-account.sql` e premi Run.
Senza questo, "Elimina account" e lo spegnimento delle misure nel cloud danno errore.

## 2. Informativa
Titolare ed email di contatto sono in `src/pages/PrivacyPage.tsx` (`OWNER`, `CONTACT`).
Il testo è una bozza: prima della pubblicazione vera va controllato da un professionista privacy.
Se cambi il testo in modo sostanziale, aggiorna `PRIVACY_VERSION` in `src/lib/privacy.ts`: l'app richiederà il consenso.

## 3. Accordo con Supabase (DPA)
Supabase → Organization settings → Legal documents: accetta il Data Processing Addendum.

## 4. Email di conferma e recupero password
Il servizio email di prova di Supabase manda pochissime email all'ora: va bene per i test, non per la beta.
1. Crea un account gratuito su un servizio SMTP (es. Resend, circa 3.000 email al mese gratis) e verifica un dominio o un indirizzo mittente.
2. Supabase → Authentication → Emails → SMTP Settings: attiva "Custom SMTP" e inserisci host, porta, utente e password del servizio.
3. Authentication → URL Configuration: in "Site URL" metti l'indirizzo dove gira l'app (per le prove in locale `http://localhost:5173`).
4. Authentication → Emails → Templates: traduci in italiano l'email "Confirm signup".

## 5. Backup settimanale
Il workflow `.github/workflows/backup.yml` salva ogni lunedì una copia cifrata del database tra gli artifact di GitHub (60 giorni).
Servono due secret nel repo (Settings → Secrets and variables → Actions):
- `SUPABASE_DB_URL`: Supabase → Connect → "Session pooler", con la password del database al posto di `[YOUR-PASSWORD]`.
- `BACKUP_PASSPHRASE`: una frase lunga, da salvare nel gestore di password. Senza, la copia non si apre.
Per aprire una copia: `gpg -d kaizen-gym-AAAA-MM-GG.sql.gz.gpg | gunzip > copia.sql`.

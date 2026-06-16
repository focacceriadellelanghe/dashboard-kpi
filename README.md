# Focacceria delle Langhe — Dashboard commerciale

Webapp mobile-first per GitHub Pages con database e autenticazione Supabase.

## File principali
- `index.html`, `styles.css`, `app.js`: applicazione
- `config.js`: configurazione Supabase da compilare
- `config.example.js`: esempio
- `supabase/schema.sql`: tabelle, ruoli, RLS e categorie iniziali
- `.github/workflows/pages.yml`: deploy GitHub Pages
- `manifest.webmanifest`, `sw.js`, `assets/`: PWA iPhone
- `mockup-reference.html`: mockup approvato

## Configurazione Supabase
1. Crea un progetto Supabase.
2. Esegui `supabase/schema.sql` nel SQL Editor.
3. Crea due utenti in Authentication: amministratore e viewer.
4. Inserisci i due ruoli nella tabella `profiles`:

```sql
insert into public.profiles(id, role) values
('UUID_ADMIN', 'admin'),
('UUID_VIEWER', 'viewer');
```

5. Inserisci in `config.js` URL, publishable key e email dei due utenti.
6. Non inserire mai la service role key nel frontend.

## Configurazione app
```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://PROJECT.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'PUBLISHABLE_KEY',
  ADMIN_EMAIL: 'email-admin',
  VIEWER_EMAIL: 'email-viewer'
};
```

## Pubblicazione GitHub Pages
1. Carica il contenuto della cartella nella root del repository.
2. In Settings > Pages seleziona GitHub Actions.
3. Esegui il workflow `Deploy GitHub Pages` o fai push su `main`.

## Modalità locale demo
Finché `config.js` è vuoto:
- admin: `admin2026`
- viewer: `viewer2026`

La modalità demo usa dati temporanei in memoria.

## Regola IVA
I dati inseriti sono lordi IVA inclusa. I KPI usano:

`netto IVA = lordo / 1,10`

Il lordo resta visibile solo nella prima card Home e nell'Archivio.

## Funzioni implementate
- login admin/viewer
- permessi RLS
- Home con KPI netti IVA
- inserimento, modifica, eliminazione giornate
- locale calcolato automaticamente
- archivio lordo/netto
- approfondimenti e grafico
- target netti IVA
- commissioni delivery
- simulatore e scenari
- export CSV e backup JSON
- PWA installabile
- recupero e cambio password admin

## Da fare alla messa online
- creare gli utenti reali Supabase
- compilare `config.js`
- importare lo storico reale
- adattare il mapping CSV al file Excel definitivo
- testare ruoli e policy

# Security Patch Kit — esbuild & vite

Questo kit aggiorna il tuo progetto per risolvere le 2 vulnerabilità moderate:
- `esbuild` (<=0.24.2) — GHSA-67mh-4wv8-2f99
- `vite` (0.11.0 - 6.1.6) — transitive via esbuild

## Cosa fa
- Imposta `devDependencies.vite = 7.1.3` (fix ufficiale).
- Aggiunge `"overrides": { "esbuild": "^0.24.4" }` in `package.json` per forzare una versione sicura.
- Reinstalla le dipendenze pulite e mostra un nuovo `npm audit`.

## Uso (Windows - PowerShell)
1. Copia questi file **dentro la cartella del tuo progetto** (dove c'è `package.json`).
2. Apri PowerShell nella cartella del progetto.
3. Esegui:
   ```powershell
   ./patch-vuln.ps1
   ```

## Uso (macOS/Linux - bash/zsh)
```bash
chmod +x patch-vuln.sh
./patch-vuln.sh
```

## Note
- Se usi `@vitejs/plugin-react`, rimane compatibile con Vite 7 (se necessario, aggiornalo con `npm i -D @vitejs/plugin-react@^4`).
- Non usiamo `--force` per evitare major upgrade distruttivi.
- Dopo il patch:
  ```bash
  npm run build
  npm run preview
  npm audit --production
  ```

#!/usr/bin/env bash
set -euo pipefail

echo "==> Security patch: vite -> 7.1.3, overrides.esbuild -> ^0.24.4"

if [ ! -f package.json ]; then
  echo "Errore: esegui questo script nella cartella del progetto (dove c'è package.json)"
  exit 1
fi

npm pkg set devDependencies.vite=7.1.3
npm pkg set overrides.esbuild="^0.24.4"

# Optional: bump plugin-react if present
if node -e "p=require('./package.json');process.exit(p.devDependencies && p.devDependencies['@vitejs/plugin-react']?0:1)"; then
  npm pkg set devDependencies.@vitejs/plugin-react="^4.0.0"
fi

[ -f package-lock.json ] && rm -f package-lock.json

npm install

echo
echo "==> npm audit (production only)"
npm audit --production

echo
echo "Patch completato. Prova:"
echo "  npm run build"
echo "  npm run preview"

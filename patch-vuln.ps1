Param()

Write-Host "==> Security patch: vite -> 7.1.3, overrides.esbuild -> ^0.24.4" -ForegroundColor Cyan

if (!(Test-Path package.json)) {
  Write-Error "package.json non trovato. Esegui questo script nella cartella del progetto."
  exit 1
}

# Set vite devDependency
npm pkg set devDependencies.vite=7.1.3

# Set override for esbuild
npm pkg set overrides.esbuild="^0.24.4"

# Optional: update plugin-react if present
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
if ($pkg.devDependencies.'@vitejs/plugin-react') {
  npm pkg set devDependencies.'@vitejs/plugin-react'="^4.0.0"
}

# Clean lockfile for a fresh resolution
if (Test-Path package-lock.json) {
  Remove-Item package-lock.json -Force
}

npm install

Write-Host "`n==> npm audit (production only)" -ForegroundColor Cyan
npm audit --production

Write-Host "`nPatch completato. Prova:" -ForegroundColor Green
Write-Host "  npm run build"
Write-Host "  npm run preview"

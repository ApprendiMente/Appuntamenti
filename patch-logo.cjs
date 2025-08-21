
// Node script to patch src/App.jsx to use the new logo.
// Usage: node patch-logo.cjs
const fs = require('fs');
const path = require('path');

// 1) Locate App.jsx
const root = process.cwd();
const appPath = path.join(root, 'src', 'App.jsx');
if (!fs.existsSync(appPath)) {
  console.error('❌ Non trovo src/App.jsx. Esegui questo comando nella cartella del progetto.');
  process.exit(1);
}
let src = fs.readFileSync(appPath, 'utf8');

// 2) Ensure import of the logo asset
if (!src.includes("from './assets/logo-am.jpg'")) {
  // Add import just after the first import line
  const importIdx = src.indexOf('\nconst BRAND');
  if (importIdx !== -1) {
    src = src.slice(0, importIdx) + "\nimport logoAM from './assets/logo-am.jpg'\n" + src.slice(importIdx);
  } else {
    // fallback: after first line
    src = "import logoAM from './assets/logo-am.jpg'\n" + src;
  }
}

// 3) Replace placeholder square in Header with <img>
// Common placeholder we injected earlier:
const placeholder1 = /<div className="w-8 h-8 rounded-xl"[^>]*><\/div>/;
const placeholderSelfClosing = /<div className="w-8 h-8 rounded-xl"[^>]*\/>/;

// Replacement <img>
const replacement = '<img src={logoAM} alt="ApprendiMente" className="w-8 h-8 rounded-xl object-cover" />';

if (placeholderSelfClosing.test(src)) {
  src = src.replace(placeholderSelfClosing, replacement);
} else if (placeholder1.test(src)) {
  src = src.replace(placeholder1, replacement);
} else {
  // Fallback: try to inject image right after the icon container in Header
  src = src.replace(
    /(<div className="flex items-center gap-3">[\s\S]*?)(<div>[\s\S]*?<div className="font-bold">)/,
    (m, a, b) => a + replacement + "\n          " + b
  );
}

// 4) Save back
fs.writeFileSync(appPath, src, 'utf8');
console.log('✅ Logo sostituito in src/App.jsx (Header).');
console.log('   Ricordati di spostare "src/assets/logo-am.jpg" nel tuo progetto (se non esiste già).');

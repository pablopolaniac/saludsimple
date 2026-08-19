import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const basePath = String.raw`c:\Users\Pablo Polania\Documents\Personal Projects\Ellie's website`;

const files = [
  'salud/index.html',
  'salud/medicaid-chip.html',
  'salud/marketplace.html',
  'salud/atencion-bajo-costo.html',
  'salud/dental-vision.html',
  'salud/seguro-medico.html',
  'salud/seguro-empleador.html',
  'salud/medicare.html',
  'salud/atencion-urgente.html',
  'sistema/index.html',
  'sistema/entender-seguro.html',
  'sistema/facturas.html',
  'sistema/autorizaciones.html',
  'sistema/donde-atenderse.html',
  'sistema/comparar-planes.html',
  'sistema/como-leer-medicamento.html',
];

for (const file of files) {
  const filePath = join(basePath, file);
  let content = readFileSync(filePath, 'utf-8');

  // CHANGE 1: Replace navbar + mobile-drawer + navbar-spacer with placeholder
  const navPattern = /  <nav class="navbar"[\s\S]*?<div class="navbar-spacer"><\/div>/;
  content = content.replace(navPattern, '  <div id="site-navbar"></div>');

  // CHANGE 2: Replace footer + script tags with placeholder and new script
  const footerPattern = /  <footer class="footer">[\s\S]*?<script src="\.\.\/js\/nav\.js"><\/script>/;
  content = content.replace(footerPattern,
    '  <div id="site-footer"></div>\n\n  <script src="/js/includes.js"></script>');

  // CHANGE 3: Update CSS/asset paths to root-relative
  content = content.replaceAll('href="../favicon.svg"', 'href="/favicon.svg"');
  content = content.replaceAll('href="../css/global.css"', 'href="/css/global.css"');
  content = content.replaceAll('href="../css/hero.css"', 'href="/css/hero.css"');
  content = content.replaceAll('href="../css/components.css"', 'href="/css/components.css"');
  content = content.replaceAll('href="../css/content.css"', 'href="/css/content.css"');

  writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated: ${file}`);
}

console.log('All files processed successfully.');

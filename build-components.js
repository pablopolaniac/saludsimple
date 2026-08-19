/* Regenerates components/*-data.js from the editable HTML files.
   Run after editing components/navbar.html, footer.html, or plan-504.html:
     node build-components.js
*/
const fs = require('fs');
const path = require('path');

function writeDataFile(htmlName, jsName, globalName) {
  const html = fs.readFileSync(path.join(__dirname, 'components', htmlName), 'utf8');
  const out = 'window.' + globalName + ' = ' + JSON.stringify(html) + ';\n';
  fs.writeFileSync(path.join(__dirname, 'components', jsName), out, 'utf8');
  console.log('Updated components/' + jsName);
}

writeDataFile('navbar.html', 'navbar-data.js', '__SITE_NAVBAR_HTML__');
writeDataFile('footer.html', 'footer-data.js', '__SITE_FOOTER_HTML__');
writeDataFile('plan-504.html', 'plan-504-data.js', '__SITE_PLAN_504_HTML__');

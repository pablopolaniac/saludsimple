import re
import os

files = [
    'medicamentos/index.html',
    'medicamentos/como-entender-receta.html',
    'medicamentos/costo-ayuda.html',
    'medicamentos/recursos-rapidos.html',
    'medicamentos/como-leer.html',
    'medicamentos/no-puedo-pagar.html',
    'medicamentos/ayuda-fabricante.html',
    'mental/index.html',
]

for f in files:
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()

    # CHANGE 1: Replace nav + mobile-drawer + navbar-spacer with placeholder
    content = re.sub(
        r'  <nav class="navbar".*?<div class="navbar-spacer"></div>',
        '  <div id="site-navbar"></div>',
        content,
        flags=re.DOTALL
    )

    # CHANGE 2: Replace footer + script tags with placeholder + new script
    content = re.sub(
        r'  <footer class="footer">.*?<script src="\.\./js/nav\.js"></script>',
        '  <div id="site-footer"></div>\n\n  <script src="/js/includes.js"></script>',
        content,
        flags=re.DOTALL
    )

    # CHANGE 3: Update CSS/asset paths to root-relative
    content = content.replace('href="../favicon.svg"', 'href="/favicon.svg"')
    content = content.replace('href="../css/global.css"', 'href="/css/global.css"')
    content = content.replace('href="../css/hero.css"', 'href="/css/hero.css"')
    content = content.replace('href="../css/components.css"', 'href="/css/components.css"')
    content = content.replace('href="../css/content.css"', 'href="/css/content.css"')

    with open(f, 'w', encoding='utf-8') as fh:
        fh.write(content)

    print(f'Updated: {f}')

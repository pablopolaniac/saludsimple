$files = @(
  'necesidades/index.html',
  'necesidades/comida.html',
  'necesidades/snap.html',
  'necesidades/wic.html',
  'necesidades/bancos-alimentacion.html',
  'necesidades/vivienda.html',
  'necesidades/asistencia-economica.html',
  'ninos/index.html',
  'ninos/cuidado-infantil.html',
  'ninos/evaluar-discapacidad.html',
  'ninos/apoyo-familiar.html',
  'ninos/wic.html',
  'ninos/discapacidades.html'
)

foreach ($file in $files) {
  $path = Join-Path $PSScriptRoot $file
  $content = [System.IO.File]::ReadAllText($path)

  # CHANGE 1: Replace navbar + mobile-drawer + navbar-spacer with placeholder
  $navPattern = '(?s)\s*<nav class="navbar".*?<div class="navbar-spacer"></div>'
  $navReplacement = "`n  <div id=`"site-navbar`"></div>"
  $content = [regex]::Replace($content, $navPattern, $navReplacement)

  # CHANGE 2: Replace footer + scripts with placeholder and includes script
  $footerPattern = '(?s)\s*<footer class="footer">.*?<script src="\.\./js/nav\.js"></script>'
  $footerReplacement = "`n  <div id=`"site-footer`"></div>`n`n  <script src=`"/js/includes.js`"></script>"
  $content = [regex]::Replace($content, $footerPattern, $footerReplacement)

  # CHANGE 3: Update CSS/asset paths to root-relative
  $content = $content -replace 'href="\.\./favicon\.svg"', 'href="/favicon.svg"'
  $content = $content -replace 'href="\.\./css/global\.css"', 'href="/css/global.css"'
  $content = $content -replace 'href="\.\./css/hero\.css"', 'href="/css/hero.css"'
  $content = $content -replace 'href="\.\./css/components\.css"', 'href="/css/components.css"'
  $content = $content -replace 'href="\.\./css/content\.css"', 'href="/css/content.css"'

  [System.IO.File]::WriteAllText($path, $content)
  Write-Output "Updated: $file"
}

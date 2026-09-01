#!/usr/bin/env bash
# ============================================================================
# Publica Pedidos de Obra como módulo del ERP: gestion.skyterra.com.ar/pedidos/
#
# La app también vive en GitHub Pages (skyterrasl.github.io/pedidos-obra). Las
# dos apuntan al mismo Firebase, así que los datos son los mismos; lo que NO se
# comparte entre las dos direcciones es la instalación como app del celular ni
# las notificaciones push (el navegador las ata al dominio).
#
# Uso:  ./deploy-a-gestion.sh
# ============================================================================
set -euo pipefail

VPS="srv1795124.hstgr.cloud"
DESTINO="/docker/gestion/app/public-pedidos"
AQUI="$(cd "$(dirname "$0")" && pwd)"

echo "→ Empaquetando…"
cd "$AQUI"
tar czf /tmp/pedidos-obra.tgz \
  index.html manifest.webmanifest service-worker.js css js assets

echo "→ Subiendo al VPS…"
scp -q /tmp/pedidos-obra.tgz "$VPS:/tmp/"

echo "→ Reemplazando el módulo…"
ssh "$VPS" "rm -rf $DESTINO && mkdir -p $DESTINO \
  && tar xzf /tmp/pedidos-obra.tgz -C $DESTINO && rm /tmp/pedidos-obra.tgz \
  && find $DESTINO -type f | wc -l | xargs echo '  archivos:'"

rm -f /tmp/pedidos-obra.tgz

echo "→ Verificando…"
VER=$(curl -s -m 20 "https://gestion.skyterra.com.ar/pedidos/js/config.js?cb=$RANDOM" \
  | grep -m1 -o 'v[0-9]\+' || echo "?")
COD=$(curl -s -o /dev/null -w "%{http_code}" -m 20 "https://gestion.skyterra.com.ar/pedidos/")
echo "  https://gestion.skyterra.com.ar/pedidos/ → HTTP $COD, versión $VER"

# El ERP sirve los estáticos con Cache-Control: no-store, así que no hace falta
# reiniciar nada: el archivo nuevo se sirve en la siguiente carga.
echo "Listo."

#!/bin/bash
# Doppio clic su questo file per avviare il Salvadanaio.

cd "$(dirname "$0")" || exit 1
clear

# Cerco Node: prima quello incluso nella cartella, poi quelli installati nel Mac.
NODE=""
for candidato in "./.node-mac/bin/node" \
                 "$(command -v node 2>/dev/null)" \
                 /opt/homebrew/bin/node \
                 /usr/local/bin/node \
                 "$HOME/.nvm/versions/node/"*/bin/node ; do
  if [ -n "$candidato" ] && [ -x "$candidato" ]; then NODE="$candidato"; break; fi
done

if [ -z "$NODE" ]; then
  echo ""
  echo "  Manca Node.js, che e' il motore su cui gira il Salvadanaio."
  echo ""
  echo "  Come rimediare:"
  echo "    1. Vai su   https://nodejs.org"
  echo "    2. Scarica la versione LTS per macOS"
  echo "    3. Installala facendo doppio clic sul file scaricato"
  echo "    4. Torna qui e fai di nuovo doppio clic su 'Avvia Salvadanaio'"
  echo ""
  echo "  Premi Invio per chiudere."
  read -r
  exit 1
fi

# macOS mette in quarantena i file scaricati: la tolgo al motore incluso,
# altrimenti si rifiuta di partire. Serve solo la prima volta.
if [ "$NODE" = "./.node-mac/bin/node" ]; then
  xattr -d com.apple.quarantine "$NODE" 2>/dev/null
  xattr -dr com.apple.quarantine "./.node-mac" 2>/dev/null
fi

# Il browser lo apre il programma stesso, appena e' pronto.
"$NODE" server.js

echo ""
echo "  Il Salvadanaio e' stato chiuso. Premi Invio per chiudere questa finestra."
read -r

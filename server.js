// Salvadanaio - server locale, senza dipendenze esterne.
// Avvia con: node server.js
// I dati stanno in dati.json, nella stessa cartella.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = 4322; // il Taccuino usa la 4321: cosi' possono restare aperti insieme
const CARTELLA = __dirname;
const FILE_DATI = path.join(CARTELLA, 'dati.json');
const FILE_BACKUP = path.join(CARTELLA, 'dati.backup.json');
const PUBBLICA = path.join(CARTELLA, 'public');

// Le regole su come cambiano i dati stanno in public/archivio.js, le stesse
// che usa la pagina quando gira da sola sull'iPhone. Qui resta solo il
// lavoro del Mac: leggere e scrivere dati.json e rispondere al browser.
const Archivio = require('./public/archivio.js');

// ---------- lettura e scrittura dei dati ----------

function leggiDati() {
  try {
    return Archivio.sistema(JSON.parse(fs.readFileSync(FILE_DATI, 'utf8')));
  } catch (err) {
    if (err.code === 'ENOENT') return Archivio.vuoto();
    // Il file esiste ma e' illeggibile: non lo tocchiamo, meglio fermarsi.
    console.error('\nERRORE: dati.json non e\' leggibile.', err.message);
    console.error('Il file non verra\' sovrascritto. Controllalo prima di continuare.\n');
    throw err;
  }
}

function scriviDati(dati) {
  // Prima una copia di sicurezza, poi scrittura su file temporaneo e rinomina:
  // cosi' un'interruzione non lascia mai dati.json a meta'.
  if (fs.existsSync(FILE_DATI)) {
    try { fs.copyFileSync(FILE_DATI, FILE_BACKUP); } catch (e) { /* non bloccante */ }
  }
  const temporaneo = FILE_DATI + '.tmp';
  fs.writeFileSync(temporaneo, JSON.stringify(dati, null, 2), 'utf8');
  fs.renameSync(temporaneo, FILE_DATI);
}

class CorpoNonValido extends Error {}

// ---------- utilita' http ----------

function rispondiJson(res, codice, oggetto) {
  res.writeHead(codice, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(oggetto));
}

function leggiCorpo(req) {
  return new Promise((risolvi, rifiuta) => {
    let pezzi = '';
    let troppo = false;
    req.on('data', (p) => {
      pezzi += p;
      if (pezzi.length > 20_000_000) { troppo = true; req.destroy(); }
    });
    req.on('end', () => {
      if (troppo) return rifiuta(new CorpoNonValido('Troppo grande'));
      if (!pezzi) return risolvi({});
      try { risolvi(JSON.parse(pezzi)); } catch (e) { rifiuta(new CorpoNonValido('JSON non valido')); }
    });
    req.on('error', rifiuta);
  });
}

const TIPI_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

function serviStatico(res, percorsoRichiesto) {
  const relativo = percorsoRichiesto === '/' ? 'index.html' : percorsoRichiesto.replace(/^\/+/, '');
  const completo = path.join(PUBBLICA, relativo);
  // Difesa contro percorsi tipo ../../: si resta dentro public/
  if (!completo.startsWith(PUBBLICA + path.sep) && completo !== PUBBLICA) {
    res.writeHead(403); return res.end('Vietato');
  }
  fs.readFile(completo, (err, contenuto) => {
    if (err) { res.writeHead(404); return res.end('Non trovato'); }
    res.writeHead(200, { 'Content-Type': TIPI_MIME[path.extname(completo)] || 'application/octet-stream' });
    res.end(contenuto);
  });
}

// ---------- il server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const percorso = url.pathname;

  if (!percorso.startsWith('/api/')) return serviStatico(res, percorso);

  try {
    const corpo = req.method === 'GET' || req.method === 'DELETE' ? {} : await leggiCorpo(req);
    const dati = leggiDati();
    const esito = Archivio.rispondi(dati, req.method, percorso, corpo);
    if (esito.modificato) scriviDati(dati);
    return rispondiJson(res, esito.codice, esito.corpo);
  } catch (err) {
    if (err instanceof CorpoNonValido) return rispondiJson(res, 400, { errore: err.message });
    console.error('Errore:', err.message);
    return rispondiJson(res, 500, { errore: err.message });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\nLa porta ' + PORTA + ' e\' gia\' occupata.');
    console.error('Probabilmente il Salvadanaio e\' gia\' aperto: guarda http://localhost:' + PORTA + '\n');
    process.exit(1);
  }
  throw err;
});

/* Apre il browser sulla pagina. Ogni sistema ha il suo comando.
   Se qualcosa va storto non importa: l'indirizzo e' comunque stampato sotto. */
function apriBrowser(indirizzo) {
  if (process.env.SALVADANAIO_NIENTE_BROWSER) return;
  const { spawn } = require('child_process');
  let comando, argomenti;
  if (process.platform === 'darwin') { comando = 'open'; argomenti = [indirizzo]; }
  else if (process.platform === 'win32') { comando = 'cmd'; argomenti = ['/c', 'start', '', indirizzo]; }
  else { comando = 'xdg-open'; argomenti = [indirizzo]; }
  try {
    const processo = spawn(comando, argomenti, { detached: true, stdio: 'ignore' });
    // Se il comando non esiste, spawn non lancia un errore subito ma lo
    // segnala dopo, con un evento: senza questo ascoltatore il programma morirebbe.
    processo.on('error', () => {});
    processo.unref();
  } catch (err) { /* pazienza, l'indirizzo e' scritto qui sotto */ }
}

// Ascolta solo su 127.0.0.1: raggiungibile da questo computer, da nessun altro.
server.listen(PORTA, '127.0.0.1', () => {
  if (!fs.existsSync(FILE_DATI)) scriviDati(Archivio.vuoto());
  const indirizzo = 'http://localhost:' + PORTA;
  console.log('');
  console.log('  Salvadanaio e\' attivo.');
  console.log('  Aprilo qui:  ' + indirizzo);
  console.log('');
  console.log('  I tuoi dati sono nel file dati.json, in questa cartella.');
  console.log('  Per chiudere: premi Ctrl+C, oppure chiudi questa finestra.');
  console.log('');
  apriBrowser(indirizzo);
});

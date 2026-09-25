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

// Gli stessi calcoli che usa la pagina: un posto solo per le regole.
const conti = require('./public/conti.js');

const TIPI = ['entrata', 'uscita'];

function vuoto() {
  return {
    movimenti: [],
    impostazioni: { percentualeObiettivo: null, obiettivo: null, soglia: null },
    notifiche: [],
    fisse: [],
  };
}

// ---------- lettura e scrittura dei dati ----------

function leggiDati() {
  try {
    const dati = JSON.parse(fs.readFileSync(FILE_DATI, 'utf8'));
    if (!Array.isArray(dati.movimenti)) dati.movimenti = [];
    if (!dati.impostazioni || typeof dati.impostazioni !== 'object') dati.impostazioni = vuoto().impostazioni;
    // I dati della versione 0.0 non hanno ne' soglia ne' notifiche.
    if (!('soglia' in dati.impostazioni)) dati.impostazioni.soglia = null;
    if (!Array.isArray(dati.notifiche)) dati.notifiche = [];
    // ...e quelli della 0.1 non hanno le voci fisse.
    if (!Array.isArray(dati.fisse)) dati.fisse = [];
    return dati;
  } catch (err) {
    if (err.code === 'ENOENT') return vuoto();
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

function nuovoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- validazione ----------

const E_UNA_DATA = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

function oggiIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
         + '-' + String(d.getDate()).padStart(2, '0');
}

function testo(valore, max) {
  if (typeof valore !== 'string') return '';
  return valore.trim().slice(0, max);
}

// Un importo valido e' un numero intero di centesimi, positivo.
// La pagina converte gia' "12,50" in 1250: qui si controlla soltanto.
function centesimi(valore) {
  const n = Number(valore);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function normalizzaMovimento(corpo, precedente) {
  const vecchio = precedente || {};
  const tipo = TIPI.includes(corpo.tipo) ? corpo.tipo : (vecchio.tipo || 'uscita');
  const importo = centesimi(corpo.importo);
  if (importo === null) throw new Errore400('Importo non valido');
  return {
    id: vecchio.id || nuovoId(),
    tipo,
    importo,
    data: E_UNA_DATA(corpo.data) ? corpo.data : (vecchio.data || oggiIso()),
    categoria: testo(corpo.categoria, 60) || (tipo === 'entrata' ? 'Extra' : 'Altro'),
    descrizione: testo(corpo.descrizione, 300),
    // Il legame con la voce fissa lo mette solo il server: dalla pagina non si tocca.
    fissaId: vecchio.fissaId || '',
    creato: vecchio.creato || new Date().toISOString(),
    aggiornato: new Date().toISOString(),
  };
}

const E_UN_MESE = (v) => /^\d{4}-\d{2}$/.test(v || '');

function normalizzaVoce(corpo, precedente) {
  const vecchio = precedente || {};
  const tipo = TIPI.includes(corpo.tipo) ? corpo.tipo : (vecchio.tipo || 'uscita');
  const importo = centesimi(corpo.importo);
  if (importo === null) throw new Errore400('Importo non valido');
  const nome = testo(corpo.nome, 100);
  if (!nome) throw new Errore400('Manca il nome della voce');
  const giorno = Number(corpo.giorno);
  if (!(Number.isInteger(giorno) && giorno >= 1 && giorno <= 31)) throw new Errore400('Il giorno va da 1 a 31');
  return {
    id: vecchio.id || nuovoId(),
    tipo,
    nome,
    importo,
    categoria: testo(corpo.categoria, 60) || (tipo === 'entrata' ? 'Stipendio' : 'Altro'),
    giorno,
    // Il mese di partenza si sceglie quando nasce la voce e poi non cambia.
    da: vecchio.da || (E_UN_MESE(corpo.da) ? corpo.da : conti.meseDi(oggiIso())),
    mesiFatti: vecchio.mesiFatti || [],
    creato: vecchio.creato || new Date().toISOString(),
    aggiornato: new Date().toISOString(),
  };
}

function normalizzaImpostazioni(corpo, vecchie) {
  const risultato = Object.assign({}, vecchie);
  if ('percentualeObiettivo' in corpo) {
    const p = Number(corpo.percentualeObiettivo);
    risultato.percentualeObiettivo =
      corpo.percentualeObiettivo === null || corpo.percentualeObiettivo === '' || !(p > 0 && p <= 100)
        ? null : Math.round(p * 10) / 10;
  }
  if ('soglia' in corpo) {
    risultato.soglia = corpo.soglia === null || corpo.soglia === '' ? null : centesimi(corpo.soglia);
    if (corpo.soglia && risultato.soglia === null) throw new Errore400('Soglia non valida');
  }
  if ('obiettivo' in corpo) {
    const o = corpo.obiettivo;
    if (!o) {
      risultato.obiettivo = null;
    } else {
      const importo = centesimi(o.importo);
      if (importo === null) throw new Errore400('Cifra dell\'obiettivo non valida');
      risultato.obiettivo = {
        nome: testo(o.nome, 100),
        importo,
        entro: E_UNA_DATA(o.entro) ? o.entro : '',
        da: E_UNA_DATA(o.da) ? o.da : oggiIso(),
        partenza: o.partenza ? (centesimi(o.partenza) || 0) : 0,
      };
    }
  }
  return risultato;
}

class Errore400 extends Error {}

// ---------- avvisi ----------

/* Dopo ogni modifica guardo se i mesi toccati meritano un avviso.
   Solo il mese in corso e quello prima: se oggi segni una spesa di tre mesi
   fa, un avviso su un mese chiuso da un pezzo non serve a nessuno. Il mese
   prima si', perche' le ultime spese si segnano spesso nei primi giorni. */
function generaAvvisi(dati, mesiToccati) {
  const questo = conti.meseDi(oggiIso());
  const precedente = conti.spostaMese(questo, -1);
  const nuovi = [];
  for (const mese of new Set(mesiToccati)) {
    if (mese !== questo && mese !== precedente) continue;
    for (const a of conti.controllaAvvisi(dati.movimenti, dati.impostazioni, mese, dati.notifiche, dati.fisse, oggiIso())) {
      const notifica = Object.assign({ id: nuovoId(), creata: new Date().toISOString(), letta: false }, a);
      dati.notifiche.unshift(notifica);
      nuovi.push(notifica);
    }
  }
  return nuovi;
}

// ---------- voci fisse ----------

/* Crea i movimenti delle voci fisse arrivate al loro giorno (anche quelli
   persi mentre il programma era chiuso). Restituisce i mesi toccati. */
function allineaFisse(dati) {
  const mesi = [];
  for (const { voce, mese, movimento } of conti.fisseDaCreare(dati.fisse, oggiIso())) {
    dati.movimenti.unshift(normalizzaMovimento(movimento, { fissaId: voce.id }));
    voce.mesiFatti = (voce.mesiFatti || []).concat(mese);
    mesi.push(mese);
  }
  return mesi;
}

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
      if (pezzi.length > 2_000_000) { troppo = true; req.destroy(); }
    });
    req.on('end', () => {
      if (troppo) return rifiuta(new Errore400('corpo troppo grande'));
      if (!pezzi) return risolvi({});
      try { risolvi(JSON.parse(pezzi)); } catch (e) { rifiuta(new Errore400('JSON non valido')); }
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
    // /api/dati -> tutto l'archivio
    // Aprire la pagina e' il momento in cui le voci fisse arrivate si registrano.
    if (percorso === '/api/dati' && req.method === 'GET') {
      const dati = leggiDati();
      const mesi = allineaFisse(dati);
      if (mesi.length) {
        generaAvvisi(dati, mesi);
        scriviDati(dati);
      }
      return rispondiJson(res, 200, dati);
    }

    // /api/fisse[/id] -> le voci fisse. Ogni modifica rimanda tutto l'archivio,
    // perche' creare una voce puo' creare anche dei movimenti.
    if (percorso.startsWith('/api/fisse')) {
      const idVoce = percorso.split('/').filter(Boolean)[2];
      const dati = leggiDati();
      let collegato = null;

      if (req.method === 'POST' && !idVoce) {
        const voce = normalizzaVoce(await leggiCorpo(req), null);
        // Se questo mese l'avevi gia' segnato a mano, quello e' il movimento
        // di questa voce: lo lego invece di crearne un doppione.
        const questo = conti.meseDi(oggiIso());
        if (voce.da === questo) {
          const simile = conti.movimentoSimile(dati.movimenti, voce, questo);
          if (simile) {
            simile.fissaId = voce.id;
            voce.mesiFatti.push(questo);
            collegato = simile;
          }
        }
        dati.fisse.push(voce);
      } else if (req.method === 'PUT' && idVoce) {
        const i = dati.fisse.findIndex((v) => v.id === idVoce);
        if (i === -1) return rispondiJson(res, 404, { errore: 'Non trovata' });
        dati.fisse[i] = normalizzaVoce(Object.assign({}, dati.fisse[i], await leggiCorpo(req)), dati.fisse[i]);
      } else if (req.method === 'DELETE' && idVoce) {
        const i = dati.fisse.findIndex((v) => v.id === idVoce);
        if (i === -1) return rispondiJson(res, 404, { errore: 'Non trovata' });
        dati.fisse.splice(i, 1);
        // I movimenti gia' creati restano cosi' come sono: sono soldi usciti
        // davvero, e in quei mesi erano spese fisse. Dal prossimo non se ne creano piu'.
      } else {
        return rispondiJson(res, 405, { errore: 'Metodo non ammesso' });
      }

      const mesi = allineaFisse(dati);
      const nuoveNotifiche = generaAvvisi(dati, mesi.concat(conti.meseDi(oggiIso())));
      scriviDati(dati);
      return rispondiJson(res, 200, { dati, nuoveNotifiche, collegato });
    }

    // /api/impostazioni -> percentuale e obiettivo
    if (percorso === '/api/impostazioni' && req.method === 'PUT') {
      const dati = leggiDati();
      const corpo = await leggiCorpo(req);
      dati.impostazioni = normalizzaImpostazioni(corpo, dati.impostazioni);
      // Una soglia appena abbassata puo' essere gia' superata.
      const nuoveNotifiche = generaAvvisi(dati, [conti.meseDi(oggiIso())]);
      scriviDati(dati);
      return rispondiJson(res, 200, { impostazioni: dati.impostazioni, nuoveNotifiche });
    }

    // /api/notifiche/lette -> segna come lette (tutte, o solo quelle indicate)
    if (percorso === '/api/notifiche/lette' && req.method === 'POST') {
      const dati = leggiDati();
      const corpo = await leggiCorpo(req);
      const quali = Array.isArray(corpo.ids) ? new Set(corpo.ids) : null;
      for (const n of dati.notifiche) if (!quali || quali.has(n.id)) n.letta = true;
      scriviDati(dati);
      return rispondiJson(res, 200, { notifiche: dati.notifiche });
    }

    const pezzi = percorso.split('/').filter(Boolean); // ['api', 'movimenti', id?]
    if (pezzi[1] !== 'movimenti') return rispondiJson(res, 404, { errore: 'Sezione sconosciuta' });
    const id = pezzi[2];
    const dati = leggiDati();

    if (req.method === 'POST' && !id) {
      const elemento = normalizzaMovimento(await leggiCorpo(req), null);
      dati.movimenti.unshift(elemento);
      const nuoveNotifiche = generaAvvisi(dati, [conti.meseDi(elemento.data)]);
      scriviDati(dati);
      return rispondiJson(res, 201, { movimento: elemento, nuoveNotifiche });
    }

    if (req.method === 'PUT' && id) {
      const indice = dati.movimenti.findIndex((e) => e.id === id);
      if (indice === -1) return rispondiJson(res, 404, { errore: 'Non trovato' });
      const unito = Object.assign({}, dati.movimenti[indice], await leggiCorpo(req));
      const primaEra = conti.meseDi(dati.movimenti[indice].data);
      dati.movimenti[indice] = normalizzaMovimento(unito, dati.movimenti[indice]);
      const nuoveNotifiche = generaAvvisi(dati, [primaEra, conti.meseDi(dati.movimenti[indice].data)]);
      scriviDati(dati);
      return rispondiJson(res, 200, { movimento: dati.movimenti[indice], nuoveNotifiche });
    }

    if (req.method === 'DELETE' && id) {
      const indice = dati.movimenti.findIndex((e) => e.id === id);
      if (indice === -1) return rispondiJson(res, 404, { errore: 'Non trovato' });
      dati.movimenti.splice(indice, 1);
      scriviDati(dati);
      return rispondiJson(res, 200, { ok: true });
    }

    return rispondiJson(res, 405, { errore: 'Metodo non ammesso' });
  } catch (err) {
    if (err instanceof Errore400) return rispondiJson(res, 400, { errore: err.message });
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
  if (!fs.existsSync(FILE_DATI)) scriviDati(vuoto());
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

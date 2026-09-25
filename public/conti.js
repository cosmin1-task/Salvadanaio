/* Salvadanaio - i conti.
   Qui ci sono solo calcoli: niente pagina, niente server. Cosi' si possono
   provare da soli (vedi prove/conti.prova.js) e sono gli stessi ovunque.

   Una regola vale per tutto il file: gli importi sono in CENTESIMI, numeri
   interi. 12,50 euro e' 1250. I numeri con la virgola, nei computer, sbagliano
   di poco (0,1 + 0,2 non fa esattamente 0,3) e sui soldi quel poco si vede. */

const CATEGORIE_ENTRATE = ['Stipendio', 'Extra'];

const CATEGORIE_USCITE = [
  'Casa', 'Bollette', 'Spesa', 'Trasporti', 'Salute',
  'Ristoranti e svago', 'Abbigliamento', 'Abbonamenti', 'Regali', 'Altro',
];

const NOMI_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// ---------------------------------------------------------------- importi

/* Legge un importo scritto da una persona e lo trasforma in centesimi.
   Accetta la scrittura italiana ("1.234,56") e quella con il punto ("12.50").
   Restituisce null se non e' un importo sensato. */
function leggiImporto(scritto) {
  if (typeof scritto === 'number') {
    return Number.isFinite(scritto) && scritto > 0 ? Math.round(scritto * 100) : null;
  }
  let t = String(scritto == null ? '' : scritto).replace(/[€\s]/g, '');
  if (!t) return null;
  if (t.includes(',')) {
    // Scrittura italiana: i punti separano le migliaia, la virgola i decimali.
    t = t.replace(/\./g, '').replace(',', '.');
  } else {
    // Solo punti. "12.50" e' un decimale; "1.234" e "1.234.567" sono migliaia.
    const pezzi = t.split('.');
    const decimale = pezzi.length === 2 && pezzi[1].length > 0 && pezzi[1].length <= 2;
    if (!decimale) t = t.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [interi, decimi = ''] = t.split('.');
  const centesimi = Number(interi) * 100 + Number((decimi + '00').slice(0, 2));
  if (!Number.isSafeInteger(centesimi) || centesimi <= 0) return null;
  return centesimi;
}

// Centesimi -> "1.234,56 €". Con segno=true mette sempre + o −.
function euro(centesimi, segno) {
  const n = Math.round(centesimi || 0);
  const assoluto = Math.abs(n);
  const interi = Math.floor(assoluto / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimi = String(assoluto % 100).padStart(2, '0');
  let prefisso = n < 0 ? '−' : '';
  if (segno && n > 0) prefisso = '+';
  return prefisso + interi + ',' + decimi + ' €';
}

// ---------------------------------------------------------------- date e mesi

const E_UNA_DATA = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

function oggiIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}

// '2026-09-25' -> '2026-09'
const meseDi = (dataIso) => String(dataIso).slice(0, 7);

// Numero progressivo del mese, comodo per contare la distanza fra due mesi.
function numeroMese(mese) {
  const [a, m] = mese.split('-').map(Number);
  return a * 12 + (m - 1);
}

function meseDaNumero(n) {
  return Math.floor(n / 12) + '-' + String((n % 12) + 1).padStart(2, '0');
}

const spostaMese = (mese, quanti) => meseDaNumero(numeroMese(mese) + quanti);

// '2026-09' -> 'settembre 2026'
function nomeMese(mese) {
  const [a, m] = mese.split('-').map(Number);
  return NOMI_MESI[m - 1] + ' ' + a;
}

function giorniNelMese(mese) {
  const [a, m] = mese.split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

// ---------------------------------------------------------------- riepiloghi

/* Tutto quello che serve sapere di un mese.
   "Avanzato" e' entrate meno uscite: quello che non hai speso.
   La percentuale e' null quando non e' entrato nulla: dividere per zero non
   ha senso, e scrivere 0% sarebbe falso. */
function riepilogoMese(movimenti, mese) {
  let entrate = 0, uscite = 0, stipendio = 0, numero = 0;
  const perCategoria = {};
  for (const m of movimenti) {
    if (meseDi(m.data) !== mese) continue;
    numero++;
    if (m.tipo === 'entrata') {
      entrate += m.importo;
      if (m.categoria === 'Stipendio') stipendio += m.importo;
    } else {
      uscite += m.importo;
      const c = m.categoria || 'Altro';
      perCategoria[c] = (perCategoria[c] || 0) + m.importo;
    }
  }
  const avanzato = entrate - uscite;
  return {
    mese,
    entrate,
    stipendio,
    extra: entrate - stipendio,
    uscite,
    avanzato,
    percentuale: entrate > 0 ? (avanzato / entrate) * 100 : null,
    perCategoria: Object.entries(perCategoria)
      .map(([categoria, totale]) => ({ categoria, totale }))
      .sort((a, b) => b.totale - a.totale),
    numeroMovimenti: numero,
  };
}

/* Un riepilogo per ogni mese, dal primo movimento fino al mese indicato
   (di solito questo). I mesi senza movimenti ci sono lo stesso, vuoti:
   un buco nel grafico e' un'informazione, non va nascosto. */
function andamento(movimenti, finoAlMese) {
  const ultimo = finoAlMese || meseDi(oggiIso());
  const date = movimenti.map((m) => m.data).filter(E_UNA_DATA).sort();
  if (!date.length) return [];
  const da = numeroMese(meseDi(date[0]));
  const a = Math.max(numeroMese(ultimo), da);
  const mesi = [];
  for (let n = da; n <= a; n++) mesi.push(riepilogoMese(movimenti, meseDaNumero(n)));
  return mesi;
}

/* Media di quanto avanza al mese, sugli ultimi mesi CHIUSI.
   Il mese in corso non conta: a meta' mese lo stipendio e' gia' entrato ma
   le spese non sono ancora tutte uscite, e la media verrebbe troppo bella.
   Restituisce { media, mesi } oppure null se non ci sono mesi chiusi. */
function mediaAvanzato(movimenti, meseCorrente, quantiMesi) {
  const mesiChiusi = andamento(movimenti, spostaMese(meseCorrente, -1))
    .filter((r) => r.mese < meseCorrente);
  const ultimi = mesiChiusi.slice(-(quantiMesi || 3));
  if (!ultimi.length) return null;
  const totale = ultimi.reduce((s, r) => s + r.avanzato, 0);
  return { media: Math.round(totale / ultimi.length), mesi: ultimi.length };
}

// ---------------------------------------------------------------- obiettivo

/* A che punto sei con il traguardo.
   obiettivo = { nome, importo, entro, da, partenza }
     importo   la cifra da raggiungere (centesimi)
     entro     entro quando (facoltativo, 'AAAA-MM-GG')
     da        da quale giorno conta quello che avanza
     partenza  quanto avevi gia' da parte quel giorno (centesimi)
   Si contano i movimenti dal giorno "da" fino a oggi compreso. */
function progressoObiettivo(movimenti, obiettivo, oggi) {
  if (!obiettivo || !(obiettivo.importo > 0)) return null;
  const giorno = oggi || oggiIso();
  const da = E_UNA_DATA(obiettivo.da) ? obiettivo.da : giorno;
  let accumulato = obiettivo.partenza || 0;
  for (const m of movimenti) {
    if (m.data < da || m.data > giorno) continue;
    accumulato += m.tipo === 'entrata' ? m.importo : -m.importo;
  }
  const mancante = Math.max(0, obiettivo.importo - accumulato);
  const quota = Math.max(0, Math.min(1, accumulato / obiettivo.importo));

  // Quanto serve al mese per arrivarci in tempo. Il mese in corso conta:
  // se oggi e' settembre e la scadenza e' dicembre, restano 4 mesi.
  let mesiRimasti = null, servePerMese = null;
  if (E_UNA_DATA(obiettivo.entro)) {
    mesiRimasti = numeroMese(meseDi(obiettivo.entro)) - numeroMese(meseDi(giorno)) + 1;
    if (mesiRimasti > 0 && mancante > 0) servePerMese = Math.ceil(mancante / mesiRimasti);
  }

  return {
    accumulato, mancante, quota,
    raggiunto: mancante === 0,
    mesiRimasti,
    servePerMese,
    scaduto: mesiRimasti !== null && mesiRimasti <= 0 && mancante > 0,
  };
}

/* Se continui a mettere da parte "media" al mese, in che mese arrivi?
   Null quando con quel ritmo non ci arrivi mai (media zero o negativa). */
function meseDiArrivo(mancante, media, meseCorrente) {
  if (mancante <= 0) return meseCorrente;
  if (!(media > 0)) return null;
  const mesi = Math.ceil(mancante / media);
  return spostaMese(meseCorrente, mesi - 1);
}

// ---------------------------------------------------------------- stipendio

/* Se nel mese precedente c'era lo stipendio e in questo no, propone di
   copiarlo: stesso importo, stesso giorno del mese (o l'ultimo giorno, se
   il mese e' piu' corto). Restituisce il movimento da creare, o null. */
function stipendioDaCopiare(movimenti, mese) {
  const giaCe = movimenti.some((m) => m.tipo === 'entrata' && m.categoria === 'Stipendio'
    && meseDi(m.data) === mese);
  if (giaCe) return null;
  const precedente = spostaMese(mese, -1);
  const scorsi = movimenti
    .filter((m) => m.tipo === 'entrata' && m.categoria === 'Stipendio' && meseDi(m.data) === precedente)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  if (!scorsi.length) return null;
  const modello = scorsi[0];
  const giorno = Math.min(Number(modello.data.slice(8, 10)), giorniNelMese(mese));
  return {
    tipo: 'entrata',
    importo: modello.importo,
    categoria: 'Stipendio',
    descrizione: modello.descrizione || '',
    data: mese + '-' + String(giorno).padStart(2, '0'),
  };
}

// ---------------------------------------------------------------- soglia e avvisi

/* Le entrate con cui confrontare le uscite del mese.
   Il problema: l'affitto esce il primo del mese, lo stipendio entra il 27.
   Contando solo quello che e' gia' entrato, ogni mese sembrerebbe in rosso
   per tre settimane. Quindi, se lo stipendio di questo mese non c'e' ancora
   ma c'era il mese prima, lo conto come "atteso" con lo stesso importo. */
function entrateDiRiferimento(movimenti, mese) {
  const r = riepilogoMese(movimenti, mese);
  const proposta = stipendioDaCopiare(movimenti, mese);
  const atteso = proposta ? proposta.importo : 0;
  return { entrate: r.entrate + atteso, gia: r.entrate, stipendioAtteso: atteso };
}

/* Quanto hai speso rispetto alla soglia. Null se la soglia non c'e'. */
function statoSoglia(movimenti, mese, soglia) {
  if (!(soglia > 0)) return null;
  const speso = riepilogoMese(movimenti, mese).uscite;
  return {
    soglia,
    speso,
    restano: soglia - speso,
    superata: speso > soglia,
    quota: speso / soglia,
  };
}

/* Gli avvisi che il mese merita e che non sono ancora stati dati.
   Due tipi, ciascuno al massimo una volta per mese:
     'soglia'  le uscite hanno superato la soglia
     'rosso'   le uscite hanno superato le entrate (contando lo stipendio atteso)
   Prima della soglia non si avvisa: e' la richiesta. Se dopo l'avviso si
   corregge una spesa e si torna sotto, l'avviso resta nello storico e non
   viene ripetuto nello stesso mese. */
function controllaAvvisi(movimenti, impostazioni, mese, notificheEsistenti) {
  const gia = (tipo) => (notificheEsistenti || []).some((n) => n.tipo === tipo && n.mese === mese);
  const nuovi = [];
  const nome = nomeMese(mese);
  const Nome = nome.charAt(0).toUpperCase() + nome.slice(1);

  const s = statoSoglia(movimenti, mese, impostazioni && impostazioni.soglia);
  if (s && s.superata && !gia('soglia')) {
    nuovi.push({
      tipo: 'soglia', mese,
      titolo: 'Soglia superata',
      testo: Nome + ': hai speso ' + euro(s.speso) + ', oltre la soglia di ' + euro(s.soglia)
        + ' (' + euro(s.speso - s.soglia) + ' in piu\').',
    });
  }

  const rif = entrateDiRiferimento(movimenti, mese);
  const uscite = riepilogoMese(movimenti, mese).uscite;
  if (uscite > rif.entrate && uscite > 0 && !gia('rosso')) {
    const comeEntrate = rif.stipendioAtteso
      ? 'le entrate previste (' + euro(rif.entrate) + ', contando lo stipendio non ancora arrivato)'
      : 'le entrate (' + euro(rif.entrate) + ')';
    nuovi.push({
      tipo: 'rosso', mese,
      titolo: 'Mese in rosso',
      testo: Nome + ': le uscite (' + euro(uscite) + ') hanno superato ' + comeEntrate
        + ' di ' + euro(uscite - rif.entrate) + '.',
    });
  }
  return nuovi;
}

// ---------------------------------------------------------------- serie per il grafico

/* Giorno per giorno, quanto e' entrato e uscito dall'inizio del mese.
   Per il mese in corso si ferma a oggi: il futuro non c'e' ancora. Tranne
   se hai gia' segnato qualcosa con una data piu' avanti (una bolletta che
   sai gia' che arrivera'): allora arriva fino a quel giorno, cosi' il
   grafico torna con i totali del mese.
   Restituisce [{ giorno, entrate, uscite }] con i valori ACCUMULATI. */
function serieGiornaliera(movimenti, mese, oggi) {
  const giorno = oggi || oggiIso();
  let ultimo = giorniNelMese(mese);
  if (meseDi(giorno) === mese) {
    ultimo = Number(giorno.slice(8, 10));
    for (const m of movimenti) {
      if (meseDi(m.data) === mese) ultimo = Math.max(ultimo, Number(m.data.slice(8, 10)));
    }
  } else if (mese > meseDi(giorno)) ultimo = 0;
  const perGiorno = Array.from({ length: ultimo + 1 }, () => ({ e: 0, u: 0 }));
  for (const m of movimenti) {
    if (meseDi(m.data) !== mese) continue;
    const g = Number(m.data.slice(8, 10));
    if (g > ultimo) continue;
    if (m.tipo === 'entrata') perGiorno[g].e += m.importo; else perGiorno[g].u += m.importo;
  }
  const serie = [];
  let e = 0, u = 0;
  for (let g = 1; g <= ultimo; g++) {
    e += perGiorno[g].e; u += perGiorno[g].u;
    serie.push({ giorno: g, entrate: e, uscite: u });
  }
  return serie;
}

// Il primo giorno in cui le uscite accumulate superano un limite, o null.
function giornoDiSuperamento(serie, limite) {
  if (!(limite > 0)) return null;
  const p = serie.find((s) => s.uscite > limite);
  return p ? p.giorno : null;
}

// Il server usa gli stessi calcoli della pagina.
if (typeof module !== 'undefined') {
  module.exports = {
    CATEGORIE_ENTRATE, CATEGORIE_USCITE, leggiImporto, euro, oggiIso, meseDi, spostaMese,
    nomeMese, riepilogoMese, andamento, mediaAvanzato, progressoObiettivo, meseDiArrivo,
    stipendioDaCopiare, entrateDiRiferimento, statoSoglia, controllaAvvisi,
    serieGiornaliera, giornoDiSuperamento,
  };
}

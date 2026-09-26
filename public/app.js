/* Salvadanaio - logica dell'interfaccia.
   Tutto gira nel browser. I calcoli stanno in conti.js, le regole su come
   cambiano i dati in archivio.js: qui si disegna e si ascoltano i clic.

   Due modi di funzionare, con la stessa pagina:
   - sul Mac (o Windows) la pagina parla con server.js, che tiene dati.json;
   - sull'iPhone non c'e' server: l'archivio sta nella memoria del telefono
     e le stesse regole girano qui dentro. */

// Sul computer la pagina arriva da localhost; da qualunque altro indirizzo
// (il sito da cui la installi sull'iPhone) gira da sola.
// "?telefono" nell'indirizzo forza il modo telefono anche sul computer, per provarlo.
const SUL_TELEFONO = new URLSearchParams(location.search).has('telefono')
  || !['localhost', '127.0.0.1'].includes(location.hostname);

// ---------------------------------------------------------------- stato

const stato = {
  dati: {
    movimenti: [],
    impostazioni: { percentualeObiettivo: null, obiettivo: null, soglia: null, ultimaCopia: null },
    notifiche: [],
    fisse: [],
  },
  vista: 'giorni',
  mese: meseDi(oggiIso()),
  modifica: null, // id del movimento che si sta correggendo
};

const VISTE = ['giorni', 'mese', 'grafico', 'fisse', 'notifiche', 'impostazioni'];
const VISTE_CON_MESE = ['giorni', 'mese', 'grafico'];

// ---------------------------------------------------------------- utilita'

const $ = (selettore) => document.querySelector(selettore);

function esc(testo) {
  return String(testo == null ? '' : testo)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function dataLeggibile(iso, conGiorno) {
  if (!E_UNA_DATA(iso)) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('it-IT', conGiorno === false
    ? { day: 'numeric', month: 'long' }
    : { weekday: 'long', day: 'numeric', month: 'long' });
}

function momentoLeggibile(isoCompleto) {
  const d = new Date(isoCompleto);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
    + ', ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function percentuale(p) {
  if (p === null || p === undefined) return '—';
  return p.toFixed(1).replace('-', '−').replace('.', ',').replace(/,0$/, '') + '%';
}

// Centesimi -> testo da rimettere in un campo ("1.234,50")
function importoPerCampo(c) {
  return euro(c).replace(' €', '');
}

const maiuscola = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const meseCorrente = () => meseDi(oggiIso());

let timerAvviso;
function avviso(testo, informazione) {
  const el = $('#avviso');
  el.textContent = testo;
  el.classList.toggle('informazione', !!informazione);
  el.hidden = false;
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => { el.hidden = true; }, 4500);
}

let timerSalvato;
function segnalaSalvato() {
  const el = $('#stato-salvataggio');
  el.textContent = 'Salvato';
  el.classList.add('visibile');
  clearTimeout(timerSalvato);
  timerSalvato = setTimeout(() => el.classList.remove('visibile'), 1400);
}

// ---------------------------------------------------------------- server (o telefono)

/* Sul telefono l'archivio si tiene anche in memoria, e le richieste si
   mettono in fila: due tocchi veloci non devono salvare uno sopra l'altro. */
let archivioTelefono = null;
let codaTelefono = Promise.resolve();

function chiamaTelefono(metodo, percorso, corpo) {
  const lavoro = codaTelefono.then(async () => {
    if (!archivioTelefono) archivioTelefono = Archivio.sistema((await Memoria.carica()) || Archivio.vuoto());
    const esito = Archivio.rispondi(archivioTelefono, metodo, percorso, corpo ? JSON.parse(JSON.stringify(corpo)) : {});
    if (esito.modificato) {
      try {
        await Memoria.salva(archivioTelefono);
      } catch (e) {
        archivioTelefono = null; // alla prossima richiesta si riparte da quello salvato davvero
        avviso('Non riesco a salvare nella memoria del telefono. Riprova; se continua, fai una copia di sicurezza.');
        throw e;
      }
    }
    // Una copia, come se arrivasse da un server: la pagina non deve poter
    // cambiare l'archivio senza passare dalle regole.
    return { codice: esito.codice, corpo: JSON.parse(JSON.stringify(esito.corpo)) };
  });
  codaTelefono = lavoro.catch(() => {});
  return lavoro;
}

async function chiama(metodo, percorso, corpo) {
  if (SUL_TELEFONO) {
    const { codice, corpo: dati } = await chiamaTelefono(metodo, percorso, corpo);
    return dopoLaRisposta(metodo, codice, dati);
  }
  let risposta;
  try {
    risposta = await fetch(percorso, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch (e) {
    avviso('Non riesco a contattare il programma. Hai chiuso la finestra nera? Riavvialo con un doppio clic.');
    throw e;
  }
  const dati = await risposta.json().catch(() => ({}));
  return dopoLaRisposta(metodo, risposta.status, dati);
}

function dopoLaRisposta(metodo, codice, dati) {
  if (codice >= 400) {
    avviso(dati.errore || 'Qualcosa e\' andato storto.');
    throw new Error(dati.errore || codice);
  }
  if (metodo !== 'GET') segnalaSalvato();
  // Ogni scrittura puo' far scattare un avviso: il server lo rimanda indietro.
  if (Array.isArray(dati.nuoveNotifiche) && dati.nuoveNotifiche.length) {
    for (const n of dati.nuoveNotifiche) stato.dati.notifiche.unshift(n);
  }
  return dati;
}

async function caricaTutto() {
  stato.dati = await chiama('GET', '/api/dati');
  disegna();
}

// ---------------------------------------------------------------- viste

function mostraVista(nome) {
  stato.vista = nome;
  for (const b of document.querySelectorAll('.scheda')) {
    b.classList.toggle('attiva', b.dataset.vista === nome);
    // Sul telefono le schede scorrono: quella scelta resta in vista.
    if (b.dataset.vista === nome) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  for (const v of VISTE) $('#vista-' + v).hidden = v !== nome;
  disegna();
}

function disegna() {
  const corrente = meseCorrente();
  $('#navigatore-mese').hidden = !VISTE_CON_MESE.includes(stato.vista);
  $('#mese-nome').textContent = nomeMese(stato.mese);
  $('#mese-oggi').hidden = stato.mese === corrente;

  disegnaAvvisiSchermo();
  disegnaContatore();
  disegnaInstalla();

  if (stato.vista === 'giorni') disegnaGiorni();
  if (stato.vista === 'mese') disegnaMese();
  if (stato.vista === 'grafico') disegnaGrafico();
  if (stato.vista === 'fisse') disegnaFisse();
  if (stato.vista === 'notifiche') disegnaNotifiche();
  if (stato.vista === 'impostazioni') disegnaImpostazioni();
}

function movimentiDelMese(mese, tipo) {
  return stato.dati.movimenti
    .filter((m) => meseDi(m.data) === mese && (!tipo || m.tipo === tipo))
    .sort((a, b) => (a.data === b.data ? (a.creato < b.creato ? 1 : -1) : (a.data < b.data ? 1 : -1)));
}

// ================================================================ 1. GIORNO PER GIORNO

function disegnaGiorni() {
  const { movimenti, impostazioni } = stato.dati;
  const corrente = meseCorrente();
  const r = riepilogoMese(movimenti, stato.mese);

  // Il form propone una data dentro il mese che stai guardando.
  const campoData = $('#form-movimento [name=data]');
  if (!stato.modifica && meseDi(campoData.value) !== stato.mese) {
    campoData.value = stato.mese === corrente ? oggiIso() : stato.mese + '-01';
  }

  disegnaSuggerimentoStipendio();
  disegnaPromemoriaCopia();

  // --- una riga di sintesi: quanto oggi, quanto nel mese, quanto resta
  const pezzi = [];
  if (stato.mese === corrente) {
    const oggi = movimenti.filter((m) => m.data === oggiIso() && m.tipo === 'uscita')
      .reduce((s, m) => s + m.importo, 0);
    pezzi.push('Oggi <strong class="numero">' + euro(oggi) + '</strong>');
  }
  pezzi.push('Nel mese <strong class="numero">' + euro(r.uscite) + '</strong> di uscite');
  const s = statoSoglia(movimenti, stato.mese, impostazioni.soglia);
  if (s) {
    pezzi.push(s.superata
      ? '<span class="segnale-soglia">⚠ Soglia superata di <strong class="numero">' + euro(s.speso - s.soglia) + '</strong></span>'
      : 'Prima della soglia restano <strong class="numero">' + euro(s.restano) + '</strong>');
  }
  $('#riga-sintesi').innerHTML = pezzi.map((p) => '<span>' + p + '</span>').join('<span class="separatore">·</span>');

  // --- le voci fisse che devono ancora arrivare questo mese
  const attese = fisseAttese(stato.dati.fisse, stato.mese, oggiIso());
  $('#in-arrivo').innerHTML = attese.length
    ? '<span class="in-arrivo-titolo">In arrivo:</span> ' + attese.map((a) => '<span class="in-arrivo-voce">'
      + esc(a.voce.nome) + ' <span class="numero ' + (a.voce.tipo === 'entrata' ? 'positivo' : '') + '">'
      + euro(a.voce.tipo === 'entrata' ? a.voce.importo : -a.voce.importo) + '</span> il ' + Number(a.data.slice(8)) + '</span>').join('')
    : '';

  // --- l'elenco, un blocco per giorno
  const delMese = movimentiDelMese(stato.mese);
  const cont = $('#elenco-giorni');
  if (!delMese.length) {
    cont.innerHTML = '<div class="vuoto">Nessun movimento in ' + esc(nomeMese(stato.mese)) + '.<br>'
      + 'Segna la prima spesa dal modulo qui sopra: importo, causale e categoria.'
      + (SUL_TELEFONO && !movimenti.length ? '<br><br>Hai gia\' dei dati sul Mac? Salvane una copia li\' e caricala qui, '
        + 'da <button class="collegamento" data-vai="impostazioni">Opzioni</button>.' : '') + '</div>';
    return;
  }
  const giorni = [];
  for (const m of delMese) {
    if (!giorni.length || giorni[giorni.length - 1].data !== m.data) giorni.push({ data: m.data, righe: [] });
    giorni[giorni.length - 1].righe.push(m);
  }
  cont.innerHTML = giorni.map((g) => {
    const spesi = g.righe.filter((m) => m.tipo === 'uscita').reduce((t, m) => t + m.importo, 0);
    const entrati = g.righe.filter((m) => m.tipo === 'entrata').reduce((t, m) => t + m.importo, 0);
    const totali = [];
    if (spesi) totali.push('spesi <strong class="numero">' + euro(spesi) + '</strong>');
    if (entrati) totali.push('<span class="positivo">entrati <strong class="numero">' + euro(entrati) + '</strong></span>');
    return '<div class="giorno">'
      + '<div class="giorno-testa"><span class="giorno-data">' + esc(dataLeggibile(g.data)) + '</span>'
      + '<span class="giorno-totale">' + totali.join(' · ') + '</span></div>'
      + g.righe.map(rigaMovimento).join('')
      + '</div>';
  }).join('');
}

function rigaMovimento(m) {
  const entrata = m.tipo === 'entrata';
  return '<div class="movimento">'
    + '<div class="movimento-testo">'
    + '<span class="movimento-causale">' + esc(m.descrizione || m.categoria)
    + (m.fissaId ? ' <span class="pillola-fissa" title="Creato da una voce fissa">fissa</span>' : '') + '</span>'
    + '<span class="movimento-categoria">' + esc(m.descrizione ? m.categoria : (entrata ? 'entrata' : 'senza causale')) + '</span>'
    + '</div>'
    + '<span class="movimento-importo numero' + (entrata ? ' positivo' : '') + '">' + euro(entrata ? m.importo : -m.importo) + '</span>'
    + '<span class="azioni">'
    + '<button class="bottone-icona" data-azione="modifica" data-id="' + esc(m.id) + '">Modifica</button>'
    + '<button class="bottone-icona pericolo" data-azione="elimina" data-id="' + esc(m.id) + '">Elimina</button>'
    + '</span></div>';
}

function disegnaSuggerimentoStipendio() {
  const box = $('#suggerimento-stipendio');
  // Solo per il mese in corso o quelli passati: lo stipendio del futuro non e' ancora arrivato.
  // E nel mese in corso solo dal giorno di paga in poi: prima e' semplicemente "atteso".
  // E non serve piu' se lo stipendio e' gia' una voce fissa: arriva da solo.
  const proposta = stato.mese <= meseCorrente() ? stipendioDaCopiare(stato.dati.movimenti, stato.mese) : null;
  const stipendioFisso = stato.dati.fisse.some((v) => v.tipo === 'entrata' && v.categoria === 'Stipendio');
  if (!proposta || proposta.data > oggiIso() || stipendioFisso) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<span>Lo stipendio di ' + esc(nomeMese(stato.mese)) + ' non c\'e\' ancora. '
    + 'Il mese scorso era di <strong class="numero">' + euro(proposta.importo) + '</strong>.</span>'
    + '<button class="bottone-primario" id="copia-stipendio">Aggiungilo uguale, il ' + Number(proposta.data.slice(8)) + '</button>'
    + '<button class="bottone-leggero" id="stipendio-diverso">Era diverso</button>'
    + (stato.mese === meseCorrente() ? '<button class="bottone-leggero" id="stipendio-fisso" title="Da ora arriva da solo ogni mese">Rendilo fisso</button>' : '');
  $('#copia-stipendio').onclick = async () => {
    const risposta = await chiama('POST', '/api/movimenti', proposta);
    stato.dati.movimenti.unshift(risposta.movimento);
    disegna();
  };
  const bFisso = $('#stipendio-fisso');
  if (bFisso) bFisso.onclick = () => salvaVoce({
    tipo: 'entrata', nome: proposta.descrizione || 'Stipendio', importo: proposta.importo,
    categoria: 'Stipendio', giorno: Number(proposta.data.slice(8)), da: meseCorrente(),
  });
  $('#stipendio-diverso').onclick = () => {
    const f = $('#form-movimento');
    f.tipo.value = 'entrata';
    aggiornaCategorie();
    f.categoria.value = 'Stipendio';
    f.descrizione.value = proposta.descrizione || '';
    f.data.value = proposta.data;
    f.importo.value = '';
    f.importo.focus();
  };
}

// ---------------------------------------------------------------- modulo movimento

function aggiornaCategorie() {
  const tipo = $('#form-movimento').tipo.value;
  const base = tipo === 'entrata' ? CATEGORIE_ENTRATE : CATEGORIE_USCITE;
  // Alle categorie di partenza si aggiungono quelle che hai inventato tu.
  const usate = stato.dati.movimenti.filter((m) => m.tipo === tipo).map((m) => m.categoria);
  const tutte = [...new Set([...base, ...usate])];
  $('#elenco-categorie').innerHTML = tutte.map((c) => '<option value="' + esc(c) + '">').join('');
}

function svuotaModulo() {
  const f = $('#form-movimento');
  stato.modifica = null;
  f.importo.value = '';
  f.descrizione.value = '';
  f.categoria.value = '';
  f.classList.remove('in-modifica');
  $('#bottone-salva').textContent = 'Aggiungi';
  $('#bottone-annulla').hidden = true;
}

function iniziaModifica(id) {
  const m = stato.dati.movimenti.find((x) => x.id === id);
  if (!m) return;
  const f = $('#form-movimento');
  stato.modifica = id;
  f.tipo.value = m.tipo;
  aggiornaCategorie();
  f.importo.value = importoPerCampo(m.importo);
  f.categoria.value = m.categoria;
  f.descrizione.value = m.descrizione;
  f.data.value = m.data;
  f.classList.add('in-modifica');
  $('#bottone-salva').textContent = 'Salva modifiche';
  $('#bottone-annulla').hidden = false;
  f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  f.importo.focus();
}

async function salvaMovimento(evento) {
  evento.preventDefault();
  const f = evento.target;
  const importo = leggiImporto(f.importo.value);
  if (importo === null) {
    avviso('L\'importo non si legge. Scrivilo cosi\': 12,50 oppure 1.250');
    f.importo.focus();
    return;
  }
  const corpo = {
    tipo: f.tipo.value,
    importo,
    categoria: f.categoria.value.trim(),
    descrizione: f.descrizione.value.trim(),
    data: f.data.value,
  };
  if (stato.modifica) {
    const { movimento } = await chiama('PUT', '/api/movimenti/' + stato.modifica, corpo);
    const i = stato.dati.movimenti.findIndex((m) => m.id === movimento.id);
    stato.dati.movimenti[i] = movimento;
  } else {
    const { movimento } = await chiama('POST', '/api/movimenti', corpo);
    stato.dati.movimenti.unshift(movimento);
  }
  // Se hai segnato un movimento di un altro mese, ti porto li' a vederlo.
  stato.mese = meseDi(corpo.data);
  svuotaModulo();
  aggiornaCategorie();
  disegna();
  f.importo.focus();
}

async function eliminaMovimento(id) {
  const m = stato.dati.movimenti.find((x) => x.id === id);
  if (!m) return;
  const cosa = (m.descrizione || m.categoria) + ', ' + euro(m.importo);
  const nota = m.fissaId ? '\n\nE\' una voce fissa: la tolgo solo da ' + nomeMese(meseDi(m.data))
    + '. Nei prossimi mesi arrivera\' come sempre.' : '';
  if (!confirm('Eliminare questo movimento?\n\n' + cosa + nota)) return;
  await chiama('DELETE', '/api/movimenti/' + id);
  stato.dati.movimenti = stato.dati.movimenti.filter((x) => x.id !== id);
  if (stato.modifica === id) svuotaModulo();
  disegna();
}

// ================================================================ 2. MESE

function disegnaMese() {
  const { movimenti, impostazioni } = stato.dati;
  const r = riepilogoMese(movimenti, stato.mese);
  const corrente = meseCorrente();

  // --- i quattro numeri
  const obiettivoP = impostazioni.percentualeObiettivo;
  let notaPercentuale = obiettivoP ? 'obiettivo ' + percentuale(obiettivoP) : 'nessun obiettivo fissato';
  let classeNota = '';
  if (obiettivoP && r.percentuale !== null) {
    if (r.percentuale >= obiettivoP) { notaPercentuale = 'obiettivo ' + percentuale(obiettivoP) + ' raggiunto'; classeNota = 'positivo'; }
    else {
      const manca = Math.ceil(r.entrate * obiettivoP / 100) - r.avanzato;
      notaPercentuale = 'per il ' + percentuale(obiettivoP) + ' mancano ' + euro(manca);
    }
  }
  const inCorso = stato.mese === corrente && r.numeroMovimenti > 0 ? ' (per ora)' : '';

  $('#riquadri-mese').innerHTML = [
    tessera('Entrate', euro(r.entrate),
      r.entrate ? 'stipendio ' + euro(r.stipendio) + ' · extra ' + euro(r.extra) : 'ancora niente'),
    tessera('Uscite', euro(r.uscite), r.perCategoria.length ? r.perCategoria.length + (r.perCategoria.length === 1 ? ' categoria' : ' categorie') : 'ancora niente'),
    tessera('Avanzato' + inCorso, euro(r.avanzato, true), notaAvanzato(r),
      r.avanzato < 0 ? 'negativo' : (r.avanzato > 0 ? 'positivo' : '')),
    tessera('Messo da parte', percentuale(r.percentuale), notaPercentuale, '', classeNota),
  ].join('');

  // --- soglia
  const s = statoSoglia(movimenti, stato.mese, impostazioni.soglia);
  const boxSoglia = $('#riquadro-soglia');
  if (!s) {
    boxSoglia.innerHTML = '<div class="riga-titolo"><h3 class="titolo-riquadro">Soglia di sicurezza</h3>'
      + '<button class="bottone-leggero" data-vai="impostazioni">Impostala</button></div>'
      + '<p class="spiegazione" style="margin:0">Scegli fino a quanto puoi spendere nel mese senza che ti avvisi.</p>';
  } else {
    const larghezza = Math.min(1, s.quota) * 100;
    boxSoglia.innerHTML = '<div class="riga-titolo"><h3 class="titolo-riquadro">Soglia di sicurezza</h3>'
      + '<span class="numero">' + euro(s.speso) + ' di ' + euro(s.soglia) + '</span></div>'
      + '<div class="barra-soglia' + (s.superata ? ' superata' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(s.quota * 100) + '">'
      + '<div style="width:' + larghezza.toFixed(1) + '%"></div></div>'
      + '<p class="nota-soglia">' + (s.superata
        ? '<span class="segnale-soglia">⚠ Superata di <strong class="numero">' + euro(s.speso - s.soglia) + '</strong></span>'
        : 'Restano <strong class="numero">' + euro(s.restano) + '</strong> prima della soglia.') + '</p>'
      + notaSogliaFisse(s);
  }

  disegnaConto();

  // --- uscite per categoria
  const contCat = $('#uscite-categorie');
  if (!r.perCategoria.length) {
    contCat.innerHTML = '<div class="vuoto">Nessuna uscita in questo mese.</div>';
  } else {
    const massimo = r.perCategoria[0].totale;
    contCat.innerHTML = r.perCategoria.map((c) => {
      const quota = Math.round(c.totale / r.uscite * 100);
      return '<div class="categoria-riga">'
        + '<span class="categoria-nome">' + esc(c.categoria) + '</span>'
        + '<span class="categoria-importo numero">' + euro(c.totale) + '<span class="categoria-quota">' + quota + '%</span></span>'
        + '<div class="categoria-barra" title="' + esc(c.categoria) + ': ' + euro(c.totale) + ', ' + quota + '% delle uscite"><div style="width:' + (c.totale / massimo * 100).toFixed(1) + '%"></div></div>'
        + '</div>';
    }).join('');
  }

  // --- entrate
  const entrate = movimentiDelMese(stato.mese, 'entrata');
  let htmlEntrate = entrate.map((m) => '<div class="movimento">'
    + '<div class="movimento-testo"><span class="movimento-causale">' + esc(m.descrizione || m.categoria) + '</span>'
    + '<span class="movimento-categoria">' + (m.descrizione ? esc(m.categoria) + ' · ' : '') + esc(dataLeggibile(m.data, false)) + '</span></div>'
    + '<span class="movimento-importo numero positivo">' + euro(m.importo) + '</span></div>').join('');
  const prevE = previsioneMese(movimenti, stato.dati.fisse, stato.mese, oggiIso());
  for (const a of prevE.attese.filter((x) => x.voce.tipo === 'entrata')) {
    htmlEntrate += rigaAttesa(a.voce.nome, 'fissa, attesa il ' + Number(a.data.slice(8)), a.voce.importo);
  }
  if (prevE.stipendioStimato) {
    const giorno = Number(stipendioDaCopiare(movimenti, stato.mese).data.slice(8));
    htmlEntrate += rigaAttesa('Stipendio', 'atteso intorno al ' + giorno + ', come il mese scorso', prevE.stipendioStimato);
  }
  $('#elenco-entrate').innerHTML = htmlEntrate || '<div class="vuoto">Nessuna entrata in questo mese.</div>';

  disegnaTraguardo();
}

// Le spese fisse che devono ancora uscire contano gia' verso la soglia?
// No, ma e' bene saperlo prima: ti dico dove arriverai.
function notaSogliaFisse(s) {
  const p = previsioneMese(stato.dati.movimenti, stato.dati.fisse, stato.mese, oggiIso());
  if (s.superata || !p.usciteAttese) return '';
  const arrivo = s.speso + p.usciteAttese;
  return '<p class="spiegazione piccola">Con le spese fisse ancora attese (' + euro(p.usciteAttese) + ') arriverai a '
    + euro(arrivo) + (arrivo > s.soglia ? ': <span class="segnale-soglia">oltre la soglia</span>.' : '.') + '</p>';
}

/* Il conto del mese: dallo stipendio si tolgono le spese fisse, e quello
   che resta e' quanto hai per tutto il resto. */
function disegnaConto() {
  const box = $('#riquadro-conto');
  if (!stato.dati.fisse.length) {
    box.innerHTML = '<div class="riga-titolo"><h3 class="titolo-riquadro">Quanto ti resta</h3>'
      + '<button class="bottone-leggero" data-vai="fisse">Imposta le voci fisse</button></div>'
      + '<p class="spiegazione" style="margin:0">Segna una volta sola stipendio, affitto e abbonamenti: '
      + 'qui vedrai quanto ti resta ogni mese, tolte le spese fisse.</p>';
    return;
  }
  const p = previsioneMese(stato.dati.movimenti, stato.dati.fisse, stato.mese, oggiIso());
  const disponibile = p.entrateFisse - p.usciteFisse;
  const altreEntrate = p.entrateVariabili + p.stipendioStimato;
  const nAttese = (tipo) => p.attese.filter((a) => a.voce.tipo === tipo).length;
  const sotto = (n) => (n ? '<span class="conto-nota">' + (n === 1 ? '1 voce ancora attesa' : n + ' voci ancora attese') + '</span>' : '');
  const riga = (etichetta, valore, classe, nota) => '<div class="conto-riga ' + (classe || '') + '"><span>' + etichetta + (nota || '') + '</span>'
    + '<span class="numero">' + euro(valore, true) + '</span></div>';
  const inCorso = stato.mese >= meseCorrente();

  let html = '<h3 class="titolo-riquadro">Quanto ti resta</h3><div class="conto">'
    + riga('Entrate fisse', p.entrateFisse, '', sotto(nAttese('entrata')))
    + riga('Spese fisse', -p.usciteFisse, '', sotto(nAttese('uscita')))
    + riga('Dopo le spese fisse', disponibile, 'conto-parziale');
  if (altreEntrate) {
    html += riga('Altre entrate', altreEntrate, '', p.stipendioStimato ? '<span class="conto-nota">compreso lo stipendio atteso</span>' : '');
  }
  html += riga(stato.mese === meseCorrente() ? 'Spese variabili finora' : 'Spese variabili', -p.usciteVariabili, '')
    + '<div class="conto-riga conto-totale ' + (p.avanzato < 0 ? 'negativo' : 'positivo') + '"><span>'
    + (inCorso ? 'Ti restano' : 'Sono rimasti') + '</span><span class="numero">' + euro(p.avanzato, true) + '</span></div>'
    + '</div>';
  if (inCorso) {
    html += '<p class="spiegazione piccola">' + (stato.mese === meseCorrente()
      ? 'Se da qui a fine mese non spendi altro, oltre alle voci fisse.'
      : 'Previsione: contate solo le voci fisse.') + '</p>';
  }
  box.innerHTML = html;
}

function rigaAttesa(nome, nota, importo) {
  return '<div class="movimento atteso"><div class="movimento-testo"><span class="movimento-causale">' + esc(nome) + '</span>'
    + '<span class="movimento-categoria">' + esc(nota) + '</span></div>'
    + '<span class="movimento-importo numero">' + euro(importo) + '</span></div>';
}

function notaAvanzato(r) {
  const p = previsioneMese(stato.dati.movimenti, stato.dati.fisse, stato.mese, oggiIso());
  if (p.attese.length || p.stipendioStimato) {
    return 'a fine mese, con le voci attese: ' + euro(p.avanzato, true);
  }
  return r.avanzato < 0 ? 'hai speso piu\' di quanto e\' entrato' : 'entrate meno uscite';
}

function tessera(etichetta, valore, nota, classeValore, classeNota) {
  return '<div class="tessera">'
    + '<div class="tessera-etichetta">' + esc(etichetta) + '</div>'
    + '<div class="tessera-valore numero ' + (classeValore || '') + '">' + esc(valore) + '</div>'
    + '<div class="tessera-nota ' + (classeNota || '') + '">' + esc(nota) + '</div>'
    + '</div>';
}

function disegnaTraguardo() {
  const { movimenti, impostazioni } = stato.dati;
  const o = impostazioni.obiettivo;
  const box = $('#riquadro-traguardo');
  if (!o) {
    box.innerHTML = '<div class="riga-titolo"><h3 class="titolo-riquadro">Traguardo</h3>'
      + '<button class="bottone-leggero" data-vai="impostazioni">Scegline uno</button></div>'
      + '<p class="spiegazione" style="margin:0">Una cifra da raggiungere: ti dico a che punto sei e quanto serve al mese.</p>';
    return;
  }

  const p = progressoObiettivo(movimenti, o, oggiIso());
  const media = mediaAvanzato(movimenti, meseCorrente(), 3);
  const righe = [];

  if (p.raggiunto) {
    righe.push('<strong class="positivo">Ci sei arrivato.</strong>');
  } else {
    righe.push('Mancano <strong class="numero">' + euro(p.mancante) + '</strong>.');
    if (p.scaduto) {
      righe.push('<span class="negativo">La data che ti eri dato e\' passata.</span> Spostala in avanti o riduci la cifra.');
    } else if (p.servePerMese !== null) {
      righe.push('Per arrivarci entro ' + esc(nomeMese(meseDi(o.entro))) + ' servono <strong class="numero">'
        + euro(p.servePerMese) + '</strong> al mese, per ' + p.mesiRimasti
        + (p.mesiRimasti === 1 ? ' mese' : ' mesi') + ' compreso questo.');
    }
    if (media) {
      const quali = media.mesi === 1 ? 'dell\'ultimo mese chiuso' : 'degli ultimi ' + media.mesi + ' mesi chiusi';
      const arrivo = meseDiArrivo(p.mancante, media.media, meseCorrente());
      righe.push(arrivo
        ? 'Al ritmo ' + quali + ' (' + euro(media.media) + ' al mese) ci arrivi a <strong>' + esc(nomeMese(arrivo)) + '</strong>.'
        : 'Al ritmo ' + quali + ' (' + euro(media.media, true) + ' al mese) non ci arrivi: in quei mesi non e\' avanzato nulla.');
    }
  }

  box.innerHTML = '<div class="riga-titolo"><h3 class="titolo-riquadro">' + esc(o.nome || 'Traguardo') + '</h3>'
    + '<span class="numero">' + euro(p.accumulato) + ' di ' + euro(o.importo) + ' · ' + Math.floor(p.quota * 100) + '%</span></div>'
    + '<div class="progresso-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'
    + Math.floor(p.quota * 100) + '"><div style="width:' + (p.quota * 100).toFixed(1) + '%"></div></div>'
    + '<ul class="progresso-righe">' + righe.map((r) => '<li>' + r + '</li>').join('') + '</ul>';
}

// ================================================================ 3. GRAFICO

function disegnaGrafico() {
  disegnaTitolone();
  disegnaGraficoMese();
  disegnaAndamento();
}

// La risposta alla domanda "questo mese sono in positivo?", in grande.
function disegnaTitolone() {
  const { movimenti } = stato.dati;
  const r = riepilogoMese(movimenti, stato.mese);
  const corrente = meseCorrente();
  const Nome = maiuscola(nomeMese(stato.mese));
  const box = $('#titolone');

  if (!r.numeroMovimenti) {
    box.innerHTML = '<div class="titolone-frase">' + esc(Nome) + ': ancora nessun movimento.</div>';
    return;
  }
  const inCorso = stato.mese === corrente;
  // Prima del giorno di paga il conto "vero" e' sempre in rosso, e non dice
  // niente. Allora il verdetto si da' contando le voci fisse ancora attese
  // (o, senza voci fisse, lo stipendio del mese scorso), come fanno gli
  // avvisi. I numeri di oggi restano scritti sotto.
  const p = previsioneMese(movimenti, stato.dati.fisse, stato.mese, oggiIso());
  const conAttese = p.attese.length > 0 || p.stipendioStimato > 0;
  const valore = conAttese ? p.avanzato : r.avanzato;
  const positivo = valore >= 0;
  let verbo = inCorso ? (positivo ? 'e\' in positivo' : 'e\' in rosso') : (positivo ? 'si e\' chiuso in positivo' : 'si e\' chiuso in rosso');
  if (inCorso && conAttese) verbo = positivo ? 'chiudera\' in positivo' : 'chiudera\' in rosso';
  if (!inCorso && conAttese) verbo = positivo ? 'e\' previsto in positivo' : 'e\' previsto in rosso';
  const note = [(conAttese ? 'Finora: entrate ' : 'Entrate ') + euro(r.entrate) + ', uscite ' + euro(r.uscite) + '.'];
  if (p.attese.length) {
    note.push('Ancora attese: ' + p.attese.map((a) => esc(a.voce.nome) + ' ' + euro(a.voce.tipo === 'entrata' ? a.voce.importo : -a.voce.importo, true)
      + ' il ' + Number(a.data.slice(8))).join(', ') + '.');
  }
  if (p.stipendioStimato) {
    note.push('Lo stipendio (' + euro(p.stipendioStimato) + ') di solito arriva il '
      + Number(stipendioDaCopiare(movimenti, stato.mese).data.slice(8)) + '.');
  }
  if (inCorso) {
    const restano = giorniNelMese(stato.mese) - Number(oggiIso().slice(8, 10));
    if (restano > 0) note.push('Il mese non e\' finito: ' + (restano === 1 ? 'manca 1 giorno.' : 'mancano ' + restano + ' giorni.'));
  }
  box.innerHTML = '<div class="titolone-frase">' + esc(Nome) + ' ' + verbo + '</div>'
    + '<div class="titolone-numero numero ' + (positivo ? 'positivo' : 'negativo') + '">'
    + (positivo ? '▲ ' : '▼ ') + euro(valore, true) + '</div>'
    + '<div class="titolone-note">' + note.join(' ') + '</div>';
}

/* Tre linee sui giorni del mese:
   - le uscite accumulate (salgono a ogni spesa)
   - le entrate accumulate (salgono con lo stipendio e gli extra)
   - la soglia, fissa
   Finche' la linea delle uscite resta sotto quella delle entrate, sei in positivo. */
function disegnaGraficoMese() {
  const { movimenti, impostazioni } = stato.dati;
  const box = $('#grafico-mese');
  const legenda = $('#legenda-mese');
  const serie = serieGiornaliera(movimenti, stato.mese, oggiIso());
  if (!serie.length || !riepilogoMese(movimenti, stato.mese).numeroMovimenti) {
    box.innerHTML = '<div class="vuoto">' + (stato.mese > meseCorrente()
      ? 'Questo mese non e\' ancora cominciato.' : 'Il grafico compare quando segni il primo movimento del mese.') + '</div>';
    legenda.innerHTML = '';
    return;
  }

  const soglia = impostazioni.soglia || null;
  const prev = previsioneMese(movimenti, stato.dati.fisse, stato.mese, oggiIso());
  const previste = prev.entrateAttese ? prev.entrate : null;
  const giorniMese = giorniNelMese(stato.mese);
  const ultimo = serie[serie.length - 1];

  // Il disegno prende la larghezza vera del riquadro: sul telefono le
  // scritte restano leggibili invece di rimpicciolirsi insieme al grafico.
  const L = Math.max(320, Math.round(box.clientWidth || 820));
  const stretto = L < 600;
  const A = stretto ? 240 : 300, sx = stretto ? 44 : 64, dx = stretto ? 112 : 118, su = 16, giu = 28;
  let max = Math.max(ultimo.entrate, ultimo.uscite, soglia || 0, previste || 0, 1000);
  const passo = scalaGradevole(max / 4);
  max = Math.ceil(max * 1.05 / passo) * passo;
  const x = (g) => sx + (g - 1) / Math.max(1, giorniMese - 1) * (L - sx - dx);
  const y = (v) => su + (max - v) / max * (A - su - giu);

  let svg = '<svg viewBox="0 0 ' + L + ' ' + A + '" role="img" aria-label="Entrate e uscite accumulate giorno per giorno in ' + esc(nomeMese(stato.mese)) + '">';

  // griglia e assi
  for (let v = 0; v <= max; v += passo) {
    svg += '<line class="' + (v === 0 ? 'linea-zero' : 'linea-griglia') + '" x1="' + sx + '" x2="' + (L - dx) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
    svg += '<text class="asse" x="' + (sx - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + euroCorto(v) + '</text>';
  }
  for (const g of stretto ? [1, 10, 20, giorniMese] : [1, 5, 10, 15, 20, 25, giorniMese]) {
    if (g > giorniMese || (g === 25 && giorniMese - g < 3)) continue;
    svg += '<text class="asse" x="' + x(g) + '" y="' + (A - 8) + '" text-anchor="middle">' + g + '</text>';
  }

  // l'area fra le due linee: verde tenue dove sei in positivo, rossa dove sei sotto.
  // Se lo stipendio deve ancora arrivare non la disegno: sarebbe tutta rossa
  // fino al giorno di paga, ogni mese, e non direbbe nulla.
  if (!previste) svg += areaDifferenza(serie, x, y);

  // linee di riferimento: soglia ed entrate previste
  const etichette = [];
  if (soglia) {
    svg += '<line class="linea-soglia" x1="' + sx + '" x2="' + (L - dx) + '" y1="' + y(soglia) + '" y2="' + y(soglia) + '"/>';
    etichette.push({ y: y(soglia), testo: 'Soglia ' + euroCorto(soglia), classe: 'etichetta-soglia' });
  }
  if (previste) {
    svg += '<line class="linea-previste" x1="' + x(ultimo.giorno) + '" x2="' + (L - dx) + '" y1="' + y(previste) + '" y2="' + y(previste) + '"/>';
  }

  // le due linee vere
  const punti = (campo) => serie.map((p) => x(p.giorno).toFixed(1) + ',' + y(p[campo]).toFixed(1)).join(' ');
  svg += '<polyline class="linea-entrate" points="' + punti('entrate') + '"/>';
  svg += '<polyline class="linea-uscite" points="' + punti('uscite') + '"/>';
  svg += '<circle class="punto-entrate" cx="' + x(ultimo.giorno) + '" cy="' + y(ultimo.entrate) + '" r="4"/>';
  svg += '<circle class="punto-uscite" cx="' + x(ultimo.giorno) + '" cy="' + y(ultimo.uscite) + '" r="4"/>';
  etichette.push({ y: y(previste || ultimo.entrate), testo: (previste ? 'Previste ' : 'Entrate ') + euroCorto(previste || ultimo.entrate), classe: 'etichetta-entrate', x: previste ? null : x(ultimo.giorno) });
  etichette.push({ y: y(ultimo.uscite), testo: 'Uscite ' + euroCorto(ultimo.uscite), classe: 'etichetta-uscite', x: x(ultimo.giorno) });

  // il giorno in cui la soglia e' stata superata
  const giornoSoglia = giornoDiSuperamento(serie, soglia);
  if (giornoSoglia) {
    const p = serie[giornoSoglia - 1];
    svg += '<circle class="punto-superamento" cx="' + x(giornoSoglia) + '" cy="' + y(p.uscite) + '" r="6"/>';
    svg += '<text class="nota-grafico" x="' + x(giornoSoglia) + '" y="' + (y(p.uscite) - 12) + '" text-anchor="middle">soglia superata il ' + giornoSoglia + '</text>';
  }

  // etichette in fondo alle linee, spostate se si sovrappongono
  etichette.sort((a, b) => a.y - b.y);
  for (let i = 1; i < etichette.length; i++) {
    if (etichette[i].y - etichette[i - 1].y < 15) etichette[i].y = etichette[i - 1].y + 15;
  }
  for (const e of etichette) {
    const xe = (e.x != null ? e.x : L - dx) + 8;
    svg += '<text class="etichetta-linea ' + e.classe + '" x="' + xe + '" y="' + (e.y + 4) + '">' + esc(e.testo) + '</text>';
  }

  // il mirino: una linea verticale sul giorno indicato
  svg += '<line id="mirino" class="mirino" x1="0" x2="0" y1="' + su + '" y2="' + (A - giu) + '" visibility="hidden"/>';
  svg += '</svg>';
  box.innerHTML = svg;

  /* Il giorno si ricava dalla posizione orizzontale, su tutto il grafico:
     col mouse basta passarci sopra, col dito si tocca o si scorre di lato.
     (Un bersaglio per giorno sarebbe largo 6 pixel sul telefono.) */
  const tip = $('#suggerimento-grafico');
  const disegno = box.querySelector('svg');
  const mirino = box.querySelector('#mirino');
  const mostraGiorno = (e) => {
    const r = disegno.getBoundingClientRect();
    const xv = (e.clientX - r.left) * L / r.width;
    const g = Math.round(1 + (xv - sx) / (L - sx - dx) * Math.max(1, giorniMese - 1));
    const p = serie[Math.min(Math.max(g, 1), serie.length) - 1];
    mirino.setAttribute('x1', x(p.giorno)); mirino.setAttribute('x2', x(p.giorno));
    mirino.setAttribute('visibility', 'visible');
    const data = stato.mese + '-' + String(p.giorno).padStart(2, '0');
    tip.innerHTML = '<strong>' + esc(dataLeggibile(data)) + '</strong>'
      + rigaSuggerimento('Entrate finora', euro(p.entrate))
      + rigaSuggerimento('Uscite finora', euro(p.uscite))
      + rigaSuggerimento('Differenza', euro(p.entrate - p.uscite, true))
      + (soglia ? rigaSuggerimento('Alla soglia', p.uscite > soglia ? 'superata' : euro(soglia - p.uscite)) : '');
    mostraSuggerimento(tip, e);
  };
  disegno.addEventListener('pointermove', mostraGiorno);
  disegno.addEventListener('pointerdown', mostraGiorno);
  disegno.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch') return; // col dito resta, finche' non tocchi altrove
    tip.hidden = true; mirino.setAttribute('visibility', 'hidden');
  });

  legenda.innerHTML = voceLegenda('entrate', 'Entrate accumulate')
    + voceLegenda('uscite', 'Uscite accumulate')
    + (soglia ? voceLegenda('soglia', 'Soglia di sicurezza') : '')
    + (previste ? voceLegenda('previste', 'Entrate previste (non ancora arrivate)') : '');
}

// L'area fra entrate e uscite, spezzata dove le due linee si incrociano.
function areaDifferenza(serie, x, y) {
  let html = '';
  for (let i = 0; i < serie.length - 1; i++) {
    const a = serie[i], b = serie[i + 1];
    const da = a.entrate - a.uscite, db = b.entrate - b.uscite;
    const pezzo = (x1, e1, u1, x2, e2, u2, positivo) => '<polygon class="' + (positivo ? 'area-pos' : 'area-neg') + '" points="'
      + x1 + ',' + y(e1) + ' ' + x2 + ',' + y(e2) + ' ' + x2 + ',' + y(u2) + ' ' + x1 + ',' + y(u1) + '"/>';
    if ((da >= 0) === (db >= 0)) {
      html += pezzo(x(a.giorno), a.entrate, a.uscite, x(b.giorno), b.entrate, b.uscite, da >= 0 && db >= 0);
    } else {
      // le linee si incrociano fra i due giorni: trovo il punto e divido
      const t = da / (da - db);
      const gx = a.giorno + t;
      const ve = a.entrate + (b.entrate - a.entrate) * t;
      html += pezzo(x(a.giorno), a.entrate, a.uscite, x(gx), ve, ve, da >= 0);
      html += pezzo(x(gx), ve, ve, x(b.giorno), b.entrate, b.uscite, db >= 0);
    }
  }
  return html;
}

function voceLegenda(classe, testo) {
  return '<span class="voce-legenda"><svg width="22" height="10" aria-hidden="true"><line class="linea-' + classe
    + '" x1="1" x2="21" y1="5" y2="5"/></svg>' + esc(testo) + '</span>';
}

function mostraSuggerimento(tip, e) {
  tip.hidden = false;
  const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
  const y = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

// ---------------------------------------------------------------- i mesi a confronto

function disegnaAndamento() {
  const mesi = andamento(stato.dati.movimenti, meseCorrente());
  const grafico = $('#grafico-andamento');
  const tabella = $('#tabella-andamento');
  if (!mesi.length) {
    grafico.innerHTML = '<div class="vuoto">Il confronto compare quando avrai segnato qualche movimento.</div>';
    tabella.innerHTML = '';
    return;
  }

  // --- grafico a colonne: ultimi 12 mesi
  const ultimi = mesi.slice(-12);
  const L = Math.max(320, Math.round(grafico.clientWidth || 820));
  const A = L < 600 ? 200 : 240, sx = L < 600 ? 44 : 64, dx = 8, su = 12, giu = 28;
  const valori = ultimi.map((r) => r.avanzato);
  let max = Math.max(0, ...valori), min = Math.min(0, ...valori);
  if (max === min) max = 100; // tutto a zero: una scala qualsiasi
  const passo = scalaGradevole((max - min) / 4);
  max = Math.ceil(max / passo) * passo;
  min = Math.floor(min / passo) * passo;
  const y = (v) => su + (max - v) / (max - min) * (A - su - giu);
  const largoColonna = (L - sx - dx) / ultimi.length;
  const larghezzaBarra = Math.min(38, largoColonna * 0.6);

  let svg = '<svg viewBox="0 0 ' + L + ' ' + A + '" role="img" aria-label="Quanto e\' avanzato ogni mese">';
  for (let v = min; v <= max + 1; v += passo) {
    svg += '<line class="' + (v === 0 ? 'linea-zero' : 'linea-griglia') + '" x1="' + sx + '" x2="' + (L - dx) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
    svg += '<text class="asse" x="' + (sx - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + euroCorto(v) + '</text>';
  }
  ultimi.forEach((r, i) => {
    const x0 = sx + i * largoColonna;
    const xb = x0 + (largoColonna - larghezzaBarra) / 2;
    const alto = y(Math.max(0, r.avanzato)), basso = y(Math.min(0, r.avanzato));
    const h = Math.max(0, basso - alto);
    svg += '<g class="colonna' + (r.mese === stato.mese ? ' scelta' : '') + '" data-indice="' + i + '">';
    svg += '<rect class="sfondo-colonna" x="' + x0 + '" y="' + su + '" width="' + largoColonna + '" height="' + (A - su - giu) + '" rx="4"/>';
    if (h > 0) svg += barraArrotondata(xb, alto, larghezzaBarra, h, r.avanzato >= 0);
    const [anno, m] = r.mese.split('-');
    const etichetta = NOMI_MESI[Number(m) - 1].slice(0, 3) + (m === '01' || i === 0 ? ' ' + anno.slice(2) : '');
    svg += '<text class="asse" x="' + (x0 + largoColonna / 2) + '" y="' + (A - 8) + '" text-anchor="middle">' + etichetta + '</text>';
    svg += '<rect class="bersaglio" x="' + x0 + '" y="0" width="' + largoColonna + '" height="' + A + '"/>';
    svg += '</g>';
  });
  svg += '</svg>';
  grafico.innerHTML = svg;

  const tip = $('#suggerimento-grafico');
  for (const g of grafico.querySelectorAll('.colonna')) {
    const r = ultimi[Number(g.dataset.indice)];
    g.addEventListener('pointermove', (e) => {
      tip.innerHTML = '<strong>' + esc(nomeMese(r.mese)) + (r.mese === meseCorrente() ? ' (in corso)' : '') + '</strong>'
        + rigaSuggerimento('Entrate', euro(r.entrate))
        + rigaSuggerimento('Uscite', euro(r.uscite))
        + rigaSuggerimento('Avanzato', euro(r.avanzato, true))
        + rigaSuggerimento('Messo da parte', percentuale(r.percentuale));
      mostraSuggerimento(tip, e);
    });
    g.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') tip.hidden = true; });
    // un clic su una colonna porta a quel mese
    g.addEventListener('click', () => { stato.mese = r.mese; tip.hidden = true; disegna(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  // --- tabella: tutti i mesi, dal piu' recente
  const chiusi = mesi.filter((r) => r.mese < meseCorrente());
  const somma = (campo) => chiusi.reduce((s, r) => s + r[campo], 0);
  const totEntrate = somma('entrate'), totAvanzato = somma('avanzato');
  let t = '<div class="tabella-contenitore"><table class="tabella"><thead><tr>'
    + '<th>Mese</th><th>Entrate</th><th>Uscite</th><th>Avanzato</th><th>Messo da parte</th></tr></thead><tbody>';
  for (const r of [...mesi].reverse()) {
    t += '<tr' + (r.mese === meseCorrente() ? ' class="corrente"' : '') + '>'
      + '<td>' + esc(nomeMese(r.mese)) + '</td>'
      + '<td class="numero">' + euro(r.entrate) + '</td>'
      + '<td class="numero">' + euro(r.uscite) + '</td>'
      + '<td class="numero ' + (r.avanzato < 0 ? 'negativo' : '') + '">' + euro(r.avanzato, true) + '</td>'
      + '<td class="numero">' + percentuale(r.percentuale) + '</td></tr>';
  }
  t += '</tbody>';
  if (chiusi.length) {
    t += '<tfoot><tr><td>Media dei ' + chiusi.length + ' mesi chiusi</td>'
      + '<td class="numero">' + euro(Math.round(totEntrate / chiusi.length)) + '</td>'
      + '<td class="numero">' + euro(Math.round(somma('uscite') / chiusi.length)) + '</td>'
      + '<td class="numero">' + euro(Math.round(totAvanzato / chiusi.length), true) + '</td>'
      + '<td class="numero">' + percentuale(totEntrate > 0 ? totAvanzato / totEntrate * 100 : null) + '</td></tr></tfoot>';
  }
  t += '</table></div>';
  tabella.innerHTML = t;
}

function rigaSuggerimento(nome, valore) {
  return '<div class="riga"><span>' + esc(nome) + '</span><span class="numero">' + esc(valore) + '</span></div>';
}

// Colonna con gli angoli arrotondati solo dal lato lontano dallo zero.
function barraArrotondata(x, y, w, h, positiva) {
  const r = Math.min(4, h, w / 2);
  const classe = positiva ? 'barra-pos' : 'barra-neg';
  let d;
  if (positiva) {
    d = 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y
      + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  } else {
    d = 'M' + x + ',' + y + 'V' + (y + h - r) + 'Q' + x + ',' + (y + h) + ' ' + (x + r) + ',' + (y + h)
      + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w) + ',' + (y + h - r) + 'V' + y + 'Z';
  }
  return '<path class="' + classe + '" d="' + d + '"/>';
}

// Un passo "tondo" per la griglia: 1, 2, 5, 10, 20, 50... euro
function scalaGradevole(grezzo) {
  const minimo = 1000; // 10 euro
  const g = Math.max(grezzo, minimo);
  const potenza = Math.pow(10, Math.floor(Math.log10(g)));
  const n = g / potenza;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * potenza;
}

// Etichette dei grafici: niente centesimi, "1,5k" oltre i mille
function euroCorto(c) {
  const e = c / 100;
  const segno = e < 0 ? '−' : '';
  const a = Math.abs(e);
  if (a >= 1000) return segno + (Math.round(a / 100) / 10).toString().replace('.', ',') + 'k €';
  return segno + Math.round(a) + ' €';
}

// ================================================================ VOCI FISSE

function disegnaFisse() {
  const { fisse, impostazioni } = stato.dati;
  const corrente = meseCorrente();

  // --- il conto di un mese tipo
  const t = totaliFisse(fisse);
  const conto = $('#conto-fisse');
  if (!fisse.length) {
    conto.innerHTML = '<p class="spiegazione" style="margin:0">Nessuna voce fissa. Comincia dallo stipendio, '
      + 'poi aggiungi affitto, bollette a importo fisso, abbonamenti.</p>';
  } else {
    let nota = '';
    if (impostazioni.soglia) {
      nota = t.uscite > impostazioni.soglia
        ? '<p class="spiegazione piccola"><span class="segnale-soglia">⚠ Le spese fisse da sole (' + euro(t.uscite)
          + ') superano la soglia di ' + euro(impostazioni.soglia) + ': l\'avviso arrivera\' ogni mese.</span></p>'
        : '<p class="spiegazione piccola">La soglia di ' + euro(impostazioni.soglia) + ' conta anche le spese fisse: per il resto ti lascia '
          + euro(impostazioni.soglia - t.uscite) + ' al mese.</p>';
    }
    conto.innerHTML = '<h3 class="titolo-riquadro">Ogni mese</h3><div class="conto">'
      + '<div class="conto-riga"><span>Entrate fisse</span><span class="numero">' + euro(t.entrate, true) + '</span></div>'
      + '<div class="conto-riga"><span>Spese fisse</span><span class="numero">' + euro(-t.uscite, true) + '</span></div>'
      + '<div class="conto-riga conto-totale ' + (t.restano < 0 ? 'negativo' : 'positivo') + '"><span>Restano per tutto il resto</span>'
      + '<span class="numero">' + euro(t.restano, true) + '</span></div></div>' + nota;
  }

  // --- gli elenchi
  const riga = (v) => {
    const data = dataDellaVoce(v, corrente);
    let statoMese;
    if (v.da > corrente) statoMese = 'parte da ' + nomeMese(v.da);
    else if ((v.mesiFatti || []).includes(corrente)) {
      const m = stato.dati.movimenti.find((x) => x.fissaId === v.id && meseDi(x.data) === corrente);
      statoMese = m ? 'segnata il ' + Number(m.data.slice(8)) + ' ' + NOMI_MESI[Number(corrente.slice(5)) - 1]
        : 'tolta da ' + NOMI_MESI[Number(corrente.slice(5)) - 1];
    } else statoMese = 'attesa il ' + Number(data.slice(8));
    return '<div class="movimento">'
      + '<div class="movimento-testo"><span class="movimento-causale">' + esc(v.nome) + '</span>'
      + '<span class="movimento-categoria">' + esc(v.categoria) + ' · il ' + v.giorno + ' di ogni mese · ' + esc(statoMese) + '</span></div>'
      + '<span class="movimento-importo numero' + (v.tipo === 'entrata' ? ' positivo' : '') + '">'
      + euro(v.tipo === 'entrata' ? v.importo : -v.importo) + '</span>'
      + '<span class="azioni">'
      + '<button class="bottone-icona" data-voce="modifica" data-id="' + esc(v.id) + '">Modifica</button>'
      + '<button class="bottone-icona pericolo" data-voce="elimina" data-id="' + esc(v.id) + '">Elimina</button>'
      + '</span></div>';
  };
  const perGiorno = (a, b) => a.giorno - b.giorno || a.nome.localeCompare(b.nome);
  const entrate = fisse.filter((v) => v.tipo === 'entrata').sort(perGiorno);
  const uscite = fisse.filter((v) => v.tipo === 'uscita').sort(perGiorno);
  $('#elenco-fisse-entrate').innerHTML = entrate.map(riga).join('') || '<div class="vuoto">Nessuna. Lo stipendio va qui.</div>';
  $('#elenco-fisse-uscite').innerHTML = uscite.map(riga).join('') || '<div class="vuoto">Nessuna. Affitto e abbonamenti vanno qui.</div>';

  aggiornaCategorieVoce();
}

function aggiornaCategorieVoce() {
  const tipo = $('#form-voce').tipo.value;
  const base = tipo === 'entrata' ? CATEGORIE_ENTRATE : CATEGORIE_USCITE;
  const usate = stato.dati.movimenti.filter((m) => m.tipo === tipo).map((m) => m.categoria);
  $('#elenco-categorie-fisse').innerHTML = [...new Set([...base, ...usate])].map((c) => '<option value="' + esc(c) + '">').join('');
}

function svuotaModuloVoce() {
  const f = $('#form-voce');
  stato.modificaVoce = null;
  f.reset();
  f.da.disabled = false;
  f.classList.remove('in-modifica');
  $('#bottone-salva-voce').textContent = 'Aggiungi';
  $('#bottone-annulla-voce').hidden = true;
  $('#nota-voce').innerHTML = 'Se questo mese l\'hai gia\' segnata a mano, la riconosco (stesso importo e categoria) e non la raddoppio. '
    + 'Giorni 29, 30 e 31: nei mesi piu\' corti vale l\'ultimo giorno.';
  aggiornaCategorieVoce();
}

function iniziaModificaVoce(id) {
  const v = stato.dati.fisse.find((x) => x.id === id);
  if (!v) return;
  const f = $('#form-voce');
  stato.modificaVoce = id;
  f.tipo.value = v.tipo;
  aggiornaCategorieVoce();
  f.importo.value = importoPerCampo(v.importo);
  f.nome.value = v.nome;
  f.categoria.value = v.categoria;
  f.giorno.value = v.giorno;
  f.da.disabled = true; // il mese di partenza non si cambia
  f.classList.add('in-modifica');
  $('#bottone-salva-voce').textContent = 'Salva modifiche';
  $('#bottone-annulla-voce').hidden = false;
  $('#nota-voce').innerHTML = 'Le modifiche valgono dai prossimi movimenti. Quelli gia\' registrati restano come sono: '
    + 'per correggere un mese solo, modifica il movimento in Giorno per giorno.';
  f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  f.importo.focus();
}

// Crea o modifica una voce. Il server rimanda tutto l'archivio, perche'
// una voce nuova puo' creare subito il movimento di questo mese.
async function salvaVoce(corpo, id) {
  const risposta = await chiama(id ? 'PUT' : 'POST', '/api/fisse' + (id ? '/' + id : ''), corpo);
  stato.dati = risposta.dati;
  if (risposta.collegato) {
    avviso('"' + (risposta.collegato.descrizione || risposta.collegato.categoria) + '" di questo mese era gia\' segnato: '
      + 'l\'ho collegato alla voce fissa, niente doppioni.', true);
  }
  disegna();
}

async function inviaModuloVoce(evento) {
  evento.preventDefault();
  const f = evento.target;
  const importo = leggiImporto(f.importo.value);
  if (importo === null) { avviso('L\'importo non si legge. Scrivilo cosi\': 12,50 oppure 1.250'); f.importo.focus(); return; }
  const giorno = Number(f.giorno.value);
  if (!(Number.isInteger(giorno) && giorno >= 1 && giorno <= 31)) { avviso('Il giorno va da 1 a 31.'); f.giorno.focus(); return; }
  const corpo = {
    tipo: f.tipo.value, importo, nome: f.nome.value.trim(), categoria: f.categoria.value.trim(), giorno,
    da: f.da.value === 'prossimo' ? spostaMese(meseCorrente(), 1) : meseCorrente(),
  };
  const id = stato.modificaVoce;
  await salvaVoce(corpo, id);
  svuotaModuloVoce();
}

async function eliminaVoce(id) {
  const v = stato.dati.fisse.find((x) => x.id === id);
  if (!v) return;
  if (!confirm('Togliere la voce fissa "' + v.nome + '"?\n\nI movimenti gia\' registrati nei mesi passati restano. '
    + 'Dal prossimo non verra\' piu\' aggiunta.')) return;
  const risposta = await chiama('DELETE', '/api/fisse/' + id);
  stato.dati = risposta.dati;
  if (stato.modificaVoce === id) svuotaModuloVoce();
  disegna();
}

// ================================================================ NOTIFICHE

const TIPI_NOTIFICA = {
  soglia: { icona: '⚠', etichetta: 'Soglia' },
  rosso: { icona: '▼', etichetta: 'In rosso' },
};

const nonLette = () => stato.dati.notifiche.filter((n) => !n.letta);

function disegnaContatore() {
  const n = nonLette().length;
  const el = $('#contatore-notifiche');
  el.hidden = n === 0;
  el.textContent = n;
  el.setAttribute('aria-label', n + (n === 1 ? ' non letta' : ' non lette'));
}

// Gli avvisi a schermo: le notifiche non lette, in cima a ogni schermata,
// finche' non premi "Ho capito". Nella scheda Notifiche non servono.
function disegnaAvvisiSchermo() {
  const box = $('#avvisi-schermo');
  const daMostrare = stato.vista === 'notifiche' ? [] : nonLette().slice(0, 3);
  box.innerHTML = daMostrare.map((n) => {
    const t = TIPI_NOTIFICA[n.tipo] || { icona: '•', etichetta: '' };
    return '<div class="avviso-schermo tipo-' + esc(n.tipo) + '" role="alert">'
      + '<span class="avviso-icona" aria-hidden="true">' + t.icona + '</span>'
      + '<div class="avviso-testo"><strong>' + esc(n.titolo) + '</strong><span>' + esc(n.testo) + '</span></div>'
      + '<button class="bottone-leggero" data-letta="' + esc(n.id) + '">Ho capito</button>'
      + '</div>';
  }).join('');
  const altre = nonLette().length - daMostrare.length;
  if (daMostrare.length && altre > 0) {
    box.innerHTML += '<button class="collegamento" data-vai="notifiche">e ' + altre + (altre === 1 ? ' altra' : ' altre') + ' da leggere</button>';
  }
}

function disegnaNotifiche() {
  const tutte = stato.dati.notifiche;
  $('#segna-lette').hidden = nonLette().length === 0;
  const box = $('#elenco-notifiche');
  if (!tutte.length) {
    box.innerHTML = '<div class="riquadro vuoto">Nessuna notifica.<br>'
      + (stato.dati.impostazioni.soglia
        ? 'Arrivano quando superi la soglia di ' + euro(stato.dati.impostazioni.soglia) + ' o quando il mese va in rosso.'
        : 'Imposta una soglia di sicurezza e ti avviso quando la superi.<br><button class="bottone-leggero" data-vai="impostazioni" style="margin-top:12px">Vai alle impostazioni</button>')
      + '</div>';
    return;
  }
  box.innerHTML = tutte.map((n) => {
    const t = TIPI_NOTIFICA[n.tipo] || { icona: '•', etichetta: '' };
    return '<div class="notifica tipo-' + esc(n.tipo) + (n.letta ? ' letta' : '') + '">'
      + '<span class="avviso-icona" aria-hidden="true">' + t.icona + '</span>'
      + '<div class="notifica-corpo">'
      + '<div class="notifica-testa"><strong>' + esc(n.titolo) + '</strong>'
      + '<span class="notifica-quando">' + esc(momentoLeggibile(n.creata)) + '</span></div>'
      + '<div>' + esc(n.testo) + '</div>'
      + '<div class="notifica-azioni">'
      + '<button class="collegamento" data-mese="' + esc(n.mese) + '">Vai a ' + esc(nomeMese(n.mese)) + '</button>'
      + (n.letta ? '' : '<button class="collegamento" data-letta="' + esc(n.id) + '">Segna come letta</button>')
      + '</div></div></div>';
  }).join('');
}

async function segnaLette(ids) {
  const risposta = await chiama('POST', '/api/notifiche/lette', ids ? { ids } : {});
  stato.dati.notifiche = risposta.notifiche;
  disegna();
}

// ================================================================ IMPOSTAZIONI

function disegnaImpostazioni() {
  const { movimenti, impostazioni } = stato.dati;

  // --- copia di sicurezza
  $('#dove-sono-i-dati').innerHTML = SUL_TELEFONO
    ? 'I tuoi dati stanno solo in questo telefono, non vanno da nessuna parte. Proprio per questo, se cancelli l\'app '
      + 'dalla Home o cambi telefono, spariscono. Salva ogni tanto una copia: si apre il foglio di condivisione, '
      + 'scegli <strong>Salva su File</strong> e poi <strong>iCloud Drive</strong>.'
    : 'I tuoi dati stanno nel file dati.json, nella cartella del Salvadanaio. Da qui puoi salvarne una copia, '
      + 'per esempio per portarla sull\'iPhone con AirDrop o iCloud Drive.';
  $('#ultima-copia').textContent = testoUltimaCopia();

  // --- soglia
  const fs = $('#form-soglia');
  if (document.activeElement !== fs.soglia) fs.soglia.value = impostazioni.soglia ? importoPerCampo(impostazioni.soglia) : '';
  $('#soglia-togli').hidden = !impostazioni.soglia;
  const stipendi = movimenti.filter((m) => m.tipo === 'entrata' && m.categoria === 'Stipendio')
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  const consiglio = $('#soglia-consiglio');
  if (stipendi.length && impostazioni.soglia) {
    const margine = stipendi[0].importo - impostazioni.soglia;
    consiglio.innerHTML = 'Con l\'ultimo stipendio di ' + euro(stipendi[0].importo) + ', questa soglia '
      + (margine > 0 ? 'ti lascia ' + euro(margine) + ' di margine.' : 'e\' piu\' alta dello stipendio: l\'avviso arrivera\' dopo che il mese e\' gia\' in rosso.');
  } else if (stipendi.length) {
    consiglio.innerHTML = 'Il tuo ultimo stipendio e\' di ' + euro(stipendi[0].importo) + '. Per esempio, una soglia di '
      + euro(Math.floor(stipendi[0].importo * 0.85 / 5000) * 5000) + ' ti lascia un margine di sicurezza.';
  } else {
    consiglio.innerHTML = 'Per esempio: se guadagni 1.800 €, una soglia di 1.600 € ti lascia 200 € di margine.';
  }

  // --- percentuale
  const fp = $('#form-percentuale');
  if (document.activeElement !== fp.percentuale) fp.percentuale.value = impostazioni.percentualeObiettivo || '';
  $('#percentuale-togli').hidden = !impostazioni.percentualeObiettivo;

  // --- traguardo
  const o = impostazioni.obiettivo;
  const fo = $('#form-obiettivo');
  $('#obiettivo-togli').hidden = !o;
  if (!fo.contains(document.activeElement)) {
    fo.nome.value = o ? o.nome : '';
    fo.importo.value = o ? importoPerCampo(o.importo) : '';
    fo.entro.value = o ? o.entro : '';
    fo.partenza.value = o && o.partenza ? importoPerCampo(o.partenza) : '';
    fo.da.value = o ? o.da : oggiIso();
  }
}

async function salvaImpostazioni(corpo) {
  const risposta = await chiama('PUT', '/api/impostazioni', corpo);
  stato.dati.impostazioni = risposta.impostazioni;
  if (document.activeElement) document.activeElement.blur();
  disegna();
}

async function salvaSoglia(evento) {
  evento.preventDefault();
  const soglia = leggiImporto(evento.target.soglia.value);
  if (soglia === null) { avviso('La soglia non si legge. Scrivila cosi\': 1.600 oppure 1600,00'); return; }
  await salvaImpostazioni({ soglia });
}

async function salvaPercentuale(evento) {
  evento.preventDefault();
  const n = Number(String(evento.target.percentuale.value).replace(',', '.'));
  if (!(n > 0 && n <= 100)) { avviso('Scrivi una percentuale fra 1 e 100.'); return; }
  await salvaImpostazioni({ percentualeObiettivo: n });
}

async function salvaObiettivo(evento) {
  evento.preventDefault();
  const f = evento.target;
  const importo = leggiImporto(f.importo.value);
  if (importo === null) { avviso('La cifra del traguardo non si legge. Scrivila cosi\': 5.000 oppure 5000,00'); return; }
  let partenza = 0;
  if (f.partenza.value.trim()) {
    partenza = leggiImporto(f.partenza.value);
    if (partenza === null) { avviso('"Gia\' da parte" non si legge. Lascialo vuoto se parti da zero.'); return; }
  }
  await salvaImpostazioni({ obiettivo: { nome: f.nome.value, importo, entro: f.entro.value, da: f.da.value, partenza } });
}

async function togliObiettivo() {
  if (!confirm('Togliere il traguardo? I movimenti restano, sparisce solo il conteggio.')) return;
  await salvaImpostazioni({ obiettivo: null });
}

// ================================================================ COPIA DI SICUREZZA

const GIORNI_PROMEMORIA = 30;

function giorniDa(isoCompleto) {
  if (!isoCompleto) return null;
  const d = new Date(isoCompleto);
  return isNaN(d) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
}

function testoUltimaCopia() {
  const g = giorniDa(stato.dati.impostazioni.ultimaCopia);
  if (g === null) return 'Nessuna copia fatta finora.';
  if (g === 0) return 'Ultima copia: oggi.';
  if (g === 1) return 'Ultima copia: ieri.';
  return 'Ultima copia: ' + g + ' giorni fa.';
}

/* Sul telefono i dati stanno solo li'. Se non c'e' mai stata una copia, o
   l'ultima ha piu' di un mese, lo ricordo in cima a Giorno per giorno. */
function disegnaPromemoriaCopia() {
  const box = $('#promemoria-copia');
  const g = giorniDa(stato.dati.impostazioni.ultimaCopia);
  const serve = SUL_TELEFONO && stato.dati.movimenti.length > 0 && (g === null || g >= GIORNI_PROMEMORIA);
  box.hidden = !serve;
  if (!serve) return;
  box.innerHTML = '<span>' + (g === null ? 'I tuoi dati stanno solo su questo telefono e non ne hai ancora una copia.'
    : 'L\'ultima copia di sicurezza ha ' + g + ' giorni.') + '</span>'
    + '<button class="collegamento" data-copia="salva">Salvala ora</button>';
}

/* Salva l'archivio in un file. Sull'iPhone si apre il foglio di
   condivisione: "Salva su File" e scegli iCloud Drive. Sul computer il
   file finisce fra i download. */
async function salvaCopia() {
  const dati = await chiama('GET', '/api/dati');
  const nome = 'salvadanaio-' + oggiIso() + '.json';
  const file = new File([JSON.stringify(dati, null, 2)], nome, { type: 'application/json' });
  let fatta = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Salvadanaio: copia di sicurezza' });
      fatta = true;
    } catch (e) {
      if (e.name === 'AbortError') return; // hai chiuso il foglio senza salvare: nessuna copia
      fatta = scaricaFile(file);
    }
  } else {
    fatta = scaricaFile(file);
  }
  if (fatta) {
    const r = await chiama('POST', '/api/copia-fatta');
    stato.dati.impostazioni = r.impostazioni;
    avviso('Copia salvata: ' + nome, true);
    disegna();
  }
}

function scaricaFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

// Carica un file di copia e sostituisce l'archivio di questo dispositivo.
async function caricaCopia(file) {
  let letto;
  try {
    letto = JSON.parse(await file.text());
  } catch (e) {
    avviso('Questo file non e\' una copia del Salvadanaio.');
    return;
  }
  const n = Array.isArray(letto.movimenti) ? letto.movimenti.length : 0;
  const f = Array.isArray(letto.fisse) ? letto.fisse.length : 0;
  const qui = stato.dati.movimenti.length;
  if (!confirm('Caricare la copia "' + file.name + '"?\n\nContiene ' + n + ' movimenti e ' + f + ' voci fisse.'
    + (qui ? '\n\nI ' + qui + ' movimenti che ci sono ora su questo dispositivo verranno sostituiti.' : ''))) return;
  const r = await chiama('POST', '/api/importa', { dati: letto });
  stato.dati = r.dati;
  aggiornaCategorie();
  avviso('Copia caricata: ' + n + ' movimenti.', true);
  mostraVista('giorni');
}

// ================================================================ INSTALLAZIONE SULL'IPHONE

const APERTA_DALLA_HOME = window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches;
const E_UN_IPHONE = /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* Aperta in Safari e non dalla Home: spiego come installarla. E avviso che
   quello che si scrive qui in Safari resta in Safari: l'app sulla Home ha
   una memoria sua. */
function disegnaInstalla() {
  const box = $('#installa');
  const mostra = SUL_TELEFONO && E_UN_IPHONE && !APERTA_DALLA_HOME;
  box.hidden = !mostra;
  if (!mostra) return;
  box.innerHTML = '<span><strong>Installala sulla Home:</strong> tocca il bottone Condividi '
    + '<svg class="icona-condividi" viewBox="0 0 24 24" width="17" height="17" aria-label="Condividi">'
    + '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" '
    + 'stroke-linecap="round" stroke-linejoin="round"/></svg> in basso, poi <strong>Aggiungi alla schermata Home</strong>. '
    + 'Poi aprila da li\': quello che scrivi qui in Safari non passa all\'app installata.</span>';
}

// ================================================================ avvio

function collega() {
  for (const b of document.querySelectorAll('.scheda')) b.addEventListener('click', () => mostraVista(b.dataset.vista));

  $('#mese-prima').onclick = () => { stato.mese = spostaMese(stato.mese, -1); disegna(); };
  $('#mese-dopo').onclick = () => { stato.mese = spostaMese(stato.mese, 1); disegna(); };
  $('#mese-oggi').onclick = () => { stato.mese = meseCorrente(); disegna(); };

  const f = $('#form-movimento');
  f.addEventListener('submit', salvaMovimento);
  for (const r of f.querySelectorAll('[name=tipo]')) {
    r.addEventListener('change', () => { f.categoria.value = ''; aggiornaCategorie(); });
  }
  $('#bottone-annulla').onclick = () => { svuotaModulo(); aggiornaCategorie(); };

  $('#elenco-giorni').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-azione]');
    if (!b) return;
    if (b.dataset.azione === 'modifica') iniziaModifica(b.dataset.id);
    if (b.dataset.azione === 'elimina') eliminaMovimento(b.dataset.id);
  });

  // Bottoni sparsi nella pagina: "vai a una scheda", "vai a un mese", "segna come letta".
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vai], [data-mese], [data-letta], [data-copia]');
    if (!b) return;
    if (b.dataset.copia) return salvaCopia();
    if (b.dataset.letta) return segnaLette([b.dataset.letta]);
    if (b.dataset.mese) { stato.mese = b.dataset.mese; return mostraVista('mese'); }
    if (b.dataset.vai) return mostraVista(b.dataset.vai);
  });
  $('#segna-lette').onclick = () => segnaLette(null);

  // Col dito, il riquadro coi numeri del grafico si chiude toccando altrove.
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.grafico')) $('#suggerimento-grafico').hidden = true;
  });

  $('#salva-copia').onclick = salvaCopia;
  $('#carica-copia').onclick = () => $('#file-copia').click();
  $('#file-copia').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) caricaCopia(file).catch(() => {}); // l'errore e' gia' stato mostrato
  });

  const fv = $('#form-voce');
  fv.addEventListener('submit', inviaModuloVoce);
  for (const r of fv.querySelectorAll('[name=tipo]')) {
    r.addEventListener('change', () => { fv.categoria.value = ''; aggiornaCategorieVoce(); });
  }
  $('#bottone-annulla-voce').onclick = svuotaModuloVoce;
  $('#vista-fisse').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-voce]');
    if (!b) return;
    if (b.dataset.voce === 'modifica') iniziaModificaVoce(b.dataset.id);
    if (b.dataset.voce === 'elimina') eliminaVoce(b.dataset.id);
  });

  $('#form-soglia').addEventListener('submit', salvaSoglia);
  $('#soglia-togli').onclick = () => salvaImpostazioni({ soglia: null });
  $('#form-percentuale').addEventListener('submit', salvaPercentuale);
  $('#percentuale-togli').onclick = () => salvaImpostazioni({ percentualeObiettivo: null });
  $('#form-obiettivo').addEventListener('submit', salvaObiettivo);
  $('#obiettivo-togli').onclick = togliObiettivo;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stato.modifica) { svuotaModulo(); aggiornaCategorie(); }
    if (e.key === 'Escape' && stato.modificaVoce) svuotaModuloVoce();
  });
}

// Se la finestra cambia larghezza, i grafici si ridisegnano alla misura nuova.
let timerRidisegno;
window.addEventListener('resize', () => {
  clearTimeout(timerRidisegno);
  timerRidisegno = setTimeout(() => { if (stato.vista === 'grafico') disegna(); }, 150);
});

// Sul telefono l'app resta aperta in sottofondo per giorni: quando torna in
// primo piano ricarico, cosi' le voci fisse arrivate nel frattempo entrano.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !stato.modifica && !stato.modificaVoce) {
    caricaTutto().catch(() => {});
  }
});

collega();
$('#form-movimento [name=data]').value = oggiIso();
caricaTutto().then(aggiornaCategorie);

if (SUL_TELEFONO) {
  Memoria.rendiPersistente();
  // Il "service worker" tiene una copia della pagina, cosi' si apre anche senza rete.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

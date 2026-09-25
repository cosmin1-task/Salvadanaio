/* Salvadanaio - logica dell'interfaccia.
   Tutto gira nel browser; i dati vengono letti e scritti dal server locale.
   I calcoli stanno in conti.js: qui si disegna e si ascoltano i clic. */

// ---------------------------------------------------------------- stato

const stato = {
  dati: { movimenti: [], impostazioni: { percentualeObiettivo: null, obiettivo: null } },
  vista: 'mese',
  mese: meseDi(oggiIso()),
  modifica: null, // id del movimento che si sta correggendo
};

// ---------------------------------------------------------------- utilita'

const $ = (selettore) => document.querySelector(selettore);

function esc(testo) {
  return String(testo == null ? '' : testo)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function dataLeggibile(iso) {
  if (!E_UNA_DATA(iso)) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function percentuale(p) {
  if (p === null || p === undefined) return '—';
  return p.toFixed(1).replace('-', '−').replace('.', ',').replace(/,0$/, '') + '%';
}

// Centesimi -> testo da rimettere in un campo ("1234,50")
function importoPerCampo(c) {
  return euro(c).replace(' €', '');
}

const meseCorrente = () => meseDi(oggiIso());

let timerAvviso;
function avviso(testo) {
  const el = $('#avviso');
  el.textContent = testo;
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

// ---------------------------------------------------------------- server

async function chiama(metodo, percorso, corpo) {
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
  if (!risposta.ok) {
    avviso(dati.errore || 'Qualcosa e\' andato storto.');
    throw new Error(dati.errore || risposta.status);
  }
  if (metodo !== 'GET') segnalaSalvato();
  return dati;
}

async function caricaTutto() {
  stato.dati = await chiama('GET', '/api/dati');
  disegna();
}

// ---------------------------------------------------------------- viste

function mostraVista(nome) {
  stato.vista = nome;
  for (const b of document.querySelectorAll('.scheda')) b.classList.toggle('attiva', b.dataset.vista === nome);
  for (const v of ['mese', 'andamento', 'obiettivo']) $('#vista-' + v).hidden = v !== nome;
  disegna();
}

function disegna() {
  if (stato.vista === 'mese') disegnaMese();
  if (stato.vista === 'andamento') disegnaAndamento();
  if (stato.vista === 'obiettivo') disegnaObiettivo();
}

// ---------------------------------------------------------------- vista: mese

function disegnaMese() {
  const { movimenti, impostazioni } = stato.dati;
  const r = riepilogoMese(movimenti, stato.mese);
  const corrente = meseCorrente();

  $('#mese-nome').textContent = nomeMese(stato.mese);
  $('#mese-oggi').hidden = stato.mese === corrente;

  // Il form propone una data dentro il mese che stai guardando.
  const campoData = $('#form-movimento [name=data]');
  if (!stato.modifica && meseDi(campoData.value) !== stato.mese) {
    campoData.value = stato.mese === corrente ? oggiIso() : stato.mese + '-01';
  }

  disegnaSuggerimentoStipendio();

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
    tessera('Avanzato' + inCorso, euro(r.avanzato, true), r.avanzato < 0 ? 'hai speso piu\' di quanto e\' entrato' : 'entrate meno uscite',
      r.avanzato < 0 ? 'negativo' : (r.avanzato > 0 ? 'positivo' : '')),
    tessera('Messo da parte', percentuale(r.percentuale), notaPercentuale, '', classeNota),
  ].join('');

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

  // --- elenco dei movimenti, raggruppati per giorno
  const delMese = movimenti.filter((m) => meseDi(m.data) === stato.mese)
    .sort((a, b) => (a.data === b.data ? (a.creato < b.creato ? 1 : -1) : (a.data < b.data ? 1 : -1)));
  const contMov = $('#elenco-movimenti');
  if (!delMese.length) {
    contMov.innerHTML = '<div class="vuoto">Nessun movimento in ' + esc(nomeMese(stato.mese)) + '.<br>Inizia dal modulo qui sopra.</div>';
    return;
  }
  let html = '', giorno = '';
  for (const m of delMese) {
    if (m.data !== giorno) { giorno = m.data; html += '<div class="giorno">' + esc(dataLeggibile(giorno)) + '</div>'; }
    const entrata = m.tipo === 'entrata';
    html += '<div class="movimento">'
      + '<div class="movimento-testo">'
      + '<span class="movimento-descrizione">' + esc(m.descrizione || m.categoria) + '</span>'
      + (m.descrizione ? '<span class="movimento-categoria">' + esc(m.categoria) + '</span>' : '')
      + '</div>'
      + '<span class="movimento-importo numero' + (entrata ? ' positivo' : '') + '">' + euro(entrata ? m.importo : -m.importo) + '</span>'
      + '<span class="azioni">'
      + '<button class="bottone-icona" data-azione="modifica" data-id="' + esc(m.id) + '">Modifica</button>'
      + '<button class="bottone-icona pericolo" data-azione="elimina" data-id="' + esc(m.id) + '">Elimina</button>'
      + '</span></div>';
  }
  contMov.innerHTML = html;
}

function tessera(etichetta, valore, nota, classeValore, classeNota) {
  return '<div class="tessera">'
    + '<div class="tessera-etichetta">' + esc(etichetta) + '</div>'
    + '<div class="tessera-valore numero ' + (classeValore || '') + '">' + esc(valore) + '</div>'
    + '<div class="tessera-nota ' + (classeNota || '') + '">' + esc(nota) + '</div>'
    + '</div>';
}

function disegnaSuggerimentoStipendio() {
  const box = $('#suggerimento-stipendio');
  // Solo per il mese in corso o quelli passati: lo stipendio del futuro non e' ancora arrivato.
  const proposta = stato.mese <= meseCorrente() ? stipendioDaCopiare(stato.dati.movimenti, stato.mese) : null;
  if (!proposta) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = '<span>Lo stipendio di ' + esc(nomeMese(stato.mese)) + ' non c\'e\' ancora. '
    + 'Il mese scorso era di <strong class="numero">' + euro(proposta.importo) + '</strong>.</span>'
    + '<button class="bottone-primario" id="copia-stipendio">Aggiungilo uguale, il ' + Number(proposta.data.slice(8)) + '</button>'
    + '<button class="bottone-leggero" id="stipendio-diverso">Era diverso</button>';
  $('#copia-stipendio').onclick = async () => {
    const nuovo = await chiama('POST', '/api/movimenti', proposta);
    stato.dati.movimenti.unshift(nuovo);
    disegna();
  };
  $('#stipendio-diverso').onclick = () => {
    const f = $('#form-movimento');
    f.tipo.value = 'entrata';
    aggiornaCategorie();
    f.categoria.value = 'Stipendio';
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
    const aggiornato = await chiama('PUT', '/api/movimenti/' + stato.modifica, corpo);
    const i = stato.dati.movimenti.findIndex((m) => m.id === aggiornato.id);
    stato.dati.movimenti[i] = aggiornato;
  } else {
    stato.dati.movimenti.unshift(await chiama('POST', '/api/movimenti', corpo));
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
  if (!confirm('Eliminare questo movimento?\n\n' + cosa)) return;
  await chiama('DELETE', '/api/movimenti/' + id);
  stato.dati.movimenti = stato.dati.movimenti.filter((x) => x.id !== id);
  if (stato.modifica === id) svuotaModulo();
  disegna();
}

// ---------------------------------------------------------------- vista: andamento

function disegnaAndamento() {
  const mesi = andamento(stato.dati.movimenti, meseCorrente());
  const grafico = $('#grafico-andamento');
  const tabella = $('#tabella-andamento');
  if (!mesi.length) {
    grafico.innerHTML = '<div class="vuoto">Il grafico compare quando avrai segnato qualche movimento.</div>';
    tabella.innerHTML = '';
    return;
  }

  // --- grafico a colonne: ultimi 12 mesi
  const ultimi = mesi.slice(-12);
  const L = 820, A = 260, sx = 64, dx = 8, su = 12, giu = 28;
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
    svg += '<g class="colonna" data-indice="' + i + '">';
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
    g.addEventListener('mousemove', (e) => {
      tip.innerHTML = '<strong>' + esc(nomeMese(r.mese)) + (r.mese === meseCorrente() ? ' (in corso)' : '') + '</strong>'
        + rigaSuggerimento('Entrate', euro(r.entrate))
        + rigaSuggerimento('Uscite', euro(r.uscite))
        + rigaSuggerimento('Avanzato', euro(r.avanzato, true))
        + rigaSuggerimento('Messo da parte', percentuale(r.percentuale));
      tip.hidden = false;
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
      tip.style.left = x + 'px';
      tip.style.top = (e.clientY + 14) + 'px';
    });
    g.addEventListener('mouseleave', () => { tip.hidden = true; });
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

// Etichette dell'asse: niente centesimi, "1,5k" oltre i mille
function euroCorto(c) {
  const e = c / 100;
  const segno = e < 0 ? '−' : '';
  const a = Math.abs(e);
  if (a >= 1000) return segno + (a / 1000).toFixed(a % 1000 === 0 ? 0 : 1).replace('.', ',') + 'k €';
  return segno + Math.round(a) + ' €';
}

// ---------------------------------------------------------------- vista: obiettivo

function disegnaObiettivo() {
  const { movimenti, impostazioni } = stato.dati;

  // --- percentuale
  const fp = $('#form-percentuale');
  if (document.activeElement !== fp.percentuale) {
    fp.percentuale.value = impostazioni.percentualeObiettivo || '';
  }
  $('#percentuale-togli').hidden = !impostazioni.percentualeObiettivo;

  // --- traguardo
  const o = impostazioni.obiettivo;
  const fo = $('#form-obiettivo');
  const box = $('#progresso-obiettivo');
  $('#obiettivo-togli').hidden = !o;
  if (!fo.contains(document.activeElement)) {
    fo.nome.value = o ? o.nome : '';
    fo.importo.value = o ? importoPerCampo(o.importo) : '';
    fo.entro.value = o ? o.entro : '';
    fo.partenza.value = o && o.partenza ? importoPerCampo(o.partenza) : '';
    fo.da.value = o ? o.da : oggiIso();
  }
  if (!o) {
    box.innerHTML = '<p class="spiegazione" style="margin:0">Nessun traguardo. Scegli una cifra da raggiungere, '
      + 'e ti dico a che punto sei e quanto serve al mese per arrivarci.</p>';
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
      if (arrivo) {
        righe.push('Al ritmo ' + quali + ' (' + euro(media.media) + ' al mese) ci arrivi a <strong>'
          + esc(nomeMese(arrivo)) + '</strong>.');
      } else {
        righe.push('Al ritmo ' + quali + ' (' + euro(media.media, true) + ' al mese) non ci arrivi: '
          + 'in quei mesi non e\' avanzato nulla.');
      }
    } else {
      righe.push('<span class="spiegazione">Quando avrai chiuso almeno un mese, ti dico anche in quanto tempo ci arrivi al ritmo attuale.</span>');
    }
  }

  box.innerHTML = '<div class="progresso-titolo">'
    + '<span class="progresso-nome">' + esc(o.nome || 'Traguardo') + '</span>'
    + '<span class="progresso-cifre numero">' + euro(p.accumulato) + ' di ' + euro(o.importo)
    + ' · ' + Math.floor(p.quota * 100) + '%</span></div>'
    + '<div class="progresso-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'
    + Math.floor(p.quota * 100) + '"><div style="width:' + (p.quota * 100).toFixed(1) + '%"></div></div>'
    + '<ul class="progresso-righe">' + righe.map((r) => '<li>' + r + '</li>').join('') + '</ul>';
}

async function salvaPercentuale(evento) {
  evento.preventDefault();
  const valore = String(evento.target.percentuale.value).replace(',', '.');
  const n = Number(valore);
  if (!(n > 0 && n <= 100)) { avviso('Scrivi una percentuale fra 1 e 100.'); return; }
  stato.dati.impostazioni = await chiama('PUT', '/api/impostazioni', { percentualeObiettivo: n });
  evento.target.percentuale.blur();
  disegna();
}

async function togliPercentuale() {
  stato.dati.impostazioni = await chiama('PUT', '/api/impostazioni', { percentualeObiettivo: null });
  disegna();
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
  stato.dati.impostazioni = await chiama('PUT', '/api/impostazioni', {
    obiettivo: { nome: f.nome.value, importo, entro: f.entro.value, da: f.da.value, partenza },
  });
  document.activeElement.blur();
  disegna();
}

async function togliObiettivo() {
  if (!confirm('Togliere il traguardo? I movimenti restano, sparisce solo il conteggio.')) return;
  stato.dati.impostazioni = await chiama('PUT', '/api/impostazioni', { obiettivo: null });
  disegna();
}

// ---------------------------------------------------------------- avvio

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

  $('#elenco-movimenti').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-azione]');
    if (!b) return;
    if (b.dataset.azione === 'modifica') iniziaModifica(b.dataset.id);
    if (b.dataset.azione === 'elimina') eliminaMovimento(b.dataset.id);
  });

  $('#form-percentuale').addEventListener('submit', salvaPercentuale);
  $('#percentuale-togli').onclick = togliPercentuale;
  $('#form-obiettivo').addEventListener('submit', salvaObiettivo);
  $('#obiettivo-togli').onclick = togliObiettivo;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stato.modifica) { svuotaModulo(); aggiornaCategorie(); }
  });
}

collega();
$('#form-movimento [name=data]').value = oggiIso();
caricaTutto().then(aggiornaCategorie);

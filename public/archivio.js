/* Salvadanaio - l'archivio.
   Tutte le regole su come cambiano i dati: cosa si accetta, cosa si rifiuta,
   quando arrivano le voci fisse, quando scatta un avviso.

   Lo usano due padroni diversi, con le stesse identiche regole:
   - server.js sul Mac, che poi scrive il risultato in dati.json;
   - la pagina sull'iPhone, che lo salva nella memoria del telefono.

   Qui non si legge e non si scrive niente: si riceve l'archivio, si fa la
   modifica e si dice se e' cambiato. Dove salvarlo lo decide chi chiama. */

const Archivio = (function () {
  // Nel Mac (Node) i calcoli si caricano con require; nel browser sono gia' li'.
  const C = (typeof module !== 'undefined' && module.exports)
    ? require('./conti.js')
    : { meseDi, spostaMese, controllaAvvisi, fisseDaCreare, movimentoSimile };

  const TIPI = ['entrata', 'uscita'];

  class Errore400 extends Error {}

  function vuoto() {
    return {
      movimenti: [],
      impostazioni: { percentualeObiettivo: null, obiettivo: null, soglia: null, ultimaCopia: null },
      notifiche: [],
      fisse: [],
    };
  }

  /* Porta un archivio di qualunque versione alla forma attuale.
     I dati della 0.0 non hanno soglia e notifiche, quelli della 0.1 non hanno
     le voci fisse, quelli della 0.2 non sanno quando e' stata fatta l'ultima
     copia di sicurezza. */
  function sistema(dati) {
    if (!dati || typeof dati !== 'object' || Array.isArray(dati)) throw new Errore400('Non e\' un archivio del Salvadanaio');
    if (!Array.isArray(dati.movimenti)) dati.movimenti = [];
    if (!dati.impostazioni || typeof dati.impostazioni !== 'object') dati.impostazioni = vuoto().impostazioni;
    for (const [chiave, valore] of Object.entries(vuoto().impostazioni)) {
      if (!(chiave in dati.impostazioni)) dati.impostazioni[chiave] = valore;
    }
    if (!Array.isArray(dati.notifiche)) dati.notifiche = [];
    if (!Array.isArray(dati.fisse)) dati.fisse = [];
    return dati;
  }

  function nuovoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const E_UNA_DATA = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const E_UN_MESE = (v) => /^\d{4}-\d{2}$/.test(v || '');

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

  // ---------------------------------------------------------------- normalizzazione

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
      // Il legame con la voce fissa lo mette solo l'archivio: dalla pagina non si tocca.
      fissaId: vecchio.fissaId || '',
      creato: vecchio.creato || new Date().toISOString(),
      aggiornato: new Date().toISOString(),
    };
  }

  function normalizzaVoce(corpo, precedente, oggi) {
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
      da: vecchio.da || (E_UN_MESE(corpo.da) ? corpo.da : C.meseDi(oggi || oggiIso())),
      mesiFatti: Array.isArray(vecchio.mesiFatti) ? vecchio.mesiFatti.filter(E_UN_MESE) : [],
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

  // ---------------------------------------------------------------- avvisi e voci fisse

  /* Dopo ogni modifica guardo se i mesi toccati meritano un avviso.
     Solo il mese in corso e quello prima: se oggi segni una spesa di tre mesi
     fa, un avviso su un mese chiuso da un pezzo non serve a nessuno. Il mese
     prima si', perche' le ultime spese si segnano spesso nei primi giorni. */
  function generaAvvisi(dati, mesiToccati, oggi) {
    const giorno = oggi || oggiIso();
    const questo = C.meseDi(giorno);
    const precedente = C.spostaMese(questo, -1);
    const nuovi = [];
    for (const mese of new Set(mesiToccati)) {
      if (mese !== questo && mese !== precedente) continue;
      for (const a of C.controllaAvvisi(dati.movimenti, dati.impostazioni, mese, dati.notifiche, dati.fisse, giorno)) {
        const notifica = Object.assign({ id: nuovoId(), creata: new Date().toISOString(), letta: false }, a);
        dati.notifiche.unshift(notifica);
        nuovi.push(notifica);
      }
    }
    return nuovi;
  }

  /* Crea i movimenti delle voci fisse arrivate al loro giorno (anche quelli
     persi mentre il programma era chiuso). Restituisce i mesi toccati. */
  function allineaFisse(dati, oggi) {
    const mesi = [];
    for (const { voce, mese, movimento } of C.fisseDaCreare(dati.fisse, oggi || oggiIso())) {
      dati.movimenti.unshift(normalizzaMovimento(movimento, { fissaId: voce.id }));
      voce.mesiFatti = (voce.mesiFatti || []).concat(mese);
      mesi.push(mese);
    }
    return mesi;
  }

  /* Un archivio arrivato da fuori (una copia di sicurezza, o il dati.json
     del Mac). Ogni pezzo passa dagli stessi controlli di un inserimento a
     mano: se qualcosa non torna, si rifiuta tutto e non si tocca niente. */
  function daImportare(grezzo) {
    const d = sistema(JSON.parse(JSON.stringify(grezzo)));
    const pulito = vuoto();
    d.movimenti.forEach((m, i) => {
      try { pulito.movimenti.push(normalizzaMovimento(m, m)); }
      catch (e) { throw new Errore400('Il movimento n. ' + (i + 1) + ' non e\' valido: ' + e.message); }
    });
    d.fisse.forEach((v, i) => {
      try { pulito.fisse.push(normalizzaVoce(v, v)); }
      catch (e) { throw new Errore400('La voce fissa n. ' + (i + 1) + ' non e\' valida: ' + e.message); }
    });
    // Aggiornato e creato restano quelli originali: importare non e' modificare.
    pulito.movimenti.forEach((m, i) => {
      if (d.movimenti[i].aggiornato) m.aggiornato = d.movimenti[i].aggiornato;
    });
    pulito.impostazioni = Object.assign(normalizzaImpostazioni(d.impostazioni, vuoto().impostazioni),
      { ultimaCopia: d.impostazioni.ultimaCopia || null });
    pulito.notifiche = d.notifiche.filter((n) => n && typeof n === 'object' && n.id && n.tipo);
    return pulito;
  }

  // ---------------------------------------------------------------- le richieste

  /* Il cuore: una richiesta della pagina (metodo, percorso, corpo) applicata
     all'archivio. Restituisce { codice, corpo, modificato }.
     "modificato" dice a chi chiama se va salvato. */
  function rispondi(dati, metodo, percorso, corpo, oggi) {
    corpo = corpo || {};
    const giorno = oggi || oggiIso();
    const questoMese = C.meseDi(giorno);
    const ok = (c, risposta, modificato) => ({ codice: c, corpo: risposta, modificato: !!modificato });
    try {
      // Tutto l'archivio. Aprire la pagina e' il momento in cui le voci fisse
      // arrivate si registrano.
      if (percorso === '/api/dati' && metodo === 'GET') {
        const mesi = allineaFisse(dati, giorno);
        if (mesi.length) generaAvvisi(dati, mesi, giorno);
        return ok(200, dati, mesi.length > 0);
      }

      // Sostituire tutto con una copia di sicurezza.
      if (percorso === '/api/importa' && metodo === 'POST') {
        const nuovo = daImportare(corpo.dati);
        for (const k of Object.keys(dati)) delete dati[k];
        Object.assign(dati, nuovo);
        allineaFisse(dati, giorno);
        return ok(200, { dati }, true);
      }

      // Segna che una copia di sicurezza e' stata appena fatta.
      if (percorso === '/api/copia-fatta' && metodo === 'POST') {
        dati.impostazioni.ultimaCopia = new Date().toISOString();
        return ok(200, { impostazioni: dati.impostazioni }, true);
      }

      // Le voci fisse. Ogni modifica rimanda tutto l'archivio, perche' creare
      // una voce puo' creare anche dei movimenti.
      if (percorso.startsWith('/api/fisse')) {
        const idVoce = percorso.split('/').filter(Boolean)[2];
        let collegato = null;
        if (metodo === 'POST' && !idVoce) {
          const voce = normalizzaVoce(corpo, null, giorno);
          // Se questo mese l'avevi gia' segnato a mano, quello e' il movimento
          // di questa voce: lo lego invece di crearne un doppione.
          if (voce.da === questoMese) {
            const simile = C.movimentoSimile(dati.movimenti, voce, questoMese);
            if (simile) {
              simile.fissaId = voce.id;
              voce.mesiFatti.push(questoMese);
              collegato = simile;
            }
          }
          dati.fisse.push(voce);
        } else if (metodo === 'PUT' && idVoce) {
          const i = dati.fisse.findIndex((v) => v.id === idVoce);
          if (i === -1) return ok(404, { errore: 'Non trovata' });
          dati.fisse[i] = normalizzaVoce(Object.assign({}, dati.fisse[i], corpo), dati.fisse[i], giorno);
        } else if (metodo === 'DELETE' && idVoce) {
          const i = dati.fisse.findIndex((v) => v.id === idVoce);
          if (i === -1) return ok(404, { errore: 'Non trovata' });
          dati.fisse.splice(i, 1);
          // I movimenti gia' creati restano cosi' come sono: sono soldi usciti
          // davvero, e in quei mesi erano spese fisse. Dal prossimo non se ne creano piu'.
        } else {
          return ok(405, { errore: 'Metodo non ammesso' });
        }
        const mesi = allineaFisse(dati, giorno);
        const nuoveNotifiche = generaAvvisi(dati, mesi.concat(questoMese), giorno);
        return ok(200, { dati, nuoveNotifiche, collegato }, true);
      }

      // Percentuale, traguardo e soglia.
      if (percorso === '/api/impostazioni' && metodo === 'PUT') {
        dati.impostazioni = normalizzaImpostazioni(corpo, dati.impostazioni);
        // Una soglia appena abbassata puo' essere gia' superata.
        const nuoveNotifiche = generaAvvisi(dati, [questoMese], giorno);
        return ok(200, { impostazioni: dati.impostazioni, nuoveNotifiche }, true);
      }

      // Segna come lette (tutte, o solo quelle indicate).
      if (percorso === '/api/notifiche/lette' && metodo === 'POST') {
        const quali = Array.isArray(corpo.ids) ? new Set(corpo.ids) : null;
        for (const n of dati.notifiche) if (!quali || quali.has(n.id)) n.letta = true;
        return ok(200, { notifiche: dati.notifiche }, true);
      }

      // I movimenti.
      const pezzi = percorso.split('/').filter(Boolean); // ['api', 'movimenti', id?]
      if (pezzi[1] !== 'movimenti') return ok(404, { errore: 'Sezione sconosciuta' });
      const id = pezzi[2];

      if (metodo === 'POST' && !id) {
        const elemento = normalizzaMovimento(corpo, null);
        dati.movimenti.unshift(elemento);
        const nuoveNotifiche = generaAvvisi(dati, [C.meseDi(elemento.data)], giorno);
        return ok(201, { movimento: elemento, nuoveNotifiche }, true);
      }
      if (metodo === 'PUT' && id) {
        const indice = dati.movimenti.findIndex((e) => e.id === id);
        if (indice === -1) return ok(404, { errore: 'Non trovato' });
        const unito = Object.assign({}, dati.movimenti[indice], corpo);
        const primaEra = C.meseDi(dati.movimenti[indice].data);
        dati.movimenti[indice] = normalizzaMovimento(unito, dati.movimenti[indice]);
        const nuoveNotifiche = generaAvvisi(dati, [primaEra, C.meseDi(dati.movimenti[indice].data)], giorno);
        return ok(200, { movimento: dati.movimenti[indice], nuoveNotifiche }, true);
      }
      if (metodo === 'DELETE' && id) {
        const indice = dati.movimenti.findIndex((e) => e.id === id);
        if (indice === -1) return ok(404, { errore: 'Non trovato' });
        dati.movimenti.splice(indice, 1);
        return ok(200, { ok: true }, true);
      }
      return ok(405, { errore: 'Metodo non ammesso' });
    } catch (err) {
      if (err instanceof Errore400) return ok(400, { errore: err.message });
      if (err instanceof SyntaxError) return ok(400, { errore: 'Il file non e\' leggibile' });
      throw err;
    }
  }

  return { vuoto, sistema, rispondi, Errore400 };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Archivio;

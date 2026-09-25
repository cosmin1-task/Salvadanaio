# Cosa è cambiato

Ogni versione del Salvadanaio, dalla più recente alla più vecchia.

## 0.1 - 25 settembre 2026

Tre schermate per il mese, una soglia di sicurezza e le notifiche.

**Aggiunto**

- Schermata *Giorno per giorno*: le spese divise per giorno, con causale,
  categoria e il totale di ogni giorno. Una riga di sintesi dice quanto hai
  speso oggi, nel mese e quanto manca alla soglia.
- Schermata *Mese*: la vista d'insieme, con i quattro numeri, la soglia, le
  uscite per categoria, le entrate e il traguardo.
- Schermata *Grafico*: in grande se il mese è in positivo o in rosso; sotto,
  entrate e uscite accumulate giorno per giorno contro la soglia, con il
  giorno del superamento segnato; più in basso i mesi a confronto.
- Soglia di sicurezza: una cifra fissa di uscite mensili. Superata, compare
  un avviso a schermo che resta finché non lo chiudi.
- Secondo avviso quando il mese va in rosso (uscite oltre le entrate).
- Scheda *Notifiche*, con lo storico degli avvisi e il numero di quelli non
  letti accanto al nome.
- Scheda *Impostazioni*, che raccoglie soglia, percentuale e traguardo.

**Cambiato**

- Le schede Andamento e Obiettivo non ci sono più come schede a sé: il
  confronto fra i mesi sta nella schermata Grafico, il traguardo nella
  schermata Mese e le sue regole nelle Impostazioni.
- Il campo "Descrizione" si chiama "Causale" e viene subito dopo l'importo.
- La proposta di copiare lo stipendio compare solo dal giorno di paga in poi.
  Prima rischiava di creare un movimento con una data futura.
- I grafici si disegnano alla larghezza vera della finestra: sul telefono le
  scritte restano leggibili.

**Scelte tecniche**

- Prima del giorno di paga lo stipendio del mese scorso conta come "atteso",
  sia per l'avviso di mese in rosso sia per il verdetto del grafico.
  Altrimenti ogni mese sarebbe in rosso fino al 27.
- Gli avvisi li decide il server, dopo ogni modifica, usando lo stesso
  `conti.js` della pagina: le regole stanno in un posto solo e le prove le
  controllano.
- Ogni tipo di avviso scatta al massimo una volta per mese, e solo per il
  mese in corso o quello prima: segnare oggi una spesa di tre mesi fa non
  deve far comparire un avviso su un mese chiuso da tempo.
- I dati della versione 0.0 si aprono senza fare nulla: la soglia parte
  vuota e l'elenco delle notifiche anche.
- Le linee del grafico usano tre colori scelti per restare distinguibili
  anche da chi confonde i colori, e hanno comunque il nome scritto accanto.

## 0.0 - 25 settembre 2026

La prima versione funzionante.

**Aggiunto**

- Movimenti: entrate e uscite con importo, data, categoria e descrizione.
  Si correggono e si eliminano dall'elenco del mese.
- Categorie di partenza (Stipendio ed Extra per le entrate, dieci per le
  uscite). Se ne scrivi una nuova, dalla volta dopo viene proposta.
- Vista Mese: entrate divise fra stipendio ed extra, uscite, quanto è
  avanzato e percentuale messa da parte. Le uscite sono raggruppate per
  categoria, dalla più grande. Si scorre fra i mesi con le frecce.
- Proposta dello stipendio: se il mese scorso c'era e questo mese no, si
  aggiunge uguale con un clic, oppure si corregge l'importo.
- Vista Andamento: grafico di quanto è avanzato ogni mese (ultimi 12), con
  i dettagli al passaggio del mouse, e tabella completa con la media.
- Vista Obiettivo: una percentuale da mettere da parte ogni mese e un
  traguardo in euro, con quanto manca, quanto serve al mese per arrivarci
  entro la data scelta e in che mese ci arrivi al ritmo attuale.
- Gli importi si scrivono come viene: "12,50", "12.50", "1.850", "45 €".
- Avvio con doppio clic su Mac e su Windows, con la stessa ricerca di Node
  del Taccuino.
- Cartella `prove/` con i controlli automatici sui calcoli.

**Scelte tecniche**

- Gli importi sono salvati in centesimi, come numeri interi. Con i numeri
  decimali 0,10 + 0,20 non fa esattamente 0,30, e sui soldi l'errore si vede.
- "Messo da parte" vuol dire entrate meno uscite. Il programma non conosce
  il saldo del conto: i numeri sono completi quanto lo è quello che si segna.
- Il mese in corso non entra nelle medie e nelle previsioni: a metà mese lo
  stipendio è già entrato e le spese no, e la media verrebbe troppo ottimista.
- Un mese senza entrate non ha percentuale ("—" e non 0%).
- I calcoli stanno in `public/conti.js`, separati dalla pagina, così le
  prove li controllano senza aprire il browser.
- Porta 4322, per poter tenere aperto anche il Taccuino sulla 4321.
- Nessuna dipendenza esterna, server in ascolto solo su 127.0.0.1, dati
  fuori dalla cronologia di Git, repository privato.

**Non c'è ancora**

Importazione dell'estratto conto, spese fisse ricorrenti, budget per
categoria, esportazione dei dati.

# Cosa è cambiato

Ogni versione del Salvadanaio, dalla più recente alla più vecchia.

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

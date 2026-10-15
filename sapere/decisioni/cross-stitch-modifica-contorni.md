# Punto croce: i contorni di gruppi e blocchi si modificano

**2026-10-15.** Lorenzo: «introduci la possibilità di modificare i contorni dei gruppi e dei blocchi se
selezionati».

- **Selezione dalla tela.** Con lo strumento Gruppi (o Blocchi) un clic entro 8 px dal bordo di una zona la
  seleziona (l'ultima disegnata vince); la riga nella lista prende lo stato `is-selected` del DS (solo l'aspetto).
  Un clic fuori o Esc deseleziona; cambiando strumento la selezione di un altro tipo si toglie.
- **Modifica.** Vertice trascinato; pallino a metà lato trascinato = vertice nuovo; tasto destro su un vertice lo
  toglie (minimo tre); trascinando dentro si sposta tutto. Vince la maniglia più vicina al clic (sui contorni fitti
  vertice e pallino sono vicini). Un rettangolo diventa un contorno a quattro vertici alla prima modifica; il
  rettangolo che lo contiene si ricalcola. I passaggi si ricalcolano al rilascio.
- **Perché non dalla lista.** Il modo conforme di rendere una riga selezionabile (`rg-list-row__select`, un
  `<button aria-pressed>` con titolo e misura) l'ha creato l'agente del DS sul branch `ds/list-row-select`
  (versione 1.44.0), non ancora unito; il submodule della suite è alla 1.19.1. Quando il DS sarà aggiornato, la riga
  della lista potrà selezionare anche lei (markup in `components/lists.md` del DS).
- Le modifiche ai contorni non entrano nell'Annulla (come gruppi e blocchi, che stanno nei parametri del percorso).
- I contorni ricavati dalle celle (per esempio i blocchi del retro delle Alpi) hanno molti vertici, a gradini: si
  modificano lo stesso, ma è più comodo su quelli disegnati a clic.

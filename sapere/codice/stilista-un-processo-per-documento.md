---
titolo: Stilista apre un processo per documento, e ogni processo carica i plugin
tipo: codice
tool: []
data: 2026-10-20
---

Misurato col plugin RG Stilista Link ([`strumenti-sviluppo/stilista-link/`](../../strumenti-sviluppo/stilista-link/README.md)).
Aprendo un file, `Stilista3.3.exe` lancia: un **processo d'avvio** (riga di comando = il file), il
**processo della finestra** (`--skipOpenCheck <file>`, figlio del primo) e due-tre **riserve** `/WAIT`,
pronte a diventare i documenti successivi. Ogni documento aperto dopo (anche con `LoadNewEmb`) è uno di
questi processi. **Il plugin si carica in tutti**, e `Init` arriva in ognuno.

**Perché conta.** Un plugin che apre una risorsa unica (una porta, un file) la prende nel primo processo
che parte, cioè quello d'avvio, che non ha documenti: la prima versione del link rispondeva «0 oggetti»
mentre la finestra mostrava 84 macchie. E «chiudere Stilista» vuol dire fermare tutti i processi con quel
percorso (è quello che fanno gli script del bridge).

**Come si applica.** Si lavora solo nel processo la cui `IStilista3.Form` è **visibile** (anche il processo
d'avvio ne mostra una, senza documento); una risorsa per finestra (il link: la prima porta libera da 5370) e,
per scegliere fra le finestre, chiedere a ognuna il suo stato (documento, selezione, ultima attivazione).

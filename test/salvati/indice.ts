// Cosa salva ogni tool nel file di progetto, letto dai default dei suoi motori (senza DOM).
// Una funzione per tool, in test/salvati/<tool>.ts. Chiave = percorso nel file (nome per i params, dove.nome per il resto).
import type { Valore } from '../../packages/cervello/src/tipi';
import { salvati as net45 } from './net-45';
import { salvati as patternGrammar } from './pattern-grammar';
import { salvati as interlace } from './interlace';
import { salvati as oblique } from './oblique';
import { salvati as crossStitch } from './cross-stitch';
import { salvati as bitmap } from './bitmap';
import { salvati as striatura } from './striatura';
import { salvati as zonePattern } from './zone-pattern';
import { salvati as cannageRafia } from './cannage-rafia';
import { salvati as broccato } from './broccato';
import { salvati as sfrangiatura } from './sfrangiatura';
import { salvati as pettine } from './pettine';
import { salvati as razza } from './razza';
import { salvati as patternMacchie } from './pattern-macchie';
import { salvati as pittorico } from './pittorico';
import { salvati as reteTestaSpeciale } from './rete-testa-speciale';

export const SALVATI: Record<string, () => Record<string, Valore>> = {
  'net-45': net45,
  'pattern-grammar': patternGrammar,
  'interlace': interlace,
  'oblique': oblique,
  'cross-stitch': crossStitch,
  'bitmap': bitmap,
  'striatura': striatura,
  'zone-pattern': zonePattern,
  'cannage-rafia': cannageRafia,
  'broccato': broccato,
  'sfrangiatura': sfrangiatura,
  'pettine': pettine,
  'razza': razza,
  'pattern-macchie': patternMacchie,
  'pittorico': pittorico,
  'rete-testa-speciale': reteTestaSpeciale,
};

// Avvio standalone del tool Generatore pattern (fuori dalla suite). Il CSS arriva da tool.ts.
import { mountPatternGrammar } from './tool';

mountPatternGrammar(document.getElementById('app')!);

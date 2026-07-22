// Avvio standalone del tool Pattern cannage (fuori dalla suite). Il CSS arriva da tool.ts.
import { mountPatternGrammar } from './tool';

mountPatternGrammar(document.getElementById('app')!);

// Avvio standalone del tool "Sfrangiatura" (fuori dalla suite). Il CSS arriva da tool.ts.
import { mountSfrangiatura } from './tool';

mountSfrangiatura(document.getElementById('app')!);

// Avvio standalone del Compositore (fuori dalla suite). Il CSS arriva da tool.ts.
import { mountCompositore } from './tool';

mountCompositore(document.getElementById('app')!);

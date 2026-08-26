// Avvio standalone del tool "Broccato" (fuori dalla suite). Il CSS arriva da tool.ts.
import { mountBroccato } from './tool';

mountBroccato(document.getElementById('app')!);

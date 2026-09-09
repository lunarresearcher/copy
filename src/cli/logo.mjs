import {lime,soft,A,c} from './ansi.mjs';
export const WORDMARK=[
' ██████╗ ██████╗ ██████╗ ██╗   ██╗',
'██╔════╝██╔═══██╗██╔══██╗╚██╗ ██╔╝',
'██║     ██║   ██║██████╔╝ ╚████╔╝ ',
'██║     ██║   ██║██╔═══╝   ╚██╔╝  ',
'╚██████╗╚██████╔╝██║        ██║   ',
' ╚═════╝ ╚═════╝ ╚═╝        ╚═╝   '
];
export const BARA=[
'        ▄██▄    ',
'   ▄██████████▄ ',
' ▄██████████████',
'█████████████ ▀█',
'████████████████',
'███████████▀▀   ',
' ███ ███ ███ ██ ',
' ▀▀  ▀▀  ▀▀  ▀▀ '
];
export function logoLines(){return WORDMARK.map(x=>lime(x));}
export function baraLines(){return BARA.map((x,i)=>i<6?lime(x):c(A.brightYellow,x));}
export function miniBara(){return lime('▟████▙▖')+' '+soft('COPYBARA');}

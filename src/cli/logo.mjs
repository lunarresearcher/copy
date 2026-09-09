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

const RUN=[
  [
    '  ▄▄  ▄▄     ',
    '▄████████▄▖   ',
    '██████████ ▀▌ ',
    '████████████  ',
    ' ▀▘   ▀▘      ',
  ],
  [
    '  ▄▄  ▄▄     ',
    '▄████████▄▖   ',
    '██████████ ▀▌ ',
    '████████████  ',
    '  ▀▄ ▄▀       ',
  ],
  [
    '   ▄▄  ▄▄    ',
    ' ▄████████▄▖  ',
    ' ██████████ ▀▌',
    ' ████████████ ',
    '  ▄▀ ▀▄       ',
  ],
  [
    '  ▄▄  ▄▄     ',
    '▄████████▄▖   ',
    '██████████ ▀▌ ',
    '████████████  ',
    ' ▀▄   ▄▀      ',
  ]
];

export function runningBaraLines(t=Date.now(),track=22){
  const step=Math.floor(t/120);
  const frame=RUN[step%RUN.length];
  const span=Math.max(2,track-10);
  const cycle=span*2;
  const raw=step%cycle;
  const x=raw<span?raw:cycle-raw;
  return frame.map((line,i)=>' '.repeat(x)+(i===4?c(A.brightYellow,line):lime(line)));
}

export function logoLines(t=Date.now(),track=22){
  const run=runningBaraLines(t,track);
  return WORDMARK.map((x,i)=>lime(x)+(i<run.length?'   '+run[i]:''));
}
export function baraLines(){return BARA.map((x,i)=>i<6?lime(x):c(A.brightYellow,x));}
export function miniBara(t=Date.now()){
  const legs=Math.floor(t/180)%2?'▟████▙▖':'▟████▙▘';
  return lime(legs)+' '+soft('COPYBARA');
}

export const A={
  reset:'\x1b[0m',bold:'\x1b[1m',dim:'\x1b[2m',italic:'\x1b[3m',underline:'\x1b[4m',
  black:'\x1b[30m',red:'\x1b[31m',green:'\x1b[32m',yellow:'\x1b[33m',blue:'\x1b[34m',magenta:'\x1b[35m',cyan:'\x1b[36m',white:'\x1b[37m',
  gray:'\x1b[90m',brightRed:'\x1b[91m',brightGreen:'\x1b[92m',brightYellow:'\x1b[93m',brightCyan:'\x1b[96m',
  bgBlack:'\x1b[40m',bgGreen:'\x1b[42m',bgYellow:'\x1b[43m',bgGray:'\x1b[100m',
};
export const c=(code,s)=>`${code}${s}${A.reset}`;
export const strip=s=>String(s??'').replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g,'').replace(/\x1b\]8;;.*?\x1b\\/g,'');
export const visibleLength=s=>strip(s).length;
export function trunc(s,n){s=String(s??'');if(visibleLength(s)<=n)return s;const plain=strip(s);return plain.slice(0,Math.max(0,n-1))+'…'}
export function pad(s,n,align='left'){const len=visibleLength(s);const d=Math.max(0,n-len);if(align==='right')return' '.repeat(d)+s;if(align==='center'){const l=Math.floor(d/2);return' '.repeat(l)+s+' '.repeat(d-l)}return s+' '.repeat(d)}
export const link=(label,url)=>process.stdout.isTTY?`\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`:label;
export const clear='\x1b[2J\x1b[H';
export const home='\x1b[H';
export const hideCursor='\x1b[?25l';
export const showCursor='\x1b[?25h';
export const altOn='\x1b[?1049h';
export const altOff='\x1b[?1049l';
export function hr(w,ch='─'){return ch.repeat(Math.max(0,w))}
export const rgb=(r,g,b,s)=>`\x1b[38;2;${r};${g};${b}m${s}${A.reset}`;
export const lime=s=>rgb(198,255,0,s);
export const acid=s=>rgb(171,255,0,s);
export const muted=s=>rgb(117,130,119,s);
export const soft=s=>rgb(72,84,75,s);
export const danger=s=>rgb(255,99,99,s);
export const amber=s=>rgb(255,207,92,s);

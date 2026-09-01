import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ESC = '[';
const c = (code, s) => (stdout.isTTY ? `${ESC}${code}m${s}${ESC}0m` : String(s));
export const dim = s => c('2', s);
export const bold = s => c('1', s);
export const accent = s => c('35', s);
export const green = s => c('32', s);
export const red = s => c('31', s);
export const yellow = s => c('33', s);

let rl = null;
const iface = () => (rl ??= createInterface({ input: stdin, output: stdout }));
export function closePrompts() { rl?.close(); rl = null; }

export async function ask(label, { fallback = '', required = false, width = 20 } = {}) {
  const hint = fallback ? dim(` [${fallback}]`) : '';
  for (;;) {
    const answer = (await iface().question(`  ${label.padEnd(width)}${dim('>')}${hint} `)).trim();
    const value = answer || fallback;
    if (value || !required) return value;
    console.log(red(`  ${label} is required`));
  }
}

export function rule(width = 58) { console.log(dim('  ' + '-'.repeat(width))); }

export function fail(message, fix) {
  console.error(`\n  ${red('error')}  ${message}`);
  if (fix) console.error(`  ${dim('fix')}    ${fix}`);
  console.error('');
  closePrompts();
  process.exit(1);
}

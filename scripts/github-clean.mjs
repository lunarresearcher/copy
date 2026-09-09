#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const GENERATED_NAMES = new Set([
  'cli-preview.html',
  'preview-standalone.html',
  'terminal-preview-standalone.html',
]);

function git(args, options = {}) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (options.allowFail) return '';
    throw error;
  }
}

function isGeneratedPreview(path) {
  const name = path.split('/').pop() || path;
  return GENERATED_NAMES.has(name) || /(^|\/)[^/]*-standalone\.html$/i.test(path);
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

console.log('\nCOPY // GITHUB CLEAN\n');

const insideGit = git(['rev-parse', '--is-inside-work-tree'], { allowFail: true }) === 'true';
let tracked = [];
if (insideGit) {
  const out = git(['ls-files', '-z'], { allowFail: true });
  tracked = out ? out.split('\0').filter(Boolean) : [];
}

const candidates = new Set([
  ...GENERATED_NAMES,
  ...tracked.filter(isGeneratedPreview),
]);

let removed = 0;
for (const rel of candidates) {
  const abs = resolve(root, rel);
  if (existsSync(abs)) {
    rmSync(abs, { force: true, recursive: false });
    console.log(`removed   ${rel}`);
    removed += 1;
  }
}

if (insideGit) {
  for (const rel of candidates) {
    git(['rm', '-f', '--cached', '--ignore-unmatch', '--', rel], { allowFail: true });
  }
}

const attrs = `# COPY // GitHub Linguist\n# Generated previews must never dominate repository language stats.\ncli-preview.html linguist-generated=true\npreview-standalone.html linguist-generated=true\nterminal-preview-standalone.html linguist-generated=true\n**/*-standalone.html linguist-generated=true\npublic/bootstrap-state.js linguist-generated=true\n\n# Binary brand / terminal assets.\n*.png binary\n*.webp binary\n`;
writeFileSync(resolve(root, '.gitattributes'), attrs);

const ignorePath = resolve(root, '.gitignore');
let ignore = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8').trimEnd() : '';
const ignoreLines = [
  'cli-preview.html',
  'preview-standalone.html',
  'terminal-preview-standalone.html',
  '*-standalone.html',
];
for (const line of ignoreLines) {
  if (!ignore.split(/\r?\n/).includes(line)) ignore += `\n${line}`;
}
writeFileSync(ignorePath, `${ignore.trimStart()}\n`);

// Show a local source-size estimate after cleanup. This is not GitHub Linguist,
// but it makes stale giant HTML files immediately obvious before a push.
let files = [];
if (insideGit) {
  const current = git(['ls-files', '-co', '--exclude-standard', '-z'], { allowFail: true });
  files = current ? [...new Set(current.split('\0').filter(Boolean))] : [];
} else {
  files = [];
}

const groups = new Map();
for (const rel of files) {
  if (isGeneratedPreview(rel)) continue;
  const abs = resolve(root, rel);
  if (!existsSync(abs)) continue;
  let s;
  try { s = statSync(abs); } catch { continue; }
  if (!s.isFile()) continue;
  const ext = extname(rel).toLowerCase() || '[no ext]';
  if (['.png', '.webp', '.jpg', '.jpeg', '.gif', '.zip'].includes(ext)) continue;
  groups.set(ext, (groups.get(ext) || 0) + s.size);
}

const sorted = [...groups.entries()].sort((a,b)=>b[1]-a[1]);
const total = sorted.reduce((n,[,v])=>n+v,0) || 1;
console.log('\nsource-size estimate after cleanup:');
for (const [ext, bytes] of sorted.slice(0, 10)) {
  const pct = (bytes / total * 100).toFixed(1).padStart(5);
  console.log(`  ${ext.padEnd(10)} ${pct}%   ${human(bytes)}`);
}

if (insideGit) {
  // Stage the cleanup so one command really does the cleanup work. It does not commit or push.
  git(['add', '-A'], { inherit: true, allowFail: true });
  console.log('\ncleanup staged in git.');
  console.log('next:');
  console.log('  git commit -m "clean GitHub language stats"');
  console.log('  git push');
} else {
  console.log('\nnot inside a git repository; files were cleaned locally.');
}

console.log(`\nremoved ${removed} generated preview file${removed === 1 ? '' : 's'}.`);
console.log('GitHub may take a short time to recalculate the language bar after push.\n');

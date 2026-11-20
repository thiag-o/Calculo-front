// Fails when a versioned text file has a NUL or another control character (anything below 0x20 except tab, LF and CR,
// plus DEL). Prints "path:line" for each one. Binary files are skipped by extension.
// Written without literal control characters: the codes are compared as numbers.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp', '.pdf', '.zip', '.gz', '.tgz', '.woff', '.woff2',
  '.ttf', '.otf', '.eot', '.mp3', '.mp4', '.webm', '.wasm', '.xlsx', '.xls', '.docx', '.parquet', '.db', '.sqlite',
]);

const TAB = 9;
const LF = 10;
const CR = 13;
const DEL = 127;

/** @param {number} byte */
export function isForbiddenControl(byte) {
  return (byte < 32 && byte !== TAB && byte !== LF && byte !== CR) || byte === DEL;
}

/**
 * @param {Uint8Array} bytes
 * @returns {{ line: number; code: number }[]} first occurrence per line
 */
export function findControlChars(bytes) {
  const found = [];
  let line = 1;
  let lastReported = 0;
  for (const byte of bytes) {
    if (byte === LF) {
      line += 1;
    } else if (isForbiddenControl(byte) && lastReported !== line) {
      found.push({ line, code: byte });
      lastReported = line;
    }
  }
  return found;
}

function main() {
  const listed = execFileSync('git', ['ls-files', '-z'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  const files = listed.split('\u0000').filter(Boolean);
  let problems = 0;
  for (const file of files) {
    if (BINARY_EXTENSIONS.has(extname(file).toLowerCase()) || !existsSync(file)) continue;
    for (const { line, code } of findControlChars(readFileSync(file))) {
      problems += 1;
      console.error(`${file}:${line}: control character 0x${code.toString(16).padStart(2, '0')} (NUL and others are not allowed)`);
    }
  }
  if (problems > 0) {
    console.error(`check-control-chars: ${problems} line(s) with control characters.`);
    process.exit(1);
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1]?.endsWith('check-control-chars.mjs')) {
  main();
}

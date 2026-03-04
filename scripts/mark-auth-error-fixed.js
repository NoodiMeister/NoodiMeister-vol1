#!/usr/bin/env node
/** Märgi viimane auth-viga parandatuks, et kasutajale kuvataks teade "Viga on parandatud ja testitud". */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = resolve(__dirname, '..', 'logs');
const STATUS_FILE = resolve(LOGS_DIR, 'last-auth-error-status.json');

mkdirSync(LOGS_DIR, { recursive: true });
writeFileSync(
  STATUS_FILE,
  JSON.stringify({ status: 'fixed', fixedAt: new Date().toISOString() }, null, 2),
  'utf-8'
);
console.log('Viimane auth-viga märgitud parandatuks. Kasutaja näeb teavitust, kui leht pollib.');

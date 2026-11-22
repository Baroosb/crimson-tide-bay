// Crimson Tide Bay — the hand-in program for the gta6-01 bounty.
//
// The game itself is the game/ folder beside this file: plain static
// files (an HTML page and its ES modules) that a desktop browser loads
// fully offline — no libraries, no build step, no network. This program
// is only the courier: it copies game/ and screenshots/ into the output
// directory and writes the dossier the judge reads, using the vendored
// make.fun library, which must stay byte-for-byte the kit's own.
//
// Run it the way the grader does (MAKEFUN_OUTPUT_DIR stands in for
// /output outside the grader's container):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally with:  node serve.ts   →   http://localhost:8080

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The caps below mirror the scorer's gate, so an entry the scorer would
// refuse is refused here first: at most 4 screenshots of 256 KiB each,
// at most 993 files and 48 MiB under game/, no game path over 1000
// bytes, and the dossier's source text capped at 160 KiB.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

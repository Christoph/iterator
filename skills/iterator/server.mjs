#!/usr/bin/env node
/**
 * CLI shim over the bundled control plane (lib/app.mjs — synced from the
 * repo-root lib/, where all logic lives). Views, payload contracts, and the
 * single-instance port behavior are documented there.
 */
import { fileURLToPath } from 'node:url';
import { main } from './lib/app.mjs';

await main({ writeScript: fileURLToPath(new URL('./write.mjs', import.meta.url)) });

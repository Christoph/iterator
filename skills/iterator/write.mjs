#!/usr/bin/env node
/**
 * CLI shim over the bundled core (lib/write.mjs — synced from the repo-root
 * lib/, where all logic lives). Ops and payloads are documented there.
 */
import { pathToFileURL } from "node:url";
import { runCli } from "./lib/write.mjs";

export * from "./lib/write.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await runCli(process.argv.slice(2));
}

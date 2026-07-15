#!/usr/bin/env node
/**
 * CLI shim over the bundled core (lib/gather.mjs — synced from the repo-root
 * lib/, where all logic lives). Usage and step list are documented there.
 */
import { pathToFileURL } from "node:url";
import { runCli } from "./lib/gather.mjs";

export * from "./lib/gather.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runCli(process.argv.slice(2));
}

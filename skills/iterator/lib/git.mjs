/**
 * Shared git wrappers — one implementation for gather (soft: '' on error),
 * write (loud: throws a readable error), and staging checks, so callers stop
 * carrying subtly different copies.
 */
import { execFileSync } from "node:child_process";

export function git(args, cwd) {
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "";
	}
}

/** git for write ops: throws a readable error instead of returning ''. */
export function gitOrFail(args, cwd) {
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (e) {
		throw new Error(
			`git ${args.join(" ")} failed: ${String(e.stderr || e.message || "").trim()}`,
		);
	}
}

/** Anything staged in the index? */
export function hasStaged(root) {
	try {
		execFileSync("git", ["diff", "--cached", "--quiet"], {
			cwd: root,
			stdio: "ignore",
		});
		return false;
	} catch {
		return true;
	}
}

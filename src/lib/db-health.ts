import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";

export type DbHealth =
	| { status: "unconfigured" }
	| { status: "unreachable" }
	| { status: "connected"; tableExists: false }
	| { status: "connected"; tableExists: true; comparisonsCount: number };

type CountRow = { count: number };

// Read-only smoke check: connection + table existence + row count only.
// Never writes, never deletes, never runs migrations. Never throws — always
// resolves to a typed result so a page rendering this can never 500 because
// of it, and never leaks host/credentials/SQL/stack traces to the caller.
export async function checkDbHealth(): Promise<DbHealth> {
	// Same lazy ".env" loading as src/db/client.ts / drizzle.config.ts, done
	// here too: this check must reflect the real configured state (including
	// a local ".env" file) rather than only whatever happens to already be in
	// process.env before src/db/client.ts has ever been imported.
	if (existsSync(".env")) {
		process.loadEnvFile(".env");
	}

	if (!process.env.DATABASE_URL) {
		return { status: "unconfigured" };
	}

	try {
		// Imported lazily: src/db/client.ts throws at module load time if
		// DATABASE_URL is missing. That case is already handled above, but a
		// lazy import keeps this check safe even if that ever changes.
		const { db } = await import("../db/client");

		await db.execute(sql`SELECT 1`);

		const [tableRows] = (await db.execute(
			sql`SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'comparisons'`,
		)) as unknown as [CountRow[], unknown];
		const tableExists = Number(tableRows[0]?.count ?? 0) > 0;

		if (!tableExists) {
			return { status: "connected", tableExists: false };
		}

		const [countRows] = (await db.execute(
			sql`SELECT COUNT(*) AS count FROM comparisons`,
		)) as unknown as [CountRow[], unknown];
		const comparisonsCount = Number(countRows[0]?.count ?? 0);

		return { status: "connected", tableExists: true, comparisonsCount };
	} catch (error) {
		console.error("[db-health] database check failed:", error);
		return { status: "unreachable" };
	}
}

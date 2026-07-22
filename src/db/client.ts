import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// Local dev reads DATABASE_URL from .env; in production the variable is set directly by the host.
if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is not set. Copy .env.example to .env and configure it.",
	);
}

const pool = mysql.createPool(databaseUrl);

export const db = drizzle(pool, { schema, mode: "default" });

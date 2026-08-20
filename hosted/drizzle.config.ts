import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is not set. Copy .env.example to .env and configure it.",
	);
}

export default defineConfig({
	dialect: "mysql",
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: databaseUrl,
	},
});

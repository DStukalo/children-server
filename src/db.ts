import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error(
		"DATABASE_URL env variable is required to connect to Postgres"
	);
}

const poolConfig: PoolConfig = {
	connectionString,
};

if (
	connectionString.includes("render.com") ||
	connectionString.includes("railway.app") ||
	connectionString.includes("neon.tech") ||
	connectionString.includes("supabase.com")
) {
	poolConfig.ssl = {
		rejectUnauthorized: false,
	};
}

if (process.env.DB_SSL === "true") {
	poolConfig.ssl = {
		rejectUnauthorized: false,
	};
}

export const db = new Pool(poolConfig);

db.on("connect", () => {
	console.log("✅ Connected to Postgres");
});

db.on("error", (err) => {
	console.error("❌ Unexpected DB error:", err);
	process.exit(1);
});

export async function initDb() {
	await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      user_name TEXT,
      avatar TEXT,
      open_categories INT4[] DEFAULT '{}',
      purchased_stages INT4[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

	console.log("✅ users table ensured");
}

export async function query<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params?: any[]
): Promise<QueryResult<T>> {
	return db.query<T>(text, params);
}

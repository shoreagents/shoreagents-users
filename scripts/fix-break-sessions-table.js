const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway';

const pool = new Pool({
	connectionString,
	ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function columnExists(client, table, column) {
	const res = await client.query(
		`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
		[table, column]
	);
	return res.rowCount > 0;
}

async function constraintExists(client, table, constraintName) {
	const res = await client.query(
		`SELECT 1 FROM information_schema.table_constraints WHERE table_name = $1 AND constraint_name = $2`,
		[table, constraintName]
	);
	return res.rowCount > 0;
}

async function fixBreakSessions() {
	const client = await pool.connect();
	try {
		console.log('🔧 Fixing break_sessions table...');
		console.log(`📡 Connecting to: ${connectionString.replace(/:[^:@]*@/, ':****@')}`);

		await client.query('BEGIN');

		// Ensure enum type exists
		await client.query(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'break_type_enum') THEN
					CREATE TYPE break_type_enum AS ENUM ('Morning','Lunch','Afternoon','NightFirst','NightMeal','NightSecond');
				END IF;
			END$$;
		`);

		// Add break_type if missing (nullable first)
		if (!(await columnExists(client, 'break_sessions', 'break_type'))) {
			console.log('   ➕ Adding column break_type (break_type_enum)');
			await client.query(`ALTER TABLE break_sessions ADD COLUMN break_type break_type_enum`);
		}

		// Add duration_minutes if missing
		if (!(await columnExists(client, 'break_sessions', 'duration_minutes'))) {
			console.log('   ➕ Adding column duration_minutes (integer)');
			await client.query(`ALTER TABLE break_sessions ADD COLUMN duration_minutes integer`);
		}

		// Add pause_used if missing
		if (!(await columnExists(client, 'break_sessions', 'pause_used'))) {
			console.log('   ➕ Adding column pause_used (boolean)');
			await client.query(`ALTER TABLE break_sessions ADD COLUMN pause_used boolean DEFAULT false`);
		}

		// Backfill any NULL break_type to a safe default (Morning) if table has rows
		const countRes = await client.query(`SELECT COUNT(*)::int AS cnt FROM break_sessions`);
		if (countRes.rows[0].cnt > 0) {
			console.log(`   ℹ️ Existing rows: ${countRes.rows[0].cnt}. Backfilling NULL break_type to 'Morning'`);
			await client.query(`UPDATE break_sessions SET break_type = 'Morning' WHERE break_type IS NULL`);
		}

		// Enforce NOT NULL on break_type
		console.log('   🔒 Ensuring break_type is NOT NULL');
		await client.query(`ALTER TABLE break_sessions ALTER COLUMN break_type SET NOT NULL`);

		// Add check constraint if missing
		const constraintName = 'break_sessions_break_type_check';
		if (!(await constraintExists(client, 'break_sessions', constraintName))) {
			console.log('   🔒 Adding check constraint on break_type');
			await client.query(`
				ALTER TABLE break_sessions 
				ADD CONSTRAINT ${constraintName}
				CHECK (break_type IN ('Morning','Lunch','Afternoon','NightFirst','NightMeal','NightSecond'))
			`);
		}

		// Helpful indexes
		console.log('   📈 Ensuring helpful indexes exist');
		await client.query(`CREATE INDEX IF NOT EXISTS idx_break_sessions_break_type ON break_sessions(break_type)`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_break_sessions_agent_user_id ON break_sessions(agent_user_id)`);
		await client.query(`CREATE INDEX IF NOT EXISTS idx_break_sessions_break_date ON break_sessions(break_date)`);

		await client.query('COMMIT');
		console.log('✅ break_sessions table fixed.');
	} catch (err) {
		await client.query('ROLLBACK');
		console.error('❌ Failed to fix break_sessions:', err.message);
		throw err;
	} finally {
		client.release();
		await pool.end();
	}
}

fixBreakSessions().catch(() => process.exit(1));

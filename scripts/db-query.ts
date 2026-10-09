/**
 * Run SQL against the Supabase project (admin, via Management API).
 *   npx tsx scripts/db-query.ts <file.sql>     or     npx tsx scripts/db-query.ts -e "select 1"
 */
import { readFileSync } from "node:fs";
import { sql } from "./db.ts";

const [flag, arg] = process.argv.slice(2);
const rows = await sql(flag === "-e" ? arg : readFileSync(flag, "utf8"));
console.log(JSON.stringify(rows, null, 1));

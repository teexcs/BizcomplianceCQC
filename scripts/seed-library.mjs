#!/usr/bin/env node
/**
 * BizCompliance — library seeder.
 *
 * Uploads the 139-document compliance library to the private `library` bucket
 * and upserts metadata rows into `library_assets`, driven by LIBRARY_INDEX.csv.
 *
 * Prerequisites:
 *   1. supabase/migrations/0001_schema.sql and 0002_seed_static.sql applied.
 *   2. .env.local containing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage:
 *   npm run seed:library            # full run (idempotent — safe to re-run)
 *   npm run seed:library -- --dry   # parse + validate only, no writes
 *
 * Override the library folder with LIBRARY_DIR if it ever moves.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LIBRARY_DIR =
  process.env.LIBRARY_DIR ??
  join(process.env.HOME ?? '', 'Downloads', 'BizCompliance_Domiciliary_Care_Library_COMPLETE');

const DRY_RUN = process.argv.includes('--dry');

// --- env ---------------------------------------------------------------
function loadEnv() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) throw new Error('.env.local not found — run from the project root.');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');

const supabase = createClient(url, key, { auth: { persistSession: false } });

// --- CSV parsing (quoted fields) ----------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const REQUIREMENT_MAP = {
  'LEGALLY REQUIRED': 'legal',
  'CQC EXPECTED': 'cqc',
  'BEST PRACTICE': 'best',
  'OPTIONAL': 'optional',
};

async function main() {
  const csvPath = join(LIBRARY_DIR, 'LIBRARY_INDEX.csv');
  if (!existsSync(csvPath)) {
    throw new Error(`LIBRARY_INDEX.csv not found in ${LIBRARY_DIR} — set LIBRARY_DIR to the library folder.`);
  }

  const [header, ...rows] = parseCsv(readFileSync(csvPath, 'utf8'));
  console.log(`Index columns: ${header.join(' | ')}`);
  console.log(`Assets in index: ${rows.length}`);

  // Sanity: migration applied?
  if (!DRY_RUN) {
    const { error: pingError } = await supabase.from('library_areas').select('code').limit(1);
    if (pingError) {
      throw new Error(
        `Cannot read library_areas (${pingError.message}). Apply supabase/migrations/0001 + 0002 first.`,
      );
    }
  }

  // Ensure bucket exists (idempotent — the migration also creates it).
  if (!DRY_RUN) {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.id === 'library')) {
      const { error } = await supabase.storage.createBucket('library', { public: false });
      if (error) throw new Error(`Failed to create library bucket: ${error.message}`);
      console.log('Created bucket: library');
    }
  }

  let uploaded = 0, skippedMissing = 0, upserted = 0;
  const failures = [];

  for (const row of rows) {
    const [areaFolder, ref, title, docType, requiredStatus, commercialValue, regulatoryBasis] = row;
    const areaCode = areaFolder.slice(0, 2);
    const requirement = REQUIREMENT_MAP[requiredStatus.trim().toUpperCase()];
    if (!requirement) {
      failures.push(`${ref}: unknown requirement "${requiredStatus}"`);
      continue;
    }

    // Find the source file by ref prefix (names contain &, parentheses etc.)
    const areaDir = join(LIBRARY_DIR, areaFolder);
    let fileName = null;
    if (existsSync(areaDir)) {
      fileName = readdirSync(areaDir).find((f) => f.startsWith(`${ref} `) && f.endsWith('.docx')) ?? null;
    }
    if (!fileName) {
      failures.push(`${ref}: source .docx not found in "${areaFolder}"`);
      skippedMissing++;
      continue;
    }

    const storagePath = `${areaCode}/${ref}.docx`;

    if (!DRY_RUN) {
      const bytes = readFileSync(join(areaDir, fileName));
      const { error: upErr } = await supabase.storage
        .from('library')
        .upload(storagePath, bytes, {
          upsert: true,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      if (upErr) {
        failures.push(`${ref}: upload failed — ${upErr.message}`);
        continue;
      }
      uploaded++;

      const { error: dbErr } = await supabase.from('library_assets').upsert(
        {
          area_code: areaCode,
          ref,
          title,
          doc_type: docType,
          requirement,
          commercial_value: commercialValue,
          regulatory_basis: regulatoryBasis,
          storage_path: storagePath,
        },
        { onConflict: 'ref' },
      );
      if (dbErr) {
        failures.push(`${ref}: db upsert failed — ${dbErr.message}`);
        continue;
      }
      upserted++;
      process.stdout.write(`\r${upserted}/${rows.length} ${ref}                    `);
    } else {
      uploaded++;
    }
  }

  console.log(`\n\nDone. uploaded=${uploaded} upserted=${upserted} missing=${skippedMissing} failures=${failures.length}`);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }

  if (!DRY_RUN && !failures.length) {
    const { count } = await supabase.from('library_assets').select('*', { count: 'exact', head: true });
    console.log(`library_assets rows in database: ${count}`);
  }
}

main().catch((e) => {
  console.error(`\nSeed failed: ${e.message}`);
  process.exit(1);
});

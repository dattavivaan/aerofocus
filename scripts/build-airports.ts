/**
 * Builds src/data/airports.json from the OurAirports CSV (public domain).
 *
 *   npm run build:airports                 # downloads the CSV
 *   npm run build:airports -- ./airports.csv   # uses a local copy
 *
 * Keeps large and medium airports with scheduled service and an IATA code.
 * OurAirports has no timezone column, so the zone is looked up from lat/lon.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parse } from 'csv-parse/sync';

const require = createRequire(import.meta.url);
const tzlookup = require('tz-lookup') as (lat: number, lon: number) => string;

const SOURCE =
  'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/airports.json');

async function loadCsv(): Promise<string> {
  const local = process.argv[2];
  if (local) return readFile(local, 'utf8');
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return res.text();
}

const rows = parse(await loadCsv(), { columns: true, skip_empty_lines: true }) as Record<
  string,
  string
>[];

const byIata = new Map<string, unknown>();
for (const r of rows) {
  if (r.type !== 'large_airport' && r.type !== 'medium_airport') continue;
  if (r.scheduled_service !== 'yes') continue;
  const iata = r.iata_code?.trim().toUpperCase();
  if (!iata || !/^[A-Z0-9]{3}$/.test(iata)) continue;
  const lat = Number(r.latitude_deg);
  const lon = Number(r.longitude_deg);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  // Large airports win if two rows share a code.
  if (byIata.has(iata) && r.type !== 'large_airport') continue;
  byIata.set(iata, {
    iata,
    name: r.name.trim(),
    city: (r.municipality || r.name).trim(),
    country: r.iso_country,
    lat: Math.round(lat * 1e4) / 1e4,
    lon: Math.round(lon * 1e4) / 1e4,
    tz: tzlookup(lat, lon),
    large: r.type === 'large_airport',
  });
}

const airports = [...byIata.values()].sort((a, b) =>
  (a as { iata: string }).iata.localeCompare((b as { iata: string }).iata),
);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(airports));
console.log(`Wrote ${airports.length} airports to ${OUT}`);

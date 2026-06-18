import axios from 'axios';
import { parse } from 'csv-parse';
import { config } from 'dotenv';
import { createReadStream } from 'fs';
import { resolve } from 'path';
import {
  ICsvRow,
  ICreatePositionsResult,
  IPositionRow,
} from '../src/types/interfaces';

config();

// argv[0]=node, argv[1]=script path → first user arg is argv[2]
const getArg = (index: number): string | undefined => process.argv[index + 2];

/**
 * CSV:  "2017-11-10 05:43:07.000000"  (space-separated, microseconds)
 * API:  "2017-11-10T05:43:07.000Z"    (ISO-8601 UTC)
 *
 * Regex groups:
 *   1 = date (YYYY-MM-DD)
 *   2 = time (HH:MM:SS)
 *   3 = optional fractional seconds (.000000)
 *
 * Empty or garbage values are returned as-is so the API rejects them. This is because the API expects a valid ISO-8601 datetime.
 */
const normalizeTimestamp = (value: string | undefined): string => {
  if (value === undefined || value.trim() === '') {
    return value ?? '';
  }

  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/.exec(
    trimmed,
  );

  if (!match) {
    return trimmed;
  }

  const [, date, time, fractional = ''] = match;
  // Truncate microseconds to milliseconds (6 digits → 3)
  const millis = fractional.slice(0, 3).padEnd(3, '0');
  return `${date}T${time}.${millis}Z`;
};

const mapRow = (row: ICsvRow): IPositionRow => ({
  vesselId: Number(row.vessel_id),
  receivedTimeUtc: normalizeTimestamp(row.received_time_utc),
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
});

const trimHeaderNames = (row: Record<string, string>): ICsvRow => {
  const trimmed: ICsvRow = {};
  for (const [key, value] of Object.entries(row)) {
    trimmed[key.trim() as keyof ICsvRow] = value;
  }
  return trimmed;
};

const postBatch = async (
  apiUrl: string,
  batch: IPositionRow[],
): Promise<ICreatePositionsResult> => {
  const { data } = await axios.post<ICreatePositionsResult>(apiUrl, batch, {
    headers: { 'X-Ingest-Partial': 'true' },
  });
  return data;
};

const mergeSummary = (
  total: ICreatePositionsResult,
  batch: ICreatePositionsResult,
): ICreatePositionsResult => ({
  received: total.received + batch.received,
  inserted: total.inserted + batch.inserted,
  duplicates: total.duplicates + batch.duplicates,
  rejected: total.rejected + batch.rejected,
  errors: total.errors.concat(batch.errors),
});

/**
 * Reads the CSV via stream (constant memory) and sends rows in batches.
 * Each batch is a separate POST; partial success is handled by the API per row.
 */
const streamCsv = async (
  csvPath: string,
  apiUrl: string,
  batchSize: number,
): Promise<ICreatePositionsResult> => {
  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: (header: string[]) => header.map((cell) => cell.trim()),
      skip_empty_lines: true,
      relax_column_count: true,
    }),
  );

  let batch: IPositionRow[] = [];
  let batchNumber = 0;
  let total: ICreatePositionsResult = {
    received: 0,
    inserted: 0,
    duplicates: 0,
    rejected: 0,
    errors: [],
  };

  for await (const rawRow of parser) {
    const row = trimHeaderNames(rawRow as Record<string, string>);
    batch.push(mapRow(row));

    if (batch.length >= batchSize) {
      batchNumber += 1;
      const summary = await postBatch(apiUrl, batch);
      total = mergeSummary(total, summary);
      console.log(
        `Batch ${batchNumber}: received=${summary.received} inserted=${summary.inserted} duplicates=${summary.duplicates} rejected=${summary.rejected}`,
      );
      batch = [];
    }
  }

  if (batch.length > 0) {
    batchNumber += 1;
    const summary = await postBatch(apiUrl, batch);
    total = mergeSummary(total, summary);
    console.log(
      `Batch ${batchNumber}: 
       received=${summary.received} inserted=${summary.inserted} duplicates=${summary.duplicates} rejected=${summary.rejected}`,
    );
  }

  return total;
};

const main = async (): Promise<void> => {
  const csvPath = resolve(
    process.cwd(),
    getArg(0) ?? process.env.CSV_PATH ?? './data-fs-exercise.csv',
  );
  const apiUrl =
    getArg(1) ?? process.env.API_URL ?? 'http://localhost:3000/positions';
  const batchSize = Number(getArg(2) ?? process.env.BATCH_SIZE ?? 500);

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('batchSize must be a positive integer');
  }

  console.log(`CSV: ${csvPath}`);
  console.log(`API: ${apiUrl}`);
  console.log(`Batch size: ${batchSize}`);

  const total = await streamCsv(csvPath, apiUrl, batchSize);

  console.log('\nFinal totals:');
  console.log(`  received:   ${total.received}`);
  console.log(`  inserted:   ${total.inserted}`);
  console.log(`  duplicates: ${total.duplicates}`);
  console.log(`  rejected:   ${total.rejected}`);

  if (total.errors.length > 0) {
    console.log('\nSample rejection reasons:');
    for (const error of total.errors.slice(0, 5)) {
      console.log(`  index ${error.index}: ${error.reasons.join('; ')}`);
    }
  }
};

main().catch((error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = JSON.stringify(error.response?.data ?? error.message);
    console.error(`POST failed (${status ?? 'network'}): ${body}`);
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  }
  process.exit(1);
});

import { useRef, useState } from 'react';
import { AdminPage } from '../components/AdminPage.tsx';
import { useAdminBrands, useAdminCategories, useImportProducts } from '../queries.ts';
import { aggregateImportResults, mapSheetRowsToRecords, SAMPLE_HEADERS, splitIntoBatches } from '../importHelpers.ts';
import { buildKnownNameMap } from '../importKnownMaps.ts';
import { t } from '../../lib/i18n.ts';
import { IMPORT_BATCH_SIZE, IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS, validateImportRow } from '@dunyo/shared';
import type { ImportResult, ImportRowError } from '../types.ts';

const PREVIEW_ROWS = 50;

interface ValidatedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  ok: boolean;
  errors: string[];
}

function formatFileTooLarge(bytes: number): string {
  return t('admin.import.fileTooLarge', { max: String(Math.round(bytes / 1024 / 1024)) });
}

export function Import(): JSX.Element {
  const { data: brands } = useAdminBrands();
  const { data: categories } = useAdminCategories();
  const importMutation = useImportProducts();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<ImportResult | null>(null);

  async function handleFile(file: File): Promise<void> {
    setFileError(null);
    setSummary(null);
    setRows([]);
    setFileName(file.name);

    if (file.size > IMPORT_MAX_FILE_BYTES) {
      setFileError(formatFileTooLarge(IMPORT_MAX_FILE_BYTES));
      return;
    }

    // Dynamic import so the xlsx/SheetJS chunk never lands in the admin
    // panel's main chunk (or the customer bundle) — only fetched when an
    // admin actually opens this screen and picks a file.
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (firstSheetName === undefined) {
      setFileError(t('admin.import.emptyFile'));
      return;
    }
    const sheet = workbook.Sheets[firstSheetName];
    if (sheet === undefined) {
      setFileError(t('admin.import.emptyFile'));
      return;
    }
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const cleaned = mapSheetRowsToRecords(rawRows);

    if (cleaned.length > IMPORT_MAX_ROWS) {
      setFileError(t('admin.import.tooManyRows', { max: String(IMPORT_MAX_ROWS) }));
      return;
    }
    if (cleaned.length === 0) {
      setFileError(t('admin.import.emptyFile'));
      return;
    }

    const knownBrands = buildKnownNameMap(brands ?? []);
    const knownCategories = buildKnownNameMap(categories ?? []);
    const validated = cleaned.map((raw, index) => {
      const rowNumber = index + 1;
      const result = validateImportRow(raw, rowNumber, knownBrands, knownCategories);
      return { rowNumber, raw, ok: result.ok, errors: result.ok ? [] : result.errors };
    });
    setRows(validated);
  }

  async function runImport(): Promise<void> {
    const validRows = rows.filter((r) => r.ok);
    if (validRows.length === 0 || fileName === null) return;

    const batches = splitIntoBatches(validRows, IMPORT_BATCH_SIZE);
    const results: ImportResult[] = [];
    setProgress({ done: 0, total: validRows.length });

    for (const batch of batches) {
      const result = await importMutation.mutateAsync({ fileName, rows: batch.map((r) => r.raw) });
      // The server validates rows again and returns batch-relative row
      // numbers; re-map them to the row's absolute number in the sheet so
      // the error list lines up with the preview table.
      const remapped: ImportResult = {
        created: result.created,
        updated: result.updated,
        errors: result.errors.map((e: ImportRowError) => ({
          rowNumber: batch[e.rowNumber - 1]?.rowNumber ?? e.rowNumber,
          errors: e.errors,
        })),
      };
      results.push(remapped);
      setProgress((p) => (p === null ? null : { done: p.done + batch.length, total: p.total }));
    }

    setSummary(aggregateImportResults(results));
    setProgress(null);
  }

  async function downloadSample(): Promise<void> {
    const XLSX = await import('xlsx');
    const sample = [
      {
        nomi: 'iPhone 16 Pro',
        brend: brands?.[0]?.name ?? 'Apple',
        kategoriya: categories?.[0]?.name ?? 'Smartfonlar',
        rang: 'Black Titanium',
        xotira: 256,
        narxi: 15450000,
        eski_narxi: 16990000,
        qoldigi: 6,
        kafolat_oyi: 12,
        artikul: 'IP16P-BT-256',
      },
      {
        nomi: 'AirPods Pro 2',
        brend: brands?.[0]?.name ?? 'Apple',
        kategoriya: categories?.[1]?.name ?? 'Quloqchinlar',
        rang: 'White',
        xotira: '',
        narxi: 2890000,
        eski_narxi: '',
        qoldigi: 14,
        kafolat_oyi: 12,
        artikul: 'APP2-USBC',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sample, { header: [...SAMPLE_HEADERS] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mahsulotlar');
    XLSX.writeFile(workbook, 'dunyo-mobile-namuna.xlsx');
  }

  const validCount = rows.filter((r) => r.ok).length;
  const invalidRows = rows.filter((r) => !r.ok);

  return (
    <AdminPage title={t('admin.import.title')}>
      <button
        type="button"
        onClick={() => void downloadSample()}
        className="min-h-[44px] px-space-md rounded-xl bg-surface-container text-on-surface text-label-md font-label-md self-start"
      >
        {t('admin.import.downloadSample')}
      </button>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="min-h-[44px] px-space-md rounded-xl bg-primary text-on-primary text-label-md font-label-md self-start"
      >
        {t('admin.import.pickFile')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file !== undefined) void handleFile(file);
        }}
      />

      {fileError !== null && <p className="text-body-sm font-body-sm text-error">{fileError}</p>}

      {rows.length > 0 && (
        <>
          <p className="text-body-md font-body-md text-on-surface">
            {fileName} &middot; {t('admin.import.summaryCounts', { valid: String(validCount), invalid: String(invalidRows.length) })}
          </p>

          <div className="overflow-x-auto rounded-xl border border-outline-variant">
            <table className="w-full text-body-sm font-body-sm">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant">
                  <th className="p-space-sm text-left">#</th>
                  <th className="p-space-sm text-left">{t('admin.products.name')}</th>
                  <th className="p-space-sm text-left">{t('admin.products.brand')}</th>
                  <th className="p-space-sm text-left">{t('admin.variants.price')}</th>
                  <th className="p-space-sm text-left">{t('admin.variants.stock')}</th>
                  <th className="p-space-sm text-left">{t('admin.import.status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_ROWS).map((row) => (
                  <tr key={row.rowNumber} className={row.ok ? '' : 'bg-error-container/40'}>
                    <td className="p-space-sm text-on-surface-variant">{row.rowNumber}</td>
                    <td className="p-space-sm text-on-surface">{String(row.raw['nomi'] ?? '')}</td>
                    <td className="p-space-sm text-on-surface">{String(row.raw['brend'] ?? '')}</td>
                    <td className="p-space-sm text-on-surface">{String(row.raw['narxi'] ?? '')}</td>
                    <td className="p-space-sm text-on-surface">{String(row.raw['qoldigi'] ?? '')}</td>
                    <td className="p-space-sm text-error">{row.ok ? '✓' : row.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > PREVIEW_ROWS && (
            <p className="text-body-sm font-body-sm text-on-surface-variant">
              {t('admin.import.previewTruncated', { shown: String(PREVIEW_ROWS), total: String(rows.length) })}
            </p>
          )}

          {invalidRows.length > 0 && (
            <div className="bg-error-container/40 rounded-xl p-space-md flex flex-col gap-space-xs">
              <p className="text-title-sm font-title-sm text-on-surface">{t('admin.import.errorsTitle')}</p>
              {invalidRows.map((row) => (
                <p key={row.rowNumber} className="text-body-sm font-body-sm text-on-surface">
                  #{row.rowNumber}: {row.errors.join('; ')}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={validCount === 0 || importMutation.isPending}
            onClick={() => void runImport()}
            className="min-h-[48px] rounded-xl bg-primary text-on-primary text-label-md font-label-md disabled:opacity-50"
          >
            {t('admin.import.run')}
          </button>

          {progress !== null && (
            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          )}

          {summary !== null && (
            <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm">
              <p className="text-title-sm font-title-sm text-on-surface">
                {t('admin.import.done', {
                  created: String(summary.created),
                  updated: String(summary.updated),
                  errors: String(summary.errors.length),
                })}
              </p>
            </div>
          )}
        </>
      )}
    </AdminPage>
  );
}

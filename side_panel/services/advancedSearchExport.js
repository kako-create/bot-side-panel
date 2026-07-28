import { buildApiV2ExportRows, getApiV2Records } from './apiV2Export.js';
import {
  buildConfiguredBlockExportRows,
  getConfiguredBlockRecords,
} from './configuredBlocksExport.js';
import { buildTopdeskExportRows, getTopdeskRecords } from './topdeskExport.js';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_MAX_ROWS = 1_048_576;

const sanitizeFileNamePart = (value, fallback = 'bot') =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 80) || fallback;

const applyWorksheetPresentation = (worksheet, model, xlsx) => {
  worksheet['!cols'] = [
    { wch: 34 },
    { wch: 105 },
  ];

  (model?.links || []).forEach(({ row, column, target }) => {
    const address = xlsx.utils.encode_cell({ r: row, c: column });
    const cell = worksheet[address];
    if (!cell || !target) return;
    cell.l = {
      Target: target,
      Tooltip: 'Abrir link',
    };
  });
};

const downloadWorkbookBlob = (filename, data) => {
  if (typeof globalThis.Blob !== 'function') {
    throw new Error('Blob não está disponível neste ambiente.');
  }
  if (!globalThis.document?.createElement || !globalThis.document?.body) {
    throw new Error('O download do arquivo requer um documento do navegador.');
  }
  if (!globalThis.URL?.createObjectURL) {
    throw new Error('A criação de URL para download não está disponível.');
  }

  const blob = new Blob([data], { type: XLSX_MIME_TYPE });
  const url = globalThis.URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  globalThis.document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(url), 1000);
  }
};

const formatFilePrefix = ({ apiCount, topdeskCount, configuredBlockCount }) => {
  const familyCount = [apiCount, topdeskCount, configuredBlockCount]
    .filter((count) => count > 0)
    .length;
  if (familyCount === 1 && apiCount > 0) return 'apis';
  if (familyCount === 1 && topdeskCount > 0) return 'topdesk';
  if (familyCount === 1 && configuredBlockCount > 0) return 'blocos';
  return 'exportacao';
};

/**
 * Classifica apenas os tipos atualmente suportados pela exportação da busca avançada.
 */
export const getAdvancedExportSummary = (records = []) => {
  const apiRecords = getApiV2Records(records);
  const topdeskRecords = getTopdeskRecords(records);
  const configuredBlockRecords = getConfiguredBlockRecords(records);
  const apiCount = apiRecords.length;
  const topdeskCount = topdeskRecords.length;
  const configuredBlockCount = configuredBlockRecords.length;

  return {
    apiRecords,
    topdeskRecords,
    configuredBlockRecords,
    apiCount,
    topdeskCount,
    configuredBlockCount,
    totalCount: apiCount + topdeskCount + configuredBlockCount,
  };
};

/**
 * Constrói os modelos puros das abas para permitir testes sem DOM ou SheetJS.
 */
export const buildAdvancedSearchExportModels = (options = {}) => {
  const summary = getAdvancedExportSummary(options.records);
  const sheets = [];

  if (summary.apiCount > 0) {
    sheets.push({
      name: 'APIs',
      model: buildApiV2ExportRows({
        ...options,
        records: summary.apiRecords,
      }),
    });
  }

  if (summary.topdeskCount > 0) {
    sheets.push({
      name: 'Topdesk',
      model: buildTopdeskExportRows({
        ...options,
        records: summary.topdeskRecords,
      }),
    });
  }

  if (summary.configuredBlockCount > 0) {
    sheets.push({
      name: 'Blocos',
      model: buildConfiguredBlockExportRows({
        ...options,
        records: summary.configuredBlockRecords,
      }),
    });
  }

  return { ...summary, sheets };
};

/**
 * Gera um único XLSX para os resultados suportados da última busca.
 */
export const exportAdvancedSearchWorkbook = (options = {}) => {
  const xlsx = globalThis.XLSX ?? null;
  if (!xlsx?.utils?.aoa_to_sheet || !xlsx?.utils?.book_new || !xlsx?.write) {
    throw new Error('SheetJS não está disponível no painel.');
  }

  const built = buildAdvancedSearchExportModels(options);
  if (built.totalCount === 0 || built.sheets.length === 0) {
    throw new Error('A consulta não possui blocos suportados para exportação.');
  }

  const oversizedSheet = built.sheets.find(
    ({ model }) => (model?.rows?.length ?? 0) > EXCEL_MAX_ROWS,
  );
  if (oversizedSheet) {
    throw new Error(
      `A aba ${oversizedSheet.name} excede o limite de ${EXCEL_MAX_ROWS.toLocaleString('pt-BR')} linhas do Excel. Refine a consulta e tente novamente.`,
    );
  }

  const workbook = xlsx.utils.book_new();
  built.sheets.forEach(({ name, model }) => {
    const worksheet = xlsx.utils.aoa_to_sheet(model.rows);
    applyWorksheetPresentation(worksheet, model, xlsx);
    xlsx.utils.book_append_sheet(workbook, worksheet, name);
  });

  const data = xlsx.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  });

  const exportedAt = options.exportedAt ?? new Date().toISOString();
  const safeBot = sanitizeFileNamePart(options.botTitle || options.botId, 'bot');
  const safeDate = sanitizeFileNamePart(exportedAt, 'exportacao');
  const prefix = formatFilePrefix(built);
  const filename = `bot-side-panel-${prefix}_${safeBot}_${safeDate}.xlsx`;
  downloadWorkbookBlob(filename, data);

  return {
    count: built.totalCount,
    exportedCount: built.totalCount,
    apiCount: built.apiCount,
    topdeskCount: built.topdeskCount,
    configuredBlockCount: built.configuredBlockCount,
    countsByType: built.sheets.find((sheet) => sheet.name === 'Topdesk')?.model?.countsByType ?? {},
    configuredCountsByType:
      built.sheets.find((sheet) => sheet.name === 'Blocos')?.model?.countsByType ?? {},
    filename,
  };
};

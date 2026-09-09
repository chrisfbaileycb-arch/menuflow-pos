import Papa from "papaparse";

export interface CsvProgressInfo {
  progress: number; // 0 to 100
  stage: "reading" | "parsing" | "validating" | "formatting" | "complete";
  stageLabel: string;
  processedCount: number;
  totalCount: number;
}

export type CsvProgressCallback = (info: CsvProgressInfo) => void;

export interface MenuPreviewRow {
  id: number;
  itemName: string;
  description: string;
  category: string;
  price: number;
  modifierName: string;
  modifierPrice: number;
  modifierRequired: boolean;
  sku?: string;
  calories?: number;
  allergens?: string[];
  raw: Record<string, string>;
  issue?: string;
  warnings?: string[];
}

export interface MenuParseSummary {
  totalRows: number;
  validCount: number;
  issueCount: number;
  uniqueItemsCount: number;
  categoriesCount: number;
  modifiersCount: number;
  categories: string[];
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

export interface MenuParseResult {
  success: boolean;
  rows: MenuPreviewRow[];
  headers: string[];
  summary: MenuParseSummary;
  error?: string;
  parseErrors: Papa.ParseError[];
}

export const EXPECTED_MENU_COLUMNS = [
  "item_name",
  "description",
  "category",
  "price",
  "modifier_name",
  "modifier_price",
  "modifier_required",
] as const;

/**
 * Normalizes a header column name to snake_case lowercase without punctuation
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_");
}

/**
 * Standard generic CSV parser using PapaParse for strings
 */
export function parseCsvString<T = Record<string, string>>(
  csvText: string,
  config?: Papa.ParseConfig<T>,
): Papa.ParseResult<T> {
  const cleanText = csvText.replace(/^\uFEFF/, "");
  return Papa.parse<T>(cleanText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    ...config,
  });
}

/**
 * Standard generic CSV parser using PapaParse for File objects
 */
export async function parseCsvFile<T = Record<string, string>>(
  file: File,
  config?: Papa.ParseConfig<T>,
): Promise<Papa.ParseResult<T>> {
  const text = await file.text();
  return parseCsvString<T>(text, config);
}

/**
 * Backward-compatible helper for existing adapters and executors.
 * Parses raw CSV text into an array of key-value string records using PapaParse.
 */
export function buildRowsFromString(csvText: string): Array<Record<string, string>> {
  if (!csvText || typeof csvText !== "string" || !csvText.trim()) {
    return [];
  }

  const cleanText = csvText.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase(),
    transform: (value) => (typeof value === "string" ? value.trim() : ""),
  });

  return parsed.data.filter((row) => {
    if (!row || typeof row !== "object") return false;
    return Object.values(row).some((val) => typeof val === "string" && val.length > 0);
  });
}

/**
 * Formats an array of records into a valid CSV string using Papa.unparse
 */
export function exportToCsv<T>(data: T[], config?: Papa.UnparseConfig): string {
  return Papa.unparse(data, {
    quotes: true,
    ...config,
  });
}

export interface ExportMenuCsvOptions {
  includeStatus?: boolean;
  quotes?: boolean;
  delimiter?: string;
  header?: boolean;
}

/**
 * Converts menu preview rows into a formatted CSV string using PapaParse unparse capability.
 * Produces standard POS-compatible RFC 4180 CSV with escaped quotes, commas, and formatted prices.
 */
export function unparseMenuData(
  rows: MenuPreviewRow[],
  options: ExportMenuCsvOptions = {},
): string {
  const {
    includeStatus = false,
    quotes = true,
    delimiter = ",",
    header = true,
  } = options;

  const fields = [
    "item_name",
    "description",
    "category",
    "price",
    "modifier_name",
    "modifier_price",
    "modifier_required",
    ...(includeStatus ? ["validation_status"] : []),
  ];

  const data = rows.map((row) => {
    const rowValues = [
      row.itemName || "",
      row.description || "",
      row.category || "",
      Number.isFinite(row.price) ? row.price.toFixed(2) : "0.00",
      row.modifierName || "",
      row.modifierName && Number.isFinite(row.modifierPrice)
        ? row.modifierPrice.toFixed(2)
        : "0.00",
      row.modifierRequired ? "true" : "false",
    ];

    if (includeStatus) {
      rowValues.push(row.issue ? `ISSUE: ${row.issue}` : "VALID");
    }

    return rowValues;
  });

  return Papa.unparse(
    {
      fields,
      data,
    },
    {
      quotes,
      delimiter,
      header,
      newline: "\r\n",
    },
  );
}

/**
 * Generates and triggers browser download of the formatted CSV file using PapaParse unparse
 */
export function downloadMenuCsvFile(
  rows: MenuPreviewRow[],
  filename = "menu-export.csv",
  options?: ExportMenuCsvOptions,
): void {
  const csvString = unparseMenuData(rows, options);
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Asynchronously converts menu preview rows into a formatted CSV string using PapaParse unparse,
 * yielding to the browser and reporting progress percentage.
 */
export async function unparseMenuDataWithProgress(
  rows: MenuPreviewRow[],
  options: ExportMenuCsvOptions = {},
  onProgress?: CsvProgressCallback,
): Promise<string> {
  const {
    includeStatus = false,
    quotes = true,
    delimiter = ",",
    header = true,
  } = options;

  const total = rows.length;
  onProgress?.({
    progress: 5,
    stage: "formatting",
    stageLabel: "Preparing rows for RFC 4180 export...",
    processedCount: 0,
    totalCount: total,
  });

  const fields = [
    "item_name",
    "description",
    "category",
    "price",
    "modifier_name",
    "modifier_price",
    "modifier_required",
    ...(includeStatus ? ["validation_status"] : []),
  ];

  const data: string[][] = [];
  const chunkSize = total > 1500 ? 250 : 120;

  for (let i = 0; i < total; i += chunkSize) {
    const end = Math.min(i + chunkSize, total);
    for (let j = i; j < end; j++) {
      const row = rows[j];
      const rowValues = [
        row.itemName || "",
        row.description || "",
        row.category || "",
        Number.isFinite(row.price) ? row.price.toFixed(2) : "0.00",
        row.modifierName || "",
        row.modifierName && Number.isFinite(row.modifierPrice)
          ? row.modifierPrice.toFixed(2)
          : "0.00",
        row.modifierRequired ? "true" : "false",
      ];

      if (includeStatus) {
        rowValues.push(row.issue ? `ISSUE: ${row.issue}` : "VALID");
      }

      data.push(rowValues);
    }

    if (total > 60) {
      const pct = Math.min(88, Math.round(10 + (end / total) * 78));
      onProgress?.({
        progress: pct,
        stage: "formatting",
        stageLabel: `Formatting records (${end.toLocaleString()} / ${total.toLocaleString()})...`,
        processedCount: end,
        totalCount: total,
      });
      // Yield to let the progress bar visually animate in the browser
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }

  onProgress?.({
    progress: 92,
    stage: "formatting",
    stageLabel: "Encoding CSV with PapaParse unparse...",
    processedCount: total,
    totalCount: total,
  });

  // Small delay for UI smoothness
  await new Promise((resolve) => setTimeout(resolve, 15));

  const csvString = Papa.unparse(
    {
      fields,
      data,
    },
    {
      quotes,
      delimiter,
      header,
      newline: "\r\n",
    },
  );

  onProgress?.({
    progress: 100,
    stage: "complete",
    stageLabel: `Export ready (${total.toLocaleString()} rows encoded)`,
    processedCount: total,
    totalCount: total,
  });

  return csvString;
}

/**
 * Generates and triggers browser download of the formatted CSV file using PapaParse unparse,
 * reporting visual progress throughout the generation process.
 */
export async function downloadMenuCsvFileWithProgress(
  rows: MenuPreviewRow[],
  filename = "menu-export.csv",
  options?: ExportMenuCsvOptions,
  onProgress?: CsvProgressCallback,
): Promise<void> {
  const csvString = await unparseMenuDataWithProgress(rows, options, onProgress);
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper to look up values using multiple column name aliases
 */
function findFirstMatchingValue(
  record: Record<string, string>,
  normalizedRecord: Record<string, string>,
  aliases: string[],
): string {
  for (const alias of aliases) {
    const directVal = record[alias];
    if (directVal !== undefined && directVal !== null && directVal.trim() !== "") {
      return directVal.trim();
    }
    const normAlias = normalizeHeader(alias);
    const normVal = normalizedRecord[normAlias];
    if (normVal !== undefined && normVal !== null && normVal.trim() !== "") {
      return normVal.trim();
    }
  }
  return "";
}

/**
 * Cleans and converts currency/numeric string into float
 */
function parsePrice(valueText: string): number | null {
  if (!valueText) return null;
  const cleaned = valueText.replace(/[$,€£\s]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

/**
 * Parses Boolean indicator for modifier requirements
 */
function parseBooleanFlag(valueText: string): boolean {
  if (!valueText) return false;
  const normalized = valueText.trim().toLowerCase();
  return ["true", "yes", "1", "y", "t", "req", "required"].includes(normalized);
}

/**
 * Core menu CSV processing engine powered by PapaParse.
 * Analyzes structure, resolves column aliases, verifies constraints,
 * and compiles comprehensive menu preview rows with validation diagnostics.
 */
export function parseMenuCsvString(csvText: string): MenuParseResult {
  if (!csvText || !csvText.trim()) {
    return {
      success: false,
      rows: [],
      headers: [],
      summary: createEmptySummary(),
      error: "The CSV file is empty. Please select a CSV containing menu rows.",
      parseErrors: [],
    };
  }

  const cleanText = csvText.replace(/^\uFEFF/, "").trim();

  const parseOutput = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const headers = parseOutput.meta.fields || [];
  const normalizedHeaders = headers.map(normalizeHeader);

  if (headers.length === 0) {
    return {
      success: false,
      rows: [],
      headers: [],
      summary: createEmptySummary(),
      error: "Unable to detect any column headers in this CSV.",
      parseErrors: parseOutput.errors,
    };
  }

  // Check essential column mappings
  const hasItemName = normalizedHeaders.some((h) =>
    ["item_name", "name", "menu_item", "item", "dish", "product_name", "title"].includes(h),
  );
  const hasCategory = normalizedHeaders.some((h) =>
    ["category", "menu_group", "group", "section", "menu_category", "department"].includes(h),
  );
  const hasPrice = normalizedHeaders.some((h) =>
    ["price", "item_price", "base_price", "cost", "unit_price", "amount"].includes(h),
  );

  const missingColumns: string[] = [];
  if (!hasItemName) missingColumns.push("item_name");
  if (!hasCategory) missingColumns.push("category");
  if (!hasPrice) missingColumns.push("price");

  if (missingColumns.length > 0) {
    return {
      success: false,
      rows: [],
      headers,
      summary: createEmptySummary(),
      error: `Missing required column${missingColumns.length > 1 ? "s" : ""}: ${missingColumns.join(", ")}. Expected headers include 'item_name', 'category', and 'price'.`,
      parseErrors: parseOutput.errors,
    };
  }

  const previewRows: MenuPreviewRow[] = [];
  const categoriesSet = new Set<string>();
  const uniqueItemsSet = new Set<string>();
  let validCount = 0;
  let issueCount = 0;
  let modifiersCount = 0;
  const prices: number[] = [];

  for (let idx = 0; idx < parseOutput.data.length; idx++) {
    const rawRow = parseOutput.data[idx];
    if (!rawRow || Object.keys(rawRow).length === 0) continue;

    const normalizedRecord: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      normalizedRecord[normalizeHeader(k)] = typeof v === "string" ? v : String(v ?? "");
    }

    const itemName = findFirstMatchingValue(rawRow, normalizedRecord, [
      "item_name",
      "name",
      "menu_item",
      "item",
      "dish",
      "product_name",
      "title",
    ]);

    const description = findFirstMatchingValue(rawRow, normalizedRecord, [
      "description",
      "item_description",
      "desc",
      "details",
    ]);

    const category = findFirstMatchingValue(rawRow, normalizedRecord, [
      "category",
      "menu_group",
      "group",
      "section",
      "menu_category",
      "department",
    ]);

    const priceRaw = findFirstMatchingValue(rawRow, normalizedRecord, [
      "price",
      "item_price",
      "base_price",
      "cost",
      "unit_price",
      "amount",
    ]);

    const modifierName = findFirstMatchingValue(rawRow, normalizedRecord, [
      "modifier_name",
      "modifier",
      "option_name",
      "option",
      "addon",
      "add_on",
    ]);

    const modifierPriceRaw = findFirstMatchingValue(rawRow, normalizedRecord, [
      "modifier_price",
      "modifier_cost",
      "option_price",
      "addon_price",
      "addon_cost",
    ]);

    const modifierRequiredRaw = findFirstMatchingValue(rawRow, normalizedRecord, [
      "modifier_required",
      "required",
      "mandatory",
      "is_required",
    ]);

    const sku = findFirstMatchingValue(rawRow, normalizedRecord, [
      "sku",
      "item_sku",
      "barcode",
      "pos_id",
    ]);

    const caloriesRaw = findFirstMatchingValue(rawRow, normalizedRecord, ["calories", "cal"]);
    const allergensRaw = findFirstMatchingValue(rawRow, normalizedRecord, [
      "allergens",
      "allergy_info",
      "dietary",
    ]);

    const parsedPrice = parsePrice(priceRaw);
    const parsedModPrice = parsePrice(modifierPriceRaw);
    const isModRequired = parseBooleanFlag(modifierRequiredRaw);

    let issue: string | undefined;
    const warnings: string[] = [];

    if (!itemName) {
      issue = "Item name is required";
    } else if (!category) {
      issue = "Category is required";
    } else if (parsedPrice === null) {
      issue = "Invalid or missing base price";
    } else if (parsedPrice < 0) {
      issue = "Base price cannot be negative";
    } else if (modifierPriceRaw && parsedModPrice === null) {
      issue = "Modifier price is not a valid number";
    } else if (parsedModPrice !== null && parsedModPrice < 0) {
      issue = "Modifier price cannot be negative";
    }

    if (parsedPrice !== null && parsedPrice > 500) {
      warnings.push("High price detected (> $500)");
    }
    if (modifierName && parsedModPrice === null && !modifierPriceRaw) {
      warnings.push("Modifier has no explicit price, defaulted to $0.00");
    }

    if (category) categoriesSet.add(category);
    if (itemName) uniqueItemsSet.add(itemName.toLowerCase());
    if (modifierName) modifiersCount++;

    if (issue) {
      issueCount++;
    } else {
      validCount++;
      if (parsedPrice !== null) {
        prices.push(parsedPrice);
      }
    }

    previewRows.push({
      id: idx + 1,
      itemName: itemName || "Untitled Item",
      description,
      category: category || "Uncategorized",
      price: parsedPrice ?? 0,
      modifierName,
      modifierPrice: parsedModPrice ?? 0,
      modifierRequired: isModRequired,
      sku: sku || undefined,
      calories: caloriesRaw ? Number(caloriesRaw) : undefined,
      allergens: allergensRaw
        ? allergensRaw
            .split(/[,;|]/)
            .map((a) => a.trim())
            .filter(Boolean)
        : undefined,
      raw: rawRow,
      issue,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  }

  const avgPrice =
    prices.length > 0
      ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
      : 0;

  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  return {
    success: previewRows.length > 0,
    rows: previewRows,
    headers,
    summary: {
      totalRows: previewRows.length,
      validCount,
      issueCount,
      uniqueItemsCount: uniqueItemsSet.size,
      categoriesCount: categoriesSet.size,
      modifiersCount,
      categories: Array.from(categoriesSet).sort(),
      avgPrice,
      minPrice,
      maxPrice,
    },
    parseErrors: parseOutput.errors,
  };
}

/**
 * Asynchronously parses a menu CSV from a browser File object or raw string using PapaParse,
 * supporting visual progress tracking across parsing and validation phases.
 */
export async function parseMenuCsvWithProgress(
  input: string | File,
  onProgress?: CsvProgressCallback,
): Promise<MenuParseResult> {
  let csvText: string;

  if (typeof input === "string") {
    csvText = input;
  } else {
    onProgress?.({
      progress: 5,
      stage: "reading",
      stageLabel: "Reading CSV file bytes...",
      processedCount: 0,
      totalCount: 0,
    });
    try {
      csvText = await input.text();
    } catch (err) {
      return {
        success: false,
        rows: [],
        headers: [],
        summary: createEmptySummary(),
        error: `Could not read file: ${err instanceof Error ? err.message : "Unknown error"}`,
        parseErrors: [],
      };
    }
  }

  if (!csvText || !csvText.trim()) {
    return {
      success: false,
      rows: [],
      headers: [],
      summary: createEmptySummary(),
      error: "The CSV file is empty. Please select a CSV containing menu rows.",
      parseErrors: [],
    };
  }

  onProgress?.({
    progress: 20,
    stage: "parsing",
    stageLabel: "Analyzing schema and delimiter...",
    processedCount: 0,
    totalCount: 0,
  });

  const cleanText = csvText.replace(/^\uFEFF/, "").trim();

  const parseOutput = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const headers = parseOutput.meta.fields || [];

  if (headers.length === 0) {
    return {
      success: false,
      rows: [],
      headers: [],
      summary: createEmptySummary(),
      error: "Unable to detect any column headers in this CSV.",
      parseErrors: parseOutput.errors,
    };
  }

  const rawRows = parseOutput.data.filter((row) => {
    if (!row || typeof row !== "object") return false;
    return Object.values(row).some((val) => typeof val === "string" && val.trim().length > 0);
  });

  const totalRows = rawRows.length;
  const previewRows: MenuPreviewRow[] = [];
  const categoriesSet = new Set<string>();
  const uniqueItemsSet = new Set<string>();
  let modifiersCount = 0;
  let validCount = 0;
  let issueCount = 0;

  const chunkSize = totalRows > 1500 ? 250 : 100;

  for (let i = 0; i < totalRows; i += chunkSize) {
    const end = Math.min(i + chunkSize, totalRows);
    for (let idx = i; idx < end; idx++) {
      const rawRow = rawRows[idx]!;
      const normalizedRecord: Record<string, string> = {};
      for (const [key, val] of Object.entries(rawRow)) {
        if (typeof val === "string") {
          normalizedRecord[normalizeHeader(key)] = val;
        }
      }

      const itemName = findFirstMatchingValue(rawRow, normalizedRecord, [
        "item_name",
        "name",
        "menu_item",
        "item",
        "dish",
        "product_name",
        "title",
      ]);

      const description = findFirstMatchingValue(rawRow, normalizedRecord, [
        "description",
        "item_description",
        "desc",
        "details",
      ]);

      const category = findFirstMatchingValue(rawRow, normalizedRecord, [
        "category",
        "menu_group",
        "group",
        "section",
        "menu_category",
        "department",
      ]);

      const priceRaw = findFirstMatchingValue(rawRow, normalizedRecord, [
        "price",
        "item_price",
        "base_price",
        "cost",
        "unit_price",
        "amount",
      ]);

      const modifierName = findFirstMatchingValue(rawRow, normalizedRecord, [
        "modifier_name",
        "modifier",
        "option_name",
        "option",
        "addon",
        "add_on",
      ]);

      const modifierPriceRaw = findFirstMatchingValue(rawRow, normalizedRecord, [
        "modifier_price",
        "modifier_cost",
        "option_price",
        "addon_price",
        "addon_cost",
      ]);

      const modifierRequiredRaw = findFirstMatchingValue(rawRow, normalizedRecord, [
        "modifier_required",
        "required",
        "mandatory",
        "is_required",
      ]);

      const sku = findFirstMatchingValue(rawRow, normalizedRecord, [
        "sku",
        "item_sku",
        "barcode",
        "pos_id",
      ]);

      const caloriesRaw = findFirstMatchingValue(rawRow, normalizedRecord, ["calories", "cal"]);
      const allergensRaw = findFirstMatchingValue(rawRow, normalizedRecord, [
        "allergens",
        "allergy_info",
        "dietary",
      ]);

      const parsedPrice = parsePrice(priceRaw);
      const parsedModPrice = parsePrice(modifierPriceRaw);
      const isModRequired = parseBooleanFlag(modifierRequiredRaw);

      let issue: string | undefined;
      const warnings: string[] = [];

      if (!itemName) {
        issue = "Item name is required";
      } else if (!category) {
        issue = "Category is required";
      } else if (parsedPrice === null) {
        issue = "Invalid or missing base price";
      } else if (parsedPrice < 0) {
        issue = "Base price cannot be negative";
      } else if (modifierPriceRaw && parsedModPrice === null) {
        issue = "Modifier price is not a valid number";
      } else if (parsedModPrice !== null && parsedModPrice < 0) {
        issue = "Modifier price cannot be negative";
      }

      if (parsedPrice !== null && parsedPrice > 500) {
        warnings.push("High price detected (> $500)");
      }
      if (modifierName && parsedModPrice === null && !modifierPriceRaw) {
        warnings.push("Modifier has no explicit price, defaulted to $0.00");
      }

      if (category) categoriesSet.add(category);
      if (itemName) uniqueItemsSet.add(itemName.toLowerCase());
      if (modifierName) modifiersCount++;

      if (issue) {
        issueCount++;
      } else {
        validCount++;
      }

      const calories = caloriesRaw ? parseInt(caloriesRaw, 10) : undefined;
      const allergens = allergensRaw
        ? allergensRaw.split(/[,;|]/).map((a) => a.trim()).filter(Boolean)
        : undefined;

      previewRows.push({
        id: idx + 1,
        itemName,
        description,
        category,
        price: parsedPrice ?? 0,
        modifierName,
        modifierPrice: parsedModPrice ?? 0,
        modifierRequired: isModRequired,
        sku: sku || undefined,
        calories: Number.isNaN(calories) ? undefined : calories,
        allergens,
        raw: rawRow,
        issue,
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    }

    if (totalRows > 60) {
      const pct = Math.min(94, Math.round(20 + (end / totalRows) * 74));
      onProgress?.({
        progress: pct,
        stage: "validating",
        stageLabel: `Validating menu constraints (${end.toLocaleString()} / ${totalRows.toLocaleString()})...`,
        processedCount: end,
        totalCount: totalRows,
      });
      // Yield execution so UI progress bar repaints smoothly
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }

  const prices = previewRows.map((r) => r.price).filter((p) => p > 0);
  const avgPrice =
    prices.length > 0
      ? Math.round((prices.reduce((sum, p) => sum + p, 0) / prices.length) * 100) / 100
      : 0;

  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  onProgress?.({
    progress: 100,
    stage: "complete",
    stageLabel: `Processed and validated ${totalRows.toLocaleString()} rows successfully`,
    processedCount: totalRows,
    totalCount: totalRows,
  });

  return {
    success: previewRows.length > 0,
    rows: previewRows,
    headers,
    summary: {
      totalRows: previewRows.length,
      validCount,
      issueCount,
      uniqueItemsCount: uniqueItemsSet.size,
      categoriesCount: categoriesSet.size,
      modifiersCount,
      categories: Array.from(categoriesSet).sort(),
      avgPrice,
      minPrice,
      maxPrice,
    },
    parseErrors: parseOutput.errors,
  };
}

/**
 * Asynchronously parses a menu CSV from a browser File object or raw string using PapaParse.
 * Compatible with existing callers while also supporting visual progress callbacks.
 */
export async function parseMenuCsv(
  input: string | File,
  onProgress?: CsvProgressCallback,
): Promise<MenuParseResult> {
  return parseMenuCsvWithProgress(input, onProgress);
}

/**
 * Procedurally generates a large realistic restaurant menu CSV with target row count
 * for testing progress updates, stress-testing rendering, and validating export throughput.
 */
export function generateLargeSampleMenuCsv(targetRowCount = 1200): string {
  const categories = [
    {
      name: "Starters & Shared Plates",
      items: [
        { name: "Crispy Calamari", desc: "Tender calamari with pickled chili and lemon garlic aioli", price: 17.50, mods: ["Extra Lemon Aioli", "Extra Spicy Marinara", "Side Lemon Wedges"] },
        { name: "Artisanal Charcuterie Board", desc: "Selection of cured meats, aged cheeses, fig jam, crackers", price: 26.00, mods: ["Gluten-Free Crackers Sub", "Extra Honeycomb", "Nut-Free Prep"] },
        { name: "Charred Brussels Sprouts", desc: "Pancetta, hot honey, pomegranate seeds, pecorino", price: 14.00, mods: ["No Pancetta (Vegetarian)", "Extra Hot Honey", "Sub Vegan Cheese"] },
        { name: "Whipped Ricotta Dip", desc: "Local wildflower honey, roasted pistachios, grilled sourdough", price: 15.50, mods: ["Gluten-Free Bread Sub", "Extra Bread (4pcs)", "No Nuts"] },
      ],
    },
    {
      name: "Signature Entrees",
      items: [
        { name: "Prime Black Angus Ribeye 14oz", desc: "28-day dry aged, confit garlic butter, red wine bordelaise", price: 54.00, mods: ["Rare", "Medium Rare", "Medium", "Medium Well", "Well Done", "Add Lobster Tail", "Add Oscar Style (Crab/Bearnaise)"] },
        { name: "Wild Pan-Seared Halibut", desc: "Sweet corn succotash, charred tomato butter, fresh chives", price: 42.00, mods: ["Gluten-Free Prep", "Dairy-Free Prep", "Extra Tomato Butter"] },
        { name: "Organic Brick-Pressed Chicken", desc: "Herb-marinated half chicken, pomme puree, natural jus", price: 29.50, mods: ["Sub Roasted Fingerlings", "Extra Jus", "All White Meat"] },
        { name: "Braised Colorado Lamb Shank", desc: "Creamy mascarpone polenta, gremolata, rosemary braising jus", price: 38.00, mods: ["Gluten-Free Prep", "Extra Rosemary Jus"] },
      ],
    },
    {
      name: "Handmade Pastas",
      items: [
        { name: "Truffle Tagliolini", desc: "House extruded pasta, cultured butter, shaved black winter truffle", price: 32.00, mods: ["Gluten-Free Pasta Sub", "Extra Shaved Truffle"] },
        { name: "Slow-Braised Short Rib Rigatoni", desc: "12-hour braised beef ragu, san marzano tomato, whipped ricotta", price: 28.50, mods: ["Gluten-Free Pasta Sub", "Extra Ricotta Dollop"] },
        { name: "Wild Mushroom Gnocchi", desc: "Pan-crisped potato gnocchi, chanterelles, sage browned butter", price: 25.00, mods: ["Vegan Prep Sub", "Add Prosciutto Di Parma"] },
      ],
    },
    {
      name: "Neapolitan Pizza",
      items: [
        { name: "Pizza Margherita DOP", desc: "San Marzano D.O.P. tomatoes, fior di latte, fresh basil, EVOO", price: 19.00, mods: ["Gluten-Free Cauliflower Crust", "Add Buffalo Mozzarella", "Well Done Bake"] },
        { name: "Pizza Diavola Hot Honey", desc: "Spicy soppressata, chili flakes, hot honey drizzle, fresh mozzarella", price: 22.50, mods: ["Gluten-Free Crust Sub", "Extra Hot Honey", "Mild Chili"] },
      ],
    },
    {
      name: "Craft Cocktails & Spirits",
      items: [
        { name: "Bourbon Smoked Old Fashioned", desc: "Small batch bourbon, smoked demerara, aromatic bitters, charred orange", price: 16.50, mods: ["Rye Whiskey Sub", "Extra Large Ice Cube", "Less Sweet"] },
        { name: "Blackberry Sage Mezcalita", desc: "Artisanal mezcal, muddled blackberries, fresh lime, agave, black lava salt", price: 15.50, mods: ["Sub Blanco Tequila", "Spicy Jalapeno Rim", "Half Sweet"] },
      ],
    },
    {
      name: "Artisan Desserts",
      items: [
        { name: "Molten Dark Chocolate Lava", desc: "Valrhona chocolate, Madagascar vanilla bean gelato, raspberry coulis", price: 12.50, mods: ["Gluten-Free Prep", "Extra Gelato Scoop"] },
        { name: "Classic Venetian Tiramisu", desc: "Espresso-soaked ladyfingers, mascarpone sabayon, dark cocoa powder", price: 11.00, mods: ["Extra Cocoa Dust", "Decaf Coffee Prep"] },
      ],
    },
  ];

  const lines: string[] = [EXPECTED_MENU_COLUMNS.join(",")];
  let currentCount = 0;
  let cycle = 1;

  while (currentCount < targetRowCount) {
    for (const cat of categories) {
      for (const item of cat.items) {
        const itemIdentifier = cycle === 1 ? item.name : `${item.name} (Vol. ${cycle})`;
        const basePrice = item.price + (cycle > 1 ? (cycle % 4) * 0.5 : 0);

        // Base item
        lines.push(
          `"${itemIdentifier}","${item.desc}","${cat.name}",${basePrice.toFixed(2)},"",0.00,false`
        );
        currentCount++;
        if (currentCount >= targetRowCount) break;

        // Modifiers
        for (const mod of item.mods) {
          const modPrice = mod.startsWith("Add") ? (mod.includes("Lobster") ? 18.0 : 3.5) : 0.0;
          const isReq = mod.includes("Rare") || mod.includes("Medium") || mod.includes("Well");
          lines.push(
            `"${itemIdentifier}","${item.desc}","${cat.name}",${basePrice.toFixed(2)},"${mod}",${modPrice.toFixed(2)},${isReq}`
          );
          currentCount++;
          if (currentCount >= targetRowCount) break;
        }
        if (currentCount >= targetRowCount) break;
      }
      if (currentCount >= targetRowCount) break;
    }
    cycle++;
  }

  return lines.join("\n");
}

function createEmptySummary(): MenuParseSummary {
  return {
    totalRows: 0,
    validCount: 0,
    issueCount: 0,
    uniqueItemsCount: 0,
    categoriesCount: 0,
    modifiersCount: 0,
    categories: [],
    avgPrice: 0,
    minPrice: 0,
    maxPrice: 0,
  };
}

/**
 * Sample pre-packaged CSV menu templates for testing & demo preview
 */
export const SAMPLE_MENU_CSVS = {
  toastDinner: {
    name: "Toast Dinner & Cocktails",
    description: "Multi-course dinner menu with protein options and side modifiers",
    csv: `${EXPECTED_MENU_COLUMNS.join(",")}\n` +
      `"Charred Lemon Chicken","Herbs, preserved lemon, pan jus","Entrees",24.00,"Add Roasted Mushrooms",3.50,false\n` +
      `"Charred Lemon Chicken","Herbs, preserved lemon, pan jus","Entrees",24.00,"Sub Truffle Polenta",4.00,false\n` +
      `"Prime Ribeye 14oz","Dry-aged bone-in steak, garlic butter","Entrees",48.00,"Rare",0.00,true\n` +
      `"Prime Ribeye 14oz","Dry-aged bone-in steak, garlic butter","Entrees",48.00,"Medium Rare",0.00,true\n` +
      `"Prime Ribeye 14oz","Dry-aged bone-in steak, garlic butter","Entrees",48.00,"Medium",0.00,true\n` +
      `"Prime Ribeye 14oz","Dry-aged bone-in steak, garlic butter","Entrees",48.00,"Add Oscar Style (Crab & Bearnaise)",12.00,false\n` +
      `"Burrata & Heirloom Tomato","Basil oil, aged balsamic, sourdough crisp","Starters",16.50,"Gluten-free Crackers",2.00,false\n` +
      `"Crispy Calamari","Cherry peppers, caper aioli, grilled lemon","Starters",18.00,"Extra Caper Aioli",1.00,false\n` +
      `"Smoked Old Fashioned","Bourbon, demerara, angostura, orange peel","Cocktails",15.00,"Rye Whiskey Sub",0.00,false\n` +
      `"Smoked Old Fashioned","Bourbon, demerara, angostura, orange peel","Cocktails",15.00,"Smoked Rosemary Sprig",1.50,false\n` +
      `"Flourless Chocolate Cake","Raspberry coulis, espresso whipped cream","Desserts",11.00,"Add Vanilla Gelato Scoop",3.00,false`,
  },
  cafeBrunch: {
    name: "Artisan Cafe & Bakery",
    description: "Coffee, specialty beverages, breakfast toasts, and milk modifiers",
    csv: `${EXPECTED_MENU_COLUMNS.join(",")}\n` +
      `"Vanilla Bean Latte","Double espresso, Madagascar vanilla syrup, steamed milk","Espresso Bar",5.75,"Oat Milk Sub",0.85,false\n` +
      `"Vanilla Bean Latte","Double espresso, Madagascar vanilla syrup, steamed milk","Espresso Bar",5.75,"Almond Milk Sub",0.85,false\n` +
      `"Vanilla Bean Latte","Double espresso, Madagascar vanilla syrup, steamed milk","Espresso Bar",5.75,"Extra Espresso Shot",1.25,false\n` +
      `"Cold Brew Reserve","24-hour slow steep Ethiopian single origin","Cold Drinks",4.75,"Sweet Cream Cold Foam",1.50,false\n` +
      `"Avocado Brioche Toast","Smashed avocado, pickled shallot, microgreens","Breakfast",13.50,"Add Poached Egg",2.50,false\n` +
      `"Avocado Brioche Toast","Smashed avocado, pickled shallot, microgreens","Breakfast",13.50,"Add Smoked Salmon",5.00,false\n` +
      `"Almond Croissant","Twice baked with frangipane cream and flaked almonds","Pastry",4.95,"Warmed Up",0.00,false\n` +
      `"Matcha Ceremonial Latte","Uji matcha, organic agave, choice of milk","Tea & Botanicals",6.25,"Extra Matcha Shot",1.75,false`,
  },
  sampleWithErrors: {
    name: "Menu with Validation Flags",
    description: "Sample file demonstrating automatic error detection (negative prices, missing names)",
    csv: `${EXPECTED_MENU_COLUMNS.join(",")}\n` +
      `"Truffle Fries","Parmesan, fresh herbs, roasted garlic mayo","Sides",8.50,"Extra Truffle Aioli",1.50,false\n` +
      `"","Housemade soup of the day","Soups",6.00,"Add Roll",1.00,false\n` +
      `"Margherita Pizza","San Marzano tomato, fresh mozzarella, basil","",17.00,"Gluten-free Crust",4.00,false\n` +
      `"House Red Wine 6oz","Cabernet Sauvignon, Columbia Valley","Beverages",-9.00,"",0.00,false\n` +
      `"Fish Tacos (3)","Catch of the day, cabbage slaw, chipotle crema","Mains",16.00,"Extra Guacamole",bad_number,false`,
  },
  largeCatalog: {
    name: "Large Catalog (1,200 Rows)",
    description: "High-volume menu testing visual progress bar during processing & PapaParse export",
    csv: generateLargeSampleMenuCsv(1200),
  },
};

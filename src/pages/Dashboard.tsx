import {
  Check,
  CheckCircle2,
  CircleAlert,
  FileSpreadsheet,
  FileUp,
  Layers,
  LogOut,
  Menu as MenuIcon,
  MousePointer2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TableProperties,
  UploadCloud,
  Utensils,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { POS_PROFILES } from "@/adapters/posEcosystem";
import {
  type MenuParseResult,
  parseMenuCsv,
  parseMenuCsvWithProgress,
  SAMPLE_MENU_CSVS,
  EXPECTED_MENU_COLUMNS,
} from "@/adapters/utils/csv";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { CsvProgressBar } from "@/components/CsvProgressBar";

function formatPrice(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPos, setSelectedPos] = useState<string>("toast");
  const posKeys = Object.keys(POS_PROFILES);
  const activePos = POS_PROFILES[selectedPos] ?? POS_PROFILES["toast"]!;

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<MenuParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState<{
    active: boolean;
    progress: number;
    stage: string;
    stageLabel: string;
    processedCount: number;
    totalCount: number;
  }>({
    active: false,
    progress: 0,
    stage: "reading",
    stageLabel: "Reading CSV file...",
    processedCount: 0,
    totalCount: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "issues">("all");

  const rows = useMemo(() => parseResult?.rows ?? [], [parseResult]);
  const summary = parseResult?.summary;
  const detectedHeaders = parseResult?.headers ?? [];

  const validRows = useMemo(() => rows.filter((r) => !r.issue), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => r.issue), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Status filter
      if (statusFilter === "ready" && row.issue) return false;
      if (statusFilter === "issues" && !row.issue) return false;

      // Category filter
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesItem = row.itemName.toLowerCase().includes(query);
        const matchesDesc = row.description.toLowerCase().includes(query);
        const matchesCategory = row.category.toLowerCase().includes(query);
        const matchesModifier = row.modifierName.toLowerCase().includes(query);
        const matchesIssue = row.issue?.toLowerCase().includes(query) ?? false;
        if (
          !matchesItem &&
          !matchesDesc &&
          !matchesCategory &&
          !matchesModifier &&
          !matchesIssue
        ) {
          return false;
        }
      }

      return true;
    });
  }, [rows, statusFilter, categoryFilter, searchQuery]);

  const processFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    setIsLoading(true);

    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setParseResult(null);
      setError("Please select a valid .csv file.");
      setIsLoading(false);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setParseResult(null);
      setError("File exceeds 15 MB. Please split very large menus into smaller CSVs.");
      setIsLoading(false);
      return;
    }

    setParseProgress({
      active: true,
      progress: 5,
      stage: "reading",
      stageLabel: `Reading ${file.name}...`,
      processedCount: 0,
      totalCount: 0,
    });

    try {
      const result = await parseMenuCsv(file, (info) => {
        setParseProgress({
          active: true,
          progress: info.progress,
          stage: info.stage,
          stageLabel: info.stageLabel,
          processedCount: info.processedCount,
          totalCount: info.totalCount,
        });
      });
      setParseResult(result);
      if (!result.success && result.error) {
        setError(result.error);
      }
      setTimeout(() => {
        setParseProgress((prev) => ({ ...prev, active: false }));
      }, 1600);
    } catch (err) {
      setParseProgress((prev) => ({ ...prev, active: false }));
      setParseResult(null);
      setError(
        `Failed to parse CSV file: ${err instanceof Error ? err.message : "Unknown parsing error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await processFile(file);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const loadSampleMenu = async (key: keyof typeof SAMPLE_MENU_CSVS) => {
    setError(null);
    const sample = SAMPLE_MENU_CSVS[key];
    setFileName(`${sample.name}.csv`);
    setIsLoading(true);

    setParseProgress({
      active: true,
      progress: 8,
      stage: "parsing",
      stageLabel: `Loading ${sample.name}...`,
      processedCount: 0,
      totalCount: 0,
    });

    try {
      const result = await parseMenuCsvWithProgress(sample.csv, (info) => {
        setParseProgress({
          active: true,
          progress: info.progress,
          stage: info.stage,
          stageLabel: info.stageLabel,
          processedCount: info.processedCount,
          totalCount: info.totalCount,
        });
      });
      setParseResult(result);
      setTimeout(() => {
        setParseProgress((prev) => ({ ...prev, active: false }));
      }, 1600);
    } catch (err) {
      setParseProgress((prev) => ({ ...prev, active: false }));
      setError(
        `Failed to load sample menu: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const clearImport = () => {
    setParseResult(null);
    setFileName(null);
    setError(null);
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  const handleDownloadTemplate = () => {
    const sampleCsv = SAMPLE_MENU_CSVS.toastDinner.csv;
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "menuflow-menu-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px]">
        {/* Left Sidebar */}
        <aside className="hidden min-h-screen w-[248px] shrink-0 flex-col border-r border-foreground/10 px-5 py-6 lg:flex">
          <div className="flex items-center gap-3 px-2">
            <div className="clay-icon flex size-10 items-center justify-center rounded-2xl bg-[#f5b46f] text-[#503b2b]">
              <Utensils className="size-5" />
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">mise</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                menu studio
              </p>
            </div>
          </div>

          <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Workspace
          </div>
          <nav className="mt-3 space-y-2">
            <div className="flex items-center gap-3 rounded-2xl bg-[#f5b46f]/35 px-3 py-3 text-sm font-semibold text-[#503b2b] shadow-[inset_0_1px_0_rgba(255,255,255,.55)]">
              <FileUp className="size-4" />
              Import menu
            </div>
            <div className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-muted-foreground">
              <MenuIcon className="size-4" />
              Menu library
              <Badge className="ml-auto bg-white/70 text-[10px] text-muted-foreground shadow-none">Soon</Badge>
            </div>
          </nav>

          {/* PapaParse Power Tag */}
          <div className="mt-8 rounded-[20px] bg-[#f8ecd5]/60 p-3.5 text-xs text-[#765139]">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-[#b77038]">
              <TableProperties className="size-3.5" />
              PapaParse Engine
            </div>
            <p className="mt-1 leading-relaxed text-[11px] text-muted-foreground">
              High-throughput RFC 4180 parsing with column autodetection & issue diagnostics.
            </p>
          </div>

          <div className="mt-auto rounded-[24px] bg-[#dcefe2] p-4 text-[#355547] shadow-[8px_8px_0_rgba(68,104,83,.08),inset_0_1px_0_rgba(255,255,255,.75)]">
            <Sparkles className="size-5" />
            <p className="mt-3 text-sm font-semibold">One row, one modifier.</p>
            <p className="mt-1 text-xs leading-5 text-[#557665]">
              Keep POS options clean and individually editable with our normalized import format.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="min-w-0 flex-1 px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="clay-icon flex size-10 items-center justify-center rounded-2xl bg-[#f5b46f] text-[#503b2b]">
                <Utensils className="size-5" />
              </div>
              <span className="font-display text-lg font-bold">mise</span>
            </div>
            <div className="hidden text-sm text-muted-foreground sm:block">
              <span className="font-medium text-foreground">Workspace</span>
              <span className="mx-2">/</span>
              Import menu
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">{user?.name || "Menu operator"}</p>
                <p className="text-xs text-muted-foreground">Independent restaurant workspace</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="clay-icon flex size-10 items-center justify-center rounded-2xl bg-white/70 text-muted-foreground transition-transform hover:-translate-y-0.5"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </header>

          <div className="mx-auto mt-8 max-w-[1060px]">
            {/* Title & POS Profile selector */}
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b77038]">
                  <span className="size-2 rounded-full bg-[#e98c58]" />
                  {activePos.name} workspace
                </div>
                <h1 className="font-display text-4xl font-bold tracking-[-0.045em] text-[#3d3029] sm:text-5xl">
                  Make your menu edits<br className="hidden sm:block" />{" "}
                  <span className="text-[#b77038]">upload-ready.</span>
                </h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                  Parse CSV menus via PapaParse, validate every item and individual modifier, and catch formatting issues before POS handoff.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {posKeys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSelectedPos(k)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selectedPos === k
                          ? "bg-[#49372e] text-white"
                          : "bg-white/70 text-[#765139] hover:bg-white"
                      }`}
                    >
                      {POS_PROFILES[k]!.name.replace(" POS", "").replace(" Restaurant", "")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 rounded-2xl bg-white/70 px-3.5 py-2 text-sm font-semibold text-[#946037] shadow-sm transition hover:bg-white"
                >
                  <FileSpreadsheet className="size-4" />
                  Template CSV
                </button>
                {rows.length > 0 && (
                  <ExportCsvButton
                    rows={rows}
                    validRows={validRows}
                    filteredRows={filteredRows}
                    fileName={fileName}
                    selectedPos={selectedPos}
                    variant="primary"
                    label="Export CSV"
                  />
                )}
              </div>
            </div>

            {/* Quick Demo Previews Bar */}
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-[#fff7ea] p-3 text-xs text-[#785437] shadow-sm">
              <span className="font-semibold text-[#46352c] flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[#e98c58]" />
                Try sample menu:
              </span>
              <button
                type="button"
                onClick={() => loadSampleMenu("toastDinner")}
                className="rounded-lg bg-white px-2.5 py-1 font-medium text-[#49372e] shadow-xs hover:bg-[#f6ebd8]"
              >
                Dinner & Cocktails
              </button>
              <button
                type="button"
                onClick={() => loadSampleMenu("cafeBrunch")}
                className="rounded-lg bg-white px-2.5 py-1 font-medium text-[#49372e] shadow-xs hover:bg-[#f6ebd8]"
              >
                Cafe & Bakery
              </button>
              <button
                type="button"
                onClick={() => loadSampleMenu("sampleWithErrors")}
                className="rounded-lg bg-[#fedfd7] px-2.5 py-1 font-medium text-[#9a463a] shadow-xs hover:bg-[#fed3c8]"
              >
                Test Validation Flags
              </button>
              <button
                type="button"
                onClick={() => loadSampleMenu("largeCatalog")}
                className="rounded-lg bg-[#f2e1cc] px-2.5 py-1 font-semibold text-[#5c3e29] shadow-xs hover:bg-[#ebd2b5] flex items-center gap-1.5"
              >
                <Sparkles className="size-3 text-[#d97736]" />
                Large Catalog (1,200 Rows)
              </button>
            </div>

            {/* Upload Area & Stats Grid */}
            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`clay-surface relative rounded-[30px] p-5 transition-all sm:p-7 ${
                    isDragging ? "scale-[1.01] bg-[#fff5dc]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-[#f9dfb5] text-[#a65e32]">
                          <UploadCloud className="size-4" />
                        </div>
                        <h2 className="font-display text-xl font-bold text-[#46352c]">
                          Import your menu CSV
                        </h2>
                      </div>
                      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                        Parsed using PapaParse with automatic headers mapping for{" "}
                        <span className="font-semibold text-[#3d3029]">{activePos.name}</span>:{" "}
                        {EXPECTED_MENU_COLUMNS.slice(0, 4).join(", ")}...
                      </p>
                    </div>
                    <Badge className="hidden rounded-full bg-[#dcefe2] px-3 py-1 text-[#47715a] shadow-none sm:inline-flex">
                      PapaParse active
                    </Badge>
                  </div>

                  {/* Live Progress Bar for File Processing */}
                  {parseProgress.active && (
                    <div className="mt-5">
                      <CsvProgressBar
                        active={parseProgress.active}
                        progress={parseProgress.progress}
                        stage={parseProgress.stage}
                        stageLabel={parseProgress.stageLabel}
                        processedCount={parseProgress.processedCount}
                        totalCount={parseProgress.totalCount}
                        mode="import"
                        variant="inline"
                        fileName={fileName}
                        onDismiss={() =>
                          setParseProgress((prev) => ({ ...prev, active: false }))
                        }
                      />
                    </div>
                  )}

                  <div
                    className={`mt-6 rounded-[24px] border-2 border-dashed p-8 text-center transition-colors sm:p-10 ${
                      isDragging
                        ? "border-[#e98c58] bg-white/60"
                        : "border-[#e7cda9] bg-white/25"
                    }`}
                  >
                    <div className="mx-auto flex size-14 items-center justify-center rounded-[20px] bg-[#f5b46f] text-[#69432d] shadow-[4px_5px_0_rgba(183,112,56,.14),inset_0_1px_0_rgba(255,255,255,.55)]">
                      <FileUp className="size-6" />
                    </div>
                    <p className="mt-4 font-display text-lg font-bold text-[#46352c]">
                      {isDragging ? "Drop your CSV here" : "Drag and drop your menu CSV here"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      or choose a file from your computer
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="mt-5 flex items-center justify-center gap-3">
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="rounded-2xl bg-[#49372e] px-5 text-white shadow-[0_5px_0_#2d211c] hover:bg-[#5c4438] hover:shadow-[0_3px_0_#2d211c]"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="size-4 animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          <>
                            <MousePointer2 className="size-4" />
                            Browse files
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">CSV only · Max 15 MB</p>
                  </div>

                  {error && (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#fee5dd] px-4 py-3 text-sm text-[#a34f43]">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Import error</p>
                        <p className="text-xs leading-relaxed opacity-90">{error}</p>
                      </div>
                    </div>
                  )}

                  {fileName && !error && (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#e4f1e7] px-4 py-3 text-sm text-[#47715a]">
                      <Check className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {fileName} ({rows.length} rows parsed)
                      </span>
                      <button
                        type="button"
                        onClick={clearImport}
                        className="rounded-full p-1 hover:bg-white/60 text-[#47715a]"
                        aria-label="Clear import"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Detected Column Headers Chip Bar */}
                {detectedHeaders.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#f7eedc]/70 px-4 py-2.5 text-xs text-[#7e5c3e]">
                    <span className="font-bold uppercase tracking-wider text-[10px]">
                      Detected Columns ({detectedHeaders.length}):
                    </span>
                    {detectedHeaders.map((header) => (
                      <span
                        key={header}
                        className="rounded-md bg-white/80 px-2 py-0.5 font-mono text-[11px] text-[#4d3a2b]"
                      >
                        {header}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar Stats & Health */}
              <div className="space-y-4">
                <div className="clay-surface rounded-[26px] p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Import health
                    </p>
                    <span
                      className={`size-2.5 rounded-full ${
                        invalidRows.length > 0
                          ? "bg-[#e26955] shadow-[0_0_0_4px_rgba(226,105,85,.15)]"
                          : "bg-[#7eb58d] shadow-[0_0_0_4px_rgba(126,181,141,.15)]"
                      }`}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="clay-inset rounded-2xl p-3">
                      <p className="text-2xl font-bold text-[#46352c]">
                        {summary?.uniqueItemsCount ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Unique items</p>
                    </div>
                    <div className="clay-inset rounded-2xl p-3">
                      <p className="text-2xl font-bold text-[#46352c]">
                        {summary?.modifiersCount ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Modifiers</p>
                    </div>
                    <div className="clay-inset rounded-2xl p-3">
                      <p className="text-2xl font-bold text-[#46352c]">
                        {summary?.categoriesCount ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Categories</p>
                    </div>
                    <div className="clay-inset rounded-2xl p-3">
                      <p className="text-2xl font-bold text-[#46352c]">
                        {summary ? formatPrice(summary.avgPrice) : "$0.00"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Avg. price</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Validation status</span>
                    <span
                      className={`font-bold ${
                        invalidRows.length > 0 ? "text-[#a34f43]" : "text-[#47715a]"
                      }`}
                    >
                      {validRows.length}/{rows.length || 0} ready
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eadfcd]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        invalidRows.length > 0 ? "bg-[#e89a58]" : "bg-[#88b997]"
                      }`}
                      style={{
                        width: rows.length ? `${(validRows.length / rows.length) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-[26px] bg-[#f5d8ca] p-5 text-[#65483d] shadow-[8px_8px_0_rgba(141,87,65,.08),inset_0_1px_0_rgba(255,255,255,.6)]">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-white/45">
                    <Plus className="size-4" />
                  </div>
                  <p className="mt-4 font-display font-bold">PapaParse RFC 4180</p>
                  <p className="mt-1 text-xs leading-5 text-[#89675a]">
                    Safely parses quotes, commas in descriptions, currency symbols, and BOM bytes. Clean data is ready for instant POS ingestion.
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Preview Section */}
            <div className="mt-12">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl font-bold tracking-tight text-[#46352c]">
                      Preview & validation
                    </h2>
                    {rows.length > 0 && (
                      <Badge className="bg-[#e4f1e7] text-[#47715a] shadow-none">
                        {validRows.length} ready
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review and verify every item, category, base price, and modifier row.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {invalidRows.length > 0 && (
                    <p className="text-sm font-semibold text-[#a34f43]">
                      {invalidRows.length} row{invalidRows.length === 1 ? "" : "s"} need attention
                    </p>
                  )}
                  {rows.length > 0 && (
                    <ExportCsvButton
                      rows={rows}
                      validRows={validRows}
                      filteredRows={filteredRows}
                      fileName={fileName}
                      selectedPos={selectedPos}
                      variant="primary"
                      label="Export Menu CSV"
                    />
                  )}
                </div>
              </div>

              {/* Filtering & Search Toolbar */}
              {rows.length > 0 && (
                <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Status tabs */}
                  <div className="flex items-center gap-1 rounded-xl bg-[#eadfcd]/60 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className={`rounded-lg px-3 py-1 font-semibold transition ${
                        statusFilter === "all"
                          ? "bg-white text-[#46352c] shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      All ({rows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("ready")}
                      className={`rounded-lg px-3 py-1 font-semibold transition ${
                        statusFilter === "ready"
                          ? "bg-[#dcefe2] text-[#355547] shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Ready ({validRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("issues")}
                      className={`rounded-lg px-3 py-1 font-semibold transition ${
                        statusFilter === "issues"
                          ? "bg-[#fee5dd] text-[#a34f43] shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Issues ({invalidRows.length})
                    </button>
                  </div>

                  {/* Category Pills */}
                  {summary && summary.categories.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                        <Layers className="size-3" /> Category:
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter("all")}
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                          categoryFilter === "all"
                            ? "bg-[#49372e] text-white"
                            : "bg-white text-muted-foreground hover:bg-[#eadfcd]"
                        }`}
                      >
                        All
                      </button>
                      {summary.categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                            categoryFilter === cat
                              ? "bg-[#49372e] text-white"
                              : "bg-white text-muted-foreground hover:bg-[#eadfcd]"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Search Input */}
                  <div className="relative min-w-[200px] sm:w-60">
                    <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search dish or modifier..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-[#eadfcd] bg-white/80 py-1.5 pl-8 pr-3 text-xs focus:border-[#49372e] focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Table Container */}
              <div className="clay-surface mt-4 overflow-hidden rounded-[26px]">
                {rows.length === 0 ? (
                  <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#e9e1d2] text-[#ae9577]">
                      <FileSpreadsheet className="size-6" />
                    </div>
                    <p className="mt-4 font-display font-bold text-[#59473b]">
                      Your menu preview will appear here
                    </p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                      Upload a CSV or choose one of the sample menus above to preview items, prices,
                      and individual modifiers.
                    </p>
                    <div className="mt-5 flex gap-2">
                      <Button
                        type="button"
                        onClick={() => loadSampleMenu("toastDinner")}
                        className="rounded-xl bg-[#49372e] px-4 text-xs text-white hover:bg-[#5c4438]"
                      >
                        Load Sample Dinner Menu
                      </Button>
                    </div>
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No rows match your current search and filter settings.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="border-b border-[#eadfcd] bg-white/30 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                          <th className="px-5 py-3.5">#</th>
                          <th className="px-5 py-3.5">Menu Item</th>
                          <th className="px-5 py-3.5">Category</th>
                          <th className="px-5 py-3.5">Base Price</th>
                          <th className="px-5 py-3.5">Modifier</th>
                          <th className="px-5 py-3.5">Modifier Cost</th>
                          <th className="px-5 py-3.5">Required?</th>
                          <th className="px-5 py-3.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => (
                          <tr
                            key={row.id}
                            className={`border-b border-[#eadfcd]/70 transition-colors last:border-0 hover:bg-white/40 ${
                              row.issue ? "bg-[#fff0ed]/40" : ""
                            }`}
                          >
                            <td className="px-5 py-3.5 text-xs text-muted-foreground">
                              {row.id}
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-[#46352c]">
                                {row.itemName || <span className="text-[#a34f43]">Untitled Item</span>}
                              </p>
                              {row.description && (
                                <p className="mt-0.5 max-w-[240px] truncate text-xs text-muted-foreground">
                                  {row.description}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="rounded-md bg-[#f6ebdc] px-2 py-0.5 text-xs font-medium text-[#765338]">
                                {row.category || "—"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-medium text-[#46352c]">
                              {formatPrice(row.price)}
                            </td>
                            <td className="px-5 py-3.5">
                              {row.modifierName ? (
                                <span className="rounded-lg bg-[#f8ecd5] px-2.5 py-1 text-xs font-medium text-[#805e3e]">
                                  {row.modifierName}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground/60">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-muted-foreground">
                              {row.modifierName
                                ? row.modifierPrice > 0
                                  ? `+${formatPrice(row.modifierPrice)}`
                                  : "Free ($0.00)"
                                : "—"}
                            </td>
                            <td className="px-5 py-3.5 text-xs">
                              {row.modifierName ? (
                                row.modifierRequired ? (
                                  <span className="rounded-full bg-[#fde9d2] px-2 py-0.5 text-[10px] font-bold text-[#a05624]">
                                    Required
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Optional</span>
                                )
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              {row.issue ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fee5dd] px-2.5 py-1 text-xs font-semibold text-[#a34f43]">
                                  <CircleAlert className="size-3.5" />
                                  {row.issue}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#47715a]">
                                  <CheckCircle2 className="size-3.5" />
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Callout Banner */}
            <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-[26px] bg-[#49372e] px-5 py-5 text-white shadow-[8px_8px_0_rgba(73,55,46,.12)] sm:flex-row sm:items-center sm:px-7">
              <div>
                <p className="font-display text-lg font-bold">Ready to hand off to POS?</p>
                <p className="mt-1 text-sm text-white/65">
                  {rows.length > 0
                    ? `${validRows.length} of ${rows.length} rows pass validation and are ready to export.`
                    : "Upload your menu CSV above to start testing."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {rows.length > 0 && (
                  <ExportCsvButton
                    rows={rows}
                    validRows={validRows}
                    filteredRows={filteredRows}
                    fileName={fileName}
                    selectedPos={selectedPos}
                    variant="compact"
                    label="Export CSV"
                  />
                )}
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl bg-white/20 text-white hover:bg-white/30"
                >
                  Upload New File
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

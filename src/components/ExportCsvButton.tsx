import { useState } from "react";
import {
  Download,
  ChevronDown,
  Check,
  Copy,
  FileCode2,
  FileSpreadsheet,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type MenuPreviewRow,
  unparseMenuData,
  downloadMenuCsvFileWithProgress,
} from "@/adapters/utils/csv";
import { CsvProgressBar } from "@/components/CsvProgressBar";

interface ExportCsvButtonProps {
  rows: MenuPreviewRow[];
  validRows: MenuPreviewRow[];
  filteredRows: MenuPreviewRow[];
  fileName: string | null;
  selectedPos?: string;
  variant?: "primary" | "compact" | "subtle";
  label?: string;
  className?: string;
}

export function ExportCsvButton({
  rows,
  validRows,
  filteredRows,
  fileName,
  selectedPos = "menu",
  variant = "primary",
  label = "Export CSV",
  className = "",
}: ExportCsvButtonProps) {
  const [includeStatus, setIncludeStatus] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [exportState, setExportState] = useState<{
    active: boolean;
    progress: number;
    stage: string;
    stageLabel: string;
    processedCount: number;
    totalCount: number;
  }>({
    active: false,
    progress: 0,
    stage: "preparing",
    stageLabel: "Preparing export...",
    processedCount: 0,
    totalCount: 0,
  });

  const isFiltered = filteredRows.length !== rows.length;
  const hasRows = rows.length > 0;

  const getExportFilename = (mode: "all" | "valid" | "filtered") => {
    const raw = fileName ? fileName.replace(/\.[^/.]+$/, "") : `${selectedPos}-menu`;
    const clean = raw.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    const suffix = mode === "valid" ? "-ready" : mode === "filtered" ? "-filtered" : "-all";
    return `menuflow-${clean}${suffix}.csv`;
  };

  const executeExport = async (
    targetRows: MenuPreviewRow[],
    mode: "all" | "valid" | "filtered",
    modeLabel: string,
  ) => {
    if (targetRows.length === 0) {
      toast.error("No menu rows to export", {
        description: "Your selection contains 0 rows.",
      });
      return;
    }

    const filename = getExportFilename(mode);

    setExportState({
      active: true,
      progress: 5,
      stage: "preparing",
      stageLabel: `Preparing ${targetRows.length.toLocaleString()} rows for RFC 4180 export...`,
      processedCount: 0,
      totalCount: targetRows.length,
    });

    try {
      await downloadMenuCsvFileWithProgress(
        targetRows,
        filename,
        {
          includeStatus,
          quotes: true,
        },
        (info) => {
          setExportState({
            active: true,
            progress: info.progress,
            stage: info.stage,
            stageLabel: info.stageLabel,
            processedCount: info.processedCount,
            totalCount: info.totalCount,
          });
        },
      );

      toast.success(`Exported ${modeLabel} (${targetRows.length}) to CSV`, {
        description: `Generated via PapaParse unparse · Saved as ${filename}`,
      });

      setTimeout(() => {
        setExportState((prev) => ({ ...prev, active: false }));
      }, 2000);
    } catch (err) {
      setExportState((prev) => ({ ...prev, active: false }));
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Could not generate CSV",
      });
    }
  };

  const handleCopyClipboard = (targetRows: MenuPreviewRow[]) => {
    try {
      const csvString = unparseMenuData(targetRows, {
        includeStatus,
        quotes: true,
      });
      navigator.clipboard.writeText(csvString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("CSV copied to clipboard", {
        description: `${targetRows.length} rows formatted with PapaParse unparse`,
      });
    } catch {
      toast.error("Failed to copy CSV to clipboard");
    }
  };

  const handleOpenPreview = (targetRows: MenuPreviewRow[]) => {
    const csvString = unparseMenuData(targetRows, {
      includeStatus,
      quotes: true,
    });
    setPreviewContent(csvString);
    setPreviewOpen(true);
  };

  if (!hasRows) {
    return (
      <Button
        type="button"
        disabled
        className={`rounded-2xl bg-[#49372e]/40 text-white/60 cursor-not-allowed ${className}`}
      >
        <Download className="size-4" />
        {label}
      </Button>
    );
  }

  // Primary variant with split / dropdown trigger
  return (
    <>
      <div className={`inline-flex items-center rounded-2xl shadow-sm ${className}`}>
        <Button
          type="button"
          onClick={() => executeExport(isFiltered ? filteredRows : rows, isFiltered ? "filtered" : "all", isFiltered ? "Filtered" : "All")}
          className={`flex items-center gap-2 rounded-l-2xl rounded-r-none font-semibold transition ${
            variant === "primary"
              ? "bg-[#49372e] px-4 py-2 text-white hover:bg-[#5c4438]"
              : variant === "subtle"
                ? "bg-white/80 px-3 py-2 text-[#49372e] hover:bg-white"
                : "bg-[#f5b46f] px-3.5 py-2 text-[#49372e] hover:bg-[#ffca89]"
          }`}
          title="Export formatted CSV using PapaParse"
        >
          <Download className="size-4" />
          <span>{label}</span>
          <span className="hidden sm:inline-block rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            PapaParse
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              className={`rounded-l-none rounded-r-2xl border-l border-white/15 px-2 transition ${
                variant === "primary"
                  ? "bg-[#49372e] text-white hover:bg-[#5c4438]"
                  : variant === "subtle"
                    ? "bg-white/80 text-[#49372e] hover:bg-white"
                    : "bg-[#f5b46f] text-[#49372e] hover:bg-[#ffca89]"
              }`}
              aria-label="Export options"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-64 rounded-2xl border border-[#e5d8c6] bg-[#fcfaf7] p-2 text-[#46352c] shadow-xl"
          >
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Export CSV</span>
              <span className="text-[10px] lowercase text-[#47715a] bg-[#e4f1e7] px-1.5 py-0.2 rounded">
                Papa.unparse
              </span>
            </DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => executeExport(rows, "all", "All rows")}
              className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium hover:bg-[#ebdcc8]"
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="size-3.5 text-[#e98c58]" />
                Export all rows
              </span>
              <span className="rounded bg-[#eadfcd] px-1.5 py-0.5 text-[10px] font-semibold text-[#5c4438]">
                {rows.length}
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => executeExport(validRows, "valid", "Ready rows only")}
              className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium hover:bg-[#ebdcc8]"
            >
              <span className="flex items-center gap-2">
                <Check className="size-3.5 text-[#47715a]" />
                Export ready only
              </span>
              <span className="rounded bg-[#dcefe2] px-1.5 py-0.5 text-[10px] font-semibold text-[#355547]">
                {validRows.length}
              </span>
            </DropdownMenuItem>

            {isFiltered && (
              <DropdownMenuItem
                onClick={() => executeExport(filteredRows, "filtered", "Filtered rows")}
                className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium hover:bg-[#ebdcc8]"
              >
                <span className="flex items-center gap-2">
                  <Layers className="size-3.5 text-[#946037]" />
                  Export filtered view
                </span>
                <span className="rounded bg-[#f5d8ca] px-1.5 py-0.5 text-[10px] font-semibold text-[#7c442c]">
                  {filteredRows.length}
                </span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="my-1 bg-[#e5d8c6]" />

            <DropdownMenuItem
              onClick={() => setIncludeStatus(!includeStatus)}
              className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs hover:bg-[#ebdcc8]"
            >
              <span className="text-muted-foreground">Include status column</span>
              <span
                className={`flex size-4 items-center justify-center rounded border text-[10px] ${
                  includeStatus
                    ? "border-[#47715a] bg-[#47715a] text-white"
                    : "border-muted-foreground/40 bg-transparent"
                }`}
              >
                {includeStatus && <Check className="size-3" />}
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1 bg-[#e5d8c6]" />

            <DropdownMenuItem
              onClick={() => handleCopyClipboard(isFiltered ? filteredRows : rows)}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs hover:bg-[#ebdcc8]"
            >
              {copied ? (
                <Check className="size-3.5 text-[#47715a]" />
              ) : (
                <Copy className="size-3.5 text-muted-foreground" />
              )}
              <span>{copied ? "Copied!" : "Copy CSV to clipboard"}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => handleOpenPreview(isFiltered ? filteredRows : rows)}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs hover:bg-[#ebdcc8]"
            >
              <FileCode2 className="size-3.5 text-muted-foreground" />
              <span>Preview raw CSV text</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Raw PapaParse Output Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl rounded-3xl border border-[#e5d8c6] bg-[#fcfaf7] p-6 text-[#46352c] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-[#e98c58]" />
              PapaParse Unparse Preview
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Formatted RFC 4180 CSV generated using PapaParse unparse with quote escaping and decimal normalization.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{previewContent.split("\n").filter(Boolean).length} lines (including headers)</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewContent);
                  toast.success("Copied to clipboard");
                }}
                className="flex items-center gap-1 text-xs font-semibold text-[#49372e] hover:underline"
              >
                <Copy className="size-3" />
                Copy text
              </button>
            </div>
            <pre className="max-h-72 overflow-auto rounded-2xl bg-[#f0e6d6] p-4 text-[11px] font-mono leading-relaxed text-[#49372e] select-all border border-[#decbb3]">
              {previewContent}
            </pre>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              className="rounded-xl border-[#dac8af] text-xs font-semibold hover:bg-[#eee1cd]"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                executeExport(isFiltered ? filteredRows : rows, isFiltered ? "filtered" : "all", isFiltered ? "Filtered" : "All");
                setPreviewOpen(false);
              }}
              className="rounded-xl bg-[#49372e] text-xs font-semibold text-white hover:bg-[#5c4438] flex items-center gap-2"
            >
              <Download className="size-3.5" />
              Download CSV File
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Progress Feedback Bar */}
      {exportState.active && (
        <CsvProgressBar
          active={exportState.active}
          progress={exportState.progress}
          stage={exportState.stage}
          stageLabel={exportState.stageLabel}
          processedCount={exportState.processedCount}
          totalCount={exportState.totalCount}
          mode="export"
          variant="floating"
          fileName={fileName}
          onDismiss={() => setExportState((prev) => ({ ...prev, active: false }))}
        />
      )}
    </>
  );
}

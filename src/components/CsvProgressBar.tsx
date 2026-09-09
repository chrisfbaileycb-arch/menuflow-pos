import {
  FileUp,
  Download,
  CheckCircle2,
  X,
  Loader2,
  Layers,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export interface CsvProgressBarProps {
  active: boolean;
  progress: number; // 0 - 100
  stage?: string;
  stageLabel?: string;
  title?: string;
  processedCount?: number;
  totalCount?: number;
  mode?: "import" | "export";
  variant?: "inline" | "card" | "floating";
  fileName?: string | null;
  onCancel?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function CsvProgressBar({
  active,
  progress,
  stage = "processing",
  stageLabel = "Processing CSV data...",
  title,
  processedCount,
  totalCount,
  mode = "import",
  variant = "card",
  fileName,
  onCancel,
  onDismiss,
  className = "",
}: CsvProgressBarProps) {
  if (!active && progress === 0) return null;

  const isComplete = progress >= 100;
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  const defaultTitle =
    title ||
    (mode === "import"
      ? isComplete
        ? "Menu Import Complete"
        : "Processing Menu CSV"
      : isComplete
        ? "Menu Export Complete"
        : "Exporting Menu CSV");

  const importSteps = [
    { key: "reading", label: "Read file" },
    { key: "parsing", label: "Parse structure" },
    { key: "validating", label: "Validate rules" },
    { key: "complete", label: "Ready" },
  ];

  const exportSteps = [
    { key: "preparing", label: "Prepare rows" },
    { key: "formatting", label: "Format values" },
    { key: "encoding", label: "Papa.unparse" },
    { key: "complete", label: "Download" },
  ];

  const steps = mode === "import" ? importSteps : exportSteps;

  const getCurrentStepIndex = () => {
    if (isComplete) return steps.length - 1;
    if (clampedProgress < 20) return 0;
    if (clampedProgress < 40) return 1;
    if (clampedProgress < 95) return 2;
    return steps.length - 1;
  };

  const currentStepIdx = getCurrentStepIndex();

  const containerClasses =
    variant === "floating"
      ? "fixed bottom-6 right-6 z-50 w-96 rounded-3xl border border-[#decbb3] bg-[#fcfaf7]/95 p-5 shadow-2xl backdrop-blur-md"
      : variant === "inline"
        ? "w-full rounded-2xl border border-[#decbb3] bg-[#fcfaf7] p-4 shadow-sm"
        : "w-full rounded-[24px] border border-[#e4d7c5] bg-[#fcfaf7] p-5 shadow-[4px_4px_0_rgba(73,55,46,0.06)]";

  return (
    <div
      role="region"
      aria-label="CSV Operation Progress"
      className={`${containerClasses} ${className} transition-all duration-300`}
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-xl shadow-xs ${
              isComplete
                ? "bg-[#e4f1e7] text-[#3e6852]"
                : mode === "import"
                  ? "bg-[#fff1e0] text-[#c96a30]"
                  : "bg-[#e8f1fa] text-[#2c5f8a]"
            }`}
          >
            {isComplete ? (
              <CheckCircle2 className="size-4 text-[#3e6852]" />
            ) : mode === "import" ? (
              <FileUp className="size-4 animate-pulse" />
            ) : (
              <Download className="size-4 animate-bounce" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-display text-sm font-bold text-[#46352c]">
                {defaultTitle}
              </h4>
              {fileName && (
                <span className="hidden sm:inline-block max-w-[140px] truncate rounded-md bg-[#eee3d1] px-1.5 py-0.5 text-[10px] font-mono text-[#5c4438]">
                  {fileName}
                </span>
              )}
            </div>
            <p className="text-xs text-[#785e49] flex items-center gap-1.5 mt-0.5">
              {!isComplete && <Loader2 className="size-3 animate-spin text-[#ae835c]" />}
              <span>{stageLabel}</span>
            </p>
          </div>
        </div>

        {/* Progress Percentage Badge & Dismiss Button */}
        <div className="flex items-center gap-2">
          <span
            className={`rounded-xl px-2.5 py-1 text-xs font-bold font-mono shadow-xs ${
              isComplete
                ? "bg-[#d8edd9] text-[#2c5540]"
                : "bg-[#ebdcc8] text-[#49372e]"
            }`}
          >
            {clampedProgress}%
          </span>

          {onCancel && !isComplete && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1 text-muted-foreground hover:bg-[#ebdcc8] hover:text-[#49372e]"
              title="Cancel operation"
            >
              <X className="size-4" />
            </button>
          )}

          {onDismiss && isComplete && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg p-1 text-muted-foreground hover:bg-[#ebdcc8] hover:text-[#49372e]"
              title="Dismiss progress"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="mt-3.5 space-y-1.5">
        <Progress
          value={clampedProgress}
          className={`h-2.5 w-full bg-[#ebdcc8] ${
            isComplete
              ? "[&>[data-slot=progress-indicator]]:bg-[#47715a]"
              : "[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-[#c96a30] [&>[data-slot=progress-indicator]]:to-[#49372e]"
          }`}
        />

        {/* Row Counters and Details */}
        <div className="flex items-center justify-between text-[11px] text-[#866850]">
          <div className="flex items-center gap-2">
            {totalCount !== undefined && totalCount > 0 && (
              <span className="flex items-center gap-1">
                <Layers className="size-3" />
                {processedCount !== undefined ? (
                  <span>
                    <strong>{processedCount.toLocaleString()}</strong> of{" "}
                    {totalCount.toLocaleString()} rows
                  </span>
                ) : (
                  <span>{totalCount.toLocaleString()} total rows</span>
                )}
              </span>
            )}
          </div>

          <span className="font-medium text-[#5c4438] capitalize">
            {isComplete ? "Completed" : stage}
          </span>
        </div>
      </div>

      {/* Milestone Step Pills */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 pt-2 border-t border-[#eadbc7]">
        {steps.map((s, index) => {
          const isDone = isComplete || index < currentStepIdx;
          const isCurrent = !isComplete && index === currentStepIdx;
          return (
            <div
              key={s.key}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                isDone
                  ? "bg-[#e4f1e7] text-[#345c47]"
                  : isCurrent
                    ? "bg-[#f5e5d3] text-[#784323] ring-1 ring-[#e98c58]/40"
                    : "text-muted-foreground/60 bg-transparent"
              }`}
            >
              <span
                className={`flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold ${
                  isDone
                    ? "bg-[#345c47] text-white"
                    : isCurrent
                      ? "bg-[#c96a30] text-white"
                      : "bg-[#d8cbba] text-[#554538]"
                }`}
              >
                {isDone ? "✓" : index + 1}
              </span>
              <span className="truncate">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  FileSpreadsheet,
  FileUp,
  Info,
  LogOut,
  Menu as MenuIcon,
  MousePointer2,
  Plus,
  Sparkles,
  UploadCloud,
  Utensils,
  X,
} from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface MenuPreviewRow {
  id: number;
  itemName: string;
  description: string;
  category: string;
  price: number;
  modifierName: string;
  modifierPrice: number;
  modifierRequired: boolean;
  issue?: string;
}

const EXPECTED_COLUMNS = [
  "item_name",
  "description",
  "category",
  "price",
  "modifier_name",
  "modifier_price",
  "modifier_required",
];

const SAMPLE_ROWS: MenuPreviewRow[] = [
  {
    id: 1,
    itemName: "Charred lemon chicken",
    description: "Herbs, preserved lemon, pan jus",
    category: "Dinner",
    price: 24,
    modifierName: "Add roasted mushrooms",
    modifierPrice: 3,
    modifierRequired: false,
  },
  {
    id: 2,
    itemName: "Charred lemon chicken",
    description: "Herbs, preserved lemon, pan jus",
    category: "Dinner",
    price: 24,
    modifierName: "Substitute crispy potatoes",
    modifierPrice: 2,
    modifierRequired: false,
  },
  {
    id: 3,
    itemName: "Garden grain bowl",
    description: "Ancient grains, greens, tahini",
    category: "Lunch",
    price: 18,
    modifierName: "Add grilled salmon",
    modifierPrice: 8,
    modifierRequired: false,
  },
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const cleanText = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < cleanText.length; index += 1) {
    const character = cleanText[index];
    const nextCharacter = cleanText[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function firstValue(record: Record<string, string>, names: string[]) {
  return names.map((name) => record[name]).find((value) => value !== undefined) ?? "";
}

function parseMenuRows(text: string): { rows: MenuPreviewRow[]; error?: string } {
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    return { rows: [], error: "Add a header row and at least one menu item to your CSV." };
  }

  const headers = parsed[0].map(normalizeHeader);
  const missing = ["item_name", "category", "price"].filter(
    (column) => !headers.includes(column),
  );
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    };
  }

  const rows = parsed.slice(1).map((cells, index) => {
    const record = Object.fromEntries(
      headers.map((header, columnIndex) => [header, cells[columnIndex] ?? ""]),
    );
    const itemName = firstValue(record, ["item_name", "name"]);
    const category = record.category;
    const priceText = record.price.replace(/[$,]/g, "");
    const modifierPriceText = firstValue(record, ["modifier_price", "modifier_cost"]).replace(
      /[$,]/g,
      "",
    );
    const price = Number(priceText);
    const modifierPrice = modifierPriceText ? Number(modifierPriceText) : 0;
    let issue: string | undefined;

    if (!itemName) issue = "Item name is required";
    else if (!category) issue = "Category is required";
    else if (!priceText || Number.isNaN(price) || price < 0) issue = "Check item price";
    else if (modifierPriceText && (Number.isNaN(modifierPrice) || modifierPrice < 0)) {
      issue = "Check modifier price";
    }

    return {
      id: index + 1,
      itemName,
      description: firstValue(record, ["description", "item_description"]),
      category,
      price: Number.isNaN(price) ? 0 : price,
      modifierName: firstValue(record, ["modifier_name", "modifier"]),
      modifierPrice: Number.isNaN(modifierPrice) ? 0 : modifierPrice,
      modifierRequired: ["true", "yes", "1"].includes(
        firstValue(record, ["modifier_required", "required"]).toLowerCase(),
      ),
      issue,
    };
  });

  return { rows };
}

function downloadTemplate() {
  const csv = `${EXPECTED_COLUMNS.join(",")}\nCharred lemon chicken,"Herbs, preserved lemon, pan jus",Dinner,24,Add roasted mushrooms,3,false`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "toast-menu-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatPrice(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<MenuPreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validRows = rows.filter((row) => !row.issue);
  const invalidRows = rows.filter((row) => row.issue);
  const uniqueItems = new Set(validRows.map((row) => row.itemName)).size;
  const modifierCount = validRows.filter((row) => row.modifierName).length;

  const processFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setRows([]);
      setError("Toast menu imports need to be a .csv file.");
      return;
    }

    const result = parseMenuRows(await file.text());
    setRows(result.rows);
    setError(result.error ?? null);
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

  const clearImport = () => {
    setRows([]);
    setFileName(null);
    setError(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px]">
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

          <div className="mt-12 px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
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

          <div className="mt-auto rounded-[24px] bg-[#dcefe2] p-4 text-[#355547] shadow-[8px_8px_0_rgba(68,104,83,.08),inset_0_1px_0_rgba(255,255,255,.75)]">
            <Sparkles className="size-5" />
            <p className="mt-3 text-sm font-semibold">One row, one modifier.</p>
            <p className="mt-1 text-xs leading-5 text-[#557665]">
              Keep Toast options clean and individually editable with our import format.
            </p>
          </div>
        </aside>

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

          <div className="mx-auto mt-12 max-w-[1060px]">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b77038]">
                  <span className="size-2 rounded-full bg-[#e98c58]" />
                  Toast workspace
                </div>
                <h1 className="font-display text-4xl font-bold tracking-[-0.045em] text-[#3d3029] sm:text-5xl">
                  Make your menu edits<br className="hidden sm:block" /> <span className="text-[#b77038]">upload-ready.</span>
                </h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                  Drop in a CSV, review every item and individual modifier, and leave the tedious formatting behind.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-2 self-start rounded-2xl px-3 py-2 text-sm font-semibold text-[#946037] transition-colors hover:bg-white/60 md:self-auto"
              >
                <FileSpreadsheet className="size-4" />
                Download CSV template
              </button>
            </div>

            <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`clay-surface relative rounded-[30px] p-5 transition-all sm:p-7 ${isDragging ? "scale-[1.01] bg-[#fff5dc]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-[#f9dfb5] text-[#a65e32]">
                          <UploadCloud className="size-4" />
                        </div>
                        <h2 className="font-display text-xl font-bold text-[#46352c]">Import your menu CSV</h2>
                      </div>
                      <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                        Use the Toast-ready columns below. We will flag missing values before anything gets sent to your team.
                      </p>
                    </div>
                    <Badge className="hidden rounded-full bg-[#dcefe2] px-3 py-1 text-[#47715a] shadow-none sm:inline-flex">
                      Toast format
                    </Badge>
                  </div>

                  <div className={`mt-7 rounded-[24px] border-2 border-dashed p-8 text-center transition-colors sm:p-12 ${isDragging ? "border-[#e98c58] bg-white/60" : "border-[#e7cda9] bg-white/25"}`}>
                    <div className="mx-auto flex size-14 items-center justify-center rounded-[20px] bg-[#f5b46f] text-[#69432d] shadow-[4px_5px_0_rgba(183,112,56,.14),inset_0_1px_0_rgba(255,255,255,.55)]">
                      <FileUp className="size-6" />
                    </div>
                    <p className="mt-5 font-display text-lg font-bold text-[#46352c]">
                      {isDragging ? "Drop it here" : "Drag and drop your CSV here"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">or choose a file from your computer</p>
                    <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-6 rounded-2xl bg-[#49372e] px-5 text-white shadow-[0_5px_0_#2d211c] hover:bg-[#5c4438] hover:shadow-[0_3px_0_#2d211c]"
                    >
                      <MousePointer2 className="size-4" />
                      Browse files
                    </Button>
                    <p className="mt-4 text-xs text-muted-foreground">CSV only · Max 10 MB</p>
                  </div>

                  {error && (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#fee5dd] px-4 py-3 text-sm text-[#a34f43]">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {fileName && !error && (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#e4f1e7] px-4 py-3 text-sm text-[#47715a]">
                      <Check className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-medium">{fileName}</span>
                      <button type="button" onClick={clearImport} className="rounded-full p-1 hover:bg-white/60" aria-label="Clear import">
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f8ecd5]/70 px-4 py-3 text-xs leading-5 text-[#836d54]">
                  <Info className="mt-0.5 size-4 shrink-0 text-[#c98a55]" />
                  <p><strong className="font-semibold text-[#66533e]">Modifier tip:</strong> create one CSV row per modifier. This keeps options separate instead of nesting them into hard-to-edit groups.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="clay-surface rounded-[26px] p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Import health</p>
                    <span className="size-2.5 rounded-full bg-[#7eb58d] shadow-[0_0_0_4px_rgba(126,181,141,.15)]" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="clay-inset rounded-2xl p-3">
                      <p className="text-2xl font-bold text-[#46352c]">{uniqueItems}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Menu items</p>
                    </div>
                    <div className="clay-inset rounded-2xl p-3">
                      <p className="text-2xl font-bold text-[#46352c]">{modifierCount}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Modifiers</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Rows ready</span>
                    <span className="font-bold text-[#47715a]">{validRows.length}/{rows.length || 0}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eadfcd]">
                    <div className="h-full rounded-full bg-[#88b997] transition-all" style={{ width: rows.length ? `${(validRows.length / rows.length) * 100}%` : "0%" }} />
                  </div>
                </div>

                <div className="rounded-[26px] bg-[#f5d8ca] p-5 text-[#65483d] shadow-[8px_8px_0_rgba(141,87,65,.08),inset_0_1px_0_rgba(255,255,255,.6)]">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-white/45"><Plus className="size-4" /></div>
                  <p className="mt-4 font-display font-bold">Simple by design</p>
                  <p className="mt-1 text-xs leading-5 text-[#89675a]">No connectors, no setup maze. Just a clean file you can confidently hand off for Toast updates.</p>
                </div>
              </div>
            </div>

            <div className="mt-12">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl font-bold tracking-tight text-[#46352c]">Preview & validation</h2>
                    {rows.length > 0 && <Badge className="bg-[#e4f1e7] text-[#47715a] shadow-none">{validRows.length} ready</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Review the exact rows your Toast operator will work from.</p>
                </div>
                {invalidRows.length > 0 && <p className="text-sm font-medium text-[#a34f43]">{invalidRows.length} row{invalidRows.length === 1 ? "" : "s"} need attention</p>}
              </div>

              <div className="clay-surface mt-5 overflow-hidden rounded-[26px]">
                {rows.length === 0 ? (
                  <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#e9e1d2] text-[#ae9577]"><FileSpreadsheet className="size-6" /></div>
                    <p className="mt-4 font-display font-bold text-[#59473b]">Your menu preview will appear here</p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Upload a CSV to see menu items, prices, and every modifier as its own editable row.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-sm">
                      <thead className="border-b border-[#eadfcd] bg-white/25 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                          <th className="px-5 py-4">Menu item</th>
                          <th className="px-5 py-4">Category</th>
                          <th className="px-5 py-4">Base price</th>
                          <th className="px-5 py-4">Individual modifier</th>
                          <th className="px-5 py-4">Modifier price</th>
                          <th className="px-5 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id} className="border-b border-[#eadfcd]/70 last:border-0">
                            <td className="px-5 py-4">
                              <p className="font-semibold text-[#46352c]">{row.itemName || "Untitled item"}</p>
                              {row.description && <p className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">{row.description}</p>}
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">{row.category || "—"}</td>
                            <td className="px-5 py-4 font-medium text-[#46352c]">{formatPrice(row.price)}</td>
                            <td className="px-5 py-4">
                              {row.modifierName ? <span className="rounded-lg bg-[#f8ecd5] px-2 py-1 text-xs font-medium text-[#805e3e]">{row.modifierName}</span> : <span className="text-muted-foreground">No modifier</span>}
                            </td>
                            <td className="px-5 py-4 text-muted-foreground">{row.modifierName ? `+${formatPrice(row.modifierPrice)}` : "—"}</td>
                            <td className="px-5 py-4">
                              {row.issue ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a34f43]"><CircleAlert className="size-3.5" />{row.issue}</span> : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#47715a]"><Check className="size-3.5" />Ready</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-[26px] bg-[#49372e] px-5 py-5 text-white shadow-[8px_8px_0_rgba(73,55,46,.12)] sm:flex-row sm:items-center sm:px-7">
              <div>
                <p className="font-display text-lg font-bold">Ready to make the edits?</p>
                <p className="mt-1 text-sm text-white/65">Upload your CSV above to start a clean Toast handoff.</p>
              </div>
              <Button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl bg-[#f5b46f] text-[#49372e] shadow-[0_4px_0_#c27d49] hover:bg-[#ffca89]">
                Start an import <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

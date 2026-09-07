import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  Layers3,
  Sparkles,
  Utensils,
} from "lucide-react";
import { Link } from "react-router";

const features = [
  {
    icon: FileSpreadsheet,
    title: "CSV in, clarity out",
    description: "Upload the file you already have and get a calm, readable preview before the work begins.",
    color: "bg-[#f5d8ca] text-[#9b5e49]",
  },
  {
    icon: Layers3,
    title: "Modifiers stay individual",
    description: "Every option gets its own row, so Toast edits stay precise instead of disappearing into groupings.",
    color: "bg-[#dcefe2] text-[#47715a]",
  },
  {
    icon: Sparkles,
    title: "Built for handoffs",
    description: "A focused workflow for independent restaurant operators and the people who help them move faster.",
    color: "bg-[#f8e6bc] text-[#a66a38]",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="clay-icon flex size-11 items-center justify-center rounded-2xl bg-[#f5b46f] text-[#503b2b]">
              <Utensils className="size-5" />
            </div>
            <div>
              <p className="font-display text-xl font-bold tracking-tight text-[#3d3029]">mise</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">menu studio</p>
            </div>
          </Link>
          <Link to="/auth" className="rounded-2xl px-4 py-2 text-sm font-semibold text-[#765139] transition-colors hover:bg-white/60">
            Sign in <ArrowRight className="ml-1 inline size-4" />
          </Link>
        </header>

        <section className="relative mx-auto grid max-w-[1180px] items-center gap-14 pb-20 pt-20 lg:grid-cols-[1.03fr_.97fr] lg:gap-20 lg:pb-28 lg:pt-28">
          <div className="relative z-10">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b77038]">
              <span className="size-2 rounded-full bg-[#e98c58]" />
              Toast menu imports, made gentle
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08, duration: .55 }} className="font-display max-w-2xl text-5xl font-bold leading-[.98] tracking-[-0.065em] text-[#3d3029] sm:text-7xl">
              Make menu work feel <span className="text-[#b77038]">lighter.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .16, duration: .55 }} className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              mise turns tedious restaurant menu edits into a simple CSV review. Upload once, see every item and individual modifier clearly, and hand off a Toast-ready file with confidence.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .24, duration: .55 }} className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link to="/auth" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#49372e] px-6 text-sm font-semibold text-white shadow-[0_5px_0_#2d211c] transition-all hover:-translate-y-0.5 hover:bg-[#5c4438] hover:shadow-[0_7px_0_#2d211c]">
                Open your workspace <ArrowRight className="size-4" />
              </Link>
              <span className="text-sm text-muted-foreground">Focused v1 · Toast CSV import</span>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, scale: .95, rotate: 1 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: .15, duration: .7 }} className="relative mx-auto w-full max-w-[480px]">
            <div className="absolute -right-7 -top-9 size-28 rounded-full bg-[#f8e6bc]/75 blur-2xl" />
            <div className="absolute -bottom-10 -left-8 size-32 rounded-full bg-[#dcefe2]/90 blur-2xl" />
            <div className="clay-surface relative rounded-[36px] p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-[#f5b46f] text-[#69432d]"><FileSpreadsheet className="size-5" /></div>
                  <div><p className="font-display font-bold text-[#46352c]">Dinner menu.csv</p><p className="text-xs text-muted-foreground">12 rows · just now</p></div>
                </div>
                <span className="rounded-full bg-[#e4f1e7] px-3 py-1 text-[11px] font-bold text-[#47715a]">Ready</span>
              </div>
              <div className="mt-6 space-y-3">
                {["Charred lemon chicken", "Garden grain bowl", "Roasted market salmon"].map((name, index) => (
                  <div key={name} className="clay-inset flex items-center gap-3 rounded-2xl p-3">
                    <div className={`size-9 rounded-xl ${index === 1 ? "bg-[#dcefe2]" : "bg-[#f5d8ca]"}`} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#534038]">{name}</p><p className="mt-1 text-xs text-muted-foreground">{index + 2} individual modifiers</p></div>
                    <Check className="size-4 text-[#6fa47e]" />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between rounded-2xl bg-[#49372e] px-4 py-3 text-white">
                <span className="text-xs font-medium text-white/65">Toast handoff</span><span className="text-sm font-bold">100% tidy</span>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-[1180px] border-t border-foreground/10 py-16 lg:py-20">
          <div className="grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description, color }, index) => (
              <motion.div key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .08 }} className="clay-surface rounded-[26px] p-6">
                <div className={`flex size-11 items-center justify-center rounded-2xl ${color}`}><Icon className="size-5" /></div>
                <h2 className="mt-5 font-display text-xl font-bold text-[#46352c]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-7 rounded-[30px] bg-[#f5d8ca] px-6 py-8 text-[#65483d] shadow-[8px_8px_0_rgba(141,87,65,.08),inset_0_1px_0_rgba(255,255,255,.6)] sm:px-10 md:flex-row md:items-center">
          <div><p className="font-display text-2xl font-bold tracking-tight">Less cleanup. More restaurant work.</p><p className="mt-2 max-w-xl text-sm leading-6 text-[#89675a]">A small, opinionated tool for the exact moment a menu update lands in your inbox.</p></div>
          <Link to="/auth" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-white/70 px-5 text-sm font-bold text-[#65483d] transition-colors hover:bg-white">Start an import <ArrowRight className="size-4" /></Link>
        </section>
        <footer className="py-8 text-center text-xs text-muted-foreground">mise menu studio · v1 for Toast CSV workflows</footer>
      </div>
    </main>
  );
}

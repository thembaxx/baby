export default function Loading() {
  return (
    <div
      className="min-h-dvh w-full flex flex-col justify-between p-6 transition-colors"
      style={{
        backgroundColor: "var(--bg-canvas, #0c0a09)",
        color: "var(--text-primary, #f5f5f4)",
      }}
    >
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between py-3 border-b border-white/[0.08]">
        <div className="h-7 w-36 rounded-xl bg-white/[0.06] animate-pulse" />
        <div className="hidden md:flex items-center gap-6">
          <div className="h-4 w-20 rounded bg-white/[0.05] animate-pulse" />
          <div className="h-4 w-20 rounded bg-white/[0.05] animate-pulse" />
          <div className="h-4 w-20 rounded bg-white/[0.05] animate-pulse" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-amber-400/20 animate-pulse" />
      </div>

      <div className="w-full max-w-7xl mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="h-[420px] rounded-3xl bg-white/[0.04] border border-white/[0.08] animate-pulse flex items-center justify-center">
            <div className="w-28 h-28 rounded-3xl bg-amber-400/10 border border-amber-400/20" />
          </div>
          <div className="h-64 rounded-3xl bg-white/[0.04] border border-white/[0.08] animate-pulse" />
        </div>
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="h-72 rounded-3xl bg-white/[0.04] border border-white/[0.08] animate-pulse" />
          <div className="h-80 rounded-3xl bg-white/[0.04] border border-white/[0.08] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

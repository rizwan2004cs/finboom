export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f8f8fa] dark:bg-[#1c1c1e] transition-colors">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Light: frosted glass icon */}
        <div className="relative dark:hidden">
          <div className="w-24 h-24 rounded-[22px] bg-white/80 border border-black/[0.06] shadow-xl flex items-center justify-center backdrop-blur-sm">
            <span className="text-6xl font-bold text-[#1d1d1f] font-[var(--font-display)] tracking-tighter">F</span>
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#34c759] shadow-[0_2px_10px_rgba(52,199,89,0.45)]" />
        </div>

        {/* Dark: solid glass icon */}
        <div className="relative hidden dark:flex">
          <div className="w-24 h-24 rounded-[22px] bg-[#2c2c2e] border border-white/[0.12] shadow-xl flex items-center justify-center">
            <span className="text-6xl font-bold text-white font-[var(--font-display)] tracking-tighter">F</span>
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#34c759] shadow-[0_2px_10px_rgba(52,199,89,0.45)]" />
        </div>

        {/* Brand name */}
        <span className="text-lg font-semibold tracking-wide text-[#1d1d1f] dark:text-white font-[var(--font-display)]">
          FinBoom
        </span>

        {/* Subtle pulsing dot loader */}
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#86868b] animate-pulse [animation-delay:0ms]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#86868b] animate-pulse [animation-delay:150ms]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#86868b] animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

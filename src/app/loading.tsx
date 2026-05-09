export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f8f8fa] dark:bg-[#1c1c1e] transition-colors">
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        {/* Light mode icon */}
        <div className="relative dark:hidden">
          <div className="w-20 h-20 rounded-[18px] bg-white/80 border border-black/[0.06] shadow-lg flex items-center justify-center backdrop-blur-sm">
            <span className="text-5xl font-bold text-[#1d1d1f] font-serif tracking-tighter">F</span>
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.4)]" />
        </div>

        {/* Dark mode icon */}
        <div className="relative hidden dark:flex">
          <div className="w-20 h-20 rounded-[18px] bg-[#2c2c2e] border border-white/[0.08] shadow-lg flex items-center justify-center">
            <span className="text-5xl font-bold text-white font-serif tracking-tighter">F</span>
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.4)]" />
        </div>

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

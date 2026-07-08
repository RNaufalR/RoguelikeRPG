// Small reusable, static-class UI primitives shared by the modals & menus.
import type { ReactNode } from "react";

export function Btn({
  children,
  onClick,
  primary,
  danger,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  className?: string;
}) {
  const base =
    "w-full rounded-xl px-4 py-3 text-sm font-bold transition-transform active:scale-95 select-none";
  const variant = primary
    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-900/40"
    : danger
    ? "bg-rose-600/80 text-white ring-1 ring-rose-400/30"
    : "bg-white/5 text-white/85 ring-1 ring-white/10";
  return (
    <button onClick={onClick} className={`${base} ${variant} ${className}`}>
      {children}
    </button>
  );
}

export function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}


import type { ReactNode } from "react";

// Small outline icons (24px grid, 1.75 stroke) so the whole app shares one visual style.
function Icon({ children, className = "w-5 h-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
type P = { className?: string };

export const HomeIcon = (p: P) => <Icon {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></Icon>;
export const BodyIcon = (p: P) => <Icon {...p}><circle cx="12" cy="5" r="2.5" /><path d="M6 21l1.5-9h9L18 21" /><path d="M5 11l7-2 7 2" /></Icon>;
export const ReportIcon = (p: P) => <Icon {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h7M9 17h5" /></Icon>;
export const ProfileIcon = (p: P) => <Icon {...p}><path d="M12 21s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.6-7 10-7 10z" /></Icon>;
export const CameraIcon = (p: P) => <Icon {...p}><path d="M3 8h4l2-3h6l2 3h4v12H3z" /><circle cx="12" cy="13" r="3.5" /></Icon>;
export const ShieldIcon = (p: P) => <Icon {...p}><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></Icon>;
export const MessageIcon = (p: P) => <Icon {...p}><path d="M4 5h16v11H9l-5 4z" /></Icon>;
export const AlertIcon = (p: P) => <Icon {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" /></Icon>;
export const HandIcon = (p: P) => <Icon {...p}><path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V13M17 9.5a1.5 1.5 0 013 0V15a7 7 0 01-7 7h-1a7 7 0 01-5.5-2.7L3.5 15.5a1.6 1.6 0 012.4-2L8 15" /></Icon>;
export const LogoutIcon = (p: P) => <Icon {...p}><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4M20 12H9" /></Icon>;
export const ArrowIcon = (p: P) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const CheckIcon = (p: P) => <Icon {...p}><path d="M5 12l5 5 9-10" /></Icon>;
export const StethoscopeIcon = (p: P) => <Icon {...p}><path d="M6 3v6a4 4 0 008 0V3" /><path d="M10 13v2a5 5 0 0010 0v-1" /><circle cx="20" cy="12" r="2" /></Icon>;

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${light ? "bg-white/15 text-white" : "bg-brand text-white"}`}>
        <HandIcon className="w-[18px] h-[18px]" />
      </span>
      <span className={`font-display text-xl font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>MedHear</span>
    </span>
  );
}

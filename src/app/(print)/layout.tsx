import "./print.css";

/** Printable pages: no app chrome, just the sheet and a small toolbar. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-canvas print:bg-white">{children}</div>;
}

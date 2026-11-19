import { Navbar } from "@/components/app-shell/navbar";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <Navbar />
      <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-8 sm:px-8 lg:px-12">{children}</main>
    </div>
  );
}

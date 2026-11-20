import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "katex/dist/katex.min.css";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Curso On — Ligue o modo estudo",
    template: "%s · Curso On",
  },
  description:
    "Plataforma gratuita e open source para criar cursos preparatórios para o ENEM, com aulas, questões e gamificação.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Saved choice from the theme toggle; without it, CSS follows the system theme.
  const saved = (await cookies()).get("theme")?.value;
  const theme = saved === "dark" || saved === "light" ? saved : undefined;
  return (
    <html lang="pt-BR" data-theme={theme} className={`${nunito.variable} ${nunitoSans.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

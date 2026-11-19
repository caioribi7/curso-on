import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
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
    "Plataforma para criar e vender cursos online com aulas, banco de questões e gamificação.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${nunitoSans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

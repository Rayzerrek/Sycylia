import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import Scrollbar from "@/components/scrollbar";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "latin-ext"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Galeria z wakacji",
  description: "Galeria zdjęć i filmów z wakacji. Dodaj swoje wspomnienia!",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-stone-800">
        {children}
        <Scrollbar />
      </body>
    </html>
  );
}

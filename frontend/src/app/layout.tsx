import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
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
      className={`${outfit.variable} ${fraunces.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col text-terra-900 selection:bg-terra-200 selection:text-terra-900">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}

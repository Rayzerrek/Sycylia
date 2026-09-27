import Gallery from "@/components/gallery";

export default function Home() {
  return (
    <div id="page-content" className="w-full min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <main className="z-1 pb-16">
          <Gallery className="space-y-6" />
        </main>

        <footer className="mt-20 pb-12 pt-6 border-t border-rule text-ink-muted font-mono text-xs text-center">
          <span>Galeria zdjęć</span>
        </footer>
      </div>
    </div>
  );
}

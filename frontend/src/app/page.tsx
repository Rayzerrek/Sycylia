import Gallery from "@/components/gallery";

export default function Home() {
  return (
    <div id="page-content" className="w-full min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8 lg:px-12">
        <main className="z-1 pb-16">
          <Gallery />
        </main>

        <footer className="mt-20 pb-12 pt-6 border-t border-rule text-ink-muted font-mono text-xs text-left">
          <span>Galeria zdjęć</span>
        </footer>
      </div>
    </div>
  );
}

import { ArrowRightIcon, CameraIcon } from "@phosphor-icons/react/dist/ssr";

import Gallery from "@/components/gallery";

export default function Home() {
  return (
    <div id="page-content" className="app-shell w-full overflow-hidden">
      <div className="mx-auto max-w-4xl">
        <header className="relative text-center mb-16 sm:mb-20 z-1">
          <h1
            className="reveal font-display mt-8 text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-balance text-terra-900"
            style={{ animationDelay: "90ms" }}
          >
            Galeria z{" "}
            <em className="bg-gradient-to-r from-terra-500 via-orange-500 to-sun-500 bg-clip-text text-transparent italic">
              wakacji
            </em>
          </h1>
        </header>

        <main className="reveal z-1" style={{ animationDelay: "420ms" }}>
          <Gallery className="space-y-8" />
        </main>
      </div>
    </div>
  );
}

import { ArrowRightIcon, CameraIcon } from "@phosphor-icons/react/dist/ssr";

import Gallery from "@/components/gallery";

export default function Home() {
  return (
    <div id="page-content" className="w-full overflow-x-hidden">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-8 lg:px-12">
        <header className="relative pt-16 pb-10 sm:pt-20 sm:pb-14 mb-10 sm:mb-12 text-center">
          <h1
            className="reveal font-display text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight text-terra-900"
            style={{ animationDelay: "90ms" }}
          >
            Galeria
          </h1>
        </header>

        <main className="reveal z-1 pb-32" style={{ animationDelay: "200ms" }}>
          <Gallery className="space-y-8" />
        </main>
      </div>
    </div>
  );
}

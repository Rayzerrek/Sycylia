import { ArrowRightIcon, CameraIcon } from "@phosphor-icons/react/dist/ssr";

import Gallery from "@/components/gallery";

export default function Home() {
  return (
    <div id="page-content" className="w-full overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-8 lg:px-12">
        <header className="relative pt-16 pb-10 sm:pt-20 sm:pb-14 mb-10 sm:mb-12 text-center">
          <h1
            className="reveal flex flex-col items-center justify-center gap-0 sm:gap-1"
            style={{ animationDelay: "90ms" }}
          >
            <span className="text-3xl sm:text-4xl lg:text-5xl font-sans uppercase tracking-[0.1em] text-terra-600 font-medium ml-[0.1em]">
              GALERIA
            </span>
            <span className="font-display text-4xl sm:text-5xl lg:text-6xl italic font-light tracking-tight text-terra-900">
              wakacyjna
            </span>
          </h1>
        </header>

        <main className="reveal z-1 pb-32" style={{ animationDelay: "200ms" }}>
          <Gallery className="space-y-8" />
        </main>
      </div>
    </div>
  );
}

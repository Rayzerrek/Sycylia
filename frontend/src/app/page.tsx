import { ArrowRightIcon, CameraIcon } from "@phosphor-icons/react/dist/ssr";

import Gallery from "@/components/gallery";

export default function Home() {
  return (
    <div id="page-content" className="app-shell w-full overflow-hidden">
      <div className="mx-auto max-w-4xl">
        <header className="relative text-center mb-10 sm:mb-12 z-1">
          <SunDecoration />

          <h1
            className="reveal font-display mt-5 text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-balance text-terra-900"
            style={{ animationDelay: "90ms" }}
          >
            Galeria z{" "}
            <em className="bg-gradient-to-r from-terra-500 via-orange-500 to-sun-500 bg-clip-text text-transparent italic">
              wakacji
            </em>
          </h1>

          <div
            className="reveal mt-5 flex items-center justify-center gap-3"
            style={{ animationDelay: "180ms" }}
            aria-hidden="true"
          ></div>

          <p
            className="reveal mt-5 flex items-center justify-center gap-1.5 flex-wrap text-base sm:text-lg text-stone-600"
            style={{ animationDelay: "260ms" }}
          ></p>
        </header>

        <main className="reveal z-1" style={{ animationDelay: "420ms" }}>
          <Gallery className="space-y-8" />
        </main>
      </div>
    </div>
  );
}

/** Paper sun glowing behind the hero title: the ray ring turns slowly while
    each ray twinkles in sequence and the core gently breathes. */
const SUN_RAY_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

function SunDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 left-1/2 -z-10 -translate-x-1/2 select-none"
    >
      <svg width="340" height="340" viewBox="0 0 340 340" className="opacity-40">
        <title>Słońce</title>
        <defs>
          <radialGradient id="sun-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="55%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="sun-rays">
          {SUN_RAY_ANGLES.map((degrees, i) => {
            const angle = (degrees * Math.PI) / 180;
            const x1 = 170 + Math.cos(angle) * 96;
            const y1 = 170 + Math.sin(angle) * 96;
            const x2 = 170 + Math.cos(angle) * 150;
            const y2 = 170 + Math.sin(angle) * 150;
            return (
              <line
                key={degrees}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#e07f3e"
                strokeWidth="7"
                strokeLinecap="round"
                className="sun-ray"
                style={{ animationDelay: `${i * 0.35}s` }}
              />
            );
          })}
        </g>
        <circle cx="170" cy="170" r="88" fill="url(#sun-core)" className="sun-core" />
      </svg>
    </div>
  );
}

/** Hand-drawn style sea wave used as a divider. */
function WaveDivider({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 240 14"
      fill="none"
      preserveAspectRatio="none"
      className={`h-3.5 ${className ?? ""}`}
      aria-hidden="true"
    >
      <path
        d="M2 8 Q 17 2 32 8 T 62 8 T 92 8 T 122 8 T 152 8 T 182 8 T 212 8 T 242 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

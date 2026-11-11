import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0b0a08] px-6 text-center">
      <p className="label-cinema text-primary/70">Off the campus map</p>
      <h1 className="mt-5 font-display text-[clamp(3rem,9vw,5.5rem)] leading-none text-[#f4ead6]">
        Wrong path.
      </h1>
      <p className="mt-5 max-w-sm font-ui text-sm leading-relaxed text-foreground/50">
        This corner of Navodaya has not been built yet. The gate is still where you left it.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 border border-primary/50 px-5 py-3 font-ui text-[10px] uppercase tracking-[0.24em] text-primary transition hover:bg-primary/10"
      >
        <ArrowLeft className="size-3.5" /> Back to the campus
      </Link>
    </main>
  );
}

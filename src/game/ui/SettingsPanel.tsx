import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { GameEngine } from "../core/GameEngine";
import { QUALITY_PROFILES } from "../core/graphics";
import type {
  EffectsQuality,
  GameUIState,
  Quality,
  QualityPreference,
  ShadowQuality,
  TextureQuality,
} from "../core/types";
import { SKIN_TONES } from "../core/types";
import { getHouse } from "../data/houses";

const QUALITY_NOTES: Record<Quality, string> = {
  low: "Fastest — minimal shadows and render resolution. Best for older phones.",
  medium: "Balanced — clear shadows, reduced pixel ratio and point lights.",
  high: "Crisp — full campus detail, soft shadows and full pixel ratio.",
  ultra: "Maximum — 4096px soft shadows and the longest view distance.",
};

const QUALITY_OPTIONS: QualityPreference[] = ["low", "medium", "high", "ultra", "auto"];

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <span className="font-ui text-xs text-foreground/80">{label}</span>
      <div className="flex overflow-hidden rounded-sm border border-foreground/12 bg-foreground/10">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={`px-2.5 py-1.5 font-ui text-[10px] capitalize transition-colors ${
              value === option
                ? "bg-primary/18 text-primary"
                : "bg-[#14110d] text-foreground/60 hover:text-foreground"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="font-ui text-sm text-foreground/90">{label}</p>
        <p className="mt-0.5 font-ui text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-300 ${
          checked
            ? "border-primary/70 bg-primary/25"
            : "border-foreground/15 bg-foreground/5"
        }`}
      >
        <span
          className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-all duration-300 ${
            checked ? "left-6 bg-primary" : "left-1 bg-foreground/40"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({
  state,
  engine,
  onClose,
}: {
  state: GameUIState;
  engine: GameEngine | null;
  onClose: () => void;
}) {
  const settings = state.settings;
  const house = state.profile ? getHouse(state.profile.houseId) : null;

  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-[3px]">
      <motion.aside
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="film-grain relative flex h-full w-full max-w-xl flex-col border-l border-primary/20 bg-[#100e0b]/95 shadow-[-40px_0_80px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-7 py-6 sm:px-9">
          <div>
            <p className="label-cinema text-primary/80">System</p>
            <h2 className="mt-2 font-display text-3xl tracking-wide text-foreground">Settings</h2>
            <p className="mt-1 font-ui text-xs text-muted-foreground">
              Changes apply immediately and are stored with your local save.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="mt-1 rounded-full border border-foreground/15 p-2 text-foreground/70 transition hover:border-primary/60 hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-7 pb-8 sm:px-9">
          <section className="border-b border-foreground/10 py-6">
            <div className="flex items-baseline justify-between">
              <p className="label-cinema text-primary/80">Graphics</p>
              <span className="font-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {state.fps} fps
              </span>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-px overflow-hidden rounded-sm border border-foreground/12 bg-foreground/10">
              {QUALITY_OPTIONS.map((quality) => (
                <button
                  key={quality}
                  type="button"
                  onClick={() => engine?.setGraphicsPreset(quality)}
                  aria-pressed={settings.quality === quality}
                  className={`px-1.5 py-3 font-ui text-[11px] capitalize transition-colors ${
                    settings.quality === quality
                      ? "bg-primary/15 text-primary"
                      : "bg-[#14110d] text-foreground/65 hover:bg-[#1a1712] hover:text-foreground"
                  }`}
                >
                  {quality === "auto" ? "Auto" : quality}
                </button>
              ))}
            </div>
            <p className="mt-3 font-ui text-[11px] leading-relaxed text-muted-foreground">
              {settings.quality === "auto"
                ? `Auto chose ${QUALITY_PROFILES[state.quality].label} for this device and adjusts down if the frame rate drops. ${QUALITY_NOTES[state.quality]}`
                : QUALITY_NOTES[settings.quality]}
            </p>
            {state.autoAdjusted && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-sm border border-primary/25 bg-primary/10 px-2.5 py-1.5 font-ui text-[10px] text-primary/90">
                <Check className="size-3" />
                Auto-adjusted to {QUALITY_PROFILES[state.quality].label} for a smoother frame rate.
              </p>
            )}

            <div className="mt-5 border-t border-foreground/10 pt-2">
              <p className="py-2 font-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Fine tuning
              </p>
              <ChoiceRow<ShadowQuality>
                label="Shadow quality"
                value={settings.shadowQuality}
                options={["off", "low", "medium", "high"]}
                onChange={(shadowQuality) => engine?.setSettings({ ...settings, shadowQuality })}
              />
              <label className="block py-2.5">
                <span className="flex items-center justify-between font-ui text-xs text-foreground/80">
                  <span>Render resolution</span>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(settings.renderScale * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0.6}
                  max={1}
                  step={0.05}
                  value={settings.renderScale}
                  onChange={(event) =>
                    engine?.setSettings({ ...settings, renderScale: Number(event.target.value) })
                  }
                  className="cinema-range mt-3"
                  aria-label="Render resolution"
                />
              </label>
              <label className="block py-2.5">
                <span className="flex items-center justify-between font-ui text-xs text-foreground/80">
                  <span>View distance</span>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round(settings.viewDistance * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0.6}
                  max={1.4}
                  step={0.05}
                  value={settings.viewDistance}
                  onChange={(event) =>
                    engine?.setSettings({ ...settings, viewDistance: Number(event.target.value) })
                  }
                  className="cinema-range mt-3"
                  aria-label="View distance"
                />
              </label>
              <ChoiceRow<TextureQuality>
                label="Texture quality"
                value={settings.textureQuality}
                options={["low", "medium", "high"]}
                onChange={(textureQuality) => engine?.setSettings({ ...settings, textureQuality })}
              />
              <p className="pb-2 font-ui text-[10px] leading-relaxed text-muted-foreground">
                Filtering updates now; the uploaded texture resolution is chosen when the campus loads.
              </p>
              <ChoiceRow<EffectsQuality>
                label="Effects"
                value={settings.effectsQuality}
                options={["low", "medium", "high"]}
                onChange={(effectsQuality) => engine?.setSettings({ ...settings, effectsQuality })}
              />
              <Toggle
                checked={settings.antialias}
                onChange={(antialias) => engine?.setSettings({ ...settings, antialias })}
                label="Anti-aliasing"
                description="Smooths jagged edges with post-process FXAA and supersampling."
              />
            </div>
          </section>

          <section className="border-b border-foreground/10 py-6">
            <div className="flex items-baseline justify-between">
              <p className="label-cinema text-primary/80">Camera</p>
              <span className="font-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {settings.sensitivity.toFixed(2)}×
              </span>
            </div>
            <label className="mt-4 block">
              <span className="font-ui text-sm text-foreground/90">Look sensitivity</span>
              <input
                type="range"
                min={0.2}
                max={2.4}
                step={0.05}
                value={settings.sensitivity}
                onChange={(event) =>
                  engine?.setSettings({ ...settings, sensitivity: Number(event.target.value) })
                }
                className="cinema-range mt-4"
                aria-label="Look sensitivity"
              />
            </label>
            <Toggle
              checked={settings.invertY}
              onChange={(invertY) => engine?.setSettings({ ...settings, invertY })}
              label="Invert vertical look"
              description="Drag up to look down instead."
            />
          </section>

          <section className="border-b border-foreground/10 py-6">
            <div className="flex items-baseline justify-between">
              <p className="label-cinema text-primary/80">Audio</p>
              <span className="font-ui text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <label className="mt-4 block">
              <span className="font-ui text-sm text-foreground/90">Master volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                onChange={(event) =>
                  engine?.setSettings({ ...settings, volume: Number(event.target.value) })
                }
                className="cinema-range mt-4"
                aria-label="Master volume"
              />
            </label>
            <Toggle
              checked={settings.music}
              onChange={(music) => engine?.setSettings({ ...settings, music })}
              label="Ambience and night sounds"
              description="Procedural wind, birdsong by day and crickets after lights-out."
            />
            <Toggle
              checked={settings.sfx}
              onChange={(sfx) => engine?.setSettings({ ...settings, sfx })}
              label="Effects"
              description="Footsteps, doors and interface tones."
            />
          </section>

          <section className="py-6">
            <p className="label-cinema text-primary/80">Your character</p>
            <p className="mt-2 font-ui text-xs leading-relaxed text-muted-foreground">
              Your uniform takes its colour from your house assignment. Skin tone remains yours.
            </p>
            <div className="mt-5 rounded-sm border border-foreground/12 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-ui text-xs text-foreground/80">House uniform</p>
                  <p className="mt-1 font-ui text-[10px] leading-relaxed text-muted-foreground">
                    {house
                      ? `${house.name} · colour set by your confirmed house`
                      : "Choose a house in New Game to set your uniform."}
                  </p>
                </div>
                <span
                  className="size-6 shrink-0 rounded-full border border-white/25"
                  style={{ backgroundColor: house?.color ?? "#44523c" }}
                  aria-label={house ? `${house.name} uniform colour` : "No house colour"}
                />
              </div>
            </div>
            <div className="mt-5">
              <p className="font-ui text-xs text-foreground/80">Skin tone</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {SKIN_TONES.map((tone, index) => {
                  const active = state.character.skin === index;
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() =>
                        engine?.setCharacter({
                          ...state.character,
                          skin: index as 0 | 1 | 2 | 3,
                        })
                      }
                      aria-label={`Skin tone ${index + 1}`}
                      aria-pressed={active}
                      className={`size-9 rounded-full border-2 transition ${
                        active
                          ? "border-primary ring-2 ring-primary/25"
                          : "border-white/15 hover:border-white/40"
                      }`}
                      style={{ backgroundColor: tone }}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-foreground/10 px-7 py-5 sm:px-9">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-sm border border-primary/60 bg-primary/12 px-5 py-3 font-ui text-xs uppercase tracking-[0.28em] text-primary transition hover:bg-primary/20"
          >
            Done
          </button>
        </div>
      </motion.aside>
    </div>
  );
}

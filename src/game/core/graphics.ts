import type { EffectsQuality, Quality, TextureQuality } from "./types";

export interface QualityProfile {
  label: string;
  detail: string;
  shadowMapSize: number;
  shadowDistance: number;
  dprCap: number;
  fogDensity: number;
  backgroundDetail: boolean;
  pointLights: boolean;
  antialias: boolean;
  effects: EffectsQuality;
  texture: TextureQuality;
}

/**
 * Rendering budgets used by the engine and world. These are deliberately
 * conservative on phones: the campus geometry is merged, but shadows and
 * fill-rate are still the two most expensive things on mobile GPUs.
 */
export const QUALITY_PROFILES: Record<Quality, QualityProfile> = {
  low: {
    label: "Low",
    detail: "Fastest. Small shadows, no extra lights.",
    shadowMapSize: 512,
    shadowDistance: 26,
    dprCap: 1,
    fogDensity: 0.0095,
    backgroundDetail: false,
    pointLights: false,
    antialias: false,
    effects: "low",
    texture: "low",
  },
  medium: {
    label: "Medium",
    detail: "Balanced for most phones.",
    shadowMapSize: 1024,
    shadowDistance: 34,
    dprCap: 1.35,
    fogDensity: 0.0074,
    backgroundDetail: true,
    pointLights: false,
    antialias: true,
    effects: "medium",
    texture: "medium",
  },
  high: {
    label: "High",
    detail: "Crisp shadows and full campus detail.",
    shadowMapSize: 2048,
    shadowDistance: 42,
    dprCap: 1.75,
    fogDensity: 0.0058,
    backgroundDetail: true,
    pointLights: true,
    antialias: true,
    effects: "high",
    texture: "high",
  },
  ultra: {
    label: "Ultra",
    detail: "Maximum detail for capable desktops and flagships.",
    shadowMapSize: 4096,
    shadowDistance: 52,
    dprCap: 2,
    fogDensity: 0.0045,
    backgroundDetail: true,
    pointLights: true,
    antialias: true,
    effects: "high",
    texture: "high",
  },
};

export const QUALITY_ORDER: Quality[] = ["low", "medium", "high", "ultra"];

export interface DeviceCapability {
  cores: number;
  memory: number;
  mobile: boolean;
  dpr: number;
}

export function readDeviceCapability(): DeviceCapability {
  if (typeof navigator === "undefined") {
    return { cores: 4, memory: 4, mobile: false, dpr: 1 };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const mobile = coarse || (navigator.maxTouchPoints ?? 0) > 1;
  return {
    cores: Math.max(1, nav.hardwareConcurrency ?? 4),
    memory: Math.max(1, nav.deviceMemory ?? 4),
    mobile,
    dpr: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
  };
}

/**
 * Auto is intentionally conservative. A device has to look genuinely strong
 * before it starts at High, and only desktop-class hardware gets Ultra.
 */
export function resolveAutoQuality(capability = readDeviceCapability()): Quality {
  const { cores, memory, mobile } = capability;
  if (mobile) {
    if (cores >= 8 && memory >= 8) return "high";
    if (cores >= 6 && memory >= 6) return "medium";
    if (cores >= 4 && memory >= 3) return "medium";
    return "low";
  }
  if (cores >= 10 && memory >= 8) return "ultra";
  if (cores >= 8 && memory >= 8) return "high";
  if (cores >= 6 && memory >= 4) return "high";
  if (cores >= 4) return "medium";
  return "low";
}

export function nextLowerQuality(quality: Quality): Quality | null {
  const index = QUALITY_ORDER.indexOf(quality);
  return index > 0 ? QUALITY_ORDER[index - 1] : null;
}

export function nextHigherQuality(quality: Quality): Quality | null {
  const index = QUALITY_ORDER.indexOf(quality);
  return index >= 0 && index < QUALITY_ORDER.length - 1 ? QUALITY_ORDER[index + 1] : null;
}

export function qualityProfile(quality: Quality): QualityProfile {
  return QUALITY_PROFILES[quality];
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

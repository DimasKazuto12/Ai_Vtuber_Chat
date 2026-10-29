import {
  Angry, Cat, Cloud, Droplet, Flame, Flower2, Frown, Heart, Laugh, Mic, Music,
  PawPrint, Send, Smile, Snowflake, Sparkles, Volume2, Zap,
  createElement, createIcons,
} from "lucide";

type Icon = typeof Heart;

/** Mengganti <i data-lucide="..."> di HTML menjadi SVG. */
export function initIcons() {
  createIcons({ icons: { Snowflake, Sparkles, PawPrint, Send, Mic, Volume2 } });
}

export function icon(node: Icon, size = 16): SVGElement {
  return createElement(node, { width: size, height: size });
}

export const paw = (size = 16) => icon(PawPrint, size);

export const MOOD_ICON: Record<string, Icon> = {
  neutral: Cat, happy: Smile, laughing: Laugh, sad: Frown,
  angry: Angry, surprised: Zap, relaxed: Flower2, shy: Heart,
};

export const EMOTE_SET: Record<string, { icon: Icon; color: string }[]> = {
  happy: [{ icon: Heart, color: "#ff7aa8" }, { icon: Sparkles, color: "#ffc94d" }, { icon: Music, color: "#6f9bff" }],
  laughing: [{ icon: Sparkles, color: "#ffc94d" }, { icon: Heart, color: "#ff7aa8" }, { icon: Music, color: "#6f9bff" }, { icon: Laugh, color: "#ff9a5c" }],
  sad: [{ icon: Droplet, color: "#6fa8ff" }],
  angry: [{ icon: Flame, color: "#ff6b4a" }, { icon: Zap, color: "#ffb703" }],
  surprised: [{ icon: Zap, color: "#ffc94d" }, { icon: Sparkles, color: "#ffffff" }],
  relaxed: [{ icon: Flower2, color: "#ff9fc0" }, { icon: Cloud, color: "#ffffff" }],
  shy: [{ icon: Heart, color: "#ff8fb3" }, { icon: Flower2, color: "#ffb3c8" }],
};
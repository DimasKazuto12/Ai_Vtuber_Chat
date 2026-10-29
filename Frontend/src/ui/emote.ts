import { EMOTE_SET, icon } from "./icons";

/** Memunculkan ikon yang melayang naik di sekitar kepala avatar. */
export function spawnEmotes(container: HTMLElement, emotion: string) {
  const set = EMOTE_SET[emotion];
  if (!set) return;

  const count = emotion === "laughing" ? 7 : 4;
  for (let i = 0; i < count; i++) {
    const pick = set[Math.floor(Math.random() * set.length)];
    const el = document.createElement("span");
    el.className = "emote";
    el.style.color = pick.color;
    el.style.left = `${30 + Math.random() * 40}%`;
    el.style.top = `${22 + Math.random() * 20}%`;
    el.style.animationDelay = `${i * 120}ms`;
    el.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
    el.style.setProperty("--rot", `${(Math.random() - 0.5) * 50}deg`);
    el.appendChild(icon(pick.icon, 28));
    el.addEventListener("animationend", () => el.remove());
    container.appendChild(el);
  }
}
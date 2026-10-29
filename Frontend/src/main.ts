import "./styles/base.css";
import "./styles/stage.css";
import "./styles/chat.css";

import { Avatar } from "./avatar";
import { chat, getVoices, type Turn } from "./api";
import { ChatUI, typewriter } from "./ui/chat";
import { startSparkles } from "./ui/particles";
import { spawnEmotes } from "./ui/emote";
import { icon, initIcons, MOOD_ICON } from "./ui/icons";

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const stage = $("#stage");
const canvas = $<HTMLCanvasElement>("#avatar");
const input = $<HTMLInputElement>("#input");
const sendBtn = $<HTMLButtonElement>("#send");
const micBtn = $<HTMLButtonElement>("#mic");
const voiceSel = $<HTMLSelectElement>("#voice");
const subtitle = $("#subtitle");
const mood = $("#mood");
const messages = $("#messages");
const emotesEl = $("#emotes");

const GREETING = "Halo! Aku Mira. Ayo ngobrol, aku siap mendengarkan kamu!";
const VOICE_KEY = "mira.voice";

const LABEL: Record<string, string> = {
  neutral: "Tenang", happy: "Senang", laughing: "Tertawa", sad: "Sedih",
  angry: "Kesal", surprised: "Kaget", relaxed: "Santai", shy: "Malu",
};

function setMood(emotion: string) {
  const key = emotion in LABEL ? emotion : "neutral";
  stage.dataset.emotion = key;
  mood.replaceChildren(icon(MOOD_ICON[key], 14), document.createTextNode(LABEL[key]));
}

// ---- Inisialisasi ----
initIcons();
setMood("neutral");
startSparkles($<HTMLCanvasElement>("#sparkles"));

const avatar = new Avatar(canvas);
avatar.onSpeakingChange = (speaking) => stage.classList.toggle("is-speaking", speaking);
avatar.onEmotionChange = (emotion) => {
  setMood(emotion);
  spawnEmotes(emotesEl, emotion);
};
avatar.load("/models/pachan/pachirisu.model3.json").catch((err) => {
  console.error(err);
  subtitle.textContent = "Model avatar gagal dimuat. Cek file di public/models/ dan konsol browser.";
});
if (import.meta.env.DEV) (window as any).avatar = avatar; // alat uji, hanya saat `npm run dev`
canvas.addEventListener("click", () => avatar.poke());

const chatUI = new ChatUI(messages);
const history: Turn[] = [];
let stopTyping: (() => void) | null = null;

chatUI.addBot(GREETING);
subtitle.textContent = GREETING;

// ---- Pilihan suara ----
getVoices().then(({ default: def, providers }) => {
  voiceSel.replaceChildren(...providers.map((p) => new Option(p.label, p.id)));
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(VOICE_KEY);
  } catch {}
  voiceSel.value = providers.some((p) => p.id === saved) ? (saved as string) : def;
});
voiceSel.addEventListener("change", () => {
  try {
    localStorage.setItem(VOICE_KEY, voiceSel.value);
  } catch {}
});

// ---- Kirim pesan ----
async function send(preset?: string) {
  const message = (preset ?? input.value).trim();
  if (!message || sendBtn.disabled) return;

  input.value = "";
  sendBtn.disabled = true;
  chatUI.addUser(message);

  stopTyping?.();
  subtitle.classList.add("is-thinking");
  subtitle.textContent = "Mira lagi mikir…";
  const removeTyping = chatUI.showTyping();

  try {
    const reply = await chat(message, history, voiceSel.value);
    if (reply.segments.length === 0) throw new Error("Jawaban kosong");

    const full = reply.segments.map((s) => s.text).join(" ");
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: full });
    if (reply.notice) chatUI.addNote(reply.notice);
    subtitle.classList.remove("is-thinking");

    await avatar.speak(reply.audio, reply.segments, (i, cue) => {
      if (i === 0) {
        removeTyping();
        chatUI.addBot(full);
      }
      // Teks muncul selaras dengan lama kalimat diucapkan
      const ms = ((cue.end - cue.start) * 1000 * 0.9) / Math.max(1, cue.text.length);
      stopTyping?.();
      stopTyping = typewriter(subtitle, cue.text, Math.min(90, Math.max(14, ms)));
    });
  } catch (err) {
    console.error(err);
    removeTyping();
    subtitle.classList.remove("is-thinking");
    subtitle.textContent = `Maaf, ada gangguan: ${(err as Error).message}`;
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn.addEventListener("click", () => send());
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});
document.querySelectorAll<HTMLButtonElement>("#chips button").forEach((btn) => {
  btn.addEventListener("click", () => send(btn.textContent ?? ""));
});

// ---- Input suara (Web Speech API, Chrome) ----
const SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
if (!SpeechRecognition) {
  micBtn.hidden = true;
} else {
  const rec = new SpeechRecognition();
  rec.lang = "id-ID";
  rec.interimResults = true;
  rec.continuous = false;
  let listening = false;

  rec.onresult = (e: any) => {
    let text = "";
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    input.value = text;
    if (e.results[e.results.length - 1].isFinal) send();
  };
  rec.onend = () => {
    listening = false;
    micBtn.classList.remove("is-listening");
  };
  micBtn.addEventListener("click", () => {
    if (listening) {
      rec.stop();
    } else {
      listening = true;
      micBtn.classList.add("is-listening");
      rec.start();
    }
  });
}
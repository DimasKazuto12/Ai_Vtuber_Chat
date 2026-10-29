import { paw } from "./icons";

export class ChatUI {
  private list: HTMLElement;

  constructor(list: HTMLElement) {
    this.list = list;
  }

  addUser(text: string) {
    this.add("user", text);
  }

  addBot(text: string) {
    this.add("bot", text);
  }

  /** Catatan kecil, misalnya "suara cadangan dipakai". */
  addNote(text: string) {
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = text;
    this.list.appendChild(note);
    this.scrollDown();
  }

  showTyping(): () => void {
    const row = document.createElement("div");
    row.className = "msg msg-bot";
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.appendChild(paw(16));
    const dots = document.createElement("div");
    dots.className = "msg-text typing";
    dots.innerHTML = "<span></span><span></span><span></span>";
    row.append(avatar, dots);
    this.list.appendChild(row);
    this.scrollDown();
    return () => row.remove();
  }

  private add(who: "user" | "bot", text: string) {
    const row = document.createElement("div");
    row.className = `msg msg-${who}`;
    if (who === "bot") {
      const avatar = document.createElement("div");
      avatar.className = "msg-avatar";
      avatar.appendChild(paw(16));
      row.appendChild(avatar);
    }
    const bubble = document.createElement("div");
    bubble.className = "msg-text";
    bubble.textContent = text; // textContent supaya aman dari XSS
    row.appendChild(bubble);
    this.list.appendChild(row);
    this.scrollDown();
  }

  private scrollDown() {
    this.list.scrollTop = this.list.scrollHeight;
  }
}

/** Teks muncul huruf demi huruf. Mengembalikan fungsi pembatal. */
export function typewriter(el: HTMLElement, text: string, speed = 28): () => void {
  el.textContent = "";
  el.classList.add("is-typing");
  let i = 0;

  const timer = window.setInterval(() => {
    i++;
    el.textContent = text.slice(0, i);
    el.scrollTop = el.scrollHeight;
    if (i >= text.length) stop();
  }, speed);

  function stop() {
    window.clearInterval(timer);
    el.classList.remove("is-typing");
  }
  return stop;
}
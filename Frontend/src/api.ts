import type { Cue } from "./avatar";

const API_URL = import.meta.env.VITE_API_URL;

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  audio: string; // base64, satu klip utuh untuk seluruh balasan
  segments: Cue[];
  provider: string;
  notice: string | null;
}

export interface VoiceOption {
  id: string;
  label: string;
}

export async function getVoices(): Promise<{ default: string; providers: VoiceOption[] }> {
  try {
    const res = await fetch(`${API_URL}/voices`);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { default: "edge", providers: [{ id: "edge", label: "Edge (cadangan)" }] };
  }
}

export async function chat(message: string, history: Turn[], voice: string): Promise<ChatReply> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, voice: voice || null }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Server error ${res.status}`);
  }
  return res.json();
}
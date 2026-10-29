import logging
import os

from dotenv import load_dotenv

load_dotenv()  # harus sebelum modul provider dibaca

from . import edge, elevenlabs
from .base import TTSResult

logger = logging.getLogger("vtuber")

MAX_CHARS = 400  # batas total per balasan (menjaga ukuran audio < 4,5 MB di Vercel)
PROVIDERS = {"elevenlabs": elevenlabs.synthesize, "edge": edge.synthesize}
LABELS = { "elevenlabs": "ElevenLabs", "edge": "Edge (cadangan)"}


def available() -> list[str]:
    ids = []
    if os.getenv("ELEVENLABS_API_KEY") and os.getenv("ELEVENLABS_VOICE_ID"):
        ids.append("elevenlabs")
    ids.append("edge")
    return ids


def default_provider() -> str:
    ids = available()
    wanted = os.getenv("TTS_PROVIDER")
    return wanted if wanted in ids else ids[0]


def trim_segments(segments: list[dict]) -> list[dict]:
    out, used = [], 0
    for s in segments:
        left = MAX_CHARS - used
        if left <= 0:
            break
        text = s["text"][:left]
        out.append({**s, "text": text})
        used += len(text)
    return out


async def synthesize(
    segments: list[dict], provider: str | None = None
) -> tuple[TTSResult, str, str | None]:
    chosen = provider if provider in available() else default_provider()
    try:
        return await PROVIDERS[chosen](segments), chosen, None
    except Exception as e:
        if chosen == "edge":
            raise
        logger.warning("TTS %s gagal, pindah ke edge-tts: %s", chosen, e)
        notice = f"{LABELS[chosen]} gagal, memakai suara cadangan (Edge)."
        return await PROVIDERS["edge"](segments), "edge", notice
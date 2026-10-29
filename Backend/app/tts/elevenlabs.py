import base64
import os

import httpx

from .base import TTSResult, dominant_emotion

API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

SETTINGS = {
    "neutral": {"stability": 0.45, "style": 0.25, "speed": 1.0},
    "happy": {"stability": 0.35, "style": 0.45, "speed": 1.05},
    "laughing": {"stability": 0.25, "style": 0.65, "speed": 1.1},
    "sad": {"stability": 0.55, "style": 0.35, "speed": 0.9},
    "angry": {"stability": 0.30, "style": 0.55, "speed": 1.08},
    "surprised": {"stability": 0.30, "style": 0.55, "speed": 1.08},
    "relaxed": {"stability": 0.60, "style": 0.20, "speed": 0.95},
    "shy": {"stability": 0.50, "style": 0.30, "speed": 0.95},
}


def _timings(alignment: dict | None, texts: list[str]):
    """Petakan waktu per karakter ke waktu per kalimat."""
    if not alignment:
        return None
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []
    result, pos = [], 0
    for t in texts:
        last = pos + len(t) - 1
        if last >= len(starts) or last >= len(ends):
            return None
        result.append((starts[pos], ends[last]))
        pos += len(t) + 1  # satu spasi pemisah
    return result


async def synthesize(segments: list[dict]) -> TTSResult:
    texts = [s["text"] for s in segments]
    cfg = SETTINGS.get(dominant_emotion(segments), SETTINGS["neutral"])
    body = {
        "text": " ".join(texts),
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": cfg["stability"],
            "similarity_boost": 0.75,
            "style": cfg["style"],
            "speed": cfg["speed"],
            "use_speaker_boost": True,
        },
    }
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/with-timestamps"
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            url,
            params={"output_format": "mp3_44100_128"},
            headers={"xi-api-key": API_KEY},
            json=body,
        )
    if res.status_code >= 400:
        raise RuntimeError(f"ElevenLabs {res.status_code}: {res.text[:300]}")
    data = res.json()
    return TTSResult(
        audio=base64.b64decode(data["audio_base64"]),
        timings=_timings(data.get("alignment"), texts),
    )
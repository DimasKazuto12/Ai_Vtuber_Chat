import os

import edge_tts

from .base import TTSResult, dominant_emotion

VOICE = os.getenv("EDGE_VOICE", "id-ID-GadisNeural")
RATE = {
    "neutral": "+0%", "happy": "+6%", "laughing": "+10%", "sad": "-12%",
    "angry": "+6%", "surprised": "+8%", "relaxed": "-4%", "shy": "-6%",
}

async def synthesize(segments: list[dict]) -> TTSResult:
    text = " ".join(s["text"] for s in segments)
    rate = RATE.get(dominant_emotion(segments), "+0%")
    audio = bytearray()
    async for chunk in edge_tts.Communicate(text, VOICE, rate=rate).stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return TTSResult(audio=bytes(audio))
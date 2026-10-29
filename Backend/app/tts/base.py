from dataclasses import dataclass


@dataclass
class TTSResult:
    audio: bytes
    # (mulai, selesai) dalam detik per segmen, jika provider menyediakannya
    timings: list[tuple[float, float]] | None = None


def dominant_emotion(segments: list[dict]) -> str:
    counts: dict[str, int] = {}
    for s in segments:
        if s["emotion"] != "neutral":
            counts[s["emotion"]] = counts.get(s["emotion"], 0) + len(s["text"])
    return max(counts, key=lambda k: counts[k]) if counts else "neutral"
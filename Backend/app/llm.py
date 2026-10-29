import json
import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    base_url=os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1"),
    api_key=os.getenv("LLM_API_KEY"),
)
MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")

EMOTIONS = ["neutral", "happy", "laughing", "sad", "angry", "surprised", "relaxed", "shy"]

SYSTEM_PROMPT = f"""Kamu adalah Mira, VTuber AI berupa gadis kucing berambut putih: ceria, hangat, sedikit pemalu, suka bercanda.
Bicaralah natural seperti orang ngobrol, dalam bahasa Indonesia santai.
Pecah jawabanmu menjadi 1 sampai 3 segmen pendek (satu kalimat per segmen, maksimal 20 kata).
Setiap segmen punya emosi sendiri yang sesuai isinya. Emosi yang boleh dipakai: {", ".join(EMOTIONS)}.
- "laughing" khusus untuk segmen tawa, contoh: "Hahaha, itu lucu banget!"
- "sad" untuk hal sedih atau simpati, "shy" saat dipuji atau malu, "surprised" saat kaget.
Jangan pakai emoji atau simbol. Tulis tawa sebagai "hahaha" atau "hehe".
Balas HANYA dalam format JSON: {{"segments": [{{"emotion": "<emosi>", "text": "<kalimat>"}}]}}"""

FALLBACK = [{"emotion": "neutral", "text": "Maaf, aku bingung mau jawab apa."}]


def _normalize(data) -> list[dict]:
    segs = data.get("segments") if isinstance(data, dict) else None
    if not segs and isinstance(data, dict) and data.get("text"):
        segs = [{"emotion": data.get("emotion", "neutral"), "text": data["text"]}]

    result = []
    for s in (segs or [])[:4]:
        text = str(s.get("text", "")).strip()
        if not text:
            continue
        emotion = s.get("emotion")
        result.append({"emotion": emotion if emotion in EMOTIONS else "neutral", "text": text})
    return result or FALLBACK


def ask_llm(user_text: str, history: list[dict]) -> list[dict]:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history[-10:],
        {"role": "user", "content": user_text},
    ]
    res = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        response_format={"type": "json_object"},
    )
    raw = res.choices[0].message.content or ""
    try:
        return _normalize(json.loads(raw))
    except json.JSONDecodeError:
        return [{"emotion": "neutral", "text": raw.strip()}] if raw.strip() else FALLBACK
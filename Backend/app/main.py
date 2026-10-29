import asyncio
import base64
import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .llm import ask_llm
from .tts import LABELS, available, default_provider, synthesize, trim_segments

logger = logging.getLogger("vtuber")
app = FastAPI()

origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"]
)


class Turn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[Turn] = []
    voice: str | None = None


@app.get("/api/voices")
async def voices():
    return {
        "default": default_provider(),
        "providers": [{"id": i, "label": LABELS[i]} for i in available()],
    }


@app.post("/api/chat")
async def chat(req: ChatRequest):
    history = [t.model_dump() for t in req.history]

    try:
        segments = trim_segments(await asyncio.to_thread(ask_llm, req.message, history))
    except Exception as e:
        logger.exception("LLM gagal")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    try:
        result, used, notice = await synthesize(segments, req.voice)
    except Exception as e:
        logger.exception("TTS gagal")
        raise HTTPException(status_code=502, detail=f"TTS error: {e}")

    timings = result.timings
    return {
        "provider": used,
        "notice": notice,
        "audio": base64.b64encode(result.audio).decode(),
        "segments": [
            {
                "text": s["text"],
                "emotion": s["emotion"],
                "start": timings[i][0] if timings else None,
                "end": timings[i][1] if timings else None,
            }
            for i, s in enumerate(segments)
        ],
    }
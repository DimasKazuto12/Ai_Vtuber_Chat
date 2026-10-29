import edge_tts

VOICE = "id-ID-GadisNeural"


async def synthesize(text: str) -> bytes:
    communicate = edge_tts.Communicate(text, VOICE)
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return bytes(audio)
import os
import asyncio
from faster_whisper import WhisperModel

# Load the model globally so it stays in memory.
# "base" is lightweight and runs decently fast even on CPU.
model_size = "base"
print(f"Loading Whisper model '{model_size}'...")
model = WhisperModel(model_size, device="cpu", compute_type="int8")

async def transcribe_audio(file_path: str) -> str:
    def _transcribe():
        segments, info = model.transcribe(file_path, beam_size=5)
        text = " ".join([segment.text for segment in segments])
        return text.strip()
    
    # Run CPU-bound task in a thread pool to avoid blocking the async event loop
    loop = asyncio.get_running_loop()
    transcription = await loop.run_in_executor(None, _transcribe)
    return transcription

import os
import asyncio
import threading
from faster_whisper import WhisperModel

model_size = "base"
_model = None
_model_lock = threading.Lock()

def get_model():
    """Load the Whisper model lazily so app startup is never blocked on the download."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                print(f"Loading Whisper model '{model_size}'...")
                _model = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _model

async def transcribe_audio(file_path: str) -> str:
    def _transcribe():
        model = get_model()
        # Auto-detect language but strongly hint Devanagari script for Hindi/Urdu
        segments, info = model.transcribe(file_path, beam_size=5, initial_prompt="Hello! नमस्ते, मेरा नाम। Please use Devanagari for Hindi. Use original script for other languages.")
        text = " ".join([segment.text for segment in segments])
        return text.strip()
    
    # Run CPU-bound task in a thread pool to avoid blocking the async event loop
    loop = asyncio.get_running_loop()
    transcription = await loop.run_in_executor(None, _transcribe)
    return transcription

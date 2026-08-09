import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter()

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

@router.post("")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        # Check if the uploaded file is an image
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Only images are allowed")
            
        result = cloudinary.uploader.upload(
            file.file,
            folder="grievances",
            resource_type="image"
        )
        return {"url": result.get("secure_url")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app.services.voice import transcribe_audio
import shutil
import tempfile
import os

@router.post("/audio")
async def upload_audio(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        # Save the uploaded audio chunk temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            shutil.copyfileobj(file.file, temp_audio)
            temp_path = temp_audio.name
            
        # Transcribe using local faster-whisper model
        text = await transcribe_audio(temp_path)
        
        # Clean up
        os.remove(temp_path)
        
        return {"transcript": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

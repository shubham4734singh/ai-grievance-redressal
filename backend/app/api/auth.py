from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    return TokenResponse(
        access_token="dummy_access_token",
        refresh_token="dummy_refresh_token"
    )

@router.post("/register")
async def register():
    return {"message": "Registration endpoint"}

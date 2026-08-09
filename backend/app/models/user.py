from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: str = "citizen"
    department: str = "All"
    jailbreak_attempts: int = 0

class UserCreate(UserBase):
    password: str

class AdminCreate(UserBase):
    password: str
    department: str

class UserInDB(UserBase):
    id: Optional[str] = Field(alias="_id", default=None)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserResponse(UserBase):
    id: str
    role: str
    department: str = "All"
    created_at: datetime

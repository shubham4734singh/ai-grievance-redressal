from typing import Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.models.notification import NotificationInDB


async def create_notification(
    db: AsyncIOMotorDatabase,
    user_id: Optional[str],
    tracking_id: str,
    title: str,
    message: str,
) -> None:
    if not user_id:
        return

    notification = NotificationInDB(
        user_id=user_id,
        tracking_id=tracking_id,
        title=title,
        message=message,
    )
    await db.notifications.insert_one(notification.model_dump(by_alias=True))


async def send_telegram_message(chat_id: Optional[str], message: str) -> None:
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or not chat_id:
        return

    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"})
    except Exception as exc:
        print(f"Failed to send telegram notification: {exc}")


async def notify_department_admins(
    db: AsyncIOMotorDatabase,
    department: str,
    tracking_id: str,
    title: str,
    message: str,
    send_telegram: bool = True,
) -> None:
    query = {"role": "admin"}
    if department != "All":
        query["department"] = {"$in": [department, "All"]}

    async for admin in db.users.find(query, {"_id": 1, "telegram_chat_id": 1}):
        await create_notification(db, str(admin["_id"]), tracking_id, title, message)
        if send_telegram:
            await send_telegram_message(admin.get("telegram_chat_id"), f"*{title}*\n\n{message}")

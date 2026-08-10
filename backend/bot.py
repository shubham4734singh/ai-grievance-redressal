import os
import logging
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler
from app.core.config import settings
from app.models.grievance import GrievanceInDB, StatusHistoryEntry
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import string
import secrets

def generate_tracking_id():
    chars = string.ascii_uppercase + string.digits
    return "GRV-" + "".join(secrets.choice(chars) for _ in range(8))

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logging.getLogger("httpx").setLevel(logging.WARNING)


CONTACT, GRIEVANCE_INPUT, LOCATION = range(3)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    chat_id = str(update.message.chat_id)
    admin = await db.users.find_one({"role": "admin", "telegram_chat_id": chat_id})
    if admin:
        await update.message.reply_text(
            f"Welcome *{admin['full_name']}*!\n\n"
            f"You are successfully connected as the Admin for *{admin['department']}*.\n"
            "You will now receive all new grievances for your department directly in this chat.",
            parse_mode="Markdown"
        )
        return ConversationHandler.END

    contact_button = KeyboardButton("Share Contact Number", request_contact=True)
    reply_markup = ReplyKeyboardMarkup([[contact_button]], one_time_keyboard=True, resize_keyboard=True)
    
    await update.message.reply_text(
        "Welcome to the JanSewa Portal AI Bot!\n\n"
        "To get started, please tap the button below to share your contact number so we can identify you securely.",
        reply_markup=reply_markup
    )
    return CONTACT

async def handle_contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    contact = update.message.contact
    if contact:
        phone_number = contact.phone_number
        first_name = contact.first_name
        
        # Check if an admin mistakenly put their phone number in the TG ID field
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.DATABASE_NAME]
        chat_id = str(update.message.chat_id)
        normalized_phone = phone_number.replace("+91", "").replace("+", "").replace(" ", "").strip()
        
        admin_fallback = await db.users.find_one({
            "role": "admin",
            "telegram_chat_id": {"$regex": f"{normalized_phone}$"}
        })
        
        if admin_fallback:
            # Auto-correct their TG ID in the database
            await db.users.update_one(
                {"_id": admin_fallback["_id"]},
                {"$set": {"telegram_chat_id": chat_id}}
            )
            await update.message.reply_text(
                f"Welcome *{admin_fallback['full_name']}*!\n\n"
                f"We noticed you entered your phone number in the Admin Dashboard instead of your Telegram Chat ID. We have automatically fixed it and linked your account!\n\n"
                f"You are successfully connected as the Admin for *{admin_fallback['department']}*.\n"
                "You will now receive all new grievances for your department directly in this chat.",
                parse_mode="Markdown",
                reply_markup=ReplyKeyboardRemove()
            )
            return ConversationHandler.END
        
        context.user_data['phone_number'] = phone_number
        context.user_data['first_name'] = first_name
        
        await update.message.reply_text(
            f"Thanks, {first_name}!\n\n"
            "Now, please describe your civic issue. *(Please also write the exact location/address in your description)*. You can:\n"
            "- *Type* a detailed description\n"
            "- *Send a photo* with a caption describing the issue.",
            parse_mode="Markdown",
            reply_markup=ReplyKeyboardRemove()
        )
        return GRIEVANCE_INPUT
    else:
        await update.message.reply_text("Please use the button to share your contact number.")
        return CONTACT

async def handle_grievance_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Check if they sent a photo
    if update.message.photo:
        # Telegram sends an array of sizes, [-1] is the largest
        photo_file_id = update.message.photo[-1].file_id
        description = update.message.caption
        if not description:
            await update.message.reply_text("Please send the photo again, but this time **add a text caption** explaining the issue (and location)!", parse_mode="Markdown")
            return GRIEVANCE_INPUT
        
        # Get the real file URL from Telegram
        file = await context.bot.get_file(photo_file_id)
        photo_url = file.file_path
        
        context.user_data['evidence_url'] = photo_url
        context.user_data['description'] = description
    else:
        # Just text
        description = update.message.text
        context.user_data['evidence_url'] = ""
        context.user_data['description'] = description

    # Request Location
    location_button = KeyboardButton("Share Live/Current Location", request_location=True)
    reply_markup = ReplyKeyboardMarkup([[location_button], ["Skip"]], one_time_keyboard=True, resize_keyboard=True)
    
    await update.message.reply_text(
        "Got it!\n\n"
        "To help our officers find the issue, please share your exact location using the button below, or manually type your address. (Or press 'Skip')",
        reply_markup=reply_markup
    )
    return LOCATION

async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.location:
        lat = update.message.location.latitude
        lon = update.message.location.longitude
        location_text = f"Lat: {lat}, Lon: {lon}"
    elif update.message.text and update.message.text.lower() != "skip":
        location_text = update.message.text
    else:
        location_text = "Not provided"
        
    context.user_data['location'] = location_text
    
    await update.message.reply_text("Analyzing your issue with AI... Please wait.", reply_markup=ReplyKeyboardRemove())
    
    description = context.user_data['description']
    evidence_url = context.user_data['evidence_url']
    phone_number = context.user_data['phone_number']
    first_name = context.user_data['first_name']
    
    # Request NLP analysis from the local FastAPI server instead of loading the model
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post("http://localhost:8000/api/internal/categorize", json={"text": description}, timeout=30.0)
            ai_analysis = res.json()
        except Exception as e:
            logging.error(f"Failed to reach internal NLP endpoint: {e}")
            ai_analysis = {"category": "General", "department": "Unassigned", "priority": "Medium", "sentiment": "Neutral"}

    tracking_id = generate_tracking_id()
    
    initial_history = StatusHistoryEntry(
        status="Submitted",
        note="Grievance has been successfully submitted via Telegram Bot."
    )
    
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    
    # Link the Telegram complaint to their Website Account if it exists
    user_id = None
    existing_user = await db.users.find_one({"phone": phone_number})
    if existing_user:
        user_id = str(existing_user["_id"])
        
    grievance_data = {
        "description": description,
        "location": location_text,
        "evidence_url": evidence_url,
        "category": ai_analysis.get("category", "General"),
        "contact_email": None,
        "contact_phone": phone_number,
        "contact_name": first_name,
        "telegram_chat_id": update.message.chat_id,
        "tracking_id": tracking_id,
        "history": [initial_history],
        "user_id": user_id, 
        "department": ai_analysis.get("department", "Unassigned"),
        "priority": ai_analysis.get("priority", "Medium"),
        "sentiment": ai_analysis.get("sentiment", "Neutral"),
        "duplicate_of": None
    }
    
    db_grievance = GrievanceInDB(**grievance_data)
    doc = db_grievance.model_dump(by_alias=True)
    
    await db.grievances.insert_one(doc)
    
    # --- SEND TO DEPARTMENT ON TELEGRAM ---
    dept_name = grievance_data['department']
    dept_admin = await db.users.find_one({"role": "admin", "department": dept_name, "telegram_chat_id": {"$exists": True, "$ne": ""}})
    
    if dept_admin and dept_admin.get("telegram_chat_id"):
        target_group_id = dept_admin["telegram_chat_id"]
        officer_msg = (
            f"*New Grievance Assigned to {dept_name}*\n\n"
            f"*Tracking ID:* `{tracking_id}`\n"
            f"*Category:* {grievance_data['category']}\n"
            f"*Priority:* {grievance_data['priority']}\n"
            f"*Location:* {location_text}\n\n"
            f"*Description:* {description}\n\n"
            f"*Reporter:* {first_name} ({phone_number})"
        )
        
        try:
            if evidence_url:
                await context.bot.send_photo(chat_id=target_group_id, photo=evidence_url, caption=officer_msg, parse_mode="Markdown")
            else:
                await context.bot.send_message(chat_id=target_group_id, text=officer_msg, parse_mode="Markdown")
        except Exception as e:
            logging.error(f"Could not send to department group {target_group_id}: {e}")
    # --------------------------------------
    
    await update.message.reply_text(
        f"*Grievance Submitted Successfully!*\n\n"
        f"AI has processed your issue and routed it to the correct department.\n\n"
        f"*Category:* {grievance_data['category']}\n"
        f"*Department:* {grievance_data['department']}\n"
        f"*Priority:* {grievance_data['priority']}\n\n"
        f"*Tracking ID:* `{tracking_id}`\n\n"
        f"You can use this Tracking ID on the JanSewa website to track its status anytime.",
        parse_mode="Markdown"
    )
    
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Action cancelled. You can type /start to begin again.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END

async def track_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Please provide a Tracking ID. Example: `/track GRV-12345678`", parse_mode="Markdown")
        return
        
    tracking_id = context.args[0].upper()
    
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    
    grievance = await db.grievances.find_one({"tracking_id": tracking_id})
    if not grievance:
        await update.message.reply_text(f"Could not find any grievance with Tracking ID: `{tracking_id}`", parse_mode="Markdown")
        return
        
    status = grievance.get("status", "Unknown")
    dept = grievance.get("department", "Unassigned")
    desc = grievance.get("description", "")
    
    history = grievance.get("history", [])
    latest_note = history[-1]["note"] if history else "No updates yet."
    
    msg = (
        f"*Status for {tracking_id}*\n\n"
        f"*Current Status:* {status}\n"
        f"*Department:* {dept}\n\n"
        f"*Latest Update:* {latest_note}\n\n"
        f"*Your Description:* {desc[:100]}{'...' if len(desc) > 100 else ''}"
    )
    
    await update.message.reply_text(msg, parse_mode="Markdown")

async def history_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.message.chat_id
    
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    
    cursor = db.grievances.find({"telegram_chat_id": chat_id}).sort("created_at", -1)
    grievances = await cursor.to_list(length=10)
    
    if not grievances:
        await update.message.reply_text("You haven't submitted any complaints via this Telegram bot yet.", parse_mode="Markdown")
        return
        
    msg = "*Your Recent Complaints:*\n\n"
    for g in grievances:
        msg += f"🔹 *ID:* `{g['tracking_id']}`\n"
        msg += f"   *Status:* {g.get('status', 'Unknown')}\n"
        msg += f"   *Category:* {g.get('category', 'General')}\n\n"
        
    msg += "Type `/track <ID>` to see more details."
    
    await update.message.reply_text(msg, parse_mode="Markdown")

def main():
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        logging.error("TELEGRAM_BOT_TOKEN is not set in .env")
        return

    application = ApplicationBuilder().token(token).build()

    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            CONTACT: [MessageHandler(filters.CONTACT, handle_contact)],
            GRIEVANCE_INPUT: [MessageHandler(filters.TEXT | filters.PHOTO, handle_grievance_input)],
            LOCATION: [MessageHandler(filters.LOCATION | filters.TEXT, handle_location)]
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )

    application.add_handler(conv_handler)
    application.add_handler(CommandHandler('track', track_command))
    application.add_handler(CommandHandler('history', history_command))
    
    logging.info("Starting JanSewa Telegram Bot...")
    application.run_polling()

if __name__ == '__main__':
    main()

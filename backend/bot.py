import os
import logging
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler
from app.core.config import settings
from app.services.nlp import categorize_grievance
from app.api.grievances import generate_tracking_id
from app.models.grievance import GrievanceInDB, StatusHistoryEntry
from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

CONTACT, GRIEVANCE_INPUT, LOCATION = range(3)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
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
    
    # Run AI Categorization
    ai_analysis = await categorize_grievance(description)
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
    
    logging.info("Starting JanSewa Telegram Bot...")
    application.run_polling()

if __name__ == '__main__':
    main()

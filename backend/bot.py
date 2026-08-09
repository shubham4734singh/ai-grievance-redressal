import os
import logging
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler
from app.core.config import settings
from app.services.nlp import categorize_grievance
from app.api.grievances import generate_tracking_id
from app.models.grievance import GrievanceInDB, StatusHistoryEntry
from app.core.database import get_database

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

CONTACT, DESCRIPTION = range(2)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Create a button that requests the user's phone number natively
    contact_button = KeyboardButton("📱 Share Contact Number", request_contact=True)
    reply_markup = ReplyKeyboardMarkup([[contact_button]], one_time_keyboard=True, resize_keyboard=True)
    
    await update.message.reply_text(
        "Welcome to the AI Grievance Redressal Bot! 🤖\n\n"
        "To get started, please tap the button below to share your contact number so we can identify you.",
        reply_markup=reply_markup
    )
    return CONTACT

async def handle_contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    contact = update.message.contact
    if contact:
        phone_number = contact.phone_number
        first_name = contact.first_name
        
        # Store phone number in context for the next step
        context.user_data['phone_number'] = phone_number
        context.user_data['first_name'] = first_name
        
        await update.message.reply_text(
            f"Thanks, {first_name}! ✅\n\n"
            "Now, please describe your grievance or complaint in detail.",
            reply_markup=ReplyKeyboardRemove()
        )
        return DESCRIPTION
    else:
        await update.message.reply_text("Please use the button to share your contact number.")
        return CONTACT

async def handle_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    description = update.message.text
    phone_number = context.user_data.get('phone_number')
    
    await update.message.reply_text("Analyzing your grievance and categorizing it... Please wait. ⏳")
    
    # Run AI Categorization
    ai_analysis = await categorize_grievance(description)
    tracking_id = generate_tracking_id()
    
    initial_history = StatusHistoryEntry(
        status="Submitted",
        note="Grievance has been successfully submitted via Telegram."
    )
    
    db = get_database()
    
    # -------------------------------------------------------------
    # 🔍 MAGIC HAPPENS HERE: Identify User
    # -------------------------------------------------------------
    # Try to find if this user already exists in your main system by phone number
    user_id = None
    existing_user = await db.users.find_one({"phone": phone_number})
    if existing_user:
        user_id = str(existing_user["_id"])  # Link the Telegram complaint to their Website Account!
        
    grievance_data = {
        "description": description,
        "location": "Telegram (Not provided)",
        "evidence_url": "",
        "category": ai_analysis.get("category", "General"),
        "contact_email": None,
        "contact_phone": phone_number, # Saved here so admins know who to call
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
        f"✅ Your grievance has been submitted successfully!\n\n"
        f"*Tracking ID:* `{tracking_id}`\n"
        f"*Category:* {grievance_data['category']}\n"
        f"*Department:* {grievance_data['department']}\n"
        f"*Priority:* {grievance_data['priority']}\n\n"
        f"You can use this Tracking ID on our website to track its status.",
        parse_mode="Markdown"
    )
    
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Complaint submission cancelled.", reply_markup=ReplyKeyboardRemove())
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
            DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_description)]
        },
        fallbacks=[CommandHandler('cancel', cancel)]
    )

    application.add_handler(conv_handler)
    
    logging.info("Starting Telegram Bot with User Identification...")
    application.run_polling()

if __name__ == '__main__':
    main()

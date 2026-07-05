# api/tasks.py - FIXED VERSION
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.db import models
from datetime import datetime, timedelta
from .models import MedicationReminder, CustomUser, OTPVerification
import random
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# OTP TASKS (Keep existing - these work fine)
# ============================================================================

def generate_otp():
    """Generate a 6-digit OTP"""
    return str(random.randint(100000, 999999))


@shared_task(bind=True, max_retries=3)
def send_otp_email(self, phone_number, email, otp, purpose='login'):
    """Send OTP via email"""
    try:
        if not email:
            logger.warning(f"No email provided for {phone_number}")
            return f"No email for {phone_number}"
        
        subject = f"🌿 Your OTP for {purpose.title()} - Rural HealthCare"
        purpose_text = "login request" if purpose == 'login' else "registration account sign-up"
        
        if purpose == 'registration':
            plain_message = f"Hello,\n\nWelcome to Rural HealthCare!\n\nYour OTP for registration is: {otp}\n\nThis OTP is valid for 10 minutes only.\n\nBest regards,\nRural HealthCare Team"
        else:  # login
            plain_message = f"Hello,\n\nYour OTP for login is: {otp}\n\nThis OTP is valid for 10 minutes only.\n\nBest regards,\nRural HealthCare Team"
        
        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; padding: 40px 0; margin: 0; width: 100%;">
          <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
            <div style="background: linear-gradient(135deg, #0d9488, #0f766e); padding: 32px; text-align: center;">
              <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin: 0;">🌿 Rural<span style="color: #2dd4bf;">HealthCare</span></h1>
            </div>
            <div style="padding: 40px 32px; text-align: center;">
              <h2 style="font-size: 20px; font-weight: 700; color: #1f2937; margin: 0 0 16px 0;">Verify Your Authentication</h2>
              <p style="font-size: 15px; color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">
                Hello,<br>
                Please use the following secure OTP code to complete your <strong>{purpose_text}</strong>.
              </p>
              <div style="background-color: #f0fdfa; border: 1.5px dashed #2dd4bf; border-radius: 12px; padding: 20px; margin: 16px 0; display: inline-block;">
                <h3 style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #0f766e; margin: 0; padding-left: 6px;">{otp}</h3>
              </div>
              <div style="margin: 24px 0 16px 0;">
                <span style="font-size: 13px; color: #b91c1c; background-color: #fef2f2; border-radius: 8px; padding: 10px 16px; font-weight: 600; display: inline-block;">
                  ⚠️ This OTP is valid for 10 minutes only.
                </span>
              </div>
              <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 24px 0 0 0;">
                If you did not request this code, you can safely ignore this email. Another person may have entered their phone number by mistake.
              </p>
            </div>
            <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #f3f4f6;">
              <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin: 0;">
                &copy; 2026 Rural HealthCare Team. All rights reserved.<br>
                Empowering rural wellness through AI-powered medicine.
              </p>
            </div>
          </div>
        </div>
        """

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
            html_message=html_content,
        )
        
        logger.info(f"✅ OTP email sent to {email} for {phone_number}")
        return f"OTP sent to {email}"
        
    except Exception as exc:
        logger.error(f"❌ Error sending OTP email: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task
def cleanup_expired_otps():
    """Periodic task to clean up expired OTP records - runs every hour"""
    try:
        now = timezone.now()
        deleted_count = OTPVerification.objects.filter(
            expires_at__lt=now
        ).delete()[0]
        
        logger.info(f"🗑️ Cleaned up {deleted_count} expired OTP records")
        return f"Deleted {deleted_count} expired OTPs"
        
    except Exception as e:
        logger.error(f"❌ Error cleaning up OTPs: {str(e)}")
        return f"Error: {str(e)}"


# ============================================================================
# MEDICATION REMINDER TASKS - FIXED VERSION
# ============================================================================

def get_time_label(time_slot):
    """Convert 24-hour time to readable label"""
    try:
        hour = int(time_slot.split(':')[0])
        if 5 <= hour < 12:
            return "Morning"
        elif 12 <= hour < 17:
            return "Afternoon"
        elif 17 <= hour < 21:
            return "Evening"
        else:
            return "Night"
    except:
        return "Scheduled Time"


def send_medicine_reminder_email_impl(reminder_id, time_slot):
    """
    Core implementation to send reminder email. Used by both Celery and local thread scheduler.
    """
    logger.info(f"📧 Starting send_medicine_reminder_email_impl for reminder {reminder_id} at {time_slot}")
    
    # Get the reminder
    try:
        reminder = MedicationReminder.objects.select_related('patient').get(id=reminder_id)
        logger.info(f"✅ Found reminder: {reminder.medication_name} for patient {reminder.patient.username}")
    except MedicationReminder.DoesNotExist:
        logger.error(f"❌ Reminder {reminder_id} not found")
        return f"Reminder {reminder_id} not found"
    
    # Check if reminder is active
    if not reminder.is_active or not reminder.reminder_enabled:
        logger.info(f"⚠️ Reminder {reminder_id} is not active/enabled")
        return f"Reminder {reminder_id} is not active"
    
    # Get patient email
    patient_email = reminder.patient.email
    if not patient_email:
        logger.error(f"❌ Patient {reminder.patient.username} has no email address")
        return f"Patient {reminder.patient.username} has no email"
    
    # Get time label
    time_label = get_time_label(time_slot)
    
    # Get meal timing label
    meal_map = {
        'before': 'Before Meals 🍽',
        'after': 'After Meals 🍽',
        'with': 'With Meals 🍽',
        'anytime': 'Anytime ⏱',
    }
    meal_info = meal_map.get(getattr(reminder, 'meal_timing', ''), '')

    # Prepare email
    subject = f"💊 Medicine Reminder: {reminder.medication_name}"
    
    message = f"""
Hello {reminder.patient.get_full_name() or reminder.patient.username},

⏰ It's time to take your medication!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊 Medicine   : {reminder.medication_name}
📏 Dosage     : {reminder.dosage}
⏰ Time       : {time_slot} ({time_label})
📅 Frequency  : {reminder.get_frequency_display()}
{f'🍽 Meal Timing: {meal_info}' if meal_info else ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{f'📝 Special Instructions: {reminder.notes}' if reminder.notes else ''}

Please take your medication as prescribed by your doctor.

💡 Tips:
• Take with water unless directed otherwise
• Don't skip doses
• Complete the full course even if you feel better

---
This is an automated reminder from Rural HealthCare.
If you have any questions, please contact your healthcare provider.

Stay healthy! 🌟

To manage your reminders, visit: http://localhost:3000/medicines
    """
    
    # Send email
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[patient_email],
        fail_silently=False,
    )
    
    logger.info(f"✅ Email sent successfully to {patient_email} for {reminder.medication_name} at {time_slot}")
    return f"✅ Email sent to {patient_email} for {reminder.medication_name}"


@shared_task(bind=True, max_retries=3)
def send_medicine_reminder_email(self, reminder_id, time_slot):
    """
    Celery wrapper task for sending medicine reminder emails.
    """
    try:
        return send_medicine_reminder_email_impl(reminder_id, time_slot)
    except Exception as exc:
        logger.error(f"❌ Error in send_medicine_reminder_email: {str(exc)}")
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


def schedule_medicine_reminders_local():
    """
    Local (non-Celery) version of the periodic task that runs every minute.
    Sends emails directly in the background thread.
    """
    from zoneinfo import ZoneInfo
    tz = ZoneInfo('Asia/Kolkata')
    now = timezone.now().astimezone(tz)
    current_time_str = now.strftime('%H:%M')
    current_date = now.date()
    
    try:
        # Find all active reminders where email is explicitly enabled
        active_reminders = MedicationReminder.objects.filter(
            is_active=True,
            reminder_enabled=True,
            email_reminders_enabled=True,
            start_date__lte=current_date
        ).select_related('patient')
        
        # Filter by end_date
        active_reminders = active_reminders.filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=current_date)
        )
        
        scheduled_count = 0
        
        for reminder in active_reminders:
            if not reminder.time_slots or not isinstance(reminder.time_slots, list):
                continue
            if not reminder.patient.email:
                continue
                
            for time_slot in reminder.time_slots:
                try:
                    if ':' not in str(time_slot):
                        continue
                    slot_hour, slot_minute = map(int, str(time_slot).split(':'))
                    
                    if now.hour == slot_hour and now.minute == slot_minute:
                        # Send email directly/synchronously in background thread
                        send_medicine_reminder_email_impl(str(reminder.id), time_slot)
                        scheduled_count += 1
                except Exception as e:
                    logger.error(f"Error checking slot {time_slot}: {e}")
                    
        if scheduled_count > 0:
            logger.info(f"📢 [Local Scheduler] Sent {scheduled_count} reminder emails at {current_time_str}")
    except Exception as e:
        logger.error(f"Error in local scheduler: {e}")


@shared_task
def schedule_medicine_reminders():
    """
    FIXED: Periodic task that runs EVERY MINUTE to check for medication reminders
    This is called by Celery Beat every 60 seconds
    """
    from zoneinfo import ZoneInfo
    tz = ZoneInfo('Asia/Kolkata')
    now = timezone.now().astimezone(tz)
    current_time_str = now.strftime('%H:%M')
    current_date = now.date()
    
    logger.info(f"\n{'='*60}")
    logger.info(f"⏰ CHECKING MEDICINE REMINDERS AT {current_time_str}")
    logger.info(f"{'='*60}")
    
    try:
        # Find all active reminders where email is explicitly enabled
        active_reminders = MedicationReminder.objects.filter(
            is_active=True,
            reminder_enabled=True,
            email_reminders_enabled=True,
            start_date__lte=current_date
        ).select_related('patient')
        
        # Filter by end_date
        active_reminders = active_reminders.filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=current_date)
        )
        
        logger.info(f"📋 Found {active_reminders.count()} active reminders")
        
        scheduled_count = 0
        
        # Check each reminder
        for reminder in active_reminders:
            logger.info(f"\n📝 Checking reminder: {reminder.medication_name}")
            logger.info(f"   Patient: {reminder.patient.username}")
            logger.info(f"   Email: {reminder.patient.email or 'NO EMAIL'}")
            logger.info(f"   Time slots: {reminder.time_slots}")
            
            # Validate time_slots
            if not reminder.time_slots or not isinstance(reminder.time_slots, list):
                logger.warning(f"   ⚠️ Invalid time_slots for {reminder.medication_name}")
                continue
            
            # Check if patient has email
            if not reminder.patient.email:
                logger.warning(f"   ⚠️ No email for patient {reminder.patient.username}")
                continue
            
            # Check each time slot
            for time_slot in reminder.time_slots:
                try:
                    # Parse time slot
                    if ':' not in str(time_slot):
                        logger.warning(f"   ⚠️ Invalid time format: {time_slot}")
                        continue
                    
                    slot_hour, slot_minute = map(int, str(time_slot).split(':'))
                    
                    # CRITICAL: Match current hour AND minute
                    if now.hour == slot_hour and now.minute == slot_minute:
                        logger.info(f"   ✅ MATCH! Scheduling email for {time_slot}")
                        
                        # Queue the email task
                        send_medicine_reminder_email.delay(
                            str(reminder.id),
                            time_slot
                        )
                        
                        scheduled_count += 1
                        logger.info(f"   📧 Email task queued for {reminder.medication_name} at {time_slot}")
                    else:
                        logger.debug(f"   ⏭️ No match: {time_slot} (current: {current_time_str})")
                        
                except (ValueError, AttributeError) as e:
                    logger.error(f"   ❌ Error parsing time slot {time_slot}: {str(e)}")
                    continue
        
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ SCHEDULED {scheduled_count} REMINDER EMAILS AT {current_time_str}")
        logger.info(f"{'='*60}\n")
        
        return f"Scheduled {scheduled_count} emails at {current_time_str}"
        
    except Exception as e:
        logger.error(f"❌ Error in schedule_medicine_reminders: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return f"Error: {str(e)}"


@shared_task
def test_send_reminder_email():
    """
    Test task to verify email sending works
    Can be called manually from Django shell
    """
    try:
        logger.info("🧪 Testing reminder email sending...")
        
        # Find first active reminder with email
        reminder = MedicationReminder.objects.filter(
            is_active=True,
            patient__email__isnull=False
        ).exclude(
            patient__email=''
        ).select_related('patient').first()
        
        if not reminder:
            logger.error("❌ No active reminders with email found")
            return "No active reminders found"
        
        logger.info(f"✅ Found test reminder: {reminder.medication_name}")
        logger.info(f"   Patient: {reminder.patient.username}")
        logger.info(f"   Email: {reminder.patient.email}")
        
        # Get first time slot
        time_slot = reminder.time_slots[0] if reminder.time_slots else "08:00"
        
        # Send test email
        result = send_medicine_reminder_email(str(reminder.id), time_slot)
        
        logger.info(f"✅ Test complete: {result}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Test failed: {str(e)}")
        return f"Test failed: {str(e)}"

schedule_daily_reminders = schedule_medicine_reminders


@shared_task
def delete_otp_record(otp_record_id):
    """Auto-delete a specific OTP record after expiry"""
    try:
        deleted, _ = OTPVerification.objects.filter(id=otp_record_id).delete()
        if deleted:
            logger.info(f"🗑️ Auto-deleted OTP record {otp_record_id} successfully.")
        return f"Deleted {otp_record_id}: {deleted}"
    except Exception as e:
        logger.error(f"❌ Error auto-deleting OTP record {otp_record_id}: {e}")
        return f"Error: {e}"
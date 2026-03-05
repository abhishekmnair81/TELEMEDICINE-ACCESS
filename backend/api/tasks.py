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
        
        if purpose == 'registration':
            subject = "🔐 Your Registration OTP - Rural HealthCare"
            message = f"""
Welcome to Rural HealthCare!

Your registration OTP is: {otp}

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email.

Stay healthy! 🌟
            """
        else:  # login
            subject = "🔐 Your Login OTP - Rural HealthCare"
            message = f"""
Hello!

Your login OTP is: {otp}

This code will expire in 10 minutes.

If you didn't request this code, please secure your account immediately.

Stay healthy! 🌟
            """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
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


@shared_task(bind=True, max_retries=3)
def send_medicine_reminder_email(self, reminder_id, time_slot):
    """
    Send email reminder for a specific medication at a specific time
    
    Args:
        reminder_id: UUID of the MedicationReminder
        time_slot: Time slot string (e.g., "08:00")
    """
    try:
        logger.info(f"📧 Starting send_medicine_reminder_email for reminder {reminder_id} at {time_slot}")
        
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
        
        # Prepare email
        subject = f"💊 Medicine Reminder: {reminder.medication_name}"
        
        message = f"""
Hello {reminder.patient.get_full_name() or reminder.patient.username},

⏰ It's time to take your medication!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💊 Medicine: {reminder.medication_name}
📏 Dosage: {reminder.dosage}
⏰ Time: {time_slot} ({time_label})
📅 Frequency: {reminder.get_frequency_display()}
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
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[patient_email],
                fail_silently=False,
            )
            
            logger.info(f"✅ Email sent successfully to {patient_email} for {reminder.medication_name} at {time_slot}")
            return f"✅ Email sent to {patient_email} for {reminder.medication_name}"
            
        except Exception as email_error:
            logger.error(f"❌ Failed to send email: {str(email_error)}")
            raise email_error
        
    except Exception as exc:
        logger.error(f"❌ Error in send_medicine_reminder_email: {str(exc)}")
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task
def schedule_medicine_reminders():
    """
    FIXED: Periodic task that runs EVERY MINUTE to check for medication reminders
    This is called by Celery Beat every 60 seconds
    """
    now = timezone.now()
    current_time_str = now.strftime('%H:%M')
    current_date = now.date()
    
    logger.info(f"\n{'='*60}")
    logger.info(f"⏰ CHECKING MEDICINE REMINDERS AT {current_time_str}")
    logger.info(f"{'='*60}")
    
    try:
        # Find all active reminders
        active_reminders = MedicationReminder.objects.filter(
            is_active=True,
            reminder_enabled=True,
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
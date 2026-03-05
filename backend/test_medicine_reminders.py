# test_medicine_reminders.py
"""
Test script for medicine reminder emails

Run this from Django shell:
python manage.py shell < test_medicine_reminders.py
"""

from api.tasks import send_test_reminder_email, send_medicine_reminder_email
from api.models import MedicationReminder, CustomUser
from django.utils import timezone

print("\n" + "="*60)
print("TESTING MEDICINE REMINDER EMAIL SYSTEM")
print("="*60 + "\n")

# Test 1: Send test email
print("TEST 1: Sending test email...")
try:
    result = send_test_reminder_email.delay(
        'teamtelemedicineruralindia@gmail.com',
        'Test Medicine'
    )
    print(f"✅ Test task queued: {result.id}")
    print(f"   Check email: teamtelemedicineruralindia@gmail.com\n")
except Exception as e:
    print(f"❌ Test failed: {e}\n")

# Test 2: Check active reminders
print("TEST 2: Checking active reminders...")
try:
    active_reminders = MedicationReminder.objects.filter(
        is_active=True,
        reminder_enabled=True
    )
    print(f"✅ Found {active_reminders.count()} active reminders:")
    
    for reminder in active_reminders:
        print(f"\n   📋 {reminder.medication_name}")
        print(f"      Patient: {reminder.patient.username}")
        print(f"      Email: {reminder.patient.email}")
        print(f"      Time slots: {reminder.time_slots}")
        print(f"      Active: {reminder.is_active}")
        print(f"      Enabled: {reminder.reminder_enabled}")
        
except Exception as e:
    print(f"❌ Error: {e}\n")

# Test 3: Send real reminder email (if reminders exist)
print("\nTEST 3: Sending real reminder email...")
try:
    reminder = MedicationReminder.objects.filter(
        is_active=True,
        reminder_enabled=True
    ).first()
    
    if reminder:
        print(f"   Using reminder: {reminder.medication_name}")
        time_slot = reminder.time_slots[0] if reminder.time_slots else "08:00"
        
        result = send_medicine_reminder_email.delay(
            str(reminder.id),
            time_slot
        )
        
        print(f"✅ Reminder email task queued: {result.id}")
        print(f"   Medicine: {reminder.medication_name}")
        print(f"   Time slot: {time_slot}")
        print(f"   Recipient: {reminder.patient.email}")
    else:
        print("⚠️ No active reminders found")
        
except Exception as e:
    print(f"❌ Error: {e}\n")

print("\n" + "="*60)
print("TESTS COMPLETED")
print("="*60 + "\n")
print("📧 Check your email inbox:")
print("   teamtelemedicineruralindia@gmail.com")
print("\n💡 TIP: If emails don't arrive:")
print("   1. Check spam/junk folder")
print("   2. Verify Celery worker is running")
print("   3. Check Django logs for errors")
print("="*60 + "\n")
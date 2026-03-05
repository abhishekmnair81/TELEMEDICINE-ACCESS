# medical_backend/celery.py - FIXED VERSION
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medical_backend.settings')

app = Celery('medical_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# CRITICAL: Configure beat schedule for medicine reminders
app.conf.beat_schedule = {
    # Check for medicine reminders every minute
    'check-medicine-reminders-every-minute': {
        'task': 'api.tasks.schedule_medicine_reminders',
        'schedule': 60.0,  # Every 60 seconds
    },
    
    # Clean up expired OTPs every hour
    'cleanup-expired-otps': {
        'task': 'api.tasks.cleanup_expired_otps',
        'schedule': crontab(minute=0),  # Every hour at minute 0
    },
}

# Set timezone
app.conf.timezone = 'Asia/Kolkata' 

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
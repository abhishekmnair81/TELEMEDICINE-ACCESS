import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medical_backend.settings')

app = Celery('medical_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'check-medicine-reminders-every-minute': {
        'task': 'api.tasks.schedule_medicine_reminders',
        'schedule': 60.0,  
    },
    
    'cleanup-expired-otps': {
        'task': 'api.tasks.cleanup_expired_otps',
        'schedule': crontab(minute=0), 
    },
}

app.conf.timezone = 'Asia/Kolkata' 

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

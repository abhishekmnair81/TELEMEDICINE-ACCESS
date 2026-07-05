from django.apps import AppConfig
import threading
import time
import os
import sys

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        # Prevent starting thread during makemigrations, migrate, test, etc.
        # Only start if we are running the actual web server.
        is_server = any(x in sys.argv for x in ['runserver', 'gunicorn', 'uwsgi', 'runserver_plus'])
        if not is_server:
            return

        # Django dev server reloader runs the ready() method twice.
        # Ensure we only start the thread in the main worker process.
        if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('RUN_MAIN'):
            def run_scheduler():
                time.sleep(5)  # Let Django complete its initialization
                print("🤖 Background Medication Reminder Scheduler Thread Started!")
                
                # Align to start of the minute to keep time checking precise
                # e.g., if it is currently 14:05:42, sleep 18 seconds to start at 14:06:00
                now = time.time()
                seconds_to_wait = 60 - (now % 60)
                time.sleep(seconds_to_wait)
                
                while True:
                    try:
                        from .tasks import schedule_medicine_reminders_local
                        schedule_medicine_reminders_local()
                    except Exception as e:
                        print(f"❌ Error in local medicine reminder scheduler: {e}")
                    
                    # Sleep exactly 60 seconds
                    time.sleep(60)

            t = threading.Thread(target=run_scheduler, name="MedicationReminderScheduler", daemon=True)
            t.start()


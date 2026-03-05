from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import (
    ChatHistoryViewSet, AppointmentViewSet, DoctorsViewSet, scan_prescription,
    PrescriptionViewSet, HealthRecordViewSet,
    EnhancedPrescriptionViewSet, PharmacyMedicineViewSet, MedicineOrderViewSet,
    reminder_stats,
    VideoConsultationRoomViewSet, VideoCallMessageViewSet,
    HealthMetricViewSet, HealthGoalViewSet, HealthActivityViewSet,
    HealthReportViewSet, MedicationReminderViewSet,
    PatientsViewSet, DoctorRatingViewSet,
    PharmacistsViewSet,
    chat_stream, chat_with_image, chat_view, request_detailed_analysis,
    text_to_speech, test_voice, api_test, health_check,
    create_prescription_from_consultation, get_patient_health_summary,
    upload_health_document, get_health_vault,
    send_webrtc_offer, send_webrtc_answer, send_ice_candidate,
    get_pending_signals, update_connection_quality,
    start_screen_share, stop_screen_share,
    get_active_consultations, get_consultation_history, get_room_details,
    register_user, get_user_profile, logout_user, unified_login,
    health_dashboard, health_summary,
    get_patient_doctors, get_doctor_rating_summary,
    send_otp_for_login, verify_otp_and_login,
    send_otp_for_registration, verify_otp_and_register, ConversationViewSet,
    get_or_create_conversation, generate_health_report, download_health_report_pdf,
    pharmacy_dashboard, pharmacy_analytics,
    pharmacist_prescriptions, fulfill_prescription, analyze_medicine_image,
    sync_medication_logs, sync_missed_reminders, adherence_prediction, PatientPrescriptionViewSet,
    patient_my_prescriptions,
    patient_prescription_detail,
)

router = DefaultRouter()
router.register(r'medication-reminders', MedicationReminderViewSet, basename='medication-reminder')
router.register(r'conversations', ConversationViewSet, basename='conversations')
router.register(r'chat-history', ChatHistoryViewSet, basename='chat-history')
router.register(r'appointments', AppointmentViewSet, basename='appointments')
router.register(r'doctors', DoctorsViewSet, basename='doctors')
router.register(r'prescriptions-old', PrescriptionViewSet, basename='prescriptions-old')
router.register(r'health-records', HealthRecordViewSet, basename='health-records')
router.register(r'prescriptions', EnhancedPrescriptionViewSet, basename='prescriptions')
router.register(r'medicines', PharmacyMedicineViewSet, basename='medicines')
router.register(r'medicine-orders', MedicineOrderViewSet, basename='medicine-orders')
router.register(r'video-consultations/rooms', VideoConsultationRoomViewSet, basename='video-room')
router.register(r'video-consultations/messages', VideoCallMessageViewSet, basename='video-message')
router.register(r'health-metrics', HealthMetricViewSet, basename='health-metrics')
router.register(r'health-goals', HealthGoalViewSet, basename='health-goals')
router.register(r'health-activities', HealthActivityViewSet, basename='health-activities')
router.register(r'health-reports', HealthReportViewSet, basename='health-reports')
router.register(r'medication-reminders', MedicationReminderViewSet, basename='medication-reminders')
router.register(r'doctor-ratings', DoctorRatingViewSet, basename='doctor-ratings')
router.register(r'cart', views.CartViewSet, basename='cart')
router.register(r'patient/prescriptions', views.PatientPrescriptionViewSet, basename='patient-prescriptions')


urlpatterns = [
    path('medication-reminders/sync-logs/',            sync_medication_logs,     name='sync-logs'),
    path('medication-reminders/sync-missed/',           sync_missed_reminders,    name='sync-missed'),
    path('medication-reminders/adherence-prediction/',  adherence_prediction,     name='adherence-prediction'),
    path('medication-reminders/stats/',                 reminder_stats,           name='reminder-stats'),

    path('medication-reminders/sync-logs/', sync_medication_logs, name='sync-medication-logs'),
    path('medication-reminders/sync-missed/', sync_missed_reminders, name='sync-missed-reminders'),
    path('medication-reminders/adherence-prediction/', adherence_prediction, name='adherence-prediction'),
    path('medication-reminders/stats/', reminder_stats, name='reminder-stats'),

    path('patient/my-prescriptions/',
         patient_my_prescriptions,
         name='patient-my-prescriptions'),

    path('patient/my-prescriptions/<uuid:prescription_id>/',
         patient_prescription_detail,
         name='patient-prescription-detail'),

    path('conversations/generate-report/', generate_health_report, name='generate-health-report'),
    path('conversations/download-report-pdf/', download_health_report_pdf, name='download-health-report-pdf'),
    path('conversations/get-or-create/', get_or_create_conversation, name='get-or-create-conversation'),

    path('cart/count/', views.get_cart_count, name='cart-count'),
    path('saved-for-later/', views.saved_for_later, name='saved-for-later'),

    path('patients/my-doctors/', get_patient_doctors, name='patient-doctors'),
    path('patients/', PatientsViewSet.as_view({'get': 'list'}), name='patients-list'),
    path('patients/<uuid:pk>/', PatientsViewSet.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'put': 'update'
    }), name='patient-detail'),
    path('patients/<uuid:pk>/upload_profile_picture/', PatientsViewSet.as_view({
        'post': 'upload_profile_picture'
    }), name='patient-upload-picture'),
    path('patients/<uuid:patient_id>/health-summary/', get_patient_health_summary, name='patient-health-summary'),

    path('pharmacists/<uuid:pk>/', PharmacistsViewSet.as_view({'get': 'retrieve','patch': 'partial_update','put': 'update',}), name='pharmacist-detail'),
    path('pharmacists/<uuid:pk>/upload_profile_picture/', PharmacistsViewSet.as_view({'post': 'upload_profile_picture',}), name='pharmacist-upload-picture'),

    path('prescriptions/scan/', scan_prescription, name='prescription-scan'),
    path('prescriptions/create/', create_prescription_from_consultation, name='create-prescription'),

    path('medicines/analyze-image/', views.analyze_medicine_image, name='analyze_medicine_image'),

    path('', include(router.urls)),

    path('chat/stream/', chat_stream, name='chat-stream'),
    path('chat/image/', chat_with_image, name='chat-with-image'),
    path('chat/detailed-analysis/', request_detailed_analysis, name='detailed-analysis'),

    path('voice/text-to-speech/', text_to_speech, name='text-to-speech'),
    path('voice/test/', test_voice, name='test-voice'),

    path('test/', api_test, name='api-test'),
    path('health/', health_check, name='health-check'),

    path('auth/send-otp-login/', send_otp_for_login, name='send-otp-login'),
    path('auth/verify-otp-login/', verify_otp_and_login, name='verify-otp-login'),
    path('auth/send-otp-register/', send_otp_for_registration, name='send-otp-register'),
    path('auth/verify-otp-register/', verify_otp_and_register, name='verify-otp-register'),

    path('auth/register/', register_user, name='register-user'),
    path('auth/login/<str:user_type>/', unified_login, name='unified-login'),
    path('auth/profile/', get_user_profile, name='user-profile'),
    path('auth/logout/', logout_user, name='logout'),

    path('health-vault/', get_health_vault, name='health-vault'),

    path('video-consultations/create-room/', VideoConsultationRoomViewSet.as_view({'post': 'create_room'}), name='create-video-room'),
    path('video-consultations/join-room/', VideoConsultationRoomViewSet.as_view({'post': 'join_room'}), name='join-video-room'),
    path('video-consultations/leave-room/', VideoConsultationRoomViewSet.as_view({'post': 'leave_room'}), name='leave-video-room'),
    path('video-consultations/end-call/', VideoConsultationRoomViewSet.as_view({'post': 'end_call'}), name='end-video-call'),
    path('video-consultations/doctor/<uuid:doctor_id>/rooms/', VideoConsultationRoomViewSet.as_view({'get': 'get_doctor_rooms'}), name='doctor-rooms'),
    path('video-consultations/patient/<uuid:patient_id>/rooms/', VideoConsultationRoomViewSet.as_view({'get': 'get_patient_rooms'}), name='patient-rooms'),

    path('video-consultations/webrtc/offer/', send_webrtc_offer, name='send-webrtc-offer'),
    path('video-consultations/webrtc/answer/', send_webrtc_answer, name='send-webrtc-answer'),
    path('video-consultations/webrtc/ice-candidate/', send_ice_candidate, name='send-ice-candidate'),
    path('video-consultations/webrtc/pending-signals/', get_pending_signals, name='get-pending-signals'),

    path('video-consultations/send-message/', VideoCallMessageViewSet.as_view({'post': 'send_message'}), name='send-video-message'),

    path('video-consultations/connection-quality/', update_connection_quality, name='update-connection-quality'),
    path('video-consultations/screen-share/start/', start_screen_share, name='start-screen-share'),
    path('video-consultations/screen-share/stop/', stop_screen_share, name='stop-screen-share'),

    path('video-consultations/active-consultations/', get_active_consultations, name='active-consultations'),
    path('video-consultations/consultation-history/', get_consultation_history, name='consultation-history'),
    path('video-consultations/room-details/', get_room_details, name='room-details'),

    path('health/dashboard/', health_dashboard, name='health-dashboard'),
    path('health/summary/', health_summary, name='health-summary'),

    path('doctors/<int:doctor_id>/rating-summary/', get_doctor_rating_summary, name='doctor-rating-summary'),

    path('pharmacy/dashboard/', pharmacy_dashboard, name='pharmacy-dashboard'),
    path('pharmacy/analytics/', pharmacy_analytics, name='pharmacy-analytics'),
    path('pharmacy/prescriptions/', pharmacist_prescriptions, name='pharmacist-prescriptions'),
    path('pharmacy/fulfill-prescription/', fulfill_prescription, name='fulfill-prescription'),

    path('orders/create-from-cart/', views.create_order_from_cart, name='create-order-from-cart'),
    path('orders/my-orders/', views.get_my_orders, name='my-orders'),
    path('orders/<uuid:order_id>/', views.get_order_details, name='order-details'),

    path('autocorrect/', views.autocorrect_query, name='autocorrect'),
    path('test-language-detection/', views.test_language_detection, name='test-language-detection'),
    path('analytics/ocr-stats/', views.ocr_statistics, name='ocr-statistics'),
]

from rest_framework import serializers
from .models import (
    ChatHistory, 
    Appointment, 
    Prescription,
    HealthRecord, 
    CustomUser, 
    MedicineImage, Conversation, OCRProcessingLog, ExtractedMedicalData,CustomUser, PharmacistProfile,
    CartItem, SavedForLater, Coupon, CouponUsage,
    DoctorProfile, 
    PharmacistProfile,
    EnhancedPrescription, 
    Medicine, 
    MedicineOrder,
    MedicalProduct, 
    InventoryBatch, 
    Supplier,
    HealthVaultDocument, 
    DoctorConsultationNote,
    AIHealthInsight, 
    FamilyHealthNetwork, 
    EmergencyContact,
    VirtualWaitingRoom,
    VideoConsultationRoom,
    VideoCallMessage,
    WebRTCSignal,
    CallConnectionLog,
    VideoConsultationPrescription,
    ScreenShareSession,
    ConsultationFollowUp,
    HealthMetric,
    HealthGoal,
    HealthActivity,
    HealthReport,
    MedicationReminder,
    MedicationLog,
    DoctorRating,
    Conversation,
    HealthReportData,
)

MEDICINE_CATEGORIES = [
    ('antibiotic', 'Antibiotic'),
    ('painkiller', 'Painkiller'),
    ('vitamin', 'Vitamin'),
    ('supplement', 'Supplement'),
    ('cough_cold', 'Cough & Cold'),
    ('antacid', 'Antacid'),
    ('allergy', 'Allergy'),
    ('other', 'Other'),
]

MEDICINE_FORMS = [
    ('tablet', 'Tablet'),
    ('capsule', 'Capsule'),
    ('syrup', 'Syrup'),
    ('injection', 'Injection'),
    ('cream', 'Cream'),
    ('ointment', 'Ointment'),
    ('gel', 'Gel'),       
    ('lotion', 'Lotion'),  
    ('drops', 'Drops'),
    ('inhaler', 'Inhaler'),
    ('powder', 'Powder'),
    ('spray', 'Spray'),    
    ('patch', 'Patch'),    
    ('suspension', 'Suspension'),  
    ('', 'Not Applicable'),
]

MEDICINE_STORAGE = [
    ('room_temp', 'Room Temperature'),
    ('refrigerated', 'Refrigerated (2-8°C)'),
    ('cool_dry', 'Cool & Dry Place'),
    ('away_from_heat', 'Away from Heat & Light'),
]



class ChatHistorySerializer(serializers.ModelSerializer):    
    class Meta:
        model = ChatHistory
        fields = [
            'id', 'conversation', 'user_id', 'role', 'message', 
            'language', 'created_at', 
            'has_image', 'image_description',
            'ocr_extracted_text', 'image_type', 'ocr_confidence',
            'has_voice_input', 'voice_language'
        ]
        read_only_fields = ['id', 'created_at']

class OCRProcessingLogSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = OCRProcessingLog
        fields = [
            'id', 'chat_message', 'image_type', 'ocr_method',
            'processing_time_ms', 'text_length', 'success',
            'error_message', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class ExtractedMedicalDataSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = ExtractedMedicalData
        fields = [
            'id', 'chat_message', 'medications', 'doctor_name',
            'clinic_name', 'prescription_date', 'test_results',
            'lab_name', 'test_date', 'raw_extracted_text',
            'confidence_score', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']



class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    profile_picture_url = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'phone_number', 'user_type',
            'first_name', 'last_name', 'full_name',
            'date_of_birth', 'gender', 'blood_group',
            'address', 'city', 'state', 'pincode',
            'emergency_contact_name', 'emergency_contact_number',
            'height', 'weight',
            'allergies', 'chronic_conditions', 
            'current_medications', 'medical_history',
            'profile_picture', 'profile_picture_url',
            'is_verified', 'created_at'
        ]
        read_only_fields = ['id', 'username', 'created_at', 'is_verified']
    
    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username
    
    def get_profile_picture_url(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

class DoctorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)  
    specialization_display = serializers.CharField(
        source='get_specialization_display', 
        read_only=True
    )
    
    class Meta:
        model = DoctorProfile
        fields = [
            'id', 
            'user', 
            'specialization', 'specialization_display',
            'license_number', 'experience_years', 'qualification',
            'consultation_fee', 'available_days', 'available_time_slots',
            'rating', 'total_consultations', 'is_available', 'bio',
        ]    

class DoctorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    specialization_display = serializers.CharField(source='get_specialization_display', read_only=True)
    rating_count = serializers.SerializerMethodField()
    rating_distribution = serializers.SerializerMethodField()
    recent_reviews = serializers.SerializerMethodField()
    
    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'user', 'specialization', 'specialization_display',
            'license_number', 'experience_years', 'qualification',
            'consultation_fee', 'available_days', 'available_time_slots',
            'rating', 'average_rating', 'total_consultations',
            'is_available', 'bio',
            'rating_count', 'rating_distribution', 'recent_reviews'
        ]
    
    def get_rating_count(self, obj):
        return obj.ratings.count()
    
    def get_rating_distribution(self, obj):
        return obj.get_rating_distribution()
    
    def get_recent_reviews(self, obj):
        recent = obj.get_recent_reviews(limit=3)
        return DoctorRatingSerializer(recent, many=True).data


class AppointmentSerializer(serializers.ModelSerializer):
    doctor_details = DoctorProfileSerializer(source='doctor', read_only=True) 

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class PrescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prescription
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class HealthRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class ChatMessageSerializer(serializers.Serializer):
    msg = serializers.CharField(required=True)
    user_id = serializers.CharField(required=False, default='anonymous')
    language = serializers.CharField(required=False, default='English')


class TextToSpeechSerializer(serializers.Serializer):
    text = serializers.CharField(required=True)
    language = serializers.CharField(required=False, default='English')


class PharmacistProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = PharmacistProfile
        fields = '__all__'


class EnhancedPrescriptionSerializer(serializers.ModelSerializer):
    patient_full_name = serializers.SerializerMethodField()
    doctor_full_name = serializers.SerializerMethodField()
    medication_count = serializers.SerializerMethodField()
    
    class Meta:
        model = EnhancedPrescription
        fields = [
            'id',
            'patient',
            'doctor', 
            'appointment',
            'patient_name',
            'patient_age',
            'patient_gender',
            'patient_phone',
            'doctor_name',
            'doctor_specialization',
            'doctor_registration',
            'hospital_name',
            'diagnosis',
            'medications',
            'vital_signs',
            'lab_tests',
            'notes',
            'follow_up_date',
            'date',
            'status',
            'created_at',
            'updated_at',
            'patient_full_name',
            'doctor_full_name',
            'medication_count',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_patient_full_name(self, obj):
        if obj.patient:
            return obj.patient.get_full_name()
        return obj.patient_name
    
    def get_doctor_full_name(self, obj):
        if obj.doctor:
            return obj.doctor.get_full_name()
        return obj.doctor_name
    
    def get_medication_count(self, obj):
        return len(obj.medications) if obj.medications else 0


class PrescriptionCreateSerializer(serializers.Serializer):
    patient_name = serializers.CharField(max_length=200)
    patient_age = serializers.CharField(max_length=10, required=False, allow_blank=True)
    patient_gender = serializers.CharField(max_length=20, required=False, allow_blank=True)
    patient_phone = serializers.CharField(max_length=20)
    doctor_name = serializers.CharField(max_length=200)
    doctor_specialization = serializers.CharField(max_length=100, required=False, allow_blank=True)
    doctor_registration = serializers.CharField(max_length=100, required=False, allow_blank=True)
    hospital_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    diagnosis = serializers.CharField()
    medications = serializers.JSONField()
    vital_signs = serializers.JSONField(required=False, default=dict)
    lab_tests = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    follow_up_date = serializers.DateField(required=False, allow_null=True)
    date = serializers.DateField()
    appointment_id = serializers.UUIDField(required=False, allow_null=True)
    
    def validate_medications(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Medications must be a list")
        
        if len(value) == 0:
            raise serializers.ValidationError("At least one medication is required")
        
        for med in value:
            if not isinstance(med, dict):
                raise serializers.ValidationError("Each medication must be an object")
            
            required_fields = ['name', 'dosage', 'frequency', 'duration']
            for field in required_fields:
                if field not in med or not med[field]:
                    raise serializers.ValidationError(f"Medication field '{field}' is required")
        
        return value
    
    def validate_patient_phone(self, value):
        if not value or len(value) < 10:
            raise serializers.ValidationError("Valid phone number is required")
        return value


class SimplePrescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EnhancedPrescription 
        fields = [
            'id',
            'patient_name',
            'patient_age',
            'patient_gender', 
            'patient_phone',
            'doctor_name',
            'doctor_specialization',
            'diagnosis',
            'medications',
            'notes',
            'follow_up_date',
            'date',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
    
    def create(self, validated_data):
        validated_data.setdefault('status', 'active')
        return super().create(validated_data)
    
class MedicineImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = MedicineImage
        fields = ['id', 'image', 'image_url', 'is_primary', 'display_order', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

class PharmacyMedicineSerializer(serializers.ModelSerializer):
    images = MedicineImageSerializer(many=True, read_only=True)
    primary_image = serializers.SerializerMethodField()
    
    class Meta:
        model = Medicine
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_primary_image(self, obj):
        if hasattr(obj, 'images'):
            primary = obj.images.filter(is_primary=True).first()
            if primary and primary.image:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(primary.image.url)
                return primary.image.url
        
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        
        return None



class MedicineOrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    pharmacist_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicineOrder
        fields = '__all__'
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""

    def get_pharmacist_name(self, obj):
        return obj.pharmacist.get_full_name() if obj.pharmacist else ""


class HealthVaultDocumentSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = HealthVaultDocument
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.get_full_name() if obj.uploaded_by else ""


class DoctorConsultationNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorConsultationNote
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class AIHealthInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIHealthInsight
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class FamilyHealthNetworkSerializer(serializers.ModelSerializer):
    primary_user_name = serializers.SerializerMethodField()
    family_member_name = serializers.SerializerMethodField()

    class Meta:
        model = FamilyHealthNetwork
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_primary_user_name(self, obj):
        return obj.primary_user.get_full_name() if obj.primary_user else ""

    def get_family_member_name(self, obj):
        return obj.family_member.get_full_name() if obj.family_member else ""


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class VirtualWaitingRoomSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = VirtualWaitingRoom
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""

    def get_doctor_name(self, obj):
        return obj.doctor.get_full_name() if obj.doctor else ""


from rest_framework import serializers

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


from rest_framework import serializers
from .models import (
    VideoConsultationRoom, VideoCallMessage, WebRTCSignal,
    CallConnectionLog, VideoConsultationPrescription,
    ScreenShareSession, ConsultationFollowUp, CustomUser
)


class VideoConsultationRoomSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    patient_details = serializers.SerializerMethodField()
    doctor_details = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    can_join = serializers.SerializerMethodField()
    
    class Meta:
        model = VideoConsultationRoom
        fields = [
            'id', 'room_id', 'patient', 'doctor', 'appointment',
            'status', 'scheduled_time', 'patient_joined_at', 'doctor_joined_at',
            'started_at', 'ended_at', 'duration',
            'patient_connection_quality', 'doctor_connection_quality',
            'chat_enabled', 'screen_share_enabled', 'recording_enabled',
            'recording_url', 'recording_consent',
            'doctor_notes', 'patient_feedback', 'rating',
            'created_at', 'updated_at',
            'patient_name', 'doctor_name', 'patient_details', 'doctor_details',
            'is_active', 'can_join'
        ]
        read_only_fields = ['id', 'room_id', 'created_at', 'updated_at']

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""

    def get_doctor_name(self, obj):
        return obj.doctor.get_full_name() if obj.doctor else ""

    def get_patient_details(self, obj):
        if obj.patient:
            return {
                'id': str(obj.patient.id),
                'name': obj.patient.get_full_name(),
                'phone': obj.patient.phone_number,
                'email': obj.patient.email,
            }
        return None

    def get_doctor_details(self, obj):
        if obj.doctor:
            doctor_profile = getattr(obj.doctor, 'doctor_profile', None)
            return {
                'id': str(obj.doctor.id),
                'name': obj.doctor.get_full_name(),
                'specialization': doctor_profile.specialization if doctor_profile else 'General',
                'qualification': doctor_profile.qualification if doctor_profile else '',
                'rating': float(doctor_profile.rating) if doctor_profile else 0.0,
            }
        return None

    def get_is_active(self, obj):
        return obj.is_active()

    def get_can_join(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.can_join(request.user)
        return False


class VideoCallMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_type = serializers.SerializerMethodField()
    
    class Meta:
        model = VideoCallMessage
        fields = [
            'id', 'room', 'sender', 'message_type', 'content',
            'file_url', 'file_name', 'file_size',
            'is_read', 'read_at', 'created_at',
            'sender_name', 'sender_type'
        ]
        read_only_fields = ['id', 'created_at']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() if obj.sender else ""

    def get_sender_type(self, obj):
        return obj.sender.user_type if obj.sender else ""


class WebRTCSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebRTCSignal
        fields = [
            'id', 'room', 'sender', 'receiver',
            'signal_type', 'signal_data',
            'is_processed', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CallConnectionLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CallConnectionLog
        fields = [
            'id', 'room', 'user', 'event_type', 'event_data',
            'bandwidth', 'latency', 'packet_loss',
            'created_at', 'user_name'
        ]
        read_only_fields = ['id', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() if obj.user else ""


class VideoConsultationPrescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoConsultationPrescription
        fields = [
            'id', 'consultation', 'prescription',
            'shared_during_call', 'shared_at',
            'patient_acknowledged', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ScreenShareSessionSerializer(serializers.ModelSerializer):
    shared_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ScreenShareSession
        fields = [
            'id', 'room', 'shared_by',
            'started_at', 'ended_at', 'duration',
            'shared_by_name'
        ]
        read_only_fields = ['id', 'started_at']

    def get_shared_by_name(self, obj):
        return obj.shared_by.get_full_name() if obj.shared_by else ""


class ConsultationFollowUpSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ConsultationFollowUp
        fields = [
            'id', 'consultation', 'patient',
            'follow_up_type', 'description', 'due_date',
            'is_completed', 'completed_at',
            'reminder_sent', 'created_at',
            'patient_name'
        ]
        read_only_fields = ['id', 'created_at']

    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""


class CreateVideoRoomSerializer(serializers.Serializer):
    patient_id = serializers.UUIDField()
    doctor_id = serializers.UUIDField()
    appointment_id = serializers.UUIDField(required=False, allow_null=True)
    scheduled_time = serializers.DateTimeField()
    chat_enabled = serializers.BooleanField(default=True)
    screen_share_enabled = serializers.BooleanField(default=True)
    recording_enabled = serializers.BooleanField(default=False)


class JoinRoomSerializer(serializers.Serializer):
    room_id = serializers.CharField()
    user_id = serializers.UUIDField()


class SendMessageSerializer(serializers.Serializer):
    room_id = serializers.CharField()
    sender_id = serializers.UUIDField()
    message_type = serializers.ChoiceField(choices=['text', 'file', 'prescription', 'system'], default='text')
    content = serializers.CharField()
    file_url = serializers.URLField(required=False, allow_blank=True)
    file_name = serializers.CharField(required=False, allow_blank=True)
    file_size = serializers.IntegerField(required=False, allow_null=True)


class WebRTCOfferSerializer(serializers.Serializer):
    room_id = serializers.CharField()
    sender_id = serializers.UUIDField()
    receiver_id = serializers.UUIDField()
    sdp = serializers.JSONField()


class WebRTCAnswerSerializer(serializers.Serializer):
    room_id = serializers.CharField()
    sender_id = serializers.UUIDField()
    receiver_id = serializers.UUIDField()
    sdp = serializers.JSONField()


class ICECandidateSerializer(serializers.Serializer):
    room_id = serializers.CharField()
    sender_id = serializers.UUIDField()
    receiver_id = serializers.UUIDField()
    candidate = serializers.JSONField()


class EndCallSerializer(serializers.Serializer):
    room_id = serializers.CharField()
    user_id = serializers.UUIDField()
    duration = serializers.IntegerField(required=False)
    doctor_notes = serializers.CharField(required=False, allow_blank=True)
    rating = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=5)


class ConnectionQualitySerializer(serializers.Serializer):
    room_id = serializers.CharField()
    user_id = serializers.UUIDField()
    quality = serializers.ChoiceField(choices=['good', 'fair', 'poor'])
    bandwidth = serializers.IntegerField(required=False, allow_null=True)
    latency = serializers.IntegerField(required=False, allow_null=True)
    packet_loss = serializers.FloatField(required=False, allow_null=True)


from rest_framework import serializers
from .models import (
    HealthMetric, HealthGoal, HealthActivity, 
    HealthReport, MedicationReminder, MedicationLog
)

from rest_framework import serializers
from .models import (
    HealthMetric, HealthGoal, HealthActivity, 
    HealthReport, MedicationReminder, MedicationLog
)
from datetime import datetime, date


class HealthMetricSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    metric_type_display = serializers.CharField(source='get_metric_type_display', read_only=True)
    alert_level_display = serializers.CharField(source='get_alert_level_display', read_only=True)
    
    class Meta:
        model = HealthMetric
        fields = [
            'id', 'patient', 'patient_name', 'metric_type', 'metric_type_display',
            'value', 'systolic', 'diastolic', 'numeric_value', 'unit',
            'notes', 'recorded_at', 'recorded_by',
            'is_abnormal', 'alert_level', 'alert_level_display',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'systolic', 'diastolic', 'numeric_value']
    
    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""


class HealthGoalSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    goal_type_display = serializers.CharField(source='get_goal_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    days_remaining = serializers.SerializerMethodField()
    
    start_date = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d', 'iso-8601'])
    target_date = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d', 'iso-8601'])
    
    class Meta:
        model = HealthGoal
        fields = [
            'id', 'patient', 'patient_name', 'goal_type', 'goal_type_display',
            'title', 'description', 'target_value', 'current_value', 'unit',
            'start_date', 'target_date', 'days_remaining',
            'status', 'status_display', 'progress_percentage',
            'reminder_enabled', 'reminder_frequency',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'progress_percentage']
    
    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""
    
    def get_days_remaining(self, obj):
        from django.utils import timezone
        if obj.target_date:
            delta = obj.target_date - timezone.now().date()
            return delta.days
        return None
    
    def validate_start_date(self, value):
        if isinstance(value, datetime):
            return value.date()
        return value
    
    def validate_target_date(self, value):
        if isinstance(value, datetime):
            return value.date()
        return value


class HealthActivitySerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    
    activity_date = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d', 'iso-8601'])
    activity_time = serializers.TimeField(
        format='%H:%M:%S', 
        input_formats=['%H:%M:%S', '%H:%M', 'iso-8601'],
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = HealthActivity
        fields = [
            'id', 'patient', 'patient_name', 'activity_type', 'activity_type_display',
            'title', 'description', 'duration_minutes', 'calories_burned', 'intensity',
            'activity_date', 'activity_time', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""
    
    def validate_activity_date(self, value):
        if isinstance(value, datetime):
            return value.date()
        return value


class MedicationReminderSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    adherence_rate = serializers.SerializerMethodField()
    
    start_date = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d', 'iso-8601'])
    end_date = serializers.DateField(
        format='%Y-%m-%d', 
        input_formats=['%Y-%m-%d', 'iso-8601'],
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = MedicationReminder
        fields = [
            'id', 'patient', 'patient_name', 'prescription',
            'medication_name', 'dosage', 'frequency', 'frequency_display',
            'time_slots', 'start_date', 'end_date',
            'is_active', 'reminder_enabled', 'notes',
            'adherence_rate', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""
    
    def get_adherence_rate(self, obj):
        total_logs = obj.logs.count()
        if total_logs == 0:
            return 100.0
        
        taken_logs = obj.logs.filter(status='taken').count()
        return round((taken_logs / total_logs) * 100, 1)
    
    def validate_start_date(self, value):
        if isinstance(value, datetime):
            return value.date()
        return value
    
    def validate_end_date(self, value):
        if value and isinstance(value, datetime):
            return value.date()
        return value
    
    def validate_time_slots(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("time_slots must be a list")
        return value


class HealthReportSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    generated_by_name = serializers.SerializerMethodField()
    
    start_date = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d', 'iso-8601'])
    end_date = serializers.DateField(format='%Y-%m-%d', input_formats=['%Y-%m-%d', 'iso-8601'])
    
    class Meta:
        model = HealthReport
        fields = [
            'id', 'patient', 'patient_name', 'report_type', 'report_type_display',
            'title', 'start_date', 'end_date',
            'summary_data', 'metrics_summary', 'trends', 'recommendations',
            'generated_by', 'generated_by_name', 'generated_at',
            'pdf_file', 'created_at'
        ]
        read_only_fields = ['id', 'generated_at', 'created_at']
    
    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""
    
    def get_generated_by_name(self, obj):
        return obj.generated_by.get_full_name() if obj.generated_by else "System"
    
    def validate_start_date(self, value):
        if isinstance(value, datetime):
            return value.date()
        return value
    
    def validate_end_date(self, value):
        if isinstance(value, datetime):
            return value.date()
        return value


class MedicationLogSerializer(serializers.ModelSerializer):
    reminder_name = serializers.CharField(source='reminder.medication_name', read_only=True)
    patient_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = MedicationLog
        fields = [
            'id', 'reminder', 'reminder_name', 'patient', 'patient_name',
            'scheduled_time', 'taken_at', 'status', 'status_display',
            'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else ""


class HealthDashboardSerializer(serializers.Serializer):
    latest_metrics = HealthMetricSerializer(many=True)
    active_goals = HealthGoalSerializer(many=True)
    recent_activities = HealthActivitySerializer(many=True)
    medication_reminders = MedicationReminderSerializer(many=True)
    alerts = serializers.ListField()

class DoctorRatingSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    
    class Meta:
        model = DoctorRating
        fields = [
            'id', 'doctor', 'patient', 'appointment',
            'rating', 'review', 'pros', 'cons', 'would_recommend',
            'patient_name', 'doctor_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_patient_name(self, obj):
        return obj.patient.get_full_name() if obj.patient else "Anonymous"
    
    def get_doctor_name(self, obj):
        return f"Dr. {obj.doctor.user.get_full_name()}" if obj.doctor else "Unknown"


class DoctorRatingCreateSerializer(serializers.Serializer):
    doctor_id = serializers.IntegerField()  
    appointment_id = serializers.UUIDField(required=False, allow_null=True)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    review = serializers.CharField(required=False, allow_blank=True)
    pros = serializers.CharField(required=False, allow_blank=True)
    cons = serializers.CharField(required=False, allow_blank=True)
    would_recommend = serializers.BooleanField(default=True)


class ChatHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatHistory
        fields = [
            'id', 'conversation', 'user_id', 'role', 'message',
            'language', 'has_image', 'image_description', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(read_only=True)
    preview = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'title', 'language', 'created_at', 'updated_at',
            'last_message_at', 'message_count', 'is_archived',
            'is_pinned', 'preview'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_message_at', 'message_count']
    
    def get_preview(self, obj):
        last_message = obj.messages.order_by('-created_at').first()
        if last_message:
            preview_text = last_message.message[:100]
            if len(last_message.message) > 100:
                preview_text += "..."
            return {
                'text': preview_text,
                'role': last_message.role,
                'created_at': last_message.created_at
            }
        return None


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = ChatHistorySerializer(many=True, read_only=True)
    message_count = serializers.IntegerField(read_only=True)
    images_with_ocr_count = serializers.SerializerMethodField()
    prescriptions_count = serializers.SerializerMethodField()
    lab_reports_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'user', 'user_id_anonymous', 'title', 'language',
            'created_at', 'last_message_at', 'is_archived', 'is_pinned',
            'message_count', 'messages',
            'images_with_ocr_count', 'prescriptions_count', 'lab_reports_count'
        ]
    
    def get_images_with_ocr_count(self, obj):
        return obj.messages.filter(
            ocr_extracted_text__isnull=False
        ).exclude(ocr_extracted_text='').count()
    
    def get_prescriptions_count(self, obj):
        return obj.messages.filter(image_type='prescription').count()
    
    def get_lab_reports_count(self, obj):
        return obj.messages.filter(image_type='lab_report').count()


class HealthReportDataSerializer(serializers.ModelSerializer):
    conversation_title = serializers.CharField(source='conversation.title', read_only=True)
    
    class Meta:
        model = HealthReportData
        fields = [
            'id', 'conversation', 'conversation_title',
            'symptoms', 'duration', 'severity',
            'additional_symptoms', 'medical_history_mentioned',
            'current_medications_mentioned', 'possible_conditions',
            'advice_given', 'emergency_warning',
            'report_generated', 'generated_at',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'generated_at']

class MedicineDetailedSerializer(serializers.ModelSerializer):
    
    is_low_stock = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    is_expiring_soon = serializers.SerializerMethodField()
    selling_price_with_gst = serializers.SerializerMethodField()
    
    class Meta:
        model = Medicine
        fields = [
            'id', 'name', 'generic_name', 'brand_name', 'manufacturer',
            'category', 'form', 'strength', 'composition', 'therapeutic_class',
            'indications', 'dosage_instructions', 'contraindications',
            'side_effects', 'precautions', 'drug_interactions',
            'requires_prescription', 'schedule_drug',
            'pack_size', 'packaging_type',
            'mrp', 'price', 'discount_percentage', 'gst_percentage',
            'stock_quantity', 'minimum_stock_level', 'reorder_quantity',
            'storage_instructions', 'shelf_life', 'batch_number',
            'manufacturing_date', 'expiry_date',
            'drug_license_number', 'hsn_code',
            'description', 'image', 'is_refrigerated', 'is_temperature_sensitive',
            'is_active', 'is_banned',
            'is_low_stock', 'is_expired', 'is_expiring_soon',
            'selling_price_with_gst',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_is_low_stock(self, obj):
        return obj.is_low_stock()
    
    def get_is_expired(self, obj):
        return obj.is_expired()
    
    def get_is_expiring_soon(self, obj):
        return obj.is_expiring_soon()
    
    def get_selling_price_with_gst(self, obj):
        return float(obj.get_selling_price_with_gst())


class MedicalProductSerializer(serializers.ModelSerializer):
    
    is_low_stock = serializers.SerializerMethodField()
    selling_price_with_gst = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = MedicalProduct
        fields = [
            'id', 'name', 'brand', 'manufacturer', 'category', 'category_display',
            'subcategory', 'description', 'specifications', 'features',
            'usage_instructions', 'pack_size', 'unit_of_measure',
            'mrp', 'price', 'discount_percentage', 'gst_percentage',
            'stock_quantity', 'minimum_stock_level', 'reorder_quantity',
            'barcode', 'sku', 'hsn_code', 'storage_instructions',
            'expiry_date', 'is_temperature_sensitive', 'certification',
            'is_sterile', 'image', 'is_active', 'is_featured',
            'is_low_stock', 'selling_price_with_gst',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_is_low_stock(self, obj):
        return obj.is_low_stock()
    
    def get_selling_price_with_gst(self, obj):
        return float(obj.get_selling_price_with_gst())


class InventoryBatchSerializer(serializers.ModelSerializer):
    
    product_name = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryBatch
        fields = [
            'id', 'medicine', 'medical_product', 'product_name',
            'batch_number', 'quantity_received', 'quantity_remaining',
            'manufacturing_date', 'expiry_date', 'received_date',
            'supplier_name', 'supplier_invoice', 'cost_price',
            'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_product_name(self, obj):
        if obj.medicine:
            return obj.medicine.name
        elif obj.medical_product:
            return obj.medical_product.name
        return "Unknown"


class SupplierSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'company_name', 'contact_person',
            'phone', 'email', 'address', 'gstin', 'drug_license',
            'payment_terms', 'minimum_order_value',
            'is_active', 'rating', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UnifiedProductSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    product_type = serializers.CharField() 
    name = serializers.CharField()
    category = serializers.CharField()
    manufacturer_or_brand = serializers.CharField()
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    mrp = serializers.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = serializers.IntegerField()
    image_url = serializers.CharField(allow_null=True)
    is_low_stock = serializers.BooleanField()
    expiry_date = serializers.DateField(allow_null=True)
    generic_name = serializers.CharField(required=False, allow_null=True)
    form = serializers.CharField(required=False, allow_null=True)
    strength = serializers.CharField(required=False, allow_null=True)
    requires_prescription = serializers.BooleanField(required=False)
    brand = serializers.CharField(required=False, allow_null=True)
    barcode = serializers.CharField(required=False, allow_null=True)

class MedicineImageUploadSerializer(serializers.Serializer):
    
    name = serializers.CharField(max_length=200)
    category = serializers.ChoiceField(choices=MEDICINE_CATEGORIES)
    form = serializers.CharField(max_length=50, required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2)
    mrp = serializers.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = serializers.IntegerField(min_value=0)
    generic_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    manufacturer = serializers.CharField(max_length=200, required=False, allow_blank=True)
    brand = serializers.CharField(max_length=200, required=False, allow_blank=True)
    strength = serializers.CharField(max_length=50, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    pack_size = serializers.CharField(max_length=100, required=False, allow_blank=True)
    storage_instructions = serializers.ChoiceField(
        choices=MEDICINE_STORAGE, 
        required=False, 
        allow_blank=True
    )
    expiry_date = serializers.DateField(required=False, allow_null=True)
    batch_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    requires_prescription = serializers.BooleanField(default=False)
    
    def validate(self, data):
        if data['price'] > data['mrp']:
            raise serializers.ValidationError({
                'price': 'Selling price cannot be greater than MRP'
            })
        return data
    
class CartItemSerializer(serializers.ModelSerializer):
    medicine_details = PharmacyMedicineSerializer(source='medicine', read_only=True)
    subtotal = serializers.SerializerMethodField()
    
    class Meta:
        model = CartItem
        fields = [
            'id', 'user', 'session_id', 'medicine', 'medicine_details',
            'quantity', 'price_at_addition', 'subtotal',
            'added_at', 'updated_at'
        ]
        read_only_fields = ['id', 'price_at_addition', 'added_at', 'updated_at']
    
    def get_subtotal(self, obj):
        return float(obj.get_subtotal())


class CartSummarySerializer(serializers.Serializer):
    items = CartItemSerializer(many=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)
    discount = serializers.DecimalField(max_digits=10, decimal_places=2)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2)
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    item_count = serializers.IntegerField()
    applied_coupon = serializers.CharField(allow_null=True)


class AddToCartSerializer(serializers.Serializer):
    medicine_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1)
    session_id = serializers.CharField(required=False, allow_null=True)


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0)


class ApplyCouponSerializer(serializers.Serializer):
    coupon_code = serializers.CharField(max_length=50)
    session_id = serializers.CharField(required=False, allow_null=True)


class SavedForLaterSerializer(serializers.ModelSerializer):
    medicine_details = PharmacyMedicineSerializer(source='medicine', read_only=True)
    
    class Meta:
        model = SavedForLater
        fields = ['id', 'user', 'medicine', 'medicine_details', 'notes', 'saved_at']
        read_only_fields = ['id', 'saved_at']


class CouponSerializer(serializers.ModelSerializer):
    is_valid_now = serializers.SerializerMethodField()
    discount_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'description', 'discount_type', 'discount_value',
            'max_uses', 'times_used', 'max_uses_per_user',
            'valid_from', 'valid_until', 'minimum_purchase_amount',
            'applicable_categories', 'is_active',
            'is_valid_now', 'discount_display'
        ]
    
    def get_is_valid_now(self, obj):
        is_valid, message = obj.is_valid()
        return is_valid
    
    def get_discount_display(self, obj):
        if obj.discount_type == 'percentage':
            return f"{obj.discount_value}% OFF"
        else:
            return f"₹{obj.discount_value} OFF"


class PharmacistProfileSerializer(serializers.ModelSerializer):

    class Meta:
        model = PharmacistProfile
        fields = [
            'id',
            'pharmacy_name',
            'pharmacy_license',
            'pharmacy_address',
            'pharmacy_phone',
            'pharmacy_email',
            'delivery_available',
            'delivery_radius_km',
            'rating',
        ]
        read_only_fields = ['id', 'rating']


class PharmacistUserSerializer(serializers.ModelSerializer):
    pharmacy_name     = serializers.CharField(required=False, allow_blank=True)
    pharmacy_license  = serializers.CharField(required=False, allow_blank=True)
    pharmacy_address  = serializers.CharField(required=False, allow_blank=True)
    pharmacy_phone    = serializers.CharField(required=False, allow_blank=True)
    pharmacy_email    = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    delivery_available = serializers.BooleanField(required=False, default=True)
    delivery_radius_km = serializers.IntegerField(required=False, allow_null=True)
    rating            = serializers.DecimalField(
        max_digits=3, decimal_places=2, read_only=True, default=0.00
    )

    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'gender', 'date_of_birth',
            'address', 'city', 'state', 'pincode',
            'profile_picture', 'profile_picture_url',
            'is_verified', 'user_type',
            'pharmacy_name', 'pharmacy_license', 'pharmacy_address',
            'pharmacy_phone', 'pharmacy_email',
            'delivery_available', 'delivery_radius_km', 'rating',
        ]
        read_only_fields = ['id', 'username', 'user_type', 'is_verified', 'rating']
        extra_kwargs = {
            'profile_picture': {'required': False, 'allow_null': True},
            'email': {'required': False, 'allow_blank': True},
        }

    def get_profile_picture_url(self, obj):
        request = self.context.get('request')
        if obj.profile_picture:
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def to_representation(self, instance):
        
        data = super().to_representation(instance)

        try:
            pp = instance.pharmacist_profile  
            data['pharmacy_name']      = pp.pharmacy_name      or ''
            data['pharmacy_license']   = pp.pharmacy_license   or ''
            data['pharmacy_address']   = pp.pharmacy_address   or ''
            data['pharmacy_phone']     = pp.pharmacy_phone     or ''
            data['pharmacy_email']     = pp.pharmacy_email     or ''
            data['delivery_available'] = pp.delivery_available
            data['delivery_radius_km'] = pp.delivery_radius_km
            data['rating']             = str(pp.rating)        if pp.rating else '0.00'
        except PharmacistProfile.DoesNotExist:
            data.setdefault('pharmacy_name', '')
            data.setdefault('pharmacy_license', '')
            data.setdefault('pharmacy_address', '')
            data.setdefault('pharmacy_phone', '')
            data.setdefault('pharmacy_email', '')
            data.setdefault('delivery_available', True)
            data.setdefault('delivery_radius_km', 10)
            data.setdefault('rating', '0.00')

        return data

    def update(self, instance, validated_data):

        pharmacy_fields = {
            'pharmacy_name', 'pharmacy_license', 'pharmacy_address',
            'pharmacy_phone', 'pharmacy_email',
            'delivery_available', 'delivery_radius_km',
        }

        pharmacy_data = {}
        for field in pharmacy_fields:
            if field in validated_data:
                pharmacy_data[field] = validated_data.pop(field)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if pharmacy_data:
            pp, _ = PharmacistProfile.objects.get_or_create(user=instance)

            for attr, value in pharmacy_data.items():
                setattr(pp, attr, value)
            if 'delivery_radius_km' in pharmacy_data:
                try:
                    pp.delivery_radius_km = int(pharmacy_data['delivery_radius_km'])
                except (TypeError, ValueError):
                    pp.delivery_radius_km = 10

            pp.save()

        return instance

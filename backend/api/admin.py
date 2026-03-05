# admin.py - UPDATED FOR MEDICAL SHOP SYSTEM

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser, DoctorProfile, PharmacistProfile,
    Appointment, Prescription, EnhancedPrescription,
    Medicine, MedicalProduct, InventoryBatch, Supplier,
    MedicineOrder, HealthRecord, HealthVaultDocument,
    ChatHistory, AIHealthInsight, Conversation, HealthReportData,
    VideoConsultationRoom, VideoCallMessage, WebRTCSignal,
    CallConnectionLog, VideoConsultationPrescription,
    ScreenShareSession, ConsultationFollowUp,
    HealthMetric, HealthGoal, HealthActivity, HealthReport,
    MedicationReminder, MedicationLog, DoctorRating,
    DoctorConsultationNote, FamilyHealthNetwork, EmergencyContact,
    OTPVerification, CartItem, SavedForLater, Coupon, CouponUsage,
    MedicineImage,ChatHistory, Conversation,
    OCRProcessingLog, ExtractedMedicalData,
)


# ============================================================================
# CUSTOM USER ADMIN
# ============================================================================

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'user_type', 'phone_number', 'is_verified', 'created_at']
    list_filter = ['user_type', 'is_verified', 'is_active', 'created_at']
    search_fields = ['username', 'email', 'phone_number', 'first_name', 'last_name']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': (
                'user_type', 'phone_number', 'date_of_birth', 'gender', 'blood_group',
                'address', 'city', 'state', 'pincode', 'profile_picture',
                'emergency_contact_name', 'emergency_contact_number',
                'height', 'weight', 'allergies', 'chronic_conditions',
                'current_medications', 'medical_history', 'is_verified'
            )
        }),
    )


# ============================================================================
# PROFILE ADMINS
# ============================================================================

@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'specialization', 'experience_years', 'consultation_fee', 'is_available', 'rating']
    list_filter = ['specialization', 'is_available']
    search_fields = ['user__username', 'user__first_name', 'user__last_name', 'license_number']


@admin.register(PharmacistProfile)
class PharmacistProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'pharmacy_name', 'pharmacy_phone', 'delivery_available']
    search_fields = ['user__username', 'pharmacy_name', 'pharmacy_license']


# ============================================================================
# MEDICAL SHOP ADMINS (NEW)
# ============================================================================

@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'generic_name', 'manufacturer', 'category', 'form', 'strength',
        'price', 'mrp', 'stock_quantity', 'requires_prescription', 'expiry_date',
        'is_active'
    ]
    list_filter = [
        'category', 'form', 'requires_prescription', 'is_active', 
        'is_refrigerated', 'is_banned', 'storage_instructions'
    ]
    search_fields = [
        'name', 'generic_name', 'manufacturer', 'batch_number', 
        'composition', 'therapeutic_class'
    ]
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'generic_name', 'brand_name', 'manufacturer')
        }),
        ('Classification', {
            'fields': ('category', 'form', 'strength', 'composition', 'therapeutic_class')
        }),
        ('Medical Information', {
            'fields': (
                'indications', 'dosage_instructions', 'contraindications',
                'side_effects', 'precautions', 'drug_interactions'
            ),
            'classes': ('collapse',)
        }),
        ('Legal & Prescription', {
            'fields': ('requires_prescription', 'schedule_drug', 'drug_license_number')
        }),
        ('Packaging', {
            'fields': ('pack_size', 'packaging_type')
        }),
        ('Pricing', {
            'fields': ('mrp', 'price', 'discount_percentage', 'gst_percentage')
        }),
        ('Stock Management', {
            'fields': ('stock_quantity', 'minimum_stock_level', 'reorder_quantity')
        }),
        ('Storage & Expiry', {
            'fields': (
                'storage_instructions', 'shelf_life', 'batch_number',
                'manufacturing_date', 'expiry_date', 'is_refrigerated',
                'is_temperature_sensitive'
            )
        }),
        ('Regulatory', {
            'fields': ('hsn_code',)
        }),
        ('Additional', {
            'fields': ('description', 'image', 'is_active', 'is_banned')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related()


@admin.register(MedicalProduct)
class MedicalProductAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'brand', 'category', 'price', 'mrp', 'stock_quantity',
        'barcode', 'is_active', 'is_featured'
    ]
    list_filter = [
        'category', 'is_active', 'is_featured', 'is_sterile',
        'is_temperature_sensitive'
    ]
    search_fields = [
        'name', 'brand', 'manufacturer', 'barcode', 'sku', 'description'
    ]
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'brand', 'manufacturer', 'category', 'subcategory')
        }),
        ('Product Details', {
            'fields': ('description', 'specifications', 'features', 'usage_instructions')
        }),
        ('Packaging', {
            'fields': ('pack_size', 'unit_of_measure')
        }),
        ('Pricing', {
            'fields': ('mrp', 'price', 'discount_percentage', 'gst_percentage')
        }),
        ('Stock Management', {
            'fields': ('stock_quantity', 'minimum_stock_level', 'reorder_quantity')
        }),
        ('Product Information', {
            'fields': ('barcode', 'sku', 'hsn_code')
        }),
        ('Storage & Handling', {
            'fields': ('storage_instructions', 'expiry_date', 'is_temperature_sensitive')
        }),
        ('Regulatory', {
            'fields': ('certification', 'is_sterile')
        }),
        ('Media & Status', {
            'fields': ('image', 'is_active', 'is_featured')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(InventoryBatch)
class InventoryBatchAdmin(admin.ModelAdmin):
    list_display = [
        'batch_number', 'get_product_name', 'quantity_received', 
        'quantity_remaining', 'expiry_date', 'supplier_name', 'is_active'
    ]
    list_filter = ['is_active', 'received_date', 'expiry_date']
    search_fields = ['batch_number', 'supplier_name', 'supplier_invoice']
    readonly_fields = ['created_at']
    
    def get_product_name(self, obj):
        if obj.medicine:
            return f"Medicine: {obj.medicine.name}"
        elif obj.medical_product:
            return f"Product: {obj.medical_product.name}"
        return "Unknown"
    get_product_name.short_description = 'Product'


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'company_name', 'phone', 'email', 'gstin',
        'is_active', 'rating'
    ]
    list_filter = ['is_active', 'rating']
    search_fields = ['name', 'company_name', 'gstin', 'drug_license', 'phone', 'email']
    readonly_fields = ['created_at', 'updated_at']


# ============================================================================
# APPOINTMENT & PRESCRIPTION ADMINS
# ============================================================================

@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ['patient_name', 'doctor', 'preferred_date', 'preferred_time', 'status', 'created_at']
    list_filter = ['status', 'preferred_date', 'created_at']
    search_fields = ['patient_name', 'patient_phone', 'symptoms']


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ['patient_name', 'doctor_name', 'diagnosis', 'date', 'created_at']
    list_filter = ['date', 'created_at']
    search_fields = ['patient_name', 'doctor_name', 'diagnosis']


@admin.register(EnhancedPrescription)
class EnhancedPrescriptionAdmin(admin.ModelAdmin):
    list_display = [
        'patient_name', 'doctor_name', 'diagnosis', 'date', 'status', 'created_at'
    ]
    list_filter = ['status', 'date', 'created_at']
    search_fields = [
        'patient_name', 'patient_phone', 'doctor_name', 'diagnosis'
    ]
    readonly_fields = ['created_at', 'updated_at']


@admin.register(MedicineOrder)
class MedicineOrderAdmin(admin.ModelAdmin):
    list_display = [
        'order_number', 'patient', 'total_amount', 'order_status',
        'payment_status', 'created_at'
    ]
    list_filter = ['order_status', 'payment_status', 'created_at']
    search_fields = ['order_number', 'patient__username']
    readonly_fields = ['created_at', 'updated_at']


# ============================================================================
# HEALTH TRACKING ADMINS
# ============================================================================

@admin.register(HealthMetric)
class HealthMetricAdmin(admin.ModelAdmin):
    list_display = ['patient', 'metric_type', 'value', 'recorded_at', 'is_abnormal']
    list_filter = ['metric_type', 'is_abnormal', 'alert_level', 'recorded_at']
    search_fields = ['patient__username', 'notes']


@admin.register(HealthGoal)
class HealthGoalAdmin(admin.ModelAdmin):
    list_display = ['patient', 'title', 'goal_type', 'progress_percentage', 'status', 'target_date']
    list_filter = ['goal_type', 'status', 'target_date']
    search_fields = ['patient__username', 'title']


@admin.register(HealthActivity)
class HealthActivityAdmin(admin.ModelAdmin):
    list_display = ['patient', 'activity_type', 'title', 'activity_date', 'duration_minutes']
    list_filter = ['activity_type', 'activity_date']
    search_fields = ['patient__username', 'title']


@admin.register(MedicationReminder)
class MedicationReminderAdmin(admin.ModelAdmin):
    list_display = ['patient', 'medication_name', 'frequency', 'start_date', 'is_active']
    list_filter = ['frequency', 'is_active', 'start_date']
    search_fields = ['patient__username', 'medication_name']


@admin.register(MedicationLog)
class MedicationLogAdmin(admin.ModelAdmin):
    list_display = ['patient', 'reminder', 'scheduled_time', 'status', 'taken_at']
    list_filter = ['status', 'scheduled_time']
    search_fields = ['patient__username']


@admin.register(HealthReport)
class HealthReportAdmin(admin.ModelAdmin):
    list_display = ['patient', 'report_type', 'title', 'start_date', 'end_date', 'generated_at']
    list_filter = ['report_type', 'generated_at']
    search_fields = ['patient__username', 'title']


# ============================================================================
# VIDEO CONSULTATION ADMINS
# ============================================================================

@admin.register(VideoConsultationRoom)
class VideoConsultationRoomAdmin(admin.ModelAdmin):
    list_display = ['room_id', 'patient', 'doctor', 'status', 'scheduled_time', 'duration']
    list_filter = ['status', 'scheduled_time']
    search_fields = ['room_id', 'patient__username', 'doctor__username']


@admin.register(VideoCallMessage)
class VideoCallMessageAdmin(admin.ModelAdmin):
    list_display = ['room', 'sender', 'message_type', 'created_at', 'is_read']
    list_filter = ['message_type', 'is_read', 'created_at']
    search_fields = ['content', 'sender__username']


# ============================================================================
# CHAT & CONVERSATION ADMINS
# ============================================================================

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'user', 'user_id_anonymous', 'message_count', 'created_at', 'is_archived']
    list_filter = ['is_archived', 'is_pinned', 'language', 'created_at']
    search_fields = ['title', 'user__username', 'user_id_anonymous']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ChatHistory)
class ChatHistoryAdmin(admin.ModelAdmin):
    list_display = ['user_id', 'role', 'conversation', 'has_image', 'image_type', 'has_voice_input', 'created_at']
    list_filter = ['role', 'has_image', 'image_type', 'has_voice_input', 'language', 'created_at']
    search_fields = ['user_id', 'message', 'ocr_extracted_text']
    readonly_fields = ['id', 'created_at']


@admin.register(HealthReportData)
class HealthReportDataAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'severity', 'report_generated', 'generated_at']
    list_filter = ['severity', 'report_generated', 'generated_at']
    search_fields = ['symptoms', 'diagnosis']


@admin.register(OCRProcessingLog)
class OCRProcessingLogAdmin(admin.ModelAdmin):
    list_display = ['chat_message', 'image_type', 'ocr_method', 'success', 'processing_time_ms', 'created_at']
    list_filter = ['image_type', 'ocr_method', 'success', 'created_at']
    search_fields = ['error_message']
    readonly_fields = ['id', 'created_at']    

@admin.register(ExtractedMedicalData)
class ExtractedMedicalDataAdmin(admin.ModelAdmin):
    list_display = ['chat_message', 'doctor_name', 'prescription_date', 'test_date', 'confidence_score', 'created_at']
    list_filter = ['prescription_date', 'test_date', 'created_at']
    search_fields = ['doctor_name', 'clinic_name', 'lab_name', 'raw_extracted_text']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(HealthRecord)
class HealthRecordAdmin(admin.ModelAdmin):
    list_display = ['metric_type', 'value', 'date', 'created_at']
    list_filter = ['metric_type', 'date']
    search_fields = ['notes']


@admin.register(HealthVaultDocument)
class HealthVaultDocumentAdmin(admin.ModelAdmin):
    list_display = ['patient', 'document_type', 'title', 'created_at']
    list_filter = ['document_type', 'is_shared_with_doctors', 'created_at']
    search_fields = ['patient__username', 'title']


@admin.register(DoctorRating)
class DoctorRatingAdmin(admin.ModelAdmin):
    list_display = ['doctor', 'patient', 'rating', 'would_recommend', 'created_at']
    list_filter = ['rating', 'would_recommend', 'created_at']
    search_fields = ['doctor__user__username', 'patient__username', 'review']


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ['phone_number', 'purpose', 'is_verified', 'expires_at', 'created_at']
    list_filter = ['purpose', 'is_verified', 'created_at']
    search_fields = ['phone_number']

@admin.register(MedicineImage)
class MedicineImageAdmin(admin.ModelAdmin):
    list_display = ['medicine', 'is_primary', 'display_order', 'created_at']
    list_filter = ['is_primary', 'created_at']
    search_fields = ['medicine__name']



    
    def get_user_identifier(self, obj):
        if obj.user:
            return f"User: {obj.user.username}"
        return f"Session: {obj.session_id[:12]}..."
    get_user_identifier.short_description = 'User/Session'


@admin.register(SavedForLater)
class SavedForLaterAdmin(admin.ModelAdmin):
    list_display = ['user', 'medicine', 'saved_at']
    list_filter = ['saved_at']
    search_fields = ['user__username', 'medicine__name']
    readonly_fields = ['id', 'saved_at']


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = [
        'code', 'discount_display', 'discount_type', 'valid_from', 
        'valid_until', 'times_used', 'max_uses', 'is_active'
    ]
    list_filter = ['discount_type', 'is_active', 'valid_from', 'valid_until']
    search_fields = ['code', 'description']
    readonly_fields = ['id', 'times_used', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('code', 'description', 'is_active')
        }),
        ('Discount', {
            'fields': ('discount_type', 'discount_value')
        }),
        ('Usage Limits', {
            'fields': ('max_uses', 'times_used', 'max_uses_per_user')
        }),
        ('Validity', {
            'fields': ('valid_from', 'valid_until')
        }),
        ('Conditions', {
            'fields': ('minimum_purchase_amount', 'applicable_categories')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def discount_display(self, obj):
        if obj.discount_type == 'percentage':
            return f"{obj.discount_value}% OFF"
        return f"₹{obj.discount_value} OFF"
    discount_display.short_description = 'Discount'


@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ['user', 'coupon', 'discount_amount', 'order', 'used_at']
    list_filter = ['used_at']
    search_fields = ['user__username', 'coupon__code']
    readonly_fields = ['id', 'used_at']


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ['get_user_identifier', 'medicine', 'quantity', 'added_at']
    list_filter = ['added_at']

    def get_user_identifier(self, obj):
        if obj.user:
            return f"User: {obj.user.username}"
        return f"Session: {obj.session_id[:12]}..."
    get_user_identifier.short_description = 'User/Session'




# Register remaining models with basic admin
admin.site.register(AIHealthInsight)
admin.site.register(DoctorConsultationNote)
admin.site.register(FamilyHealthNetwork)
admin.site.register(EmergencyContact)
admin.site.register(WebRTCSignal)
admin.site.register(CallConnectionLog)
admin.site.register(VideoConsultationPrescription)
admin.site.register(ScreenShareSession)
admin.site.register(ConsultationFollowUp)


# Customize admin site header
admin.site.site_header = "Medical Shop Management System"
admin.site.site_title = "Medical Shop Admin"
admin.site.index_title = "Welcome to Medical Shop Management"
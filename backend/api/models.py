from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from django.utils import timezone
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth import get_user_model


class CustomUser(AbstractUser):
    """Custom user model with role-based access"""
    USER_TYPES = [
        ('patient', 'Patient'),
        ('doctor', 'Doctor'),
        ('pharmacist', 'Pharmacist'),
        ('admin', 'Admin'),
    ]

    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]

    BLOOD_GROUP_CHOICES = [
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_type = models.CharField(max_length=20, choices=USER_TYPES, default='patient')
    phone_number = models.CharField(max_length=15, unique=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    profile_picture = models.ImageField(upload_to='profiles/', null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # ADD THESE NEW FIELDS:
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    
    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=200, blank=True)
    emergency_contact_number = models.CharField(max_length=15, blank=True)
    
    # Physical Measurements
    height = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Height in cm")
    weight = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text="Weight in kg")
    
    # Medical Information
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    current_medications = models.TextField(blank=True)
    medical_history = models.TextField(blank=True)

    def __str__(self):
        return f"{self.username} ({self.user_type})"
    
    def get_patient_stats(self):
        """Get patient statistics for dashboard"""
        if self.user_type != 'patient':
            return None
        
        return {
            'total_appointments': self.patient_consultations.count() if hasattr(self, 'patient_consultations') else 0,
            'active_prescriptions': EnhancedPrescription.objects.filter(patient=self, status='active').count(),
            'total_consultations': self.patient_consultations.filter(status='completed').count() if hasattr(self, 'patient_consultations') else 0,
        }


# ============================================================================
# PROFILE MODELS
# ============================================================================

class DoctorProfile(models.Model):
    """Doctor profile with specialization and availability"""
    SPECIALIZATIONS = [
        ('general', 'General Physician'),
        ('cardiologist', 'Cardiologist'),
        ('dermatologist', 'Dermatologist'),
        ('pediatrician', 'Pediatrician'),
        ('orthopedic', 'Orthopedic'),
        ('gynecologist', 'Gynecologist'),
        ('psychiatrist', 'Psychiatrist'),
        ('neurologist', 'Neurologist'),
    ]

    id = models.AutoField(primary_key=True)  # Changed from UUID to AutoField
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='doctor_profile')
    specialization = models.CharField(max_length=50, choices=SPECIALIZATIONS)
    license_number = models.CharField(max_length=50, unique=True)
    experience_years = models.IntegerField(default=0)
    qualification = models.CharField(max_length=200)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=500.00)
    available_days = models.JSONField(default=list)
    available_time_slots = models.JSONField(default=list)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_consultations = models.IntegerField(default=0)
    is_available = models.BooleanField(default=True)
    bio = models.TextField(blank=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=1, default=0.0)

    def update_rating(self):
        """Calculate and update average rating"""
        from django.db.models import Avg
        avg_rating = self.ratings.aggregate(Avg('rating'))['rating__avg']
        if avg_rating:
            self.rating = round(avg_rating, 2)
            self.average_rating = round(avg_rating, 1)
        else:
            self.rating = 0.0
            self.average_rating = 0.0
        self.save(update_fields=['rating', 'average_rating'])
    
    def get_rating_distribution(self):
        """Get distribution of ratings (1-5 stars)"""
        from django.db.models import Count
        distribution = {i: 0 for i in range(1, 6)}
        ratings = self.ratings.values('rating').annotate(count=Count('rating'))
        for item in ratings:
            distribution[item['rating']] = item['count']
        return distribution
    
    def get_recent_reviews(self, limit=5):
        """Get recent reviews with text"""
        return self.ratings.filter(review__isnull=False).exclude(review='')[:limit]


    def __str__(self):
        return f"Dr. {self.user.get_full_name()} - {self.specialization}"


class PharmacistProfile(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='pharmacist_profile')
    pharmacy_name = models.CharField(max_length=200)
    pharmacy_license = models.CharField(max_length=50, unique=True)
    pharmacy_address = models.TextField()
    pharmacy_phone = models.CharField(max_length=15)
    pharmacy_email = models.EmailField(blank=True, null=True, help_text="Pharmacy contact email for OTP")
    
    delivery_available = models.BooleanField(default=True)
    delivery_radius_km = models.IntegerField(default=10)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)

    def __str__(self):
        return f"{self.pharmacy_name} - {self.user.get_full_name()}"


# ============================================================================
# APPOINTMENT MODEL
# ============================================================================

class Appointment(models.Model):
    """Patient appointments with doctors"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient_name = models.CharField(max_length=200)
    patient_phone = models.CharField(max_length=20)
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name='appointments')
    symptoms = models.TextField()
    preferred_date = models.DateField()
    preferred_time = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.patient_name} - {self.preferred_date}"


# ============================================================================
# PRESCRIPTION MODELS
# ============================================================================

class Prescription(models.Model):
    """Basic prescription model (legacy)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient_name = models.CharField(max_length=200)
    doctor_name = models.CharField(max_length=200)
    diagnosis = models.CharField(max_length=500)
    medications = models.JSONField()
    notes = models.TextField(blank=True)
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.patient_name} - {self.date}"


class EnhancedPrescription(models.Model):
    """
    Enhanced Prescription model for video consultations
    ✅ CORRECTED: Works with video consultation prescriptions
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Foreign Keys (nullable for flexibility)
    patient = models.ForeignKey(
        CustomUser, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='received_prescriptions'
    )
    doctor = models.ForeignKey(
        CustomUser, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='created_prescriptions'
    )
    appointment = models.ForeignKey(
        Appointment, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='prescriptions'
    )
    
    # Patient Information (stored for records even if user deleted)
    patient_name = models.CharField(max_length=200)
    patient_age = models.CharField(max_length=10, blank=True)
    patient_gender = models.CharField(max_length=20, blank=True)
    patient_phone = models.CharField(max_length=20)
    
    # Doctor Information
    doctor_name = models.CharField(max_length=200)
    doctor_specialization = models.CharField(max_length=100, blank=True)
    doctor_registration = models.CharField(max_length=100, blank=True)
    hospital_name = models.CharField(max_length=200, blank=True)
    
    # Prescription Details
    diagnosis = models.TextField()
    medications = models.JSONField(default=list)  # List of medication objects
    
    # Vital Signs (optional)
    vital_signs = models.JSONField(default=dict, blank=True)
    
    # Additional Information
    lab_tests = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    date = models.DateField(default=timezone.now)
    
    # Status
    status = models.CharField(
        max_length=20, 
        default='active',
        choices=[
            ('active', 'Active'),
            ('completed', 'Completed'),
            ('cancelled', 'Cancelled')
        ]
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Enhanced Prescription'
        verbose_name_plural = 'Enhanced Prescriptions'
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['patient_phone']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Prescription for {self.patient_name} by Dr. {self.doctor_name} ({self.date})"
    
    def get_medications_count(self):
        return len(self.medications) if self.medications else 0

#-------------------------------------------------------------------------------------------------------------------------------------------------------------------

PRODUCT_CATEGORIES = [
    # Medicines
    ('medicines', 'Medicines'),
    ('prescription_drugs', 'Prescription Drugs'),
    ('otc_medicines', 'Over-the-Counter Medicines'),
    
    # Medical Devices & Equipment
    ('thermometers', 'Thermometers'),
    ('bp_monitors', 'Blood Pressure Monitors'),
    ('glucometers', 'Glucometers'),
    ('pulse_oximeters', 'Pulse Oximeters'),
    ('nebulizers', 'Nebulizers'),
    ('wheelchairs', 'Wheelchairs'),
    ('walking_aids', 'Walking Aids & Crutches'),
    ('hospital_beds', 'Hospital Beds'),
    
    # Personal Care & Hygiene
    ('sanitizers', 'Sanitizers & Disinfectants'),
    ('masks', 'Masks (Surgical, N95, etc.)'),
    ('gloves', 'Medical Gloves'),
    ('bandages', 'Bandages & Dressings'),
    ('cotton', 'Cotton & Cotton Buds'),
    ('antiseptics', 'Antiseptics'),
    
    # Baby Care
    ('baby_care', 'Baby Care Products'),
    ('diapers', 'Diapers'),
    ('baby_food', 'Baby Food & Formula'),
    ('baby_wipes', 'Baby Wipes'),
    
    # Health Supplements
    ('vitamins', 'Vitamins & Minerals'),
    ('protein_supplements', 'Protein Supplements'),
    ('herbal_supplements', 'Herbal Supplements'),
    ('health_drinks', 'Health Drinks'),
    
    # First Aid
    ('first_aid_kits', 'First Aid Kits'),
    ('syringes', 'Syringes & Needles'),
    ('surgical_items', 'Surgical Items'),
    
    # Diabetic Care
    ('diabetic_supplies', 'Diabetic Care Supplies'),
    ('insulin', 'Insulin Products'),
    ('test_strips', 'Test Strips'),
    
    # Ayurvedic & Herbal
    ('ayurvedic', 'Ayurvedic Products'),
    ('homeopathy', 'Homeopathic Products'),
    
    # Beauty & Wellness
    ('skincare', 'Skincare Products'),
    ('haircare', 'Hair Care Products'),
    ('dental_care', 'Dental Care'),
    
    # Other
    ('diagnostic_kits', 'Home Diagnostic Kits'),
    ('mobility_aids', 'Mobility Aids'),
    ('respiratory_care', 'Respiratory Care'),
    ('other', 'Other Medical Products'),
]

# ============================================================================
# MEDICINE-SPECIFIC CHOICES
# ============================================================================

MEDICINE_FORMS = [
    ('tablet', 'Tablet'),
    ('capsule', 'Capsule'),
    ('syrup', 'Syrup'),
    ('suspension', 'Suspension'),
    ('injection', 'Injection'),
    ('cream', 'Cream'),
    ('ointment', 'Ointment'),
    ('gel', 'Gel'),
    ('drops', 'Drops'),
    ('inhaler', 'Inhaler'),
    ('powder', 'Powder'),
    ('spray', 'Spray'),
    ('patch', 'Patch'),
    ('suppository', 'Suppository'),
]

MEDICINE_STORAGE = [
    ('room_temp', 'Room Temperature (15-25°C)'),
    ('cool_place', 'Cool Place (8-15°C)'),
    ('refrigerated', 'Refrigerated (2-8°C)'),
    ('frozen', 'Frozen (Below 0°C)'),
]

MEDICINE_CATEGORIES = [
    ('antibiotics', 'Antibiotics'),
    ('analgesics', 'Analgesics (Pain Relief)'),
    ('antacids', 'Antacids'),
    ('antidiabetic', 'Antidiabetic'),
    ('antihypertensive', 'Antihypertensive'),
    ('antihistamines', 'Antihistamines'),
    ('cardiovascular', 'Cardiovascular'),
    ('dermatological', 'Dermatological'),
    ('gastrointestinal', 'Gastrointestinal'),
    ('respiratory', 'Respiratory'),
    ('vitamins', 'Vitamins & Supplements'),
    ('hormones', 'Hormones'),
    ('other', 'Other'),
]
# ============================================================================
# MEDICINE & ORDERS
# ============================================================================

class Medicine(models.Model):

    CATEGORY_CHOICES = [
        # Medicines
        ('medicines', 'General Medicines'),
        ('prescription_drugs', 'Prescription Drugs'),
        ('otc_medicines', 'OTC Medicines'),
        ('antibiotics', 'Antibiotics'),
        ('painkillers', 'Painkillers'),
        ('vitamins', 'Vitamins & Supplements'),
        ('ayurvedic', 'Ayurvedic'),
        ('homeopathy', 'Homeopathic'),
        
        # Medical Devices
        ('thermometers', 'Thermometers'),
        ('bp_monitors', 'BP Monitors'),
        ('glucometers', 'Glucometers'),
        ('pulse_oximeters', 'Pulse Oximeters'),
        ('nebulizers', 'Nebulizers'),
        
        # First Aid & Surgical
        ('bandages', 'Bandages & Dressings'),
        ('antiseptics', 'Antiseptics'),
        ('first_aid_kits', 'First Aid Kits'),
        ('syringes', 'Syringes & Needles'),
        ('gloves', 'Medical Gloves'),
        
        # Baby Care
        ('diapers', 'Diapers'),
        ('baby_food', 'Baby Food & Formula'),
        ('baby_wipes', 'Baby Wipes'),
        
        # Personal Care
        ('sanitizers', 'Sanitizers & Disinfectants'),
        ('masks', 'Face Masks'),
        ('cotton', 'Cotton & Cotton Buds'),
        
        # Diabetic & Other
        ('diabetic_supplies', 'Diabetic Care'),
        ('other', 'Other'),
    ]
    
    # ✅ CRITICAL FIX: Explicit primary key
    id = models.AutoField(primary_key=True)
    
    # Basic Information
    name = models.CharField(max_length=255, db_index=True)
    generic_name = models.CharField(max_length=255, blank=True, default='')
    brand_name = models.CharField(max_length=255, blank=True, default='')
    manufacturer = models.CharField(max_length=255, blank=True, default='')
    
    # Category with expanded choices
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default='other',
        db_index=True
    )
    
    # Product Classification
    MEDICINE_FORMS = [
        ('tablet', 'Tablet'),
        ('capsule', 'Capsule'),
        ('syrup', 'Syrup'),
        ('injection', 'Injection'),
        ('cream', 'Cream'),
        ('ointment', 'Ointment'),
        ('drops', 'Drops'),
        ('powder', 'Powder'),
        ('spray', 'Spray'),
        ('inhaler', 'Inhaler'),
        ('patch', 'Patch'),
        ('gel', 'Gel'),
        ('lotion', 'Lotion'),
    ]
    
    form = models.CharField(
        max_length=50,
        choices=MEDICINE_FORMS,
        blank=True,  # Allow blank for non-medicine products
        default='',
        help_text="Medicine form (not required for non-medicine products)"
    )
    
    strength = models.CharField(max_length=50, blank=True, default='')
    composition = models.TextField(blank=True, default='')
    
    # Medical Information
    indications = models.TextField(blank=True, default='')
    dosage_instructions = models.TextField(blank=True, default='')
    contraindications = models.TextField(blank=True, default='')
    side_effects = models.TextField(blank=True, default='')
    precautions = models.TextField(blank=True, default='')
    drug_interactions = models.TextField(blank=True, default='')
    therapeutic_class = models.CharField(max_length=100, blank=True, default='')
    
    # Prescription & Legal
    requires_prescription = models.BooleanField(default=False)
    schedule_drug = models.CharField(max_length=10, blank=True, default='')
    drug_license_number = models.CharField(max_length=100, blank=True, default='')
    
    # Packaging
    pack_size = models.CharField(max_length=50, blank=True, default='')
    packaging_type = models.CharField(max_length=100, blank=True, default='')
    
    # Pricing
    mrp = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    
    # Stock Management
    stock_quantity = models.IntegerField(default=0)
    minimum_stock_level = models.IntegerField(default=10)
    reorder_quantity = models.IntegerField(default=50)
    
    # Storage & Expiry
    STORAGE_CHOICES = [
        ('room_temp', 'Room Temperature'),
        ('cool_place', 'Cool Place'),
        ('refrigerated', 'Refrigerated (2-8°C)'),
    ]
    storage_instructions = models.CharField(
        max_length=50,
        choices=STORAGE_CHOICES,
        default='room_temp'
    )
    shelf_life = models.CharField(max_length=50, blank=True, default='')
    batch_number = models.CharField(max_length=100, blank=True, default='')
    manufacturing_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    is_refrigerated = models.BooleanField(default=False)
    is_temperature_sensitive = models.BooleanField(default=False)
    
    # Regulatory
    hsn_code = models.CharField(max_length=20, blank=True, default='')
    
    # Additional Fields
    description = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='medicines/', null=True, blank=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_banned = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = 'Medicine/Product'
        verbose_name_plural = 'Medicines/Products'
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['name']),
            models.Index(fields=['generic_name']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.category})"
    
    def save(self, *args, **kwargs):
        # Auto-calculate discount percentage
        if self.mrp > 0 and self.price > 0:
            self.discount_percentage = ((self.mrp - self.price) / self.mrp) * 100
        super().save(*args, **kwargs)


class MedicalProduct(models.Model):
    """Model for all non-medicine medical shop products"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Basic Information
    name = models.CharField(max_length=200, db_index=True)
    brand = models.CharField(max_length=200, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    category = models.CharField(
    max_length=50,
    choices=PRODUCT_CATEGORIES,
    default='other',
    db_index=True
    )
    subcategory = models.CharField(max_length=100, blank=True)
    
    # Product Details
    description = models.TextField(blank=True)
    specifications = models.JSONField(default=dict, blank=True, help_text="Technical specifications")
    features = models.TextField(blank=True)
    usage_instructions = models.TextField(blank=True)
    
    # Packaging
    pack_size = models.CharField(max_length=100, blank=True, help_text="Size, quantity, dimensions")
    unit_of_measure = models.CharField(max_length=50, blank=True, help_text="pieces, kg, liters, etc.")
    
    # Pricing & Stock
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    
    stock_quantity = models.IntegerField(default=0)
    minimum_stock_level = models.IntegerField(default=5)
    reorder_quantity = models.IntegerField(default=20)
    
    # Product Information
    barcode = models.CharField(max_length=100, blank=True, unique=True, null=True)
    sku = models.CharField(max_length=100, blank=True)
    hsn_code = models.CharField(max_length=20, blank=True)
    
    # Storage & Handling
    storage_instructions = models.TextField(blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    is_temperature_sensitive = models.BooleanField(default=False)
    
    # Regulatory
    certification = models.CharField(max_length=200, blank=True, help_text="FDA, CE, ISO certifications")
    is_sterile = models.BooleanField(default=False)
    
    # Media
    image = models.ImageField(upload_to='medical_products/', blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['category']),
            models.Index(fields=['barcode']),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.brand}"
    
    def is_low_stock(self):
        return self.stock_quantity <= self.minimum_stock_level
    
    def get_selling_price_with_gst(self):
        gst_amount = (self.price * self.gst_percentage) / 100
        return self.price + gst_amount


# ============================================================================
# INVENTORY BATCH TRACKING
# ============================================================================

class InventoryBatch(models.Model):
    """Track individual batches of medicines and products"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Link to product (can be medicine or medical product)
    medicine = models.ForeignKey(
        Medicine, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='batches'
    )
    medical_product = models.ForeignKey(
        MedicalProduct, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='batches'
    )
    
    # Batch Information
    batch_number = models.CharField(max_length=100)
    quantity_received = models.IntegerField()
    quantity_remaining = models.IntegerField()
    
    # Dates
    manufacturing_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    received_date = models.DateField(default=timezone.now)
    
    # Supplier Information
    supplier_name = models.CharField(max_length=200, blank=True)
    supplier_invoice = models.CharField(max_length=100, blank=True)
    
    # Cost
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['expiry_date']
        unique_together = ['batch_number', 'medicine', 'medical_product']
    
    def __str__(self):
        product = self.medicine or self.medical_product
        return f"Batch {self.batch_number} - {product.name if product else 'Unknown'}"


# ============================================================================
# SUPPLIER MANAGEMENT
# ============================================================================

class Supplier(models.Model):
    """Supplier information"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(max_length=200)
    company_name = models.CharField(max_length=200, blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    
    # Contact Details
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    address = models.TextField()
    
    # Business Details
    gstin = models.CharField(max_length=15, blank=True, help_text="GST Identification Number")
    drug_license = models.CharField(max_length=100, blank=True)
    
    # Terms
    payment_terms = models.CharField(max_length=200, blank=True, help_text="e.g., 30 days credit")
    minimum_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Status
    is_active = models.BooleanField(default=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name


User = get_user_model()
#_________________________________________________________________________________________________________________________________
class MedicineOrder(models.Model):
    """Medicine order placed by a patient / guest."""

    ORDER_STATUS_CHOICES = [
        ('pending',          'Pending'),
        ('confirmed',        'Confirmed'),
        ('processing',       'Processing'),
        ('out_for_delivery', 'Out for Delivery'),
        ('delivered',        'Delivered'),
        ('cancelled',        'Cancelled'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('completed', 'Completed'),
        ('failed',    'Failed'),
        ('refunded',  'Refunded'),
    ]

    # ── Primary key ────────────────────────────────────────────────────
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_number = models.CharField(max_length=50, unique=True, blank=True)

    # ── Relations ──────────────────────────────────────────────────────
    patient    = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='medicine_orders'
    )
    pharmacist = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pharmacist_orders'
    )

    # ── Order items ────────────────────────────────────────────────────
    # Stored as JSON: [{"medicine_id": ..., "name": ..., "quantity": ..., "price": ...}]
    order_items  = models.JSONField(default=list)

    # ── Delivery ───────────────────────────────────────────────────────
    delivery_address = models.TextField(blank=True, default='')
    delivery_phone   = models.CharField(max_length=20, blank=True, default='')
    delivery_notes   = models.TextField(blank=True, default='')

    # ── Financials ─────────────────────────────────────────────────────
    subtotal       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_fee   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount   = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # ── Status ─────────────────────────────────────────────────────────
    order_status   = models.CharField(
        max_length=30,
        choices=ORDER_STATUS_CHOICES,
        default='pending'
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )
    payment_id     = models.CharField(max_length=200, blank=True, default='')

    # ── Session (for guest orders) ──────────────────────────────────────
    session_id = models.CharField(max_length=100, blank=True, default='')

    # ── Coupon ─────────────────────────────────────────────────────────
    coupon_code    = models.CharField(max_length=50, blank=True, default='')

    # ── Timestamps ─────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Medicine Order'
        verbose_name_plural = 'Medicine Orders'

    def __str__(self):
        return f"Order {self.order_number or self.id} — {self.order_status}"

    def save(self, *args, **kwargs):
        # Auto-generate order_number on first save
        if not self.order_number:
            import random, string
            prefix = 'RX'
            suffix = ''.join(random.choices(string.digits, k=8))
            self.order_number = f"{prefix}{suffix}"
        super().save(*args, **kwargs)


class HealthRecord(models.Model):
    """Patient health metrics"""
    METRIC_TYPES = [
        ('heartRate', 'Heart Rate'),
        ('bloodPressure', 'Blood Pressure'),
        ('weight', 'Weight'),
        ('temperature', 'Temperature'),
        ('glucose', 'Blood Glucose'),
        ('oxygen', 'Oxygen Saturation'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    metric_type = models.CharField(max_length=50, choices=METRIC_TYPES)
    value = models.CharField(max_length=100)
    date = models.DateTimeField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.metric_type} - {self.value} - {self.date}"


class HealthVaultDocument(models.Model):
    """Secure document storage"""
    DOCUMENT_TYPES = [
        ('prescription', 'Prescription'),
        ('lab_report', 'Lab Report'),
        ('xray', 'X-Ray'),
        ('scan', 'Scan'),
        ('insurance', 'Insurance'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='health_documents')
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='health_vault/')
    uploaded_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents')
    is_shared_with_doctors = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.patient.get_full_name()}"


# ============================================================================
# CHAT & AI
# ============================================================================
    

class OCRProcessingLog(models.Model):
    """Track OCR processing for analytics and debugging"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chat_message = models.ForeignKey(
        'ChatHistory',  # ✅ Use string reference to avoid import order issues
        on_delete=models.CASCADE,
        related_name='ocr_logs',
        null=True,
        blank=True
    )
    image_type = models.CharField(max_length=50)
    ocr_method = models.CharField(
        max_length=20,
        choices=[
            ('easyocr', 'EasyOCR'),
            ('tesseract', 'Tesseract'),
            ('none', 'No OCR (Vision AI only)'),
        ]
    )
    processing_time_ms = models.IntegerField(help_text="Processing time in milliseconds")
    text_length = models.IntegerField(help_text="Length of extracted text")
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'ocr_processing_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['image_type', 'created_at']),
            models.Index(fields=['success']),
        ]
    
    def __str__(self):
        return f"OCR {self.image_type} - {self.ocr_method} - {self.created_at}"


class ExtractedMedicalData(models.Model):
    """Store structured data extracted from medical images"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chat_message = models.OneToOneField(
        'ChatHistory',  # ✅ Use string reference
        on_delete=models.CASCADE,
        related_name='extracted_data'
    )
    
    # For prescriptions
    medications = models.JSONField(
        blank=True,
        null=True,
        help_text="List of medications with dosage, frequency"
    )
    doctor_name = models.CharField(max_length=255, blank=True, null=True)
    clinic_name = models.CharField(max_length=255, blank=True, null=True)
    prescription_date = models.DateField(blank=True, null=True)
    
    # For lab reports
    test_results = models.JSONField(
        blank=True,
        null=True,
        help_text="Lab test results with values and ranges"
    )
    lab_name = models.CharField(max_length=255, blank=True, null=True)
    test_date = models.DateField(blank=True, null=True)
    
    # General
    raw_extracted_text = models.TextField(
        blank=True,
        help_text="Full raw OCR text"
    )
    confidence_score = models.FloatField(
        blank=True,
        null=True,
        help_text="Overall extraction confidence"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'extracted_medical_data'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Medical Data - {self.chat_message.image_type} - {self.created_at}"


class AIHealthInsight(models.Model):
    """AI-generated health insights"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='ai_insights')
    insight_type = models.CharField(max_length=100)
    title = models.CharField(max_length=200)
    description = models.TextField()
    risk_level = models.CharField(max_length=20)
    recommendations = models.JSONField(default=list)
    data_sources = models.JSONField(default=list)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


# ============================================================================
# DOCTOR CONSULTATION NOTES
# ============================================================================

class DoctorConsultationNote(models.Model):
    """Private notes by doctors"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='consultation_notes')
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='doctor_notes')
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE)
    notes = models.TextField()
    is_critical = models.BooleanField(default=False)
    follow_up_required = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Note by Dr. {self.doctor.get_full_name()} for {self.patient.get_full_name()}"


# ============================================================================
# FAMILY & EMERGENCY CONTACTS
# ============================================================================

class FamilyHealthNetwork(models.Model):
    """Link family members"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    primary_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='family_primary')
    family_member = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='family_member')
    relationship = models.CharField(max_length=50)
    can_view_records = models.BooleanField(default=True)
    can_book_appointments = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['primary_user', 'family_member']


class EmergencyContact(models.Model):
    """Emergency contacts"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='emergency_contacts')
    name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=50)
    phone_number = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


# ============================================================================
# OTP VERIFICATION
# ============================================================================

class OTPVerification(models.Model):
    """OTP verification for login"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(max_length=15)
    otp = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_valid(self):
        return not self.is_verified and timezone.now() < self.expires_at

    class Meta:
        ordering = ['-created_at']


# ============================================================================
# VIDEO CONSULTATION MODELS
# ============================================================================

class VideoConsultationRoom(models.Model):
    """Video consultation room"""
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('waiting', 'Waiting'),
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('missed', 'Missed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_id = models.CharField(max_length=100, unique=True, db_index=True)
    
    # Participants
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='patient_consultations')
    doctor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='doctor_consultations')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Room Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    
    # Timing
    scheduled_time = models.DateTimeField()
    patient_joined_at = models.DateTimeField(null=True, blank=True)
    doctor_joined_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration = models.IntegerField(default=0, help_text="Duration in seconds")
    
    # Call Quality
    patient_connection_quality = models.CharField(max_length=20, default='good')
    doctor_connection_quality = models.CharField(max_length=20, default='good')
    
    # Features
    chat_enabled = models.BooleanField(default=True)
    screen_share_enabled = models.BooleanField(default=True)
    recording_enabled = models.BooleanField(default=False)
    recording_url = models.URLField(blank=True, null=True)
    recording_consent = models.BooleanField(default=False)
    
    # Notes
    doctor_notes = models.TextField(blank=True)
    patient_feedback = models.TextField(blank=True)
    rating = models.IntegerField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-scheduled_time']
        indexes = [
            models.Index(fields=['room_id']),
            models.Index(fields=['patient', '-scheduled_time']),
            models.Index(fields=['doctor', '-scheduled_time']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Room {self.room_id}"

    def is_active(self):
        return self.status in ['waiting', 'ongoing']

    def can_join(self, user):
        return user.id in [self.patient.id, self.doctor.id] and self.status in ['scheduled', 'waiting', 'ongoing']


class VideoCallMessage(models.Model):
    """Chat messages during video call"""
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('file', 'File'),
        ('prescription', 'Prescription'),
        ('system', 'System'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(VideoConsultationRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='video_messages')
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    content = models.TextField()
    file_url = models.URLField(blank=True, null=True)
    file_name = models.CharField(max_length=255, blank=True)
    file_size = models.IntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.get_full_name()}: {self.content[:50]}"


class WebRTCSignal(models.Model):
    """WebRTC signaling data"""
    SIGNAL_TYPES = [
        ('offer', 'Offer'),
        ('answer', 'Answer'),
        ('ice_candidate', 'ICE Candidate'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(VideoConsultationRoom, on_delete=models.CASCADE, related_name='signals')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_signals')
    receiver = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_signals')
    signal_type = models.CharField(max_length=20, choices=SIGNAL_TYPES)
    signal_data = models.JSONField()
    is_processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class CallConnectionLog(models.Model):
    """Connection quality logs"""
    EVENT_TYPES = [
        ('joined', 'User Joined'),
        ('left', 'User Left'),
        ('reconnecting', 'Reconnecting'),
        ('reconnected', 'Reconnected'),
        ('connection_failed', 'Connection Failed'),
        ('quality_change', 'Quality Change'),
        ('network_issue', 'Network Issue'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(VideoConsultationRoom, on_delete=models.CASCADE, related_name='connection_logs')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=30, choices=EVENT_TYPES)
    event_data = models.JSONField(default=dict)
    bandwidth = models.IntegerField(null=True, blank=True)
    latency = models.IntegerField(null=True, blank=True)
    packet_loss = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


class VideoConsultationPrescription(models.Model):
    """Link prescriptions to video consultations"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.OneToOneField(VideoConsultationRoom, on_delete=models.CASCADE, related_name='consultation_prescription')
    prescription = models.ForeignKey(EnhancedPrescription, on_delete=models.CASCADE)
    shared_during_call = models.BooleanField(default=False)
    shared_at = models.DateTimeField(null=True, blank=True)
    patient_acknowledged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Prescription for consultation {self.consultation.room_id}"


class ScreenShareSession(models.Model):
    """Screen sharing sessions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(VideoConsultationRoom, on_delete=models.CASCADE, related_name='screen_shares')
    shared_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration = models.IntegerField(default=0)

    class Meta:
        ordering = ['-started_at']


class ConsultationFollowUp(models.Model):
    """Follow-up tasks after consultation"""
    FOLLOW_UP_TYPES = [
        ('appointment', 'Follow-up Appointment'),
        ('test', 'Lab Test'),
        ('medication', 'Medication Check'),
        ('general', 'General Check-in'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(VideoConsultationRoom, on_delete=models.CASCADE, related_name='follow_ups')
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='follow_up_tasks')
    follow_up_type = models.CharField(max_length=20, choices=FOLLOW_UP_TYPES)
    description = models.TextField()
    due_date = models.DateField()
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return f"{self.follow_up_type} for {self.patient.get_full_name()}"


class VirtualWaitingRoom(models.Model):
    """Virtual waiting room"""
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('in_consultation', 'In Consultation'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='waiting_rooms')
    doctor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='doctor_waiting_rooms')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    queue_position = models.IntegerField(default=0)
    estimated_wait_time = models.IntegerField(default=0)
    patient_joined_at = models.DateTimeField(null=True, blank=True)
    doctor_joined_at = models.DateTimeField(null=True, blank=True)
    consultation_started_at = models.DateTimeField(null=True, blank=True)
    consultation_ended_at = models.DateTimeField(null=True, blank=True)
    room_id = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class HealthMetric(models.Model):
    """Track various health metrics over time"""
    METRIC_TYPES = [
        ('blood_pressure', 'Blood Pressure'),
        ('heart_rate', 'Heart Rate'),
        ('weight', 'Weight'),
        ('height', 'Height'),
        ('temperature', 'Temperature'),
        ('blood_sugar', 'Blood Sugar'),
        ('oxygen_saturation', 'Oxygen Saturation'),
        ('bmi', 'BMI'),
        ('cholesterol', 'Cholesterol'),
        ('steps', 'Daily Steps'),
        ('sleep', 'Sleep Hours'),
        ('water_intake', 'Water Intake'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='health_metrics')
    metric_type = models.CharField(max_length=50, choices=METRIC_TYPES)
    
    value = models.CharField(max_length=100) 
    systolic = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True) 
    diastolic = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True) 
    numeric_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    unit = models.CharField(max_length=20, blank=True) 
    notes = models.TextField(blank=True)
    recorded_at = models.DateTimeField(default=timezone.now)
    recorded_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_metrics')
    
    is_abnormal = models.BooleanField(default=False)
    alert_level = models.CharField(max_length=20, default='normal', choices=[
        ('normal', 'Normal'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ])
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['patient', '-recorded_at']),
            models.Index(fields=['metric_type', '-recorded_at']),
        ]
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.get_metric_type_display()}: {self.value}"
    
    def save(self, *args, **kwargs):
        # Auto-parse blood pressure
        if self.metric_type == 'blood_pressure' and '/' in self.value:
            try:
                sys, dia = self.value.split('/')
                self.systolic = float(sys.strip())
                self.diastolic = float(dia.strip())
            except ValueError:
                pass
        
        # Auto-parse numeric values
        if self.metric_type in ['heart_rate', 'weight', 'temperature', 'blood_sugar', 'oxygen_saturation']:
            try:
                self.numeric_value = float(self.value)
            except ValueError:
                pass
        
        # Check for abnormal values
        self.check_abnormal_values()
        
        super().save(*args, **kwargs)
    
    def check_abnormal_values(self):
        """Check if values are outside normal ranges"""
        if self.metric_type == 'blood_pressure':
            if self.systolic and self.diastolic:
                if self.systolic >= 180 or self.diastolic >= 120:
                    self.is_abnormal = True
                    self.alert_level = 'critical'
                elif self.systolic >= 140 or self.diastolic >= 90:
                    self.is_abnormal = True
                    self.alert_level = 'warning'
        
        elif self.metric_type == 'heart_rate':
            if self.numeric_value:
                if self.numeric_value < 40 or self.numeric_value > 120:
                    self.is_abnormal = True
                    self.alert_level = 'warning'
                if self.numeric_value < 30 or self.numeric_value > 150:
                    self.alert_level = 'critical'
        
        elif self.metric_type == 'blood_sugar':
            if self.numeric_value:
                if self.numeric_value > 180 or self.numeric_value < 70:
                    self.is_abnormal = True
                    self.alert_level = 'warning'
                if self.numeric_value > 250 or self.numeric_value < 50:
                    self.alert_level = 'critical'
        
        elif self.metric_type == 'oxygen_saturation':
            if self.numeric_value:
                if self.numeric_value < 95:
                    self.is_abnormal = True
                    self.alert_level = 'warning'
                if self.numeric_value < 90:
                    self.alert_level = 'critical'


class HealthGoal(models.Model):
    """Patient health goals and targets"""
    GOAL_TYPES = [
        ('weight_loss', 'Weight Loss'),
        ('weight_gain', 'Weight Gain'),
        ('exercise', 'Exercise'),
        ('steps', 'Daily Steps'),
        ('water_intake', 'Water Intake'),
        ('sleep', 'Sleep Hours'),
        ('blood_pressure', 'Blood Pressure Control'),
        ('blood_sugar', 'Blood Sugar Control'),
        ('medication_adherence', 'Medication Adherence'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('abandoned', 'Abandoned'),
        ('on_hold', 'On Hold'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='health_goals')
    goal_type = models.CharField(max_length=50, choices=GOAL_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    
    # Target values
    target_value = models.DecimalField(max_digits=10, decimal_places=2)
    current_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=20)
    
    # Timeline
    start_date = models.DateField(default=timezone.now) 
    target_date = models.DateField()
    
    # Progress tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    progress_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Reminders
    reminder_enabled = models.BooleanField(default=True)
    reminder_frequency = models.CharField(max_length=20, default='daily')  # daily, weekly, etc.
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.title}"
    
    def update_progress(self):
        """Calculate and update progress percentage"""
        if self.target_value > 0:
            self.progress_percentage = min((self.current_value / self.target_value) * 100, 100)
            
            if self.progress_percentage >= 100:
                self.status = 'completed'
            
            self.save()


class HealthActivity(models.Model):
    """Track daily health activities"""
    ACTIVITY_TYPES = [
        ('exercise', 'Exercise'),
        ('meal', 'Meal'),
        ('medication', 'Medication'),
        ('water', 'Water Intake'),
        ('sleep', 'Sleep'),
        ('meditation', 'Meditation'),
        ('checkup', 'Health Checkup'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='health_activities')
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    # Activity details
    duration_minutes = models.IntegerField(null=True, blank=True)
    calories_burned = models.IntegerField(null=True, blank=True)
    intensity = models.CharField(max_length=20, blank=True)  # low, medium, high
    
    activity_date = models.DateField(default=timezone.now)
    activity_time = models.TimeField(null=True, blank=True)
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-activity_date', '-activity_time']
        verbose_name_plural = 'Health Activities'
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.get_activity_type_display()} on {self.activity_date}"


class HealthReport(models.Model):
    """Generated health reports and summaries"""
    REPORT_TYPES = [
        ('weekly', 'Weekly Summary'),
        ('monthly', 'Monthly Summary'),
        ('quarterly', 'Quarterly Summary'),
        ('annual', 'Annual Summary'),
        ('custom', 'Custom Report'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='health_reports')
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    title = models.CharField(max_length=200)
    
    # Date range
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Report data (JSON)
    summary_data = models.JSONField(default=dict)
    metrics_summary = models.JSONField(default=dict)
    trends = models.JSONField(default=dict)
    recommendations = models.JSONField(default=list)
    
    # Generated by
    generated_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='generated_reports')
    generated_at = models.DateTimeField(auto_now_add=True)
    
    # File attachment
    pdf_file = models.FileField(upload_to='health_reports/', null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.get_report_type_display()} ({self.start_date} to {self.end_date})"


class MedicationReminder(models.Model):
    """Medication reminders for patients"""
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('twice_daily', 'Twice Daily'),
        ('three_times_daily', 'Three Times Daily'),
        ('weekly', 'Weekly'),
        ('as_needed', 'As Needed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='medication_reminders')
    prescription = models.ForeignKey(EnhancedPrescription, on_delete=models.CASCADE, null=True, blank=True, related_name='reminders')
    
    # Medication details
    medication_name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100)
    frequency = models.CharField(max_length=50, choices=FREQUENCY_CHOICES)
    
    # Schedule
    time_slots = models.JSONField(default=list)  # e.g., ["08:00", "14:00", "20:00"]
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    
    # Tracking
    is_active = models.BooleanField(default=True)
    reminder_enabled = models.BooleanField(default=True)
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.patient.get_full_name()} - {self.medication_name}"


class MedicationLog(models.Model):
    reminder = models.ForeignKey(
        MedicationReminder, 
        on_delete=models.CASCADE,
        related_name='logs'
    )
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, default='taken')
    taken_at = models.DateTimeField(null=True, blank=True)        # ← null=True
    scheduled_time = models.DateTimeField(null=True, blank=True)  # ← null=True
    notes = models.TextField(blank=True, default='')
    source = models.CharField(max_length=20, default='pwa')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-scheduled_time']
    
    def __str__(self):
        return f"{self.reminder.medication_name} - {self.status} at {self.scheduled_time}"
    
class DoctorRating(models.Model):
    """Patient ratings for doctors"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name='ratings')
    patient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='doctor_ratings')
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='rating')
    
    # Rating (1-5 stars)
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Rating from 1 to 5 stars"
    )
    
    # Optional review text
    review = models.TextField(blank=True, help_text="Optional written review")
    
    # What patient liked
    pros = models.TextField(blank=True, help_text="What the patient liked")
    
    # Areas for improvement
    cons = models.TextField(blank=True, help_text="Areas for improvement")
    
    # Would recommend?
    would_recommend = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['doctor', 'patient', 'appointment']  # One rating per appointment
        indexes = [
            models.Index(fields=['doctor', '-created_at']),
            models.Index(fields=['patient', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.patient.get_full_name()} rated Dr. {self.doctor.user.get_full_name()} - {self.rating} stars"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update doctor's average rating
        self.doctor.update_rating()

class Conversation(models.Model):
    """
    Conversation session for organizing chat messages
    Similar to ChatGPT/Claude conversation threads
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        CustomUser, 
        on_delete=models.CASCADE, 
        related_name='conversations',
        null=True,  # Allow anonymous users
        blank=True
    )
    user_id_anonymous = models.CharField(max_length=100, blank=True)  # For non-logged-in users
    
    # Conversation metadata
    title = models.CharField(max_length=200, blank=True)  # Auto-generated from first message
    language = models.CharField(max_length=50, default='English')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(default=timezone.now)
    
    # Stats
    message_count = models.IntegerField(default=0)
    
    # Status
    is_archived = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['user', '-last_message_at']),
            models.Index(fields=['user_id_anonymous', '-last_message_at']),
        ]
    
    def __str__(self):
        user_identifier = self.user.username if self.user else self.user_id_anonymous
        return f"{user_identifier} - {self.title or 'Untitled'} ({self.created_at.strftime('%Y-%m-%d')})"
    
    def update_title_from_first_message(self):
        """Auto-generate title from first user message"""
        if not self.title:
            first_message = self.messages.filter(role='user').first()
            if first_message:
                # Take first 50 chars of message as title
                self.title = first_message.message[:50]
                if len(first_message.message) > 50:
                    self.title += "..."
                self.save(update_fields=['title'])
    
    def update_stats(self):
        """Update message count and last message time"""
        self.message_count = self.messages.count()
        last_message = self.messages.order_by('-created_at').first()
        if last_message:
            self.last_message_at = last_message.created_at
        self.save(update_fields=['message_count', 'last_message_at'])


class ChatHistory(models.Model):
    """
    Individual chat message - UPDATED to link to Conversation
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Link to conversation session
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
        null=True,  # Nullable for backward compatibility
        blank=True
    )
    
    # Legacy fields (keep for backward compatibility)
    user_id = models.CharField(max_length=100)
    
    # Message content
    role = models.CharField(max_length=20)  # 'user' or 'assistant'
    message = models.TextField()
    language = models.CharField(max_length=50, default='English')
    
    # Image fields
    has_image = models.BooleanField(default=False)
    image_description = models.TextField(blank=True)
    
    # ✅ OCR-related fields
    ocr_extracted_text = models.TextField(
        blank=True, 
        null=True,
        help_text="Text extracted from uploaded image via OCR"
    )
    image_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        choices=[
            ('prescription', 'Prescription'),
            ('lab_report', 'Lab Report'),
            ('ct_scan', 'CT Scan'),
            ('xray', 'X-Ray'),
            ('mri', 'MRI Scan'),
            ('other', 'Other Medical Image'),
        ],
        help_text="Automatically classified image type"
    )
    ocr_confidence = models.FloatField(
        blank=True,
        null=True,
        help_text="OCR confidence score (0-1)"
    )
    
    # ✅ Voice-related fields
    has_voice_input = models.BooleanField(
        default=False,
        help_text="Message was created via voice input"
    )
    voice_language = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        help_text="Language code for voice input (e.g., en-US, hi-IN)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_history'
        ordering = ['created_at']  # Changed to ascending for chat display
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['user_id', '-created_at']),
            models.Index(fields=['image_type']),
        ]

    def __str__(self):
        return f"{self.user_id} - {self.role} - {self.created_at}"
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        
        # Update conversation stats
        if self.conversation:
            self.conversation.update_stats()
            
            # Auto-generate title from first message
            if self.role == 'user' and self.conversation.message_count <= 1:
                self.conversation.update_title_from_first_message()


class HealthReportData(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.OneToOneField(
        'Conversation',
        on_delete=models.CASCADE,
        related_name='health_report_data'
    )
    
    symptoms = models.JSONField(
        default=list,
        help_text="List of symptoms mentioned in conversation"
    )
    duration = models.CharField(
        max_length=200,
        blank=True,
        help_text="How long symptoms have been present"
    )
    severity = models.CharField(
        max_length=50,
        choices=[
            ('mild', 'Mild'),
            ('moderate', 'Moderate'),
            ('severe', 'Severe'),
            ('critical', 'Critical'),
            ('unknown', 'Unknown'),
        ],
        default='unknown'
    ) 
    
    additional_symptoms = models.JSONField(
        default=list,
        blank=True,
        help_text="Additional symptoms noted"
    )
    medical_history_mentioned = models.TextField(
        blank=True,
        help_text="Medical history discussed in conversation"
    )
    current_medications_mentioned = models.TextField(
        blank=True,
        help_text="Medications discussed in conversation"
    )
    
    possible_conditions = models.JSONField(
        default=list,
        blank=True,
        help_text="AI-suggested possible conditions"
    )
    advice_given = models.TextField(
        blank=True,
        help_text="Medical advice provided by AI"
    )
    emergency_warning = models.TextField(
        blank=True,
        help_text="Emergency warning if critical condition detected"
    )
    
    report_generated = models.BooleanField(
        default=False,
        help_text="Whether report has been generated"
    )
    generated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the report was generated"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'health_report_data'
        ordering = ['-created_at']
        verbose_name = 'Health Report Data'
        verbose_name_plural = 'Health Report Data'
    
    def __str__(self):
        return f"Health Report Data for Conversation {self.conversation.id}"
    
    def get_symptoms_display(self):
        return ", ".join(self.symptoms) if self.symptoms else "None"
    
    def has_emergency_symptoms(self):
        return bool(self.emergency_warning)
    
    
    
class MedicineImage(models.Model):
    """Support for multiple images per medicine/product"""
    medicine = models.ForeignKey(
        Medicine, 
        on_delete=models.CASCADE, 
        related_name='images'
    )
    image = models.ImageField(upload_to='medicine_images/')
    is_primary = models.BooleanField(default=False)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['display_order', 'created_at']
        verbose_name = 'Medicine Image'
        verbose_name_plural = 'Medicine Images'
    
    def __str__(self):
        return f"Image for {self.medicine.name}"
    
    def save(self, *args, **kwargs):
        if self.is_primary:
            MedicineImage.objects.filter(
                medicine=self.medicine, 
                is_primary=True
            ).exclude(id=self.id).update(is_primary=False)
        super().save(*args, **kwargs)

class PharmacyMedicine(models.Model):
    CATEGORY_CHOICES = [
    # Medicines
    ('medicines', 'General Medicines'),
    ('prescription_drugs', 'Prescription Drugs'),
    ('otc_medicines', 'OTC Medicines'),
    ('antibiotics', 'Antibiotics'),
    ('painkillers', 'Painkillers'),
    ('vitamins', 'Vitamins & Supplements'),
    ('ayurvedic', 'Ayurvedic'),
    ('homeopathy', 'Homeopathic'),
    
    # Medical Devices
    ('thermometers', 'Thermometers'),
    ('bp_monitors', 'BP Monitors'),
    ('glucometers', 'Glucometers'),
    ('pulse_oximeters', 'Pulse Oximeters'),
    ('nebulizers', 'Nebulizers'),
    
    # First Aid & Surgical
    ('bandages', 'Bandages & Dressings'),
    ('antiseptics', 'Antiseptics'),
    ('first_aid_kits', 'First Aid Kits'),
    ('syringes', 'Syringes & Needles'),
    ('gloves', 'Medical Gloves'),
    
    # Baby Care
    ('diapers', 'Diapers'),
    ('baby_food', 'Baby Food & Formula'),
    ('baby_wipes', 'Baby Wipes'),
    
    # Personal Care
    ('sanitizers', 'Sanitizers & Disinfectants'),
    ('masks', 'Face Masks'),
    ('cotton', 'Cotton & Cotton Buds'),
    
    # Diabetic & Other
    ('diabetic_supplies', 'Diabetic Care'),
    ('other', 'Other'),
]

    
    FORM_CHOICES = [
    ('tablet', 'Tablet'),
    ('capsule', 'Capsule'),
    ('syrup', 'Syrup'),
    ('injection', 'Injection'),
    ('cream', 'Cream/Ointment'),
    ('ointment', 'Ointment'),
    ('drops', 'Drops'),
    ('inhaler', 'Inhaler'),
    ('powder', 'Powder'),
    ('gel', 'Gel'),       
    ('lotion', 'Lotion'),  
    ('spray', 'Spray'),    
    ('patch', 'Patch'),    
    ('suspension', 'Suspension'),   
    ('suppository', 'Suppository'), 
    ('', 'Not Applicable'),
]
    
    STORAGE_CHOICES = [
        ('room_temp', 'Room Temperature'),
        ('cool_place', 'Cool Place'),
        ('refrigerated', 'Refrigerated'),
        ('', 'Not Applicable'),
    ]
    
    # Fields
    name = models.CharField(max_length=255)
    generic_name = models.CharField(max_length=255, blank=True, null=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    manufacturer = models.CharField(max_length=255, blank=True, null=True)
    brand_name = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    form = models.CharField(max_length=50, choices=FORM_CHOICES, blank=True, default='')  # Make optional
    strength = models.CharField(max_length=100, blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    mrp = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    stock_quantity = models.IntegerField(default=0)
    requires_prescription = models.BooleanField(default=False)
    expiry_date = models.DateField(blank=True, null=True)
    storage_instructions = models.CharField(max_length=50, choices=STORAGE_CHOICES, blank=True, default='')
    batch_number = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Additional fields for non-medicine products
    pack_size = models.CharField(max_length=100, blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Pharmacy Product'
        verbose_name_plural = 'Pharmacy Products'
    
    def __str__(self):
        return self.name

class CartItem(models.Model):
    """
    Shopping cart items
    Stores items before checkout
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # User/Session tracking
    user = models.ForeignKey(
        CustomUser, 
        on_delete=models.CASCADE, 
        related_name='cart_items',
        null=True,
        blank=True
    )
    session_id = models.CharField(
        max_length=255, 
        db_index=True,
        null=True,
        blank=True,
        help_text="For anonymous users"
    )
    
    # Product reference
    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.CASCADE,
        related_name='cart_items'
    )
    
    # Quantity
    quantity = models.PositiveIntegerField(default=1)
    
    # Price snapshot (in case price changes)
    price_at_addition = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Timestamps
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-added_at']
        indexes = [
            models.Index(fields=['user', '-added_at']),
            models.Index(fields=['session_id', '-added_at']),
        ]
        # Prevent duplicate items in cart
        unique_together = [['user', 'medicine'], ['session_id', 'medicine']]
    
    def __str__(self):
        user_identifier = self.user.username if self.user else f"Session {self.session_id[:8]}"
        return f"{user_identifier} - {self.medicine.name} x{self.quantity}"
    
    def get_subtotal(self):
        """Calculate subtotal for this cart item"""
        return self.price_at_addition * self.quantity
    
    def save(self, *args, **kwargs):
        # Capture current price if not set
        if not self.price_at_addition:
            self.price_at_addition = self.medicine.price
        super().save(*args, **kwargs)


class SavedForLater(models.Model):
    """
    Items saved for later (wishlist-like feature)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='saved_items'
    )
    
    medicine = models.ForeignKey(
        Medicine,
        on_delete=models.CASCADE,
        related_name='saved_by_users'
    )
    
    saved_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, help_text="User notes about this item")
    
    class Meta:
        ordering = ['-saved_at']
        unique_together = ['user', 'medicine']
        verbose_name_plural = 'Saved for Later'
    
    def __str__(self):
        return f"{self.user.username} - {self.medicine.name}"


class Coupon(models.Model):
    """
    Discount coupons for pharmacy
    """
    code = models.CharField(max_length=50, unique=True, db_index=True)
    description = models.TextField()
    
    # Discount type
    DISCOUNT_TYPES = [
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    ]
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Usage limits
    max_uses = models.PositiveIntegerField(null=True, blank=True, help_text="Leave blank for unlimited")
    times_used = models.PositiveIntegerField(default=0)
    max_uses_per_user = models.PositiveIntegerField(default=1)
    
    # Validity
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    
    # Conditions
    minimum_purchase_amount = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=0,
        help_text="Minimum order value to use this coupon"
    )
    
    # Categories
    applicable_categories = models.JSONField(
        default=list,
        blank=True,
        help_text="List of category codes. Empty = all categories"
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.code} - {self.discount_value}{'%' if self.discount_type == 'percentage' else '₹'}"
    
    def is_valid(self):
        """Check if coupon is currently valid"""
        now = timezone.now()
        
        if not self.is_active:
            return False, "Coupon is inactive"
        
        if now < self.valid_from:
            return False, "Coupon not yet valid"
        
        if now > self.valid_until:
            return False, "Coupon has expired"
        
        if self.max_uses and self.times_used >= self.max_uses:
            return False, "Coupon usage limit reached"
        
        return True, "Valid"
    
    def calculate_discount(self, subtotal):
        """Calculate discount amount for given subtotal"""
        if self.discount_type == 'percentage':
            return (subtotal * self.discount_value) / 100
        else:
            return min(self.discount_value, subtotal)  # Don't exceed subtotal


class CouponUsage(models.Model):
    """
    Track coupon usage by users
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='coupon_usages')
    order = models.ForeignKey(MedicineOrder, on_delete=models.SET_NULL, null=True, blank=True)
    
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    used_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-used_at']
    
    def __str__(self):
        return f"{self.user.username} used {self.coupon.code}"
from rest_framework import viewsets, status
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.http import StreamingHttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import timedelta, datetime
from django.shortcuts import get_object_or_404
import logging
import random

import tempfile

import base64
from PIL import Image
from decimal import Decimal
from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.utils import timezone
from django.utils.dateparse import parse_datetime

import anthropic
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

import io
import json
import os 
from django.db.models import Q, Avg, Sum, Count, Max, Min, F
import secrets
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import uuid
from .tasks import send_otp_email
from django.conf import settings
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from .helpers import fuzzy_search_medicines, auto_correct_search_query

from .ocr_utils import (
    extract_text_from_image,
    classify_medical_image_type,
    get_medical_image_disclaimer,
    build_ocr_analysis_prompt,
    save_temp_image,
    cleanup_temp_image,
    validate_image_file
)



from .models import (
    ChatHistory, Appointment, Prescription,MedicationReminder,
    MedicationLog,
    CustomUser,
    HealthRecord, EnhancedPrescription, Medicine, MedicineOrder,
    HealthVaultDocument, DoctorConsultationNote,
    AIHealthInsight, CustomUser, DoctorProfile, PharmacistProfile,
    VideoConsultationRoom, VideoCallMessage, WebRTCSignal,
    CallConnectionLog, VideoConsultationPrescription,
    ScreenShareSession, ConsultationFollowUp, HealthMetric, HealthGoal, HealthActivity,
    HealthReport, MedicationReminder, MedicationLog, DoctorRating, OTPVerification, 
    Conversation, HealthReportData,
    MedicalProduct, InventoryBatch, Supplier, CartItem, SavedForLater, Coupon, CouponUsage, Medicine,CustomUser, PharmacistProfile,
)


from .serializers import (
    ChatHistorySerializer, PharmacistUserSerializer,
    AppointmentSerializer,
    PrescriptionSerializer, 
    PharmacyMedicineSerializer,
    # MedicineDoseSerializer, 
    HealthRecordSerializer,
    ChatMessageSerializer, 
    TextToSpeechSerializer, 
    EnhancedPrescriptionSerializer,
    MedicineOrderSerializer, 
    HealthVaultDocumentSerializer, 
    LoginSerializer, 
    DoctorProfileSerializer,
    UserSerializer,
    VideoConsultationRoomSerializer, 
    VideoCallMessageSerializer,
    WebRTCSignalSerializer, 
    CallConnectionLogSerializer,
    VideoConsultationPrescriptionSerializer, 
    ScreenShareSessionSerializer,
    ConsultationFollowUpSerializer, 
    CreateVideoRoomSerializer,
    JoinRoomSerializer, 
    SendMessageSerializer, 
    WebRTCOfferSerializer,
    WebRTCAnswerSerializer, 
    ICECandidateSerializer, 
    EndCallSerializer,
    ConnectionQualitySerializer,
    HealthMetricSerializer, 
    HealthGoalSerializer, 
    HealthActivitySerializer,
    HealthReportSerializer, 
    MedicationReminderSerializer,
    MedicationLogSerializer, 
    HealthDashboardSerializer, 
    DoctorRatingSerializer, 
    DoctorRatingCreateSerializer,
    ConversationSerializer, 
    ConversationDetailSerializer, 
    ChatHistorySerializer,
    HealthReportDataSerializer,CartItemSerializer, CartSummarySerializer, AddToCartSerializer,
    UpdateCartItemSerializer, ApplyCouponSerializer, SavedForLaterSerializer,
    CouponSerializer
)
from .helpers import (
    get_chatbot, 
    GTTS_LANGUAGE_MAP, 
    classify_image_query_intent,
    analyze_conversation_for_report,  
    generate_health_report_text       
)
from gtts import gTTS

logger = logging.getLogger(__name__)

from django.core.mail import send_mail
from django.conf import settings
import random
from datetime import timedelta
from django.utils import timezone
from io import BytesIO
from django.http import StreamingHttpResponse, JsonResponse, HttpResponse 
from rest_framework.parsers import MultiPartParser, FormParser


def generate_otp():
    return str(random.randint(100000, 999999))


def send_otp_email_sync(phone_number, email, otp, purpose='login'):

    try:
        subject = f"Your OTP for {purpose.title()}"
        
        if purpose == 'login':
            message = f"""
Hello,

Your OTP for login is: {otp}

This OTP will expire in 10 minutes.

If you didn't request this OTP, please ignore this email.

Best regards,
Rural HealthCare Team
"""
        else: 
            message = f"""
Hello,

Welcome to Rural HealthCare!

Your OTP for registration is: {otp}

This OTP will expire in 10 minutes.

Please enter this code to complete your registration.

Best regards,
Rural HealthCare Team
"""
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        
        logger.info(f"[send_otp_email_sync]  Email sent to {email}")
        return True
        
    except Exception as e:
        logger.error(f"[send_otp_email_sync]  Error sending email: {str(e)}")
        return False


@api_view(['POST'])
@permission_classes([AllowAny])
def send_otp_for_login(request):
    try:
        phone_number = request.data.get('phone_number')
        
        if not phone_number or len(phone_number) != 10:
            return Response(
                {'error': 'Valid 10-digit phone number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            user = CustomUser.objects.get(phone_number=phone_number)
            logger.info(f"[send_otp_for_login] Found user: {user.username} (Type: {user.user_type})")
        except CustomUser.DoesNotExist:
            logger.warning(f"[send_otp_for_login] No user found with phone: {phone_number}")
            return Response(
                {
                    'error': 'No account found with this phone number',
                    'requires_registration': True
                },
                status=status.HTTP_404_NOT_FOUND
            )
        email_to_use = None
        
        if user.email:
            email_to_use = user.email
            logger.info(f"[send_otp_for_login] Using user email: {email_to_use}")
        
        elif user.user_type == 'pharmacist':
            try:
                pharmacist_profile = PharmacistProfile.objects.get(user=user)
                if pharmacist_profile.pharmacy_email:
                    email_to_use = pharmacist_profile.pharmacy_email
                    logger.info(f"[send_otp_for_login] Using pharmacy email: {email_to_use}")
                else:
                    logger.warning(f"[send_otp_for_login] Pharmacist has no email in profile")
            except PharmacistProfile.DoesNotExist:
                logger.error(f"[send_otp_for_login] Pharmacist profile not found for user: {user.username}")
        
        if not email_to_use:
            return Response(
                {
                    'error': 'No email associated with this account. Please contact support or register again.',
                    'user_type': user.user_type
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        otp = generate_otp()
        expires_at = timezone.now() + timedelta(minutes=10)
        
        OTPVerification.objects.filter(
            phone_number=phone_number,
            purpose='login'
        ).delete()
        
        OTPVerification.objects.create(
            phone_number=phone_number,
            otp=otp,
            purpose='login',
            expires_at=expires_at
        )
        
        logger.info(f"📱 LOGIN OTP for {phone_number} ({user.user_type}): {otp}")
        print(f"📱 LOGIN OTP for {phone_number} ({user.user_type}): {otp}")
        
        email_sent = False
        try:
            email_sent = send_otp_email_sync(phone_number, email_to_use, otp, purpose='login')
            if email_sent:
                logger.info(f"[send_otp_for_login]  OTP sent to email: {email_to_use}")
            else:
                logger.warning(f"[send_otp_for_login]  Email send returned False")
        except Exception as e:
            logger.error(f"[send_otp_for_login]  Email send exception: {str(e)}")
        
        return Response({
            'success': True,
            'message': f'OTP sent to your registered email ({email_to_use[:3]}***@{email_to_use.split("@")[1]})',
            'phone_number': phone_number,
            'user_type': user.user_type,
            'expires_in': 600,
            'otp': otp if settings.DEBUG else None,
            'email_sent': email_sent
        })
        
    except Exception as e:
        logger.error(f"[send_otp_for_login] Error: {str(e)}")
        import traceback
        logger.error(f"[send_otp_for_login] Traceback: {traceback.format_exc()}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )



@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp_and_login(request):
    try:
        phone_number = request.data.get('phone_number')
        otp = request.data.get('otp')
        
        if not phone_number or not otp:
            return Response(
                {'error': 'Phone number and OTP are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            otp_record = OTPVerification.objects.get(
                phone_number=phone_number,
                otp=otp,
                purpose='login'
            )
        except OTPVerification.DoesNotExist:
            return Response(
                {'error': 'Invalid OTP'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not otp_record.is_valid():
            return Response(
                {'error': 'OTP has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = CustomUser.objects.get(phone_number=phone_number)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        otp_record.is_verified = True
        otp_record.save()
        
        refresh = RefreshToken.for_user(user)
        
        user_data = {
            'id': str(user.id),
            'username': user.username,
            'user_type': user.user_type,
            'full_name': user.get_full_name(),
            'email': user.email,
            'phone_number': user.phone_number,
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
        
        logger.info(f"[verify_otp_and_login]  Login successful for {user.username}")
        
        return Response({
            'success': True,
            'message': 'Login successful',
            'user': user_data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })
        
    except Exception as e:
        logger.error(f"[verify_otp_and_login] Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def send_otp_for_registration(request):
    try:
        phone_number = request.data.get('phone_number')
        email = request.data.get('email')
        
        if not phone_number or len(phone_number) != 10:
            return Response(
                {'error': 'Valid 10-digit phone number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if CustomUser.objects.filter(phone_number=phone_number).exists():
            return Response(
                {'error': 'An account with this phone number already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        otp = generate_otp()
        expires_at = timezone.now() + timedelta(minutes=10)
        
        OTPVerification.objects.filter(
            phone_number=phone_number,
            purpose='registration'
        ).delete()
        
        OTPVerification.objects.create(
            phone_number=phone_number,
            otp=otp,
            purpose='registration',
            expires_at=expires_at
        )
        
        logger.info(f"📱 REGISTRATION OTP for {phone_number}: {otp}")
        print(f"📱 REGISTRATION OTP for {phone_number}: {otp}")
        
        email_sent = send_otp_email_sync(phone_number, email, otp, purpose='registration')
        
        if email_sent:
            logger.info(f"[send_otp_for_registration]  OTP sent to email: {email}")
        else:
            logger.warning(f"[send_otp_for_registration]  Email send failed, but OTP is available in console")
        
        return Response({
            'success': True,
            'message': f'OTP sent to {email}',
            'phone_number': phone_number,
            'expires_in': 600,
            'otp': otp if settings.DEBUG else None  
        })
        
    except Exception as e:
        logger.error(f"[send_otp_for_registration] Error: {str(e)}")
        import traceback
        logger.error(f"[send_otp_for_registration] Traceback: {traceback.format_exc()}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp_and_register(request):
    try:
        phone_number = request.data.get('phone_number')
        otp = request.data.get('otp')
        user_type = request.data.get('user_type', 'patient')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not all([phone_number, otp, first_name, email, password]):
            return Response(
                {'error': 'All fields are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(password) < 6:
            return Response(
                {'error': 'Password must be at least 6 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            otp_record = OTPVerification.objects.get(
                phone_number=phone_number,
                otp=otp,
                purpose='registration'
            )
        except OTPVerification.DoesNotExist:
            return Response(
                {'error': 'Invalid OTP'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not otp_record.is_valid():
            return Response(
                {'error': 'OTP has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if CustomUser.objects.filter(phone_number=phone_number).exists():
            return Response(
                {'error': 'User with this phone number already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = CustomUser.objects.create_user(
            username=phone_number,
            phone_number=phone_number,
            first_name=first_name,
            last_name=last_name or '',
            email=email, 
            user_type=user_type,
            is_verified=True,
            password=password
        )
        
        from django.contrib.auth.models import Group
        
        if user_type == 'doctor':
            DoctorProfile.objects.create(
                user=user,
                specialization=request.data.get('specialization', 'general'),
                license_number=request.data.get('license_number', 'LIC123'),
                qualification=request.data.get('qualification', 'MBBS')
            )
            doctor_group, _ = Group.objects.get_or_create(name='Doctor')
            user.groups.add(doctor_group)
            
        elif user_type == 'pharmacist':
            PharmacistProfile.objects.create(
                user=user,
                pharmacy_name=request.data.get('pharmacy_name', 'Pharmacy'),
                pharmacy_license=request.data.get('pharmacy_license', 'PHM123'),
                pharmacy_address=request.data.get('pharmacy_address', ''),
                pharmacy_phone=phone_number,
                pharmacy_email=email 
            )
            pharmacist_group, _ = Group.objects.get_or_create(name='Pharmacist')
            user.groups.add(pharmacist_group)
        
        otp_record.is_verified = True
        otp_record.save()
        
        refresh = RefreshToken.for_user(user)
        
        user_data = {
            'id': str(user.id),
            'username': user.username,
            'user_type': user.user_type,
            'full_name': user.get_full_name(),
            'email': user.email,
            'phone_number': user.phone_number,
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
        
        logger.info(f"[verify_otp_and_register]  Registration successful for {user.username}")
        
        return Response({
            'success': True,
            'message': 'Registration successful',
            'user': user_data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"[verify_otp_and_register] Error: {str(e)}")
        import traceback
        logger.error(f"[verify_otp_and_register] Traceback: {traceback.format_exc()}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    phone_number = request.data.get('phone_number')
    user_type = request.data.get('user_type', 'patient')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    email = request.data.get('email')
    password = request.data.get('password')

    if not phone_number:
        return Response(
            {'error': 'Phone number is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not password:
        return Response(
            {'error': 'Password is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if CustomUser.objects.filter(username=phone_number).exists():
        return Response(
            {'error': 'User with this phone number already exists'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = CustomUser.objects.create_user(
            username=phone_number,
            phone_number=phone_number,
            first_name=first_name or '',
            last_name=last_name or '',
            email=email or '',
            user_type=user_type,
            is_verified=True,
            password=password
        )

        from django.contrib.auth.models import Group
        
        if user_type == 'doctor':
            DoctorProfile.objects.create(
                user=user,
                specialization=request.data.get('specialization', 'general'),
                license_number=request.data.get('license_number', 'LIC123'),
                qualification=request.data.get('qualification', 'MBBS')
            )
            doctor_group, _ = Group.objects.get_or_create(name='Doctor')
            user.groups.add(doctor_group)
            
        elif user_type == 'pharmacist':
            PharmacistProfile.objects.create(
                user=user,
                pharmacy_name=request.data.get('pharmacy_name', 'Pharmacy'),
                pharmacy_license=request.data.get('pharmacy_license', 'PHM123'),
                pharmacy_address=request.data.get('pharmacy_address', ''),
                pharmacy_phone=phone_number
            )
            pharmacist_group, _ = Group.objects.get_or_create(name='Pharmacist')
            user.groups.add(pharmacist_group)
            
        else:
            patient_group, _ = Group.objects.get_or_create(name='Patient')
            user.groups.add(patient_group)

        refresh = RefreshToken.for_user(user)

        return Response({
            'success': True,
            'message': 'Registration successful',
            'user': {
                'id': str(user.id),
                'username': user.username,
                'user_type': user.user_type,
                'full_name': user.get_full_name(),
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })

    except Exception as e:
        logger.error(f"[verify_otp_and_register] Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def unified_login(request, user_type):
    try:
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response(
                {'success': False, 'error': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if user_type not in ['patient', 'doctor', 'pharmacist']:
            return Response(
                {'success': False, 'error': 'Invalid user type'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticate(username=username, password=password)
        
        if not user:
            return Response(
                {'success': False, 'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        user_type_mapping = {
            'patient': 'Patient',
            'doctor': 'Doctor', 
            'pharmacist': 'Pharmacist'
        }
        
        group_name = user_type_mapping.get(user_type)
        
        if not user.groups.filter(name=group_name).exists():
            if hasattr(user, 'user_type') and user.user_type != user_type:
                return Response(
                    {'success': False, 'error': f'Invalid credentials or not a {user_type}'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
        
        refresh = RefreshToken.for_user(user)
        
        user_data = {
            'id': str(user.id),
            'username': user.username,
            'user_type': user_type,
            'full_name': user.get_full_name() if hasattr(user, 'get_full_name') else f"{user.first_name} {user.last_name}",
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
        
        return Response({
            'success': True,
            'user': user_data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })
        
    except Exception as e:
        logger.error(f"Login error for {user_type}: {str(e)}")
        return Response(
            {'success': False, 'error': 'An error occurred during login'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    user = request.user
    return Response({
        'id': str(user.id),
        'username': user.username,
        'user_type': user.user_type,
        'full_name': user.get_full_name(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_user(request):
    return Response({
        'success': True,
        'message': 'Logged out successfully'
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def patient_login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )
        if user and user.groups.filter(name='Patient').exists():
            return Response({'success': True, 'user_id': user.id, 'role': 'patient'})
        else:
            return Response({'success': False, 'error': 'Invalid credentials or not a patient.'},
                            status=status.HTTP_401_UNAUTHORIZED)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def doctor_login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )
        if user and user.groups.filter(name='Doctor').exists():
            return Response({'success': True, 'user_id': user.id, 'role': 'doctor'})
        else:
            return Response({'success': False, 'error': 'Invalid credentials or not a doctor.'},
                            status=status.HTTP_401_UNAUTHORIZED)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def pharmacist_login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = authenticate(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )
        if user and user.groups.filter(name='Pharmacist').exists():
            return Response({'success': True, 'user_id': user.id, 'role': 'pharmacist'})
        else:
            return Response({'success': False, 'error': 'Invalid credentials or not a pharmacist.'},
                            status=status.HTTP_401_UNAUTHORIZED)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DoctorsViewSet(viewsets.ModelViewSet):
    queryset = DoctorProfile.objects.select_related('user').all()
    serializer_class = DoctorProfileSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        specialization = self.request.query_params.get('specialization')
        if specialization:
            queryset = queryset.filter(specialization=specialization)
        is_available = self.request.query_params.get('available')
        if is_available == 'true':
            queryset = queryset.filter(is_available=True)
        return queryset.order_by('-average_rating')
    
    def retrieve(self, request, pk=None):
        try:
            logger.info(f"[DoctorsViewSet] Retrieving doctor with pk: {pk}")
            
            is_uuid = False
            try:
                import uuid as uuid_lib
                uuid_obj = uuid_lib.UUID(str(pk))
                is_uuid = True
                logger.info(f"[DoctorsViewSet] PK is UUID: {pk}")
            except (ValueError, AttributeError):
                logger.info(f"[DoctorsViewSet] PK is not UUID (likely integer): {pk}")
            
            if is_uuid:
                try:
                    user = CustomUser.objects.get(id=pk, user_type='doctor')
                    logger.info(f"[DoctorsViewSet] Found user: {user.username}")
                    
                    doctor_profile = DoctorProfile.objects.get(user=user)
                    logger.info(f"[DoctorsViewSet] Found doctor profile: {doctor_profile.id}")
                    
                    serializer = self.get_serializer(doctor_profile)
                    return Response(serializer.data)
                    
                except CustomUser.DoesNotExist:
                    logger.warning(f"[DoctorsViewSet] User not found with UUID: {pk}")
                except DoctorProfile.DoesNotExist:
                    logger.warning(f"[DoctorsViewSet] Doctor profile not found for user: {pk}")
                    return Response(
                        {'error': 'Doctor profile not found. Please contact administrator.'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
            try:
                doctor_profile = DoctorProfile.objects.select_related('user').get(id=pk)
                logger.info(f"[DoctorsViewSet] Found doctor profile by ID: {doctor_profile.id}")
                
                serializer = self.get_serializer(doctor_profile)
                return Response(serializer.data)
                
            except DoctorProfile.DoesNotExist:
                logger.warning(f"[DoctorsViewSet] Doctor profile not found with ID: {pk}")
            
            return Response(
                {'error': f'Doctor not found with ID: {pk}'},
                status=status.HTTP_404_NOT_FOUND
            )
            
        except Exception as e:
            logger.error(f"[DoctorsViewSet] Error retrieving doctor: {str(e)}")
            import traceback
            logger.error(f"[DoctorsViewSet] Traceback: {traceback.format_exc()}")
            
            return Response(
                {'error': f'Error retrieving doctor: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def update(self, request, pk=None):
        try:
            logger.info(f"[DoctorsViewSet] Updating doctor with pk: {pk}")
            
            doctor_profile = None
            try:
                import uuid as uuid_lib
                uuid_obj = uuid_lib.UUID(str(pk))
                user = CustomUser.objects.get(id=pk, user_type='doctor')
                doctor_profile = DoctorProfile.objects.get(user=user)
            except (ValueError, AttributeError):
                doctor_profile = DoctorProfile.objects.get(id=pk)
            except (CustomUser.DoesNotExist, DoctorProfile.DoesNotExist):
                return Response(
                    {'error': f'Doctor not found with ID: {pk}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            user = doctor_profile.user
            user_updated = False
            
            if 'first_name' in request.data:
                user.first_name = request.data['first_name']
                user_updated = True
                
            if 'last_name' in request.data:
                user.last_name = request.data['last_name']
                user_updated = True
            
            if user_updated:
                user.save()
                logger.info(f"[DoctorsViewSet]  User updated: {user.first_name} {user.last_name}")
            
            serializer = self.get_serializer(doctor_profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                
                from django.core.cache import cache
                cache_key = f'doctor_profile_{pk}'
                cache.delete(cache_key)
                
                doctor_profile = DoctorProfile.objects.select_related('user').get(id=doctor_profile.id)
                
                fresh_serializer = self.get_serializer(doctor_profile)
                response_data = fresh_serializer.data
                
                if doctor_profile.user.profile_picture:
                    response_data['profile_picture_url'] = request.build_absolute_uri(
                        doctor_profile.user.profile_picture.url
                    )
                
                logger.info(f"[DoctorsViewSet]  Returning fresh data")
                logger.info(f"  Response keys: {response_data.keys()}")
                
                return Response(response_data)
            else:
                logger.error(f"[DoctorsViewSet] Validation errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"[DoctorsViewSet] Error: {str(e)}")
            import traceback
            logger.error(f"[DoctorsViewSet] Traceback: {traceback.format_exc()}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    def partial_update(self, request, pk=None):
        return self.update(request, pk)
    
    @action(detail=True, methods=['post'])
    def upload_profile_picture(self, request, pk=None):
        try:
            logger.info(f"[DoctorsViewSet] Uploading profile picture for doctor: {pk}")
            
            doctor_user = None
            
            try:
                import uuid as uuid_lib
                uuid_obj = uuid_lib.UUID(str(pk))
                doctor_user = CustomUser.objects.get(id=pk, user_type='doctor')
                logger.info(f"[DoctorsViewSet] Found doctor user via UUID: {doctor_user.username}")
            except (ValueError, AttributeError):
                doctor_profile = DoctorProfile.objects.get(id=pk)
                doctor_user = doctor_profile.user
                logger.info(f"[DoctorsViewSet] Found doctor user via profile ID: {doctor_user.username}")
            except (CustomUser.DoesNotExist, DoctorProfile.DoesNotExist):
                return Response(
                    {'error': f'Doctor not found with ID: {pk}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            if 'profile_picture' not in request.FILES:
                return Response(
                    {'error': 'No profile picture file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            profile_picture = request.FILES['profile_picture']
            
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
            if profile_picture.content_type not in allowed_types:
                return Response(
                    {'error': 'Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if profile_picture.size > 5 * 1024 * 1024:
                return Response(
                    {'error': 'File too large. Maximum size is 5MB.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if doctor_user.profile_picture:
                try:
                    old_path = doctor_user.profile_picture.path
                    if os.path.exists(old_path):
                        os.remove(old_path)
                        logger.info(f"[DoctorsViewSet] Deleted old profile picture")
                except Exception as e:
                    logger.warning(f"[DoctorsViewSet] Could not delete old picture: {e}")
            
            doctor_user.profile_picture = profile_picture
            doctor_user.save()
            
            logger.info(f"[DoctorsViewSet]  Profile picture uploaded successfully")
            
            doctor_profile = DoctorProfile.objects.get(user=doctor_user)
            serializer = self.get_serializer(doctor_profile)
            
            return Response({
                'success': True,
                'message': 'Profile picture uploaded successfully',
                'profile_picture_url': doctor_user.profile_picture.url if doctor_user.profile_picture else None,
                'user': UserSerializer(doctor_user, context={'request': request}).data,
                'doctor_profile': serializer.data
            })
            
        except Exception as e:
            logger.error(f"[DoctorsViewSet] Upload error: {str(e)}")
            import traceback
            logger.error(f"[DoctorsViewSet] Traceback: {traceback.format_exc()}")
            
            return Response(
                {'error': f'Error uploading profile picture: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChatHistoryViewSet(viewsets.ModelViewSet):
    queryset = ChatHistory.objects.all()
    serializer_class = ChatHistorySerializer

    def get_queryset(self):
        queryset = ChatHistory.objects.all()
        user_id = self.request.query_params.get('user_id', None)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset


@api_view(['POST'])
@csrf_exempt
def chat_stream(request):
    try:
        serializer = ChatMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        msg = data['msg']
        user_id = data['user_id']
        user_selected_language = data.get('language', 'English')
        conversation_id = data.get('conversation_id')
        from .helpers import (
            get_response_language, 
            detect_emergency_level, 
            should_show_hospitals, 
            check_ai_response_for_hospital_trigger,
            get_chatbot
        )
        
        detected_language = get_response_language(msg, user_selected_language)

        # Priority: native script > user selected > romanized > English
        native_script_ranges = [
            ('\u0d00', '\u0d7f', 'Malayalam'),
            ('\u0b80', '\u0bff', 'Tamil'),
            ('\u0c00', '\u0c7f', 'Telugu'),
            ('\u0c80', '\u0cff', 'Kannada'),
            ('\u0900', '\u097f', 'Hindi'),
        ]
        native_detected = None
        for start, end, lang_name in native_script_ranges:
            if any(start <= char <= end for char in msg):
                native_detected = lang_name
                break

        if native_detected:
            language = native_detected
            logger.info(f"[chat_stream] Native script: {language}")
        elif user_selected_language and user_selected_language != 'English':
            language = user_selected_language
            logger.info(f"[chat_stream] User selected: {language}")
        else:
            language = detected_language
            logger.info(f"[chat_stream] Auto detected: {language}")


        
        logger.info("="*60)
        logger.info("[chat_stream] LANGUAGE & EMERGENCY CHECK")
        logger.info("="*60)
        logger.info(f"Message: {msg[:100]}")
        logger.info(f"User selected: {user_selected_language}")
        logger.info(f"Auto-detected: {detected_language}")
        logger.info(f" FINAL LANGUAGE: {language}")
        
        
        emergency_level = detect_emergency_level(msg)
        show_hospitals_from_user = should_show_hospitals(msg)  
        
        logger.info(f"Emergency level: {emergency_level}")
        logger.info(f"Show hospitals (from user message): {show_hospitals_from_user}")
        logger.info("="*60)

        conversation = None
        is_new_conversation = False
        
        if conversation_id:
            try:
                if request.user and request.user.is_authenticated:
                    conversation = Conversation.objects.get(id=conversation_id, user=request.user)
                else:
                    conversation = Conversation.objects.get(id=conversation_id, user_id_anonymous=user_id)
                logger.info(f"[chat_stream]  Found existing conversation: {conversation.id}")
            except Conversation.DoesNotExist:
                logger.warning(f"[chat_stream] Conversation not found: {conversation_id}")
        
        if not conversation:
            conversation_data = {'language': language}
            if request.user and request.user.is_authenticated:
                conversation_data['user'] = request.user
            else:
                conversation_data['user_id_anonymous'] = user_id
            
            conversation = Conversation.objects.create(**conversation_data)
            is_new_conversation = True
            logger.info(f"[chat_stream]  Created new conversation with language: {language}")

        user_message = ChatHistory.objects.create(
            conversation=conversation,
            user_id=user_id,
            role='user',
            message=msg,
            language=language
        )
        logger.info(f"[chat_stream]  Saved user message: {user_message.id}")

        if is_new_conversation or not conversation.title:
            title = msg[:50].strip()
            if len(msg) > 50:
                title += "..."
            conversation.title = title
            conversation.save(update_fields=['title'])
            logger.info(f"[chat_stream]  Set conversation title: {title}")

        emergency_prefix = ""
        if emergency_level == 'critical':
            emergency_prefix = "🚨 EMERGENCY ALERT: This appears to be a medical emergency. Please call 108/102 immediately or go to the nearest emergency room. "
        elif emergency_level == 'urgent':
            emergency_prefix = " URGENT MEDICAL ATTENTION NEEDED: Please seek medical care within 24 hours. "

        chatbot = get_chatbot()

        def generate():
            try:
                full_response = ""
                
                if emergency_prefix:
                    full_response += emergency_prefix
                    yield f"data: {json.dumps({'chunk': emergency_prefix})}\n\n"
                
                logger.info(f"[chat_stream]  Generating response in: {language}")
                for chunk in chatbot.get_response(msg, language):
                    full_response += chunk
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"

                show_hospitals = show_hospitals_from_user

                if not show_hospitals and emergency_level == 'critical':
                    show_hospitals = True
                    logger.info("[chat_stream] Critical emergency in response - enabling hospital finder")

                assistant_message = ChatHistory.objects.create(
                    conversation=conversation,
                    user_id=user_id,
                    role='assistant',
                    message=full_response,
                    language=language
                )
                logger.info(f"[chat_stream]  Saved assistant message: {assistant_message.id}")

                from django.utils import timezone
                conversation.last_message_at = timezone.now()
                conversation.message_count = conversation.messages.count()
                conversation.save(update_fields=['last_message_at', 'message_count'])
                logger.info(f"[chat_stream]  Updated conversation metadata")

                completion_data = {
                    'done': True,
                    'conversation_id': str(conversation.id),
                    'show_hospitals': show_hospitals, 
                    'emergency_level': emergency_level,
                    'detected_language': language ,
                }
                
                logger.info(f"[chat_stream] 📤 Sending completion data:")
                logger.info(f"  show_hospitals: {show_hospitals}")
                logger.info(f"  emergency_level: {emergency_level}")
                logger.info(f"  detected_language: {language}")
                logger.info("="*60)
                
                yield f"data: {json.dumps(completion_data)}\n\n"

            except Exception as e:
                logger.error(f"[chat_stream]  Error in streaming: {str(e)}")
                import traceback
                logger.error(f"[chat_stream] Traceback: {traceback.format_exc()}")
                
                error_msg = f"I apologize, but I encountered an error: {str(e)}"
                yield f"data: {json.dumps({'chunk': error_msg, 'error': True})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

        response = StreamingHttpResponse(
            generate(),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    except Exception as e:
        logger.error(f"[chat_stream]  Error: {str(e)}")
        import traceback
        logger.error(f"[chat_stream] Traceback: {traceback.format_exc()}")
        
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )        

@csrf_exempt
def chat_view(request):
    try:
        data = json.loads(request.body)
        message = data.get('message', '').strip()
        language = data.get('language', 'English')
        elaborate = data.get('elaborate', False)
        user_id = data.get('user_id', 'anonymous')

        if not message:
            return JsonResponse({'success': False, 'error': 'Message is required'}, status=400)

        logger.info(f"Chat request from {user_id} in {language} (elaborate={elaborate}): {message[:50]}...")

        chatbot = get_chatbot()

        def generate():
            try:
                for chunk in chatbot.get_response(message, language, elaborate):
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
            except Exception as e:
                logger.error(f"Error in SSE generator: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        response = StreamingHttpResponse(
            generate(),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON data'}, status=400)
    except Exception as e:
        logger.error(f"Error in chat view: {str(e)}")
        return JsonResponse({'success': False, 'error': 'An error occurred processing your request'}, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def chat_with_image(request):
    temp_path = None
    
    try:
        logger.info("=" * 80)
        logger.info(" CHAT WITH IMAGE REQUEST (SIMPLIFIED)")
        logger.info("=" * 80)
        
        user_message = request.POST.get('msg', '').strip()
        user_id = request.POST.get('user_id', 'anonymous')
        language = request.POST.get('language', 'English')
        elaborate = request.POST.get('elaborate', 'false').lower() == 'true'
        image_file = request.FILES.get('image')
        
        logger.info(f"User: {user_id}")
        logger.info(f"Message: {user_message}")
        logger.info(f"Image: {image_file.name if image_file else 'None'}")
        
        if not image_file:
            logger.error("No image provided")
            return JsonResponse({'error': 'No image file provided'}, status=400)
        
        if image_file.size > 5 * 1024 * 1024:
            logger.error(f"Image too large: {image_file.size}")
            return JsonResponse({'error': 'Image must be less than 5MB'}, status=400)
        
        allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if image_file.content_type.lower() not in allowed:
            logger.error(f"Invalid type: {image_file.content_type}")
            return JsonResponse({'error': 'Only JPEG, PNG, WebP allowed'}, status=400)
        
        logger.info(" Validation passed")
        
        try:
            temp_dir = os.path.join(tempfile.gettempdir(), 'medical_images')
            os.makedirs(temp_dir, exist_ok=True)
            
            import uuid
            ext = os.path.splitext(image_file.name)[1] or '.jpg'
            temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}{ext}")
            
            with open(temp_path, 'wb+') as f:
                for chunk in image_file.chunks():
                    f.write(chunk)
            
            logger.info(f" Saved to: {temp_path}")
        except Exception as e:
            logger.error(f" Save error: {e}")
            return JsonResponse({'error': f'Cannot save image: {str(e)}'}, status=500)
        
        conversation = None
        try:
            from .models import Conversation
            conversation, _ = Conversation.objects.get_or_create(
                user_id_anonymous=user_id,
                defaults={
                    'title': f"Image Analysis - {timezone.now().strftime('%Y-%m-%d %H:%M')}",
                    'language': language,
                }
            )
            logger.info(f" Conversation: {conversation.id}")
        except Exception as e:
            logger.warning(f" Conversation error: {e}")
        
        try:
            from .models import ChatHistory
            ChatHistory.objects.create(
                conversation=conversation,
                user_id=user_id,
                role='user',
                message=user_message or "Analyze this medical image",
                language=language,
                has_image=True,
                image_description=f"Image: {image_file.name}",
            )
            logger.info(" Saved user message")
        except Exception as e:
            logger.warning(f" Save message error: {e}")
        
        def generate_response():
            full_response = ""
            
            try:
                logger.info(" Getting chatbot...")
                from .chatbot import get_chatbot
                
                chatbot = get_chatbot()
                logger.info(" Chatbot loaded")
                
                with open(temp_path, 'rb') as img_file:
                    logger.info(" Starting image analysis...")
                    
                    for chunk in chatbot.analyze_medical_image(
                        user_id=user_id,
                        image_buffer=img_file,
                        query=user_message or "Please analyze this medical image in detail",
                        language=language,
                        elaborate=elaborate
                    ):
                        full_response += chunk
                        yield chunk
                
                logger.info(" Analysis complete")
                
            except ImportError as e:
                logger.error(f" Chatbot import error: {e}")
                error_msg = "Medical image analysis system is not configured. Please install required dependencies."
                full_response = error_msg
                yield error_msg
                
            except Exception as e:
                logger.error(f" Analysis error: {e}")
                import traceback
                logger.error(traceback.format_exc())
                
                error_msg = f"I encountered an error analyzing this image. Please consult a healthcare professional for proper evaluation.\n\nError: {str(e)}"
                full_response = error_msg
                yield error_msg
            
            finally:
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                        logger.info(" Cleaned up temp file")
                    except:
                        pass
                
                try:
                    from .models import ChatHistory
                    ChatHistory.objects.create(
                        conversation=conversation,
                        user_id=user_id,
                        role='assistant',
                        message=full_response,
                        language=language,
                    )
                    
                    if conversation:
                        conversation.last_message_at = timezone.now()
                        conversation.save()
                    
                    logger.info(" Saved assistant response")
                except Exception as e:
                    logger.warning(f" Save response error: {e}")
        
        logger.info(" Streaming response...")
        
        response = StreamingHttpResponse(
            generate_response(),
            content_type='text/plain; charset=utf-8'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        
        return response
        
    except Exception as e:
        logger.error("=" * 80)
        logger.error(f" CRITICAL ERROR in chat_with_image")
        logger.error(f"Error: {str(e)}")
        logger.error("=" * 80)
        
        import traceback
        logger.error(traceback.format_exc())
        
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        
        return JsonResponse({
            'error': str(e),
            'type': type(e).__name__,
            'message': 'Check Django console for full error details'
        }, status=500)


    

@api_view(['POST'])
@csrf_exempt
def request_detailed_analysis(request):
    try:
        user_id = request.data.get('user_id', 'anonymous')
        language = request.data.get('language', 'English')
        original_message = request.data.get('original_message', '')

        chatbot = get_chatbot()

        def generate():
            try:
                full_response = ""
                detailed_prompt = f"""The user has requested MORE DETAILED information about their previous medical image.

Original context: {original_message}

Now provide a COMPREHENSIVE analysis including:
1. Detailed anatomical observations
2. Thorough explanation of findings
3. Clinical significance and pathophysiology
4. Differential diagnoses to consider
5. Recommended additional tests
6. Detailed follow-up recommendations
7. Educational context about the condition

Total response: 600-800 words
Use clear headings and detailed paragraphs."""

                for chunk in chatbot.get_response(detailed_prompt, language, elaborate=True):
                    full_response += chunk
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"

                ChatHistory.objects.create(
                    user_id=user_id,
                    role='assistant',
                    message=full_response,
                    language=language
                )

                yield f"data: {json.dumps({'done': True})}\n\n"

            except Exception as e:
                logger.error(f"Error in detailed analysis: {str(e)}")
                error_msg = "I apologize, but I encountered an error providing detailed analysis."
                yield f"data: {json.dumps({'chunk': error_msg, 'error': True})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

        response = StreamingHttpResponse(
            generate(),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    except Exception as e:
        logger.error(f"Error in detailed analysis endpoint: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related('doctor__user').all()
    serializer_class = AppointmentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Appointment.objects.select_related('doctor__user').all()

        patient_param = self.request.query_params.get('patient', None)

        if patient_param:
            logger.info(f" Filtering appointments by patient: {patient_param}")
            
            try:
                patient_user = CustomUser.objects.get(id=patient_param, user_type='patient')
                logger.info(f" Found patient user: {patient_user.username}")
                
                queryset = queryset.filter(patient_phone=patient_user.phone_number)
                logger.info(f" Filtered by patient phone, count: {queryset.count()}")
                
            except CustomUser.DoesNotExist:
                if hasattr(Appointment, 'patient'):
                    queryset = queryset.filter(patient_id=patient_param)
                    logger.info(f" Filtered by patient FK, count: {queryset.count()}")
                else:
                    logger.warning(f" Patient not found: {patient_param}")
                    queryset = queryset.none()
        

        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
            logger.info(f"Filtered by status: {status_filter}")
        
        doctor_param = self.request.query_params.get('doctor', None)
        doctor_user_param = self.request.query_params.get('doctor__user', None)
        
        if doctor_user_param:
            logger.info(f" Filtering appointments by doctor__user: {doctor_user_param}")
            try:
                user = CustomUser.objects.get(id=doctor_user_param, user_type='doctor')
                logger.info(f" Found doctor user: {user.username}")
                
                queryset = queryset.filter(doctor__user=user)
                logger.info(f" Filtered appointments, count: {queryset.count()}")
                
                for apt in queryset:
                    logger.info(f"  📋 Appointment: {apt.patient_name} - {apt.preferred_date} - {apt.status}")
                    
            except CustomUser.DoesNotExist:
                logger.warning(f" No doctor user found with ID: {doctor_user_param}")
                queryset = queryset.none()
            except Exception as e:
                logger.error(f" Error filtering by doctor__user: {str(e)}")
        
        elif doctor_param:
            logger.info(f" Filtering appointments by doctor: {doctor_param}")
            try:
                try:
                    doctor_profile = DoctorProfile.objects.get(id=doctor_param)
                    queryset = queryset.filter(doctor=doctor_profile)
                    logger.info(f" Filtered by DoctorProfile ID, count: {queryset.count()}")
                except DoctorProfile.DoesNotExist:
                    logger.info(f"  Trying as User ID...")
                    user = CustomUser.objects.get(id=doctor_param, user_type='doctor')
                    queryset = queryset.filter(doctor__user=user)
                    logger.info(f" Filtered by User ID, count: {queryset.count()}")
                    
            except (DoctorProfile.DoesNotExist, CustomUser.DoesNotExist):
                logger.warning(f" No doctor found with ID: {doctor_param}")
                queryset = queryset.none()
            except Exception as e:
                logger.error(f" Error filtering by doctor: {str(e)}")
        
        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        try:
            doctor_id = request.data.get('doctor')
            logger.info(f"\n{'='*60}")
            logger.info(f"CREATING APPOINTMENT")
            logger.info(f"{'='*60}")
            logger.info(f"Received doctor ID: {doctor_id}")
            logger.info(f"Request data: {request.data}")
            
            if doctor_id:
                try:
                    doctor = DoctorProfile.objects.get(id=doctor_id)
                    logger.info(f" Found DoctorProfile: Dr. {doctor.user.get_full_name()}")
                    request.data['doctor'] = doctor.id
                except DoctorProfile.DoesNotExist:
                    logger.error(f" DoctorProfile not found with ID: {doctor_id}")
                    return Response(
                        {'error': f'Doctor not found with ID: {doctor_id}'},
                        status=status.HTTP_404_NOT_FOUND
                    )

            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            
            logger.info(f" Appointment created successfully")
            logger.info(f"   Appointment ID: {serializer.instance.id}")
            logger.info(f"   Patient: {serializer.instance.patient_name}")
            logger.info(f"   Doctor: Dr. {serializer.instance.doctor.user.get_full_name()}")
            logger.info(f"   Date: {serializer.instance.preferred_date}")
            logger.info(f"{'='*60}\n")
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            logger.error(f" Appointment create error: {str(e)}")
            logger.error(f"   Error type: {type(e).__name__}")
            logger.error(f"   Full error:", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        appointment = self.get_object()
        new_status = request.data.get('status')

        if new_status not in ['pending', 'confirmed', 'completed', 'cancelled']:
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"Updating appointment {pk} status: {appointment.status} -> {new_status}")
        appointment.status = new_status
        appointment.save()
        logger.info(f" Appointment status updated successfully")

        serializer = self.get_serializer(appointment)
        return Response(serializer.data)


class PharmacyMedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.all()
    serializer_class = PharmacyMedicineSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
    
        queryset = Medicine.objects.prefetch_related('images').all()
        product_type = self.request.query_params.get('type', None)
        
        medicine_categories = [
            'medicines', 'prescription_drugs', 'otc_medicines',
            'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
        ]
        
        other_product_categories = [
            'thermometers', 'bp_monitors', 'glucometers', 'pulse_oximeters', 'nebulizers',
            'bandages', 'antiseptics', 'first_aid_kits', 'syringes', 'gloves',
            'diapers', 'baby_food', 'baby_wipes',
            'sanitizers', 'masks', 'cotton',
            'diabetic_supplies', 'other'
        ]
        
        if product_type == 'medicines':
            queryset = queryset.filter(category__in=medicine_categories)
            logger.info(f"[PharmacyMedicineViewSet] Filtering for medicines only: {queryset.count()}")
        elif product_type == 'devices' or product_type == 'other':
            queryset = queryset.filter(category__in=other_product_categories)
            logger.info(f"[PharmacyMedicineViewSet] Filtering for devices/other: {queryset.count()}")
        
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | 
                Q(generic_name__icontains=search) |
                Q(manufacturer__icontains=search)
            )
        
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category=category)
        
        requires_prescription = self.request.query_params.get('requires_prescription', None)
        if requires_prescription is not None:
            queryset = queryset.filter(requires_prescription=requires_prescription.lower() == 'true')
        
        stock_status = self.request.query_params.get('stock_status', None)
        if stock_status == 'low':
            queryset = queryset.filter(stock_quantity__lte=10)
        elif stock_status == 'out':
            queryset = queryset.filter(stock_quantity=0)
        elif stock_status == 'in_stock':
            queryset = queryset.filter(stock_quantity__gt=0)
        
        sort_by = self.request.query_params.get('sort_by', '-created_at')
        queryset = queryset.order_by(sort_by)
        
        logger.info(f"[PharmacyMedicineViewSet] Final queryset count: {queryset.count()}")
        
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def create(self, request, *args, **kwargs):
        try:
            logger.info(f"[PharmacyMedicine] Creating medicine")
            logger.info(f"[PharmacyMedicine] Data: {request.data}")
            
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            
            logger.info(f"[PharmacyMedicine]  Medicine created: {serializer.data['name']}")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def update(self, request, pk=None, partial=False):
        try:
            medicine = self.get_object()
            logger.info(f"[PharmacyMedicine] Updating medicine: {medicine.name}")
            
            serializer = self.get_serializer(medicine, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            logger.info(f"[PharmacyMedicine]  Medicine updated")
            
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def partial_update(self, request, pk=None):
        return self.update(request, pk, partial=True)
        

    @action(detail=False, methods=['post'])
    def upload_images(self, request):
        try:
            logger.info(f"[PharmacyMedicine] Creating product with images")
            logger.info(f"[PharmacyMedicine] POST data: {request.POST}")
            
            category = request.POST.get('category', 'other')
            medicine_categories = [
                'medicines', 'prescription_drugs', 'otc_medicines',
                'antibiotics', 'painkillers', 'vitamins', 'ayurvedic', 'homeopathy'
            ]
            is_medicine = category.lower() in medicine_categories
            form_value = request.POST.get('form', '')
            if is_medicine and not form_value:
                form_value = 'tablet' 
            elif not is_medicine:
                form_value = '' 
            
            medicine_data = {
                'name': request.POST.get('name'),
                'generic_name': request.POST.get('generic_name', ''),
                'category': category,
                'manufacturer': request.POST.get('manufacturer', ''),
                'brand_name': request.POST.get('brand', ''),
                'description': request.POST.get('description', ''),
                'form': form_value, 
                'strength': request.POST.get('strength', ''),
                'price': request.POST.get('price', 0),
                'mrp': request.POST.get('mrp') or request.POST.get('price', 0),
                'stock_quantity': request.POST.get('stock_quantity', 0),
                'requires_prescription': request.POST.get('requires_prescription', 'false').lower() == 'true',
                'expiry_date': request.POST.get('expiry_date') or None,
                'storage_instructions': request.POST.get('storage_instructions', 'room_temp'),
                'batch_number': request.POST.get('batch_number', ''),
            }
            if not medicine_data['name']:
                return Response(
                    {'error': 'Product name is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if is_medicine and not medicine_data['form']:
                return Response(
                    {'error': 'Medicine form (tablet/capsule/syrup) is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"[PharmacyMedicine] Medicine data: {medicine_data}")
            
            serializer = self.get_serializer(data=medicine_data)
            serializer.is_valid(raise_exception=True)
            medicine = serializer.save()
            
            logger.info(f"[PharmacyMedicine]  Product created: {medicine.name} (ID: {medicine.id})")
            
            images = request.FILES.getlist('images')
            logger.info(f"[PharmacyMedicine] Received {len(images)} images")
            
            if images:
                from .models import MedicineImage
                
                for idx, image_file in enumerate(images[:5]):
                    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
                    if image_file.content_type not in allowed_types:
                        logger.warning(f"[PharmacyMedicine] Skipping invalid file type: {image_file.content_type}")
                        continue
                    
                    if image_file.size > 5 * 1024 * 1024:
                        logger.warning(f"[PharmacyMedicine] Skipping large file: {image_file.size} bytes")
                        continue
                    
                    MedicineImage.objects.create(
                        medicine=medicine,
                        image=image_file,
                        is_primary=(idx == 0),
                        display_order=idx
                    )
                    logger.info(f"[PharmacyMedicine]  Saved image {idx + 1}/{len(images)}")
            
            response_serializer = self.get_serializer(medicine, context={'request': request})
            
            return Response({
                'success': True,
                'message': f'Product created with {len(images)} images',
                'medicine': response_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            import traceback
            logger.error(f"[PharmacyMedicine] Traceback: {traceback.format_exc()}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    @action(detail=True, methods=['post'])
    def add_images(self, request, pk=None):
        try:
            medicine = self.get_object()
            logger.info(f"[PharmacyMedicine] Adding images to: {medicine.name}")
            
            images = request.FILES.getlist('images')
            logger.info(f"[PharmacyMedicine] Received {len(images)} images")
            
            if not images:
                return Response(
                    {'error': 'No images provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            from .models import MedicineImage
            
            current_count = medicine.images.count()
            
            if current_count >= 5:
                return Response(
                    {'error': 'Maximum 5 images allowed per medicine'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            remaining_slots = 5 - current_count
            images_to_add = images[:remaining_slots]
            
            added_images = []
            for idx, image_file in enumerate(images_to_add):
                
                allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
                if image_file.content_type not in allowed_types:
                    continue
                
                if image_file.size > 5 * 1024 * 1024:
                    continue
                
                img = MedicineImage.objects.create(
                    medicine=medicine,
                    image=image_file,
                    is_primary=(current_count == 0 and idx == 0),
                    display_order=current_count + idx
                )
                added_images.append(img)
                logger.info(f"[PharmacyMedicine]  Added image {idx + 1}")
            
            serializer = self.get_serializer(medicine, context={'request': request})
            
            return Response({
                'success': True,
                'message': f'Added {len(added_images)} images',
                'medicine': serializer.data
            })
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    @action(detail=True, methods=['put'])
    def update_images(self, request, pk=None):
        try:
            medicine = self.get_object()
            logger.info(f"[PharmacyMedicine] Updating medicine: {medicine.name}")
            
            medicine_data = {}
            for field in ['name', 'generic_name', 'category', 'manufacturer', 
                        'description', 'dosage_form', 'strength', 'price', 
                        'stock_quantity', 'requires_prescription', 'expiry_date',
                        'storage_conditions', 'side_effects', 'warnings']:
                if field in request.POST:
                    value = request.POST.get(field)
                    if value is not None and value != '':
                        medicine_data[field] = value
            
            if medicine_data:
                serializer = self.get_serializer(medicine, data=medicine_data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                logger.info(f"[PharmacyMedicine]  Medicine data updated")
            
            images = request.FILES.getlist('images')
            if images:
                from .models import MedicineImage
                
                current_count = medicine.images.count()
                remaining_slots = 5 - current_count
                
                if remaining_slots > 0:
                    images_to_add = images[:remaining_slots]
                    
                    for idx, image_file in enumerate(images_to_add):
                        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
                        if image_file.content_type not in allowed_types:
                            continue
                        
                        if image_file.size > 5 * 1024 * 1024:
                            continue
                        
                        MedicineImage.objects.create(
                            medicine=medicine,
                            image=image_file,
                            is_primary=(current_count == 0 and idx == 0),
                            display_order=current_count + idx
                        )
                        logger.info(f"[PharmacyMedicine]  Added new image {idx + 1}")
            
            response_serializer = self.get_serializer(medicine, context={'request': request})
            
            return Response({
                'success': True,
                'message': 'Medicine updated successfully',
                'medicine': response_serializer.data
            })
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    @action(detail=True, methods=['delete'], url_path='delete_image/(?P<image_id>[^/.]+)')
    def delete_image(self, request, pk=None, image_id=None):
        try:
            medicine = self.get_object()
            
            from .models import MedicineImage
            
            try:
                image = MedicineImage.objects.get(id=image_id, medicine=medicine)
            except MedicineImage.DoesNotExist:
                return Response(
                    {'error': 'Image not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            was_primary = image.is_primary
            image.delete()
            
            logger.info(f"[PharmacyMedicine]  Deleted image {image_id}")
            
            if was_primary:
                first_image = medicine.images.first()
                if first_image:
                    first_image.is_primary = True
                    first_image.save()
                    logger.info(f"[PharmacyMedicine] Set new primary image: {first_image.id}")
            
            serializer = self.get_serializer(medicine, context={'request': request})
            
            return Response({
                'success': True,
                'message': 'Image deleted successfully',
                'medicine': serializer.data
            })
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    @action(detail=True, methods=['post'])
    def set_primary_image(self, request, pk=None):
        try:
            medicine = self.get_object()
            image_id = request.data.get('image_id')
            
            if not image_id:
                return Response(
                    {'error': 'image_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            from .models import MedicineImage
            
            try:
                new_primary = MedicineImage.objects.get(id=image_id, medicine=medicine)
            except MedicineImage.DoesNotExist:
                return Response(
                    {'error': 'Image not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            medicine.images.update(is_primary=False)
            
            new_primary.is_primary = True
            new_primary.save()
            
            logger.info(f"[PharmacyMedicine]  Set primary image: {image_id}")
            
            serializer = self.get_serializer(medicine, context={'request': request})
            
            return Response({
                'success': True,
                'message': 'Primary image updated',
                'medicine': serializer.data
            })
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    
    def destroy(self, request, pk=None):
        try:
            medicine = self.get_object()
            medicine_name = medicine.name
            
            logger.info(f"[PharmacyMedicine] Deleting medicine: {medicine_name}")
            
            medicine.delete()
            
            logger.info(f"[PharmacyMedicine]  Medicine deleted")
            
            return Response(
                {'success': True, 'message': f'{medicine_name} deleted successfully'},
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['patch'])
    def update_stock(self, request, pk=None):
        try:
            medicine = self.get_object()
            action_type = request.data.get('action') 
            quantity = int(request.data.get('quantity', 0))
            
            if action_type == 'add':
                medicine.stock_quantity += quantity
            elif action_type == 'reduce':
                medicine.stock_quantity = max(0, medicine.stock_quantity - quantity)
            elif action_type == 'set':
                medicine.stock_quantity = quantity
            
            medicine.save()
            
            logger.info(f"[PharmacyMedicine]  Stock updated: {medicine.name} - {medicine.stock_quantity}")
            
            return Response({
                'success': True,
                'medicine': self.get_serializer(medicine).data
            })
            
        except Exception as e:
            logger.error(f"[PharmacyMedicine]  Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = Medicine.objects.values_list('category', flat=True).distinct()
        return Response({
            'success': True,
            'categories': list(categories)
        })
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        threshold = int(request.query_params.get('threshold', 10))
        low_stock_medicines = Medicine.objects.filter(
            stock_quantity__lte=threshold
        ).order_by('stock_quantity')
        
        serializer = self.get_serializer(low_stock_medicines, many=True)
        
        return Response({
            'success': True,
            'count': low_stock_medicines.count(),
            'medicines': serializer.data
        })
    

@api_view(['GET'])
@permission_classes([AllowAny])
def pharmacy_dashboard(request):
    try:
        pharmacist_id = request.query_params.get('pharmacist_id')
        
        if pharmacist_id:
            try:
                pharmacist = CustomUser.objects.get(id=pharmacist_id, user_type='pharmacist')
            except CustomUser.DoesNotExist:
                return Response(
                    {'error': 'Pharmacist not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        total_medicines = Medicine.objects.count()
        low_stock_count = Medicine.objects.filter(stock_quantity__lte=10).count()
        out_of_stock_count = Medicine.objects.filter(stock_quantity=0).count()
        total_stock_value = Medicine.objects.aggregate(
            total=Sum(F('price') * F('stock_quantity'))
        )['total'] or 0
        
        total_orders = MedicineOrder.objects.count()
        pending_orders = MedicineOrder.objects.filter(order_status='pending').count()
        today_orders = MedicineOrder.objects.filter(created_at__date=today).count()
        week_orders = MedicineOrder.objects.filter(created_at__date__gte=week_ago).count()
        
        today_revenue = MedicineOrder.objects.filter(
            created_at__date=today,
            payment_status='completed'
        ).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        week_revenue = MedicineOrder.objects.filter(
            created_at__date__gte=week_ago,
            payment_status='completed'
        ).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        month_revenue = MedicineOrder.objects.filter(
            created_at__date__gte=month_ago,
            payment_status='completed'
        ).aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        
        recent_orders = MedicineOrder.objects.order_by('-created_at')[:5]
        recent_orders_data = MedicineOrderSerializer(recent_orders, many=True).data
        
        low_stock_medicines = Medicine.objects.filter(
            stock_quantity__lte=10
        ).order_by('stock_quantity')[:10]
        low_stock_data = PharmacyMedicineSerializer(low_stock_medicines, many=True).data
        
        top_medicines = Medicine.objects.order_by('-stock_quantity')[:5]
        top_medicines_data = PharmacyMedicineSerializer(top_medicines, many=True).data
        
        dashboard_data = {
            'inventory': {
                'total_medicines': total_medicines,
                'low_stock_count': low_stock_count,
                'out_of_stock_count': out_of_stock_count,
                'total_stock_value': float(total_stock_value),
            },
            'orders': {
                'total_orders': total_orders,
                'pending_orders': pending_orders,
                'today_orders': today_orders,
                'week_orders': week_orders,
            },
            'revenue': {
                'today': float(today_revenue),
                'week': float(week_revenue),
                'month': float(month_revenue),
            },
            'recent_orders': recent_orders_data,
            'low_stock_alerts': low_stock_data,
            'top_medicines': top_medicines_data,
        }
        
        return Response({
            'success': True,
            'dashboard': dashboard_data
        })
        
    except Exception as e:
        logger.error(f"[pharmacy_dashboard]  Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def pharmacy_analytics(request):
    try:
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        
        daily_sales = MedicineOrder.objects.filter(
            created_at__gte=start_date,
            payment_status='completed'
        ).extra(
            select={'day': 'date(created_at)'}
        ).values('day').annotate(
            total=Sum('total_amount'),
            count=Count('id')
        ).order_by('day')
        
        category_stats = Medicine.objects.values('category').annotate(
            total_medicines=Count('id'),
            total_stock=Sum('stock_quantity'),
            avg_price=Avg('price')
        ).order_by('-total_medicines')
        
        status_distribution = MedicineOrder.objects.filter(
            created_at__gte=start_date
        ).values('order_status').annotate(
            count=Count('id')
        )
        
        return Response({
            'success': True,
            'period_days': days,
            'analytics': {
                'daily_sales': list(daily_sales),
                'category_stats': list(category_stats),
                'status_distribution': list(status_distribution),
            }
        })
        
    except Exception as e:
        logger.error(f"[pharmacy_analytics]  Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([AllowAny])
def pharmacist_prescriptions(request):
    try:
        status_filter = request.query_params.get('status', 'active')
        
        prescriptions = EnhancedPrescription.objects.filter(
            status=status_filter
        ).select_related('patient', 'doctor').order_by('-created_at')
        
        search = request.query_params.get('search', None)
        if search:
            prescriptions = prescriptions.filter(
                Q(patient_name__icontains=search) |
                Q(patient_phone__icontains=search)
            )
        
        limit = int(request.query_params.get('limit', 20))
        prescriptions = prescriptions[:limit]
        
        from .serializers import EnhancedPrescriptionSerializer
        serializer = EnhancedPrescriptionSerializer(prescriptions, many=True)
        
        return Response({
            'success': True,
            'count': prescriptions.count(),
            'prescriptions': serializer.data
        })
        
    except Exception as e:
        logger.error(f"[pharmacist_prescriptions]  Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def fulfill_prescription(request):
    try:
        prescription_id = request.data.get('prescription_id')
        pharmacist_id = request.data.get('pharmacist_id')
        
        prescription = EnhancedPrescription.objects.get(id=prescription_id)
        pharmacist = CustomUser.objects.get(id=pharmacist_id, user_type='pharmacist')
        
        order_number = f"ORD{timezone.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:6].upper()}"
        
        order = MedicineOrder.objects.create(
            order_number=order_number,
            patient=prescription.patient,
            pharmacist=pharmacist,
            prescription=prescription,
            order_items=prescription.medications,
            subtotal=request.data.get('subtotal', 0),
            total_amount=request.data.get('total_amount', 0),
            delivery_address=request.data.get('delivery_address', ''),
            delivery_phone=prescription.patient_phone,
            order_status='confirmed',
            payment_status='pending',
            payment_method=request.data.get('payment_method', 'cash_on_delivery')
        )
        
        prescription.status = 'completed'
        prescription.save()
        
        logger.info(f"[fulfill_prescription]  Prescription fulfilled: {prescription_id}")
        
        return Response({
            'success': True,
            'order': MedicineOrderSerializer(order).data
        })
        
    except Exception as e:
        logger.error(f"[fulfill_prescription]  Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )



class PrescriptionViewSet(viewsets.ModelViewSet):
    queryset = Prescription.objects.all()
    serializer_class = PrescriptionSerializer

    def get_queryset(self):
        queryset = Prescription.objects.all()
        patient_name = self.request.query_params.get('patient_name', None)
        if patient_name:
            queryset = queryset.filter(patient_name__icontains=patient_name)
        return queryset


class EnhancedPrescriptionViewSet(viewsets.ModelViewSet):
    queryset = EnhancedPrescription.objects.all()
    serializer_class = EnhancedPrescriptionSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = EnhancedPrescription.objects.all()
        
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        
        patient_phone = self.request.query_params.get('patient_phone')
        if patient_phone:
            queryset = queryset.filter(patient_phone=patient_phone)
        
        doctor_id = self.request.query_params.get('doctor')
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        
        appointment_id = self.request.query_params.get('appointment')
        if appointment_id:
            queryset = queryset.filter(appointment_id=appointment_id)
        
        return queryset.order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        try:
            data = request.data
            logger.info(f"[Prescription] Creating prescription")
            logger.info(f"[Prescription] Received data: {data}")
            
            patient = None
            patient_phone = data.get('patient_phone')
            patient_name = data.get('patient_name')
            
            if patient_phone:
                logger.info(f"[Prescription] Looking up patient by phone: {patient_phone}")
                try:
                    patient = CustomUser.objects.get(
                        phone_number=patient_phone,
                        user_type='patient'
                    )
                    logger.info(f"[Prescription]  Found existing patient: {patient.username}")
                except CustomUser.DoesNotExist:
                    logger.info(f"[Prescription] Creating patient account for {patient_phone}")
                    username = f"patient_{patient_phone}"
                    
                    if CustomUser.objects.filter(username=username).exists():
                        patient = CustomUser.objects.get(username=username)
                        logger.info(f"[Prescription] Found patient by username: {patient.username}")
                    else:
                        patient = CustomUser.objects.create_user(
                            username=username,
                            phone_number=patient_phone,
                            first_name=patient_name.split()[0] if patient_name else 'Patient',
                            last_name=' '.join(patient_name.split()[1:]) if patient_name and len(patient_name.split()) > 1 else '',
                            user_type='patient',
                            is_verified=True,
                            password=None  
                        )
                        
                        from django.contrib.auth.models import Group
                        patient_group, _ = Group.objects.get_or_create(name='Patient')
                        patient.groups.add(patient_group)
                        
                        logger.info(f"[Prescription]  Created patient: {patient.username}")
            
            if not patient:
                logger.error("[Prescription]  Could not find or create patient")
                return Response(
                    {'error': 'Could not identify patient. Please provide patient_phone.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            doctor = None
            
            if request.user and request.user.is_authenticated and request.user.user_type == 'doctor':
                doctor = request.user
                logger.info(f"[Prescription] Using authenticated doctor: {doctor.username}")
            else:
                doctor_name = data.get('doctor_name', '')
                if doctor_name:
                    try:
                        first_name = doctor_name.replace('Dr.', '').strip().split()[0]
                        doctor = CustomUser.objects.filter(
                            user_type='doctor',
                            first_name__icontains=first_name
                        ).first()
                        if doctor:
                            logger.info(f"[Prescription] Found doctor by name: {doctor.username}")
                    except Exception as e:
                        logger.warning(f"[Prescription] Could not find doctor by name: {e}")
            
            appointment = None
            appointment_id = data.get('appointment_id')
            if appointment_id:
                try:
                    appointment = Appointment.objects.get(id=appointment_id)
                    logger.info(f"[Prescription] Found appointment: {appointment.id}")
                    
                    if not doctor and appointment.doctor:
                        if hasattr(appointment.doctor, 'user'):
                            doctor = appointment.doctor.user
                            logger.info(f"[Prescription] Using doctor from appointment: {doctor.username}")
                except Appointment.DoesNotExist:
                    logger.warning(f"[Prescription] Appointment not found: {appointment_id}")
            
            prescription = EnhancedPrescription.objects.create(
                patient=patient,
                doctor=doctor,
                appointment=appointment,
                patient_name=data.get('patient_name', patient.get_full_name()),
                patient_age=data.get('patient_age', ''),
                patient_gender=data.get('patient_gender', ''),
                patient_phone=patient_phone,
                doctor_name=data.get('doctor_name', doctor.get_full_name() if doctor else ''),
                doctor_specialization=data.get('doctor_specialization', ''),
                diagnosis=data.get('diagnosis', ''),
                medications=data.get('medications', []),
                notes=data.get('notes', ''),
                follow_up_date=data.get('follow_up_date') or None,
                date=data.get('date') or timezone.now().date(),
                status='active'
            )
            
            logger.info(f"[Prescription]  Created successfully: {prescription.id}")
            logger.info(f"[Prescription]    Patient: {prescription.patient_name}")
            logger.info(f"[Prescription]    Doctor: {prescription.doctor_name}")
            logger.info(f"[Prescription]    Diagnosis: {prescription.diagnosis}")
            logger.info(f"[Prescription]    Medications: {len(prescription.medications)}")
            
            serializer = self.get_serializer(prescription)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"[Prescription]  Error creating prescription: {str(e)}")
            logger.error(f"[Prescription] Error type: {type(e).__name__}")
            import traceback
            logger.error(f"[Prescription] Traceback: {traceback.format_exc()}")
            
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


@api_view(['POST'])
@permission_classes([AllowAny])
def create_prescription_simple(request):
    try:
        data = request.data
        logger.info(f"[Simple Prescription] Creating prescription")
        logger.info(f"[Simple Prescription] Data: {data}")
        patient_phone = data.get('patient_phone')
        patient = None
        
        if patient_phone:
            patient, created = CustomUser.objects.get_or_create(
                phone_number=patient_phone,
                user_type='patient',
                defaults={
                    'username': f"patient_{patient_phone}",
                    'first_name': data.get('patient_name', '').split()[0] if data.get('patient_name') else 'Patient',
                    'is_verified': True,
                }
            )
            if created:
                from django.contrib.auth.models import Group
                patient_group, _ = Group.objects.get_or_create(name='Patient')
                patient.groups.add(patient_group)
        doctor = request.user if request.user.is_authenticated and request.user.user_type == 'doctor' else None
        
        prescription = EnhancedPrescription.objects.create(
            patient=patient,
            doctor=doctor,
            patient_name=data.get('patient_name', ''),
            patient_age=data.get('patient_age', ''),
            patient_gender=data.get('patient_gender', ''),
            patient_phone=patient_phone,
            doctor_name=data.get('doctor_name', ''),
            doctor_specialization=data.get('doctor_specialization', ''),
            diagnosis=data.get('diagnosis', ''),
            medications=data.get('medications', []),
            notes=data.get('notes', ''),
            follow_up_date=data.get('follow_up_date') or None,
            date=data.get('date') or timezone.now().date(),
            status='active'
        )
        
        logger.info(f"[Simple Prescription]  Created: {prescription.id}")
        
        return Response({
            'success': True,
            'id': prescription.id,
            'message': 'Prescription created successfully'
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"[Simple Prescription]  Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


class MedicineOrderViewSet(viewsets.ModelViewSet):
    queryset = MedicineOrder.objects.all()
    serializer_class = MedicineOrderSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = MedicineOrder.objects.all()
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        session_id = self.request.query_params.get('session_id')
        if session_id:
            queryset = queryset.filter(session_id=session_id)
        return queryset.order_by('-created_at')

    @action(detail=True, methods=['patch'], url_path='update_status')
    def update_status(self, request, pk=None):
        try:
            order = self.get_object()
            new_status = request.data.get('order_status')

            valid_statuses = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled']
            if new_status not in valid_statuses:
                return Response(
                    {'error': f'Invalid status. Must be one of: {valid_statuses}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            order.order_status = new_status
            order.save()

            serializer = self.get_serializer(order)
            return Response({
                'success': True,
                'order': serializer.data,
                'message': f'Order status updated to {new_status}'
            })
        except Exception as e:
            logger.error(f"[MedicineOrder] Error updating status: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['patch'], url_path='update_payment_status')
    def update_payment_status(self, request, pk=None):
        try:
            order = self.get_object()
            payment_status = request.data.get('payment_status')
            payment_id = request.data.get('payment_id', '')

            valid_statuses = ['pending', 'completed', 'failed', 'refunded']
            if payment_status not in valid_statuses:
                return Response(
                    {'error': f'Invalid payment status. Must be one of: {valid_statuses}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            order.payment_status = payment_status
            if payment_id:
                order.payment_id = payment_id
            order.save()

            serializer = self.get_serializer(order)
            return Response({
                'success': True,
                'order': serializer.data,
                'message': f'Payment status updated to {payment_status}'
            })
        except Exception as e:
            logger.error(f"[MedicineOrder] Error updating payment status: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='statistics')
    def statistics(self, request):
        try:
            days = int(request.query_params.get('days', 30))
            start_date = timezone.now() - timedelta(days=days)

            total_orders = MedicineOrder.objects.count()
            pending_orders = MedicineOrder.objects.filter(order_status='pending').count()
            confirmed_orders = MedicineOrder.objects.filter(order_status='confirmed').count()
            delivered_orders = MedicineOrder.objects.filter(order_status='delivered').count()

            recent_revenue = MedicineOrder.objects.filter(
                created_at__gte=start_date,
                payment_status='completed'
            ).aggregate(total=Sum('total_amount'))['total'] or 0

            return Response({
                'success': True,
                'statistics': {
                    'total_orders': total_orders,
                    'pending_orders': pending_orders,
                    'confirmed_orders': confirmed_orders,
                    'delivered_orders': delivered_orders,
                    'recent_revenue': float(recent_revenue),
                    'period_days': days,
                }
            })
        except Exception as e:
            logger.error(f"[MedicineOrder] Error getting statistics: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([AllowAny])
def create_prescription_from_consultation(request):
    return Response({
        'success': True,
        'message': 'Prescription created'
    })

class HealthRecordViewSet(viewsets.ModelViewSet):
    queryset = HealthRecord.objects.all()
    serializer_class = HealthRecordSerializer

    def get_queryset(self):
        queryset = HealthRecord.objects.all()
        metric_type = self.request.query_params.get('metric_type', None)
        if metric_type:
            queryset = queryset.filter(metric_type=metric_type)
        return queryset


@api_view(['GET'])
@permission_classes([AllowAny])
def get_patient_health_summary(request, patient_id):
    return Response({
        'patient': {'name': 'Test Patient'},
        'summary': 'Health summary'
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def upload_health_document(request):
    return Response({
        'success': True,
        'message': 'Document uploaded'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_health_vault(request):
    return Response([])

@api_view(['POST'])
def text_to_speech(request):
    try:
        serializer = TextToSpeechSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        text = data['text']
        language = data['language']
        lang_code = GTTS_LANGUAGE_MAP.get(language, 'en')

        logger.info(f"Generating speech for language: {language} ({lang_code})")

        tts = gTTS(text=text, lang=lang_code, slow=False)
        audio_fp = io.BytesIO()
        tts.write_to_fp(audio_fp)
        audio_fp.seek(0)

        audio_base64 = base64.b64encode(audio_fp.read()).decode('utf-8')

        return Response({
            'success': True,
            'audio': audio_base64,
            'format': 'mp3',
            'language': language
        })

    except Exception as e:
        logger.error(f"Error in text-to-speech: {str(e)}")
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def test_voice(request):
    try:
        language = request.data.get('language', 'English')

        test_messages = {
            'English': 'Hello! I am your AI medical assistant.',
            'Hindi': 'नमस्ते! मैं आपका एआई चिकित्सा सहायक हूं।',
            'Kannada': 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ AI ವೈದ್ಯಕೀಯ ಸಹಾಯಕ.',
            'Tamil': 'வணக்கம்! நான் உங்கள் AI மருத்துவ உதவியாளர்.',
            'Telugu': 'నమస్కారం! నేను మీ AI వైద్య సహాయకుడిని.',
            'Malayalam': 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ AI മെഡിക്കൽ അസിസ്റ് റ്റന്റ് ആണ്.'
        }

        text = test_messages.get(language, test_messages['English'])
        lang_code = GTTS_LANGUAGE_MAP.get(language, 'en')

        tts = gTTS(text=text, lang=lang_code, slow=False)
        audio_fp = io.BytesIO()
        tts.write_to_fp(audio_fp)
        audio_fp.seek(0)

        audio_base64 = base64.b64encode(audio_fp.read()).decode('utf-8')

        return Response({
            'success': True,
            'audio': audio_base64,
            'format': 'mp3'
        })

    except Exception as e:
        logger.error(f"Error in test voice: {str(e)}")
        return Response(
            {'success': False, 'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def api_test(request):
    try:
        chatbot = get_chatbot()
        return Response({
            'status': 'ok',
            'message': 'API is working',
            'vision_providers': getattr(chatbot, 'vision_providers', []),
            'available_providers': getattr(chatbot, 'available_providers', [])
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
def health_check(request):
    try:
        chatbot = get_chatbot()
        return JsonResponse({
            'success': True,
            'status': 'healthy',
            'vision_enabled': len(getattr(chatbot, 'vision_providers', [])) > 0,
            'providers': getattr(chatbot, 'available_providers', [])
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'status': 'unhealthy',
            'error': str(e)
        }, status=503)
    

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
import secrets
import logging

from .models import (
    VideoConsultationRoom, VideoCallMessage, WebRTCSignal,
    CallConnectionLog, VideoConsultationPrescription,
    ScreenShareSession, ConsultationFollowUp, CustomUser, Appointment
)
from .serializers import (
    VideoConsultationRoomSerializer, VideoCallMessageSerializer,
    WebRTCSignalSerializer, CallConnectionLogSerializer,
    VideoConsultationPrescriptionSerializer, ScreenShareSessionSerializer,
    ConsultationFollowUpSerializer, CreateVideoRoomSerializer,
    JoinRoomSerializer, SendMessageSerializer, WebRTCOfferSerializer,
    WebRTCAnswerSerializer, ICECandidateSerializer, EndCallSerializer,
    ConnectionQualitySerializer
)

logger = logging.getLogger(__name__)
logger = logging.getLogger(__name__)


class VideoConsultationRoomViewSet(viewsets.ModelViewSet):
    queryset = VideoConsultationRoom.objects.all()
    serializer_class = VideoConsultationRoomSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def create_room(self, request):
        try:
            logger.info("="*60)
            logger.info("CREATE ROOM REQUEST")
            logger.info("="*60)
            logger.info(f"Request data: {request.data}")
            patient_id = request.data.get('patient_id')
            doctor_id = request.data.get('doctor_id')
            appointment_id = request.data.get('appointment_id')
            
            logger.info(f"Extracted IDs:")
            logger.info(f"  Patient ID: {patient_id}")
            logger.info(f"  Doctor ID: {doctor_id}")
            logger.info(f"  Appointment ID: {appointment_id}")
            logger.info("\n--- Looking up Doctor ---")
            doctor = None
            
            is_uuid = False
            try:
                uuid_obj = uuid.UUID(str(doctor_id))
                is_uuid = True
            except (ValueError, AttributeError):
                pass
            
            if is_uuid and not doctor:
                try:
                    doctor = CustomUser.objects.get(id=doctor_id, user_type='doctor')
                    logger.info(f" Found doctor via CustomUser (UUID): {doctor.username}")
                except CustomUser.DoesNotExist:
                    pass
            
            if not doctor:
                try:
                    doctor_profile = DoctorProfile.objects.get(id=doctor_id)
                    doctor = doctor_profile.user
                    logger.info(f" Found doctor via DoctorProfile: {doctor.username}")
                except DoctorProfile.DoesNotExist:
                    pass
            
            if not doctor:
                try:
                    doctor = CustomUser.objects.get(id=doctor_id, user_type='doctor')
                    logger.info(f" Found doctor via direct lookup: {doctor.username}")
                except CustomUser.DoesNotExist:
                    pass
            
            if not doctor:
                logger.error(f" Doctor not found with ID: {doctor_id}")
                return Response(
                    {'error': f'Doctor not found with ID: {doctor_id}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            logger.info("\n--- Looking up Patient ---")
            patient = None
            appointment = None
            if appointment_id:
                try:
                    appointment = Appointment.objects.get(id=appointment_id)
                    logger.info(f" Found appointment: {appointment.patient_name}")
                except Appointment.DoesNotExist:
                    logger.warning(f" Appointment not found: {appointment_id}")
            
            if patient_id:
                is_real_patient_uuid = True
                try:
                    if str(patient_id).startswith('appointment_'):
                        is_real_patient_uuid = False
                        logger.info(f" Patient ID is fallback placeholder: {patient_id}")
                    else:
                        uuid_obj = uuid.UUID(str(patient_id))
                        logger.info(f"Patient ID is valid UUID: {patient_id}")
                except (ValueError, AttributeError):
                    is_real_patient_uuid = False
                    logger.warning(f" Patient ID is not a valid UUID: {patient_id}")
                
                if is_real_patient_uuid:
                    try:
                        patient = CustomUser.objects.get(id=patient_id, user_type='patient')
                        logger.info(f" Found patient via patient_id: {patient.username}")
                    except CustomUser.DoesNotExist:
                        logger.warning(f" Patient not found with ID: {patient_id}")
            
            if not patient and appointment:
                if hasattr(appointment, 'patient') and appointment.patient:
                    patient = appointment.patient
                    logger.info(f" Found patient from appointment.patient: {patient.username}")
            
            if not patient and appointment:
                logger.info(f" No patient found, trying phone lookup")
                logger.info(f"   Patient phone: {appointment.patient_phone}")
                
                try:
                    patient = CustomUser.objects.filter(
                        phone_number=appointment.patient_phone,
                        user_type='patient'
                    ).first()
                    
                    if patient:
                        logger.info(f" Found patient via phone lookup: {patient.username}")
                    else:
                        logger.warning(f" No patient found with phone: {appointment.patient_phone}")
                except Exception as e:
                    logger.error(f" Error during phone lookup: {e}")
            
            if not patient and appointment:
                logger.warning(" Creating temporary patient account for consultation")
                
                try:
                    username = f"patient_{appointment.patient_phone}"
                    patient = CustomUser.objects.filter(username=username).first()
                    
                    if not patient:
                        patient = CustomUser.objects.create_user(
                            username=username,
                            phone_number=appointment.patient_phone,
                            first_name=appointment.patient_name.split()[0] if appointment.patient_name else 'Patient',
                            last_name=' '.join(appointment.patient_name.split()[1:]) if len(appointment.patient_name.split()) > 1 else '',
                            user_type='patient',
                            is_verified=True,
                            password=None
                        )
                        
                        from django.contrib.auth.models import Group
                        patient_group, _ = Group.objects.get_or_create(name='Patient')
                        patient.groups.add(patient_group)
                        
                        logger.info(f" Created temporary patient account: {patient.username}")
                        
                        if hasattr(appointment, 'patient'):
                            appointment.patient = patient
                            appointment.save()
                            logger.info(f" Updated appointment with patient reference")
                    else:
                        logger.info(f" Found existing patient account: {patient.username}")
                        
                except Exception as e:
                    logger.error(f" Error creating patient account: {e}")
            
            if not patient:
                return Response(
                    {
                        'error': 'Could not find or create patient account',
                        'details': 'Please ensure the patient has registered or provide valid patient_id',
                        'appointment_phone': appointment.patient_phone if appointment else None
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            logger.info("\n--- Checking for existing room ---")
            room = None
            
            if appointment_id:
                try:
                    existing_rooms = VideoConsultationRoom.objects.filter(
                        appointment_id=appointment_id,
                        status__in=['scheduled', 'waiting', 'ongoing']
                    )
                    
                    if existing_rooms.exists():
                        room = existing_rooms.first()
                        logger.info(f" Found existing room: {room.room_id}")
                except Exception as e:
                    logger.warning(f" Error checking for existing room: {e}")
            if not room:
                logger.info("\n--- Creating new room ---")
                
                room_id = f"room_{secrets.token_urlsafe(16)}"
                scheduled_time = request.data.get('scheduled_time') or timezone.now()
                
                logger.info(f"Patient: {patient.username} (ID: {patient.id})")
                logger.info(f"Doctor: {doctor.username} (ID: {doctor.id})")
                logger.info(f"Room ID: {room_id}")
                
                try:
                    room = VideoConsultationRoom.objects.create(
                        room_id=room_id,
                        patient=patient,
                        doctor=doctor,
                        appointment=appointment,
                        scheduled_time=scheduled_time,
                        chat_enabled=request.data.get('chat_enabled', True),
                        screen_share_enabled=request.data.get('screen_share_enabled', True),
                        recording_enabled=request.data.get('recording_enabled', False),
                        status='scheduled'
                    )
                    
                    logger.info("\n" + "="*60)
                    logger.info(" VIDEO ROOM CREATED SUCCESSFULLY")
                    logger.info("="*60)
                    logger.info(f"Room ID: {room.room_id}")
                    logger.info(f"Patient: {room.patient.username} (ID: {room.patient.id})")
                    logger.info(f"Doctor: {room.doctor.username} (ID: {room.doctor.id})")
                    logger.info(f"Status: {room.status}")
                    logger.info("="*60 + "\n")
                    
                except Exception as e:
                    logger.error(f"\n ERROR CREATING ROOM")
                    logger.error(f"Error: {str(e)}", exc_info=True)
                    return Response(
                        {'error': f'Error creating room: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            else:
                logger.info(f" Using existing room: {room.room_id}")
            
            serializer = VideoConsultationRoomSerializer(room, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"\n UNEXPECTED ERROR IN CREATE_ROOM")
            logger.error(f"Error: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Unexpected error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            logger.info("\n--- Looking up Doctor ---")
            doctor = None
            
            is_uuid = False
            try:
                uuid_obj = uuid.UUID(str(doctor_id))
                is_uuid = True
                logger.info(f"Doctor ID is a UUID: {doctor_id}")
            except (ValueError, AttributeError):
                logger.info(f"Doctor ID is NOT a UUID (probably integer): {doctor_id}")
            
            if is_uuid and not doctor:
                try:
                    doctor = CustomUser.objects.get(id=doctor_id, user_type='doctor')
                    logger.info(f" Found doctor via CustomUser (UUID):")
                    logger.info(f"   Username: {doctor.username}")
                    logger.info(f"   User ID: {doctor.id}")
                except CustomUser.DoesNotExist:
                    logger.warning(f" CustomUser with UUID {doctor_id} not found")
                except Exception as e:
                    logger.warning(f" Error searching CustomUser: {str(e)}")
            
            if not doctor:
                try:
                    logger.info(f"Trying DoctorProfile lookup with ID: {doctor_id}")
                    doctor_profile = DoctorProfile.objects.get(id=doctor_id)
                    doctor = doctor_profile.user
                    logger.info(f" Found doctor via DoctorProfile:")
                    logger.info(f"   Profile ID: {doctor_profile.id} (type: {type(doctor_profile.id).__name__})")
                    logger.info(f"   Username: {doctor.username}")
                    logger.info(f"   User ID: {doctor.id} (type: {type(doctor.id).__name__})")
                    logger.info(f"   Specialization: {doctor_profile.specialization}")
                except DoctorProfile.DoesNotExist:
                    logger.warning(f" DoctorProfile with ID {doctor_id} not found")
                except ValueError as e:
                    logger.warning(f" ValueError in DoctorProfile lookup: {str(e)}")
                except Exception as e:
                    logger.warning(f" Error searching DoctorProfile: {str(e)}")
            
            if not doctor:
                try:
                    logger.info(f"Trying direct CustomUser lookup")
                    doctor = CustomUser.objects.get(id=doctor_id, user_type='doctor')
                    logger.info(f" Found doctor via direct CustomUser lookup:")
                    logger.info(f"   Username: {doctor.username}")
                    logger.info(f"   User ID: {doctor.id}")
                except CustomUser.DoesNotExist:
                    logger.warning(f" Direct CustomUser lookup failed")
                except Exception as e:
                    logger.warning(f" Error in direct lookup: {str(e)}")
            
            if not doctor:
                logger.error(f" FAILED TO FIND DOCTOR")
                logger.error(f"   Tried ID: {doctor_id}")
                logger.error(f"   Tried UUID lookup: {is_uuid}")
                logger.error(f"   Tried DoctorProfile lookup: Yes")
                logger.error(f"   Tried CustomUser lookup: Yes")
                
                return Response(
                    {
                        'error': f'Doctor not found with ID: {doctor_id}',
                        'details': 'Tried CustomUser and DoctorProfile lookups',
                        'id_type': 'UUID' if is_uuid else 'Integer/Other'
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
            appointment = None
            if appointment_id:
                logger.info(f"\n--- Looking up Appointment ---")
                try:
                    appointment = Appointment.objects.get(id=appointment_id)
                    logger.info(f" Found appointment: {appointment.id}")
                    logger.info(f"   Patient: {appointment.patient_name}")
                    logger.info(f"   Date: {appointment.preferred_date}")
                    
                    if appointment.doctor and hasattr(appointment.doctor, 'user'):
                        appointment_doctor = appointment.doctor.user
                        if appointment_doctor.id != doctor.id:
                            logger.info(f" Updating doctor from appointment")
                            logger.info(f"   Old: {doctor.username} ({doctor.id})")
                            logger.info(f"   New: {appointment_doctor.username} ({appointment_doctor.id})")
                            doctor = appointment_doctor
                        
                except Appointment.DoesNotExist:
                    logger.warning(f" Appointment not found: {appointment_id}")
                except Exception as e:
                    logger.warning(f" Error loading appointment: {str(e)}")

            logger.info("\n--- Creating Video Room ---")
            try:
                room_id = f"room_{secrets.token_urlsafe(16)}"
                logger.info(f"Generated room_id: {room_id}")

                scheduled_time = request.data.get('scheduled_time')
                if not scheduled_time:
                    scheduled_time = timezone.now()
                    logger.info(f"Using current time: {scheduled_time}")
                else:
                    logger.info(f"Using provided time: {scheduled_time}")
                
                logger.info(f"Pre-creation validation:")
                logger.info(f"  Patient: {patient.username} (ID: {patient.id}, Type: {type(patient.id).__name__})")
                logger.info(f"  Doctor: {doctor.username} (ID: {doctor.id}, Type: {type(doctor.id).__name__})")
                
                room = VideoConsultationRoom.objects.create(
                    room_id=room_id,
                    patient=patient,
                    doctor=doctor,
                    appointment=appointment,
                    scheduled_time=scheduled_time,
                    chat_enabled=request.data.get('chat_enabled', True),
                    screen_share_enabled=request.data.get('screen_share_enabled', True),
                    recording_enabled=request.data.get('recording_enabled', False),
                    status='scheduled'
                )
                
                logger.info("\n" + "="*60)
                logger.info(" VIDEO ROOM CREATED SUCCESSFULLY")
                logger.info("="*60)
                logger.info(f"Room ID: {room.room_id}")
                logger.info(f"Patient: {room.patient.username} (ID: {room.patient.id})")
                logger.info(f"Doctor: {room.doctor.username} (ID: {room.doctor.id})")
                logger.info(f"Status: {room.status}")
                logger.info(f"Scheduled: {room.scheduled_time}")
                logger.info("="*60 + "\n")

                serializer = VideoConsultationRoomSerializer(room, context={'request': request})
                return Response(serializer.data, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                logger.error(f"\n ERROR CREATING ROOM OBJECT")
                logger.error(f"Error type: {type(e).__name__}")
                logger.error(f"Error message: {str(e)}")
                logger.error(f"Full error:", exc_info=True)
                
                return Response(
                    {'error': f'Error creating room: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        except Exception as e:
            logger.error(f"\n UNEXPECTED ERROR IN CREATE_ROOM")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error message: {str(e)}")
            logger.error(f"Full error:", exc_info=True)
            
            return Response(
                {'error': f'Unexpected error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def join_room(self, request):
        try:
            room_id = request.data.get('room_id')
            user_id = request.data.get('user_id')

            if not room_id or not user_id:
                return Response(
                    {'error': 'room_id and user_id are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                room = VideoConsultationRoom.objects.get(room_id=room_id)
                user = CustomUser.objects.get(id=user_id)
            except VideoConsultationRoom.DoesNotExist:
                return Response(
                    {'error': 'Room not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            except CustomUser.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if user.id not in [room.patient.id, room.doctor.id]:
                return Response(
                    {'error': 'Unauthorized to join this room'},
                    status=status.HTTP_403_FORBIDDEN
                )

            now = timezone.now()
            
            if user.id == room.patient.id:
                room.patient_joined_at = now
                if room.status == 'scheduled':
                    room.status = 'waiting'
            elif user.id == room.doctor.id:
                room.doctor_joined_at = now
                if room.status in ['scheduled', 'waiting']:
                    room.status = 'ongoing'
                    if not room.started_at:
                        room.started_at = now

            room.save()

            CallConnectionLog.objects.create(
                room=room,
                user=user,
                event_type='joined',
                event_data={'joined_at': now.isoformat()}
            )

            serializer = VideoConsultationRoomSerializer(room, context={'request': request})
            return Response({
                'success': True,
                'room': serializer.data,
                'message': f'{user.get_full_name()} joined the room'
            })

        except Exception as e:
            logger.error(f"Error joining room: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def leave_room(self, request):
        try:
            room_id = request.data.get('room_id')
            user_id = request.data.get('user_id')

            if not room_id or not user_id:
                return Response(
                    {'error': 'room_id and user_id are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            room = VideoConsultationRoom.objects.get(room_id=room_id)
            user = CustomUser.objects.get(id=user_id)

            CallConnectionLog.objects.create(
                room=room,
                user=user,
                event_type='left',
                event_data={'left_at': timezone.now().isoformat()}
            )

            return Response({
                'success': True,
                'message': f'{user.get_full_name()} left the room'
            })

        except Exception as e:
            logger.error(f"Error leaving room: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def end_call(self, request):
        try:
            room_id = request.data.get('room_id')
            user_id = request.data.get('user_id')
            duration = request.data.get('duration')
            doctor_notes = request.data.get('doctor_notes', '')
            rating = request.data.get('rating')

            if not room_id or not user_id:
                return Response(
                    {'error': 'room_id and user_id are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            room = VideoConsultationRoom.objects.get(room_id=room_id)
            user = CustomUser.objects.get(id=user_id)

            now = timezone.now()
            room.ended_at = now
            room.status = 'completed'
            if duration:
                room.duration = duration
            elif room.started_at:
                room.duration = int((now - room.started_at).total_seconds())
            
            if doctor_notes:
                room.doctor_notes = doctor_notes
            if rating:
                room.rating = rating
            
            room.save()
            CallConnectionLog.objects.create(
                room=room,
                user=user,
                event_type='left',
                event_data={
                    'ended_at': now.isoformat(),
                    'duration': room.duration
                }
            )

            serializer = VideoConsultationRoomSerializer(room, context={'request': request})
            return Response({
                'success': True,
                'room': serializer.data,
                'message': 'Consultation ended successfully'
            })

        except Exception as e:
            logger.error(f"Error ending call: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def get_doctor_rooms(self, request, doctor_id=None):
        try:
            if not doctor_id:
                doctor_id = request.query_params.get('doctor_id')
            
            if not doctor_id:
                return Response(
                    {'error': 'doctor_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            rooms = VideoConsultationRoom.objects.filter(doctor_id=doctor_id).order_by('-scheduled_time')
            serializer = VideoConsultationRoomSerializer(rooms, many=True, context={'request': request})
            
            return Response({
                'success': True,
                'rooms': serializer.data
            })

        except Exception as e:
            logger.error(f"Error getting doctor rooms: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def get_patient_rooms(self, request, patient_id=None):
        try:
            if not patient_id:
                patient_id = request.query_params.get('patient_id')
            
            if not patient_id:
                return Response(
                    {'error': 'patient_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            rooms = VideoConsultationRoom.objects.filter(patient_id=patient_id).order_by('-scheduled_time')
            serializer = VideoConsultationRoomSerializer(rooms, many=True, context={'request': request})
            
            return Response({
                'success': True,
                'rooms': serializer.data
            })

        except Exception as e:
            logger.error(f"Error getting patient rooms: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
@permission_classes([AllowAny])  
def send_webrtc_offer(request):
    serializer = WebRTCOfferSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        room = VideoConsultationRoom.objects.get(room_id=data['room_id'])
        sender = CustomUser.objects.get(id=data['sender_id'])
        receiver = CustomUser.objects.get(id=data['receiver_id'])
    except (VideoConsultationRoom.DoesNotExist, CustomUser.DoesNotExist):
        return Response(
            {'error': 'Room or User not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    signal = WebRTCSignal.objects.create(
        room=room,
        sender=sender,
        receiver=receiver,
        signal_type='offer',
        signal_data=data['sdp']
    )

    logger.info(f"WebRTC offer sent from {sender.username} to {receiver.username}")

    return Response({
        'success': True,
        'signal_id': str(signal.id),
        'message': 'Offer sent successfully'
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def send_webrtc_answer(request):
    serializer = WebRTCAnswerSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        room = VideoConsultationRoom.objects.get(room_id=data['room_id'])
        sender = CustomUser.objects.get(id=data['sender_id'])
        receiver = CustomUser.objects.get(id=data['receiver_id'])
    except (VideoConsultationRoom.DoesNotExist, CustomUser.DoesNotExist):
        return Response(
            {'error': 'Room or User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    signal = WebRTCSignal.objects.create(
        room=room,
        sender=sender,
        receiver=receiver,
        signal_type='answer',
        signal_data=data['sdp']
    )

    logger.info(f"WebRTC answer sent from {sender.username} to {receiver.username}")

    return Response({
        'success': True,
        'signal_id': str(signal.id),
        'message': 'Answer sent successfully'
    })


@api_view(['POST'])
@permission_classes([AllowAny]) 
def send_ice_candidate(request):
    serializer = ICECandidateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        room = VideoConsultationRoom.objects.get(room_id=data['room_id'])
        sender = CustomUser.objects.get(id=data['sender_id'])
        receiver = CustomUser.objects.get(id=data['receiver_id'])
    except (VideoConsultationRoom.DoesNotExist, CustomUser.DoesNotExist):
        return Response(
            {'error': 'Room or User not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    signal = WebRTCSignal.objects.create(
        room=room,
        sender=sender,
        receiver=receiver,
        signal_type='ice_candidate',
        signal_data=data['candidate']
    )

    return Response({
        'success': True,
        'signal_id': str(signal.id),
        'message': 'ICE candidate sent successfully'
    })


@api_view(['GET'])
@permission_classes([AllowAny]) 
def get_pending_signals(request):
    room_id = request.query_params.get('room_id')
    user_id = request.query_params.get('user_id')

    if not room_id or not user_id:
        return Response(
            {'error': 'room_id and user_id are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        room = VideoConsultationRoom.objects.get(room_id=room_id)
        user = CustomUser.objects.get(id=user_id)
    except (VideoConsultationRoom.DoesNotExist, CustomUser.DoesNotExist):
        return Response(
            {'error': 'Room or User not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    signals = WebRTCSignal.objects.filter(
        room=room,
        receiver=user,
        is_processed=False
    ).order_by('created_at')

    signals.update(is_processed=True)

    serializer = WebRTCSignalSerializer(signals, many=True)
    return Response({
        'success': True,
        'signals': serializer.data
    })

class VideoCallMessageViewSet(viewsets.ModelViewSet):
    queryset = VideoCallMessage.objects.all()
    serializer_class = VideoCallMessageSerializer
    permission_classes = [AllowAny] 

    def get_queryset(self):
        queryset = VideoCallMessage.objects.all()
        room_id = self.request.query_params.get('room_id')
        
        if room_id:
            try:
                room = VideoConsultationRoom.objects.get(room_id=room_id)
                queryset = queryset.filter(room=room)
            except VideoConsultationRoom.DoesNotExist:
                return VideoCallMessage.objects.none()
        
        return queryset.order_by('created_at')

    @action(detail=False, methods=['post'])
    def send_message(self, request):
        serializer = SendMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        try:
            room = VideoConsultationRoom.objects.get(room_id=data['room_id'])
            sender = CustomUser.objects.get(id=data['sender_id'])
        except (VideoConsultationRoom.DoesNotExist, CustomUser.DoesNotExist):
            return Response(
                {'error': 'Room or Sender not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        message = VideoCallMessage.objects.create(
            room=room,
            sender=sender,
            message_type=data['message_type'],
            content=data['content'],
            file_url=data.get('file_url', ''),
            file_name=data.get('file_name', ''),
            file_size=data.get('file_size')
        )

        return Response(
            VideoCallMessageSerializer(message).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        message = self.get_object()
        message.is_read = True
        message.read_at = timezone.now()
        message.save()

        return Response({
            'success': True,
            'message': 'Message marked as read'
        })


@api_view(['POST'])
@permission_classes([AllowAny]) 
def update_connection_quality(request):
    serializer = ConnectionQualitySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        room = VideoConsultationRoom.objects.get(room_id=data['room_id'])
        user = CustomUser.objects.get(id=data['user_id'])
    except (VideoConsultationRoom.DoesNotExist, CustomUser.DoesNotExist):
        return Response(
            {'error': 'Room or User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    if user.id == room.patient.id:
        room.patient_connection_quality = data['quality']
    elif user.id == room.doctor.id:
        room.doctor_connection_quality = data['quality']
    room.save()
    CallConnectionLog.objects.create(
        room=room,
        user=user,
        event_type='quality_change',
        event_data={'quality': data['quality']},
        bandwidth=data.get('bandwidth'),
        latency=data.get('latency'),
        packet_loss=data.get('packet_loss')
    )

    return Response({
        'success': True,
        'message': 'Connection quality updated'
    })

@api_view(['POST'])
@permission_classes([AllowAny])  
def start_screen_share(request):
    room_id = request.data.get('room_id')
    user_id = request.data.get('user_id')

    if not room_id or not user_id:
        return Response(
            {'error': 'room_id and user_id are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        room = VideoConsultationRoom.objects.get(room_id=room_id)
        user = CustomUser.objects.get(id=user_id)
    except (VideoConsultationRoom.DoesNotExist, CustomUser.DoesNotExist):
        return Response(
            {'error': 'Room or User not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if not room.screen_share_enabled:
        return Response(
            {'error': 'Screen sharing is not enabled for this room'},
            status=status.HTTP_403_FORBIDDEN
        )
    session = ScreenShareSession.objects.create(
        room=room,
        shared_by=user
    )
    return Response({
        'success': True,
        'session_id': str(session.id),
        'message': 'Screen sharing started'
    })


@api_view(['POST'])
@permission_classes([AllowAny]) 
def stop_screen_share(request):
    session_id = request.data.get('session_id')

    if not session_id:
        return Response(
            {'error': 'session_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        session = ScreenShareSession.objects.get(id=session_id)
    except ScreenShareSession.DoesNotExist:
        return Response(
            {'error': 'Session not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    now = timezone.now()
    session.ended_at = now
    session.duration = int((now - session.started_at).total_seconds())
    session.save()

    return Response({
        'success': True,
        'duration': session.duration,
        'message': 'Screen sharing stopped'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_active_consultations(request):
    user_id = request.query_params.get('user_id')

    if not user_id:
        return Response(
            {'error': 'user_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    active_rooms = VideoConsultationRoom.objects.filter(
        Q(patient_id=user_id) | Q(doctor_id=user_id),
        status__in=['waiting', 'ongoing']
    ).order_by('-scheduled_time')

    serializer = VideoConsultationRoomSerializer(active_rooms, many=True, context={'request': request})
    return Response({
        'success': True,
        'consultations': serializer.data
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_consultation_history(request):
    user_id = request.query_params.get('user_id')
    limit = int(request.query_params.get('limit', 20))

    if not user_id:
        return Response(
            {'error': 'user_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    history = VideoConsultationRoom.objects.filter(
        Q(patient_id=user_id) | Q(doctor_id=user_id),
        status='completed'
    ).order_by('-ended_at')[:limit]

    serializer = VideoConsultationRoomSerializer(history, many=True, context={'request': request})
    return Response({
        'success': True,
        'history': serializer.data
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_room_details(request):
    room_id = request.query_params.get('room_id')

    if not room_id:
        return Response(
            {'error': 'room_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        room = VideoConsultationRoom.objects.get(room_id=room_id)
    except VideoConsultationRoom.DoesNotExist:
        return Response(
            {'error': 'Room not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    messages = VideoCallMessage.objects.filter(room=room).order_by('created_at')
    logs = CallConnectionLog.objects.filter(room=room).order_by('-created_at')[:10]

    return Response({
        'success': True,
        'room': VideoConsultationRoomSerializer(room, context={'request': request}).data,
        'messages': VideoCallMessageSerializer(messages, many=True).data,
        'connection_logs': CallConnectionLogSerializer(logs, many=True).data
    })


class HealthMetricViewSet(viewsets.ModelViewSet):
    queryset = HealthMetric.objects.all()
    serializer_class = HealthMetricSerializer
    permission_classes = [AllowAny]  
    
    def get_queryset(self):
        queryset = HealthMetric.objects.all()
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        metric_type = self.request.query_params.get('metric_type')
        if metric_type:
            queryset = queryset.filter(metric_type=metric_type)
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(recorded_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(recorded_at__lte=end_date)
        alert_level = self.request.query_params.get('alert_level')
        if alert_level:
            queryset = queryset.filter(alert_level=alert_level)
        
        return queryset.select_related('patient').order_by('-recorded_at')
    
    def create(self, request, *args, **kwargs):
        try:
            patient_id = request.data.get('patient_id') or (request.user.id if request.user.is_authenticated else None)
            
            if not patient_id:
                return Response(
                    {'error': 'Patient ID is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                patient = CustomUser.objects.get(id=patient_id, user_type='patient')
            except CustomUser.DoesNotExist:
                return Response(
                    {'error': 'Patient not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            metric = HealthMetric.objects.create(
                patient=patient,
                metric_type=request.data.get('metric_type'),
                value=request.data.get('value'),
                unit=request.data.get('unit', ''),
                notes=request.data.get('notes', ''),
                recorded_at=request.data.get('recorded_at') or timezone.now(),
                recorded_by=request.user if request.user.is_authenticated else None
            )
            
            serializer = self.get_serializer(metric)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating health metric: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        patient_id = request.query_params.get('patient')
        
        if not patient_id:
            return Response(
                {'error': 'patient parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        metric_types = [
            'blood_pressure', 'heart_rate', 'weight', 'temperature',
            'blood_sugar', 'oxygen_saturation', 'bmi'
        ]
        
        latest_metrics = {}
        for metric_type in metric_types:
            metric = HealthMetric.objects.filter(
                patient_id=patient_id,
                metric_type=metric_type
            ).order_by('-recorded_at').first()
            
            if metric:
                latest_metrics[metric_type] = HealthMetricSerializer(metric).data
        
        return Response({
            'success': True,
            'latest_metrics': latest_metrics
        })
    
    @action(detail=False, methods=['get'])
    def trends(self, request):
        patient_id = request.query_params.get('patient')
        metric_type = request.query_params.get('metric_type')
        period = request.query_params.get('period', '30') 
        
        if not patient_id or not metric_type:
            return Response(
                {'error': 'patient and metric_type parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        start_date = timezone.now() - timedelta(days=int(period))
        metrics = HealthMetric.objects.filter(
            patient_id=patient_id,
            metric_type=metric_type,
            recorded_at__gte=start_date
        ).order_by('recorded_at')
        
        data_points = []
        for metric in metrics:
            data_points.append({
                'date': metric.recorded_at.strftime('%Y-%m-%d'),
                'value': str(metric.numeric_value) if metric.numeric_value else metric.value,
                'is_abnormal': metric.is_abnormal
            })
        
        avg_value = metrics.aggregate(Avg('numeric_value'))['numeric_value__avg'] or 0
        
        return Response({
            'success': True,
            'metric_type': metric_type,
            'period_days': period,
            'data_points': data_points,
            'average': round(avg_value, 2),
            'count': metrics.count()
        })
    
class PatientsViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.filter(user_type='patient')
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by('-created_at')
    
    def retrieve(self, request, pk=None):
        try:
            logger.info(f"[PatientsViewSet] Retrieving patient with pk: {pk}")
            
            try:
                patient = CustomUser.objects.get(id=pk, user_type='patient')
                logger.info(f"[PatientsViewSet] Found patient: {patient.username}")
            except CustomUser.DoesNotExist:
                return Response(
                    {'error': f'Patient not found with ID: {pk}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            patient.refresh_from_db()
            serializer = self.get_serializer(patient)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"[PatientsViewSet] Error: {str(e)}")
            import traceback
            logger.error(f"[PatientsViewSet] Traceback: {traceback.format_exc()}")
            return Response(
                {'error': f'Error retrieving patient: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def update(self, request, pk=None):
        try:
            logger.info(f"[PatientsViewSet] Updating patient with pk: {pk}")
            logger.info(f"[PatientsViewSet] Request data: {request.data}")
            
            try:
                patient = CustomUser.objects.get(id=pk, user_type='patient')
                logger.info(f"[PatientsViewSet] Found patient: {patient.username}")
            except CustomUser.DoesNotExist:
                return Response(
                    {'error': f'Patient not found with ID: {pk}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            allowed_fields = [
                'first_name', 'last_name', 'email',
                'date_of_birth', 'gender', 'blood_group',
                'address', 'city', 'state', 'pincode',
                'emergency_contact_name', 'emergency_contact_number',
                'height', 'weight',
                'allergies', 'chronic_conditions', 
                'current_medications', 'medical_history'
            ]
            
            updated_fields = []
            for field in allowed_fields:
                if field in request.data:
                    value = request.data[field]
                    
                    if field == 'date_of_birth':
                        if value == '' or value is None:
                            value = None
                            
                    elif field in ['height', 'weight']:
                        if value == '' or value is None:
                            value = None
                        else:
                            try:
                                value = float(value)
                            except (ValueError, TypeError):
                                value = None
                    
                    elif isinstance(value, str) or value is None:
                        if value is None:
                            value = ''
                    
                    current_value = getattr(patient, field)
                    if current_value != value:
                        setattr(patient, field, value)
                        updated_fields.append(field)
                        logger.info(f"[PatientsViewSet] Updated {field}: {current_value} -> {value}")
            
            if updated_fields:
                patient.save(update_fields=updated_fields)
                logger.info(f"[PatientsViewSet]  Saved {len(updated_fields)} fields: {updated_fields}")
            else:
                logger.info(f"[PatientsViewSet] No fields to update")
            
            patient.refresh_from_db()
            
            serializer = self.get_serializer(patient)
            return Response(serializer.data)
                
        except Exception as e:
            logger.error(f"[PatientsViewSet] Update error: {str(e)}")
            import traceback
            logger.error(f"[PatientsViewSet] Traceback: {traceback.format_exc()}")
            
            return Response(
                {'error': f'Error updating patient: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def partial_update(self, request, pk=None):
        return self.update(request, pk)
    
    @action(detail=True, methods=['post'])
    def upload_profile_picture(self, request, pk=None):
        try:
            logger.info(f"[PatientsViewSet] Uploading profile picture for patient: {pk}")
            
            try:
                patient = CustomUser.objects.get(id=pk, user_type='patient')
            except CustomUser.DoesNotExist:
                return Response(
                    {'error': f'Patient not found with ID: {pk}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            if 'profile_picture' not in request.FILES:
                return Response(
                    {'error': 'No profile picture file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            profile_picture = request.FILES['profile_picture']
            
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
            if profile_picture.content_type not in allowed_types:
                return Response(
                    {'error': 'Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if profile_picture.size > 5 * 1024 * 1024:
                return Response(
                    {'error': 'File too large. Maximum size is 5MB.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if patient.profile_picture:
                try:
                    import os
                    old_path = patient.profile_picture.path
                    if os.path.exists(old_path):
                        os.remove(old_path)
                        logger.info(f"[PatientsViewSet] Deleted old profile picture")
                except Exception as e:
                    logger.warning(f"[PatientsViewSet] Could not delete old picture: {e}")
            
            patient.profile_picture = profile_picture
            patient.save(update_fields=['profile_picture'])
            
            patient.refresh_from_db()
            
            logger.info(f"[PatientsViewSet]  Profile picture uploaded successfully")
            
            serializer = self.get_serializer(patient)
            return Response({
                'success': True,
                'message': 'Profile picture uploaded successfully',
                'profile_picture_url': patient.profile_picture.url if patient.profile_picture else None,
                'user': serializer.data
            })
            
        except Exception as e:
            logger.error(f"[PatientsViewSet] Upload error: {str(e)}")
            import traceback
            logger.error(f"[PatientsViewSet] Traceback: {traceback.format_exc()}")
            
            return Response(
                {'error': f'Error uploading profile picture: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class HealthGoalViewSet(viewsets.ModelViewSet):
    queryset = HealthGoal.objects.all()
    serializer_class = HealthGoalSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = HealthGoal.objects.all()
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        goal_type = self.request.query_params.get('goal_type')
        if goal_type:
            queryset = queryset.filter(goal_type=goal_type)
        
        return queryset.select_related('patient').order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        goal = self.get_object()
        current_value = request.data.get('current_value')
        
        if current_value is not None:
            goal.current_value = current_value
            goal.update_progress()
            
            return Response({
                'success': True,
                'goal': HealthGoalSerializer(goal).data
            })
        
        return Response(
            {'error': 'current_value is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

class HealthActivityViewSet(viewsets.ModelViewSet):
    queryset = HealthActivity.objects.all()
    serializer_class = HealthActivitySerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = HealthActivity.objects.all()
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(activity_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(activity_date__lte=end_date)
        
        return queryset.select_related('patient').order_by('-activity_date', '-activity_time')




class MedicationReminderViewSet(viewsets.ModelViewSet):
    serializer_class = MedicationReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        LOG_INTAKE_ACTIONS = {'log_intake', 'log_intake_underscore'}
        if self.action in LOG_INTAKE_ACTIONS:
            return MedicationReminder.objects.filter(patient=self.request.user)
        return MedicationReminder.objects.filter(
            patient=self.request.user,
            is_active=True,
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user)

    def _do_log_intake(self, request, pk=None):
        reminder = self.get_object()

        intake_status   = request.data.get('status', 'taken')
        taken_at        = request.data.get('taken_at') or timezone.now().isoformat()
        scheduled_time  = request.data.get('scheduled_time') or timezone.now().isoformat()
        notes           = request.data.get('notes', '')

        scheduled_dt = parse_datetime(scheduled_time) if isinstance(scheduled_time, str) else scheduled_time
        taken_at_dt  = (parse_datetime(taken_at) if isinstance(taken_at, str) else taken_at) if intake_status == 'taken' else None

        log = MedicationLog.objects.create(
            reminder=reminder,
            patient=reminder.patient,
            status=intake_status,
            scheduled_time=scheduled_dt or timezone.now(),
            taken_at=taken_at_dt,
            notes=notes,
        )

        self._auto_cleanup_if_complete(reminder)

        return Response(
            {'success': True, 'log_id': str(log.id), 'status': intake_status},
            status=status.HTTP_201_CREATED,
        )
    @action(detail=True, methods=['post'], url_path='log-intake', url_name='log-intake')
    def log_intake(self, request, pk=None):
        return self._do_log_intake(request, pk)
    @action(detail=True, methods=['post'], url_path='log_intake', url_name='log-intake-underscore')
    def log_intake_underscore(self, request, pk=None):
        return self._do_log_intake(request, pk)

    @action(detail=False, methods=['post'], url_path='cleanup-completed')
    def cleanup_completed(self, request):
        today = timezone.now().date()
        expired = MedicationReminder.objects.filter(
            patient=request.user, end_date__lt=today, is_active=True
        )
        count = expired.count()
        expired.update(is_active=False)
        return Response({'success': True, 'cleaned': count})

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            instance.is_active = False
            instance.save(update_fields=['is_active'])
            return Response(
                {'success': True, 'message': 'Reminder deleted successfully.'},
                status=status.HTTP_200_OK,
            )
        except MedicationReminder.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Reminder not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

    def _auto_cleanup_if_complete(self, reminder):
        today = timezone.now().date()
        if reminder.end_date and reminder.end_date < today:
            reminder.is_active = False
            reminder.save(update_fields=['is_active'])

@api_view(['POST'])
@permission_classes([AllowAny])
def sync_medication_logs(request):
    raw = request.data
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = [raw]
    else:
        return Response(
            {'success': False, 'error': 'Payload must be a JSON object or array.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    synced = 0
    errors = []

    for item in items:
        reminder_id    = item.get('reminder_id')   or item.get('reminderId')
        intake_status  = item.get('status', 'taken')
        scheduled_time = item.get('scheduled_time') or item.get('scheduledTime')
        taken_at       = item.get('taken_at')       or item.get('takenAt')
        notes          = item.get('notes', '')

        if not reminder_id:
            errors.append({'error': 'Missing reminder_id', 'item': item})
            continue

        try:
            reminder = MedicationReminder.objects.get(id=reminder_id)
        except MedicationReminder.DoesNotExist:
            errors.append({'reminder_id': reminder_id, 'error': 'Reminder not found'})
            continue

        try:
            scheduled_dt = parse_datetime(scheduled_time) if scheduled_time else timezone.now()
            taken_at_dt  = None
            if intake_status == 'taken':
                taken_at_dt = parse_datetime(taken_at) if taken_at else timezone.now()
            log, created = MedicationLog.objects.get_or_create(
                reminder=reminder,
                scheduled_time=scheduled_dt or timezone.now(),
                defaults={
                    'patient':  reminder.patient,
                    'status':   intake_status,
                    'taken_at': taken_at_dt,
                    'notes':    notes,
                },
            )
            if not created:
                log.status   = intake_status
                log.taken_at = taken_at_dt
                log.notes    = notes
                log.save(update_fields=['status', 'taken_at', 'notes'])

            synced += 1

        except Exception as exc:
            logger.exception('sync_medication_logs error for reminder %s', reminder_id)
            errors.append({'reminder_id': reminder_id, 'error': str(exc)})

    return Response(
        {'success': True, 'synced': synced, 'errors': errors},
        status=status.HTTP_200_OK,
    )
@api_view(['POST'])
@permission_classes([AllowAny])
def sync_missed_reminders(request):
    raw = request.data

    if isinstance(raw, dict) and 'missed' in raw:
        items = raw['missed']
    elif isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = [raw]
    else:
        items = []

    synced = 0
    for item in items:
        reminder_id    = item.get('reminder_id') or item.get('reminderId')
        scheduled_time = item.get('scheduled_time') or item.get('scheduledTime')

        if not reminder_id:
            continue
        try:
            reminder = MedicationReminder.objects.get(id=reminder_id)
            scheduled_dt = parse_datetime(scheduled_time) if scheduled_time else timezone.now()

            MedicationLog.objects.get_or_create(
                reminder=reminder,
                scheduled_time=scheduled_dt or timezone.now(),
                defaults={
                    'patient': reminder.patient,
                    'status':  'missed',
                    'notes':   'Synced from offline PWA',
                },
            )
            synced += 1
        except MedicationReminder.DoesNotExist:
            pass

    return Response({'success': True, 'synced': synced})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def adherence_prediction(request):
    patient_id = (
        request.data.get('patient_id')
        if request.method == 'POST'
        else request.query_params.get('patient')
    )
    reminders_data = request.data.get('reminders', []) if request.method == 'POST' else []

    qs = MedicationLog.objects.all()
    if patient_id:
        qs = qs.filter(patient__id=patient_id)
    elif request.user.is_authenticated:
        qs = qs.filter(patient=request.user)

    total = qs.count()
    taken = qs.filter(status='taken').count()
    rate  = round(taken / total * 100, 1) if total > 0 else 100.0

    if rate >= 80:
        risk, recs = 'low', ['Excellent adherence! Keep it up.']
    elif rate >= 60:
        risk, recs = 'medium', [
            'Try to take medications at the same time each day.',
            'Use the "Mark as Taken" button immediately after taking.',
        ]
    else:
        risk, recs = 'high', [
            'Please consult your doctor about your medication schedule.',
            'Set multiple reminder times to avoid missing doses.',
        ]

    return Response({
        'adherence_rate':           rate,
        'predicted_adherence_rate': rate,
        'risk_level':               risk,
        'recommendations':          recs,
        'total_doses':              total,
        'taken_doses':              taken,
        'insights': f'Based on {total} logged doses, {taken} taken on time.',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def reminder_stats(request):
    patient_id = request.query_params.get('patient')
    qs = MedicationReminder.objects.all()
    if patient_id:
        qs = qs.filter(patient__id=patient_id)
    elif request.user.is_authenticated:
        qs = qs.filter(patient=request.user)

    today = timezone.now().date()
    active = qs.filter(is_active=True).count()
    logs_today = MedicationLog.objects.filter(
        reminder__in=qs,
        scheduled_time__date=today,
    )

    return Response({
        'total_reminders':  qs.count(),
        'active_reminders': active,
        'logs_today':       logs_today.count(),
        'taken_today':      logs_today.filter(status='taken').count(),
        'missed_today':     logs_today.filter(status='missed').count(),
        'today':            str(today),
    })    
    

class HealthReportViewSet(viewsets.ModelViewSet):
    queryset = HealthReport.objects.all()
    serializer_class = HealthReportSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = HealthReport.objects.all()
        
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        
        report_type = self.request.query_params.get('report_type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)
        
        return queryset.select_related('patient', 'generated_by').order_by('-created_at')
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        patient_id = request.data.get('patient_id')
        report_type = request.data.get('report_type', 'custom')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        if not patient_id or not start_date or not end_date:
            return Response(
                {'error': 'patient_id, start_date, and end_date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            patient = CustomUser.objects.get(id=patient_id)
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Patient not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        metrics = HealthMetric.objects.filter(
            patient=patient,
            recorded_at__gte=start_date,
            recorded_at__lte=end_date
        )
        
        activities = HealthActivity.objects.filter(
            patient=patient,
            activity_date__gte=start_date,
            activity_date__lte=end_date
        )
        
        goals = HealthGoal.objects.filter(patient=patient)
        
        summary_data = {
            'total_metrics': metrics.count(),
            'total_activities': activities.count(),
            'active_goals': goals.filter(status='active').count(),
            'abnormal_readings': metrics.filter(is_abnormal=True).count()
        }
        
        metrics_summary = {}
        for metric_type in ['blood_pressure', 'heart_rate', 'weight', 'blood_sugar']:
            type_metrics = metrics.filter(metric_type=metric_type)
            if type_metrics.exists():
                avg = type_metrics.aggregate(Avg('numeric_value'))['numeric_value__avg']
                metrics_summary[metric_type] = {
                    'count': type_metrics.count(),
                    'average': round(avg, 2) if avg else 0,
                    'latest': str(type_metrics.order_by('-recorded_at').first().value)
                }
        
        report = HealthReport.objects.create(
            patient=patient,
            report_type=report_type,
            title=f"{report_type.title()} Health Report",
            start_date=start_date,
            end_date=end_date,
            summary_data=summary_data,
            metrics_summary=metrics_summary,
            trends={},
            recommendations=[],
            generated_by=request.user if request.user.is_authenticated else None
        )
        
        return Response(
            HealthReportSerializer(report).data,
            status=status.HTTP_201_CREATED
        )

@api_view(['GET'])
@permission_classes([AllowAny])
def health_dashboard(request):
    patient_id = request.query_params.get('patient')
    
    if not patient_id:
        return Response(
            {'error': 'patient parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        try:
            patient = CustomUser.objects.get(id=patient_id, user_type='patient')
            logger.info(f"[health_dashboard]  Found patient: {patient.username}")
        except CustomUser.DoesNotExist:
            logger.warning(f"[health_dashboard] Patient not found with user_type filter, trying without...")
            patient = CustomUser.objects.get(id=patient_id)
            logger.info(f"[health_dashboard]  Found patient (no type filter): {patient.username}, type={patient.user_type}")
            
            if not patient.user_type or patient.user_type == '':
                logger.info(f"[health_dashboard] Setting user_type to 'patient' for {patient.username}")
                patient.user_type = 'patient'
                patient.save()
    
    except CustomUser.DoesNotExist:
        logger.error(f"[health_dashboard]  Patient not found with ID: {patient_id}")
        return Response(
            {
                'error': 'Patient not found',
                'patient_id': patient_id,
                'message': 'Please ensure you are logged in with a valid patient account'
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    latest_metrics = []
    metric_types = ['blood_pressure', 'heart_rate', 'weight', 'temperature', 'blood_sugar', 'oxygen_saturation']
    
    for metric_type in metric_types:
        metric = HealthMetric.objects.filter(
            patient=patient,
            metric_type=metric_type
        ).order_by('-recorded_at').first()
        
        if metric:
            latest_metrics.append(metric)
    
    active_goals = HealthGoal.objects.filter(
        patient=patient,
        status='active'
    ).order_by('-created_at')[:5]
    
    week_ago = timezone.now() - timedelta(days=7)
    recent_activities = HealthActivity.objects.filter(
        patient=patient,
        activity_date__gte=week_ago.date()
    ).order_by('-activity_date', '-activity_time')[:10]
    
    medication_reminders = MedicationReminder.objects.filter(
        patient=patient,
        is_active=True
    ).order_by('medication_name')
    
    alerts = []
    abnormal_metrics = HealthMetric.objects.filter(
        patient=patient,
        is_abnormal=True,
        recorded_at__gte=week_ago
    ).order_by('-recorded_at')[:5]
    
    for metric in abnormal_metrics:
        alerts.append({
            'type': metric.metric_type,
            'value': metric.value,
            'alert_level': metric.alert_level,
            'date': metric.recorded_at.strftime('%Y-%m-%d %H:%M'),
            'message': f"{metric.get_metric_type_display()} is {metric.get_alert_level_display()}"
        })
    
    logger.info(f"[health_dashboard]  Dashboard data loaded for {patient.username}")
    logger.info(f"  - Latest metrics: {len(latest_metrics)}")
    logger.info(f"  - Active goals: {active_goals.count()}")
    logger.info(f"  - Recent activities: {recent_activities.count()}")
    logger.info(f"  - Medication reminders: {medication_reminders.count()}")
    logger.info(f"  - Alerts: {len(alerts)}")
    
    return Response({
        'success': True,
        'dashboard': {
            'latest_metrics': HealthMetricSerializer(latest_metrics, many=True).data,
            'active_goals': HealthGoalSerializer(active_goals, many=True).data,
            'recent_activities': HealthActivitySerializer(recent_activities, many=True).data,
            'medication_reminders': MedicationReminderSerializer(medication_reminders, many=True).data,
            'alerts': alerts
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def health_summary(request):
    patient_id = request.query_params.get('patient')
    period_days = int(request.query_params.get('period', 30))
    
    if not patient_id:
        return Response(
            {'error': 'patient parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        try:
            patient = CustomUser.objects.get(id=patient_id, user_type='patient')
        except CustomUser.DoesNotExist:
            patient = CustomUser.objects.get(id=patient_id)
            if not patient.user_type:
                patient.user_type = 'patient'
                patient.save()
    except CustomUser.DoesNotExist:
        return Response(
            {'error': 'Patient not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    start_date = timezone.now() - timedelta(days=period_days)
    
    metrics_count = HealthMetric.objects.filter(
        patient_id=patient_id,
        recorded_at__gte=start_date
    ).count()
    
    activities_count = HealthActivity.objects.filter(
        patient_id=patient_id,
        activity_date__gte=start_date.date()
    ).count()
    active_goals = HealthGoal.objects.filter(
        patient_id=patient_id,
        status='active'
    )
    avg_progress = active_goals.aggregate(Avg('progress_percentage'))['progress_percentage__avg'] or 0
    
    total_logs = MedicationLog.objects.filter(
        patient_id=patient_id,
        scheduled_time__gte=start_date
    ).count()
    
    taken_logs = MedicationLog.objects.filter(
        patient_id=patient_id,
        scheduled_time__gte=start_date,
        status='taken'
    ).count()
    
    adherence_rate = (taken_logs / total_logs * 100) if total_logs > 0 else 100
    
    return Response({
        'success': True,
        'summary': {
            'period_days': period_days,
            'metrics_recorded': metrics_count,
            'activities_logged': activities_count,
            'active_goals': active_goals.count(),
            'average_goal_progress': round(avg_progress, 1),
            'medication_adherence_rate': round(adherence_rate, 1)
        }
    })

class DoctorRatingViewSet(viewsets.ModelViewSet):
    queryset = DoctorRating.objects.all()
    serializer_class = DoctorRatingSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = DoctorRating.objects.select_related('doctor', 'patient', 'appointment').all()
        
        doctor_id = self.request.query_params.get('doctor')
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        
        return queryset.order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        try:
            logger.info(f"[DoctorRating] Creating rating")
            logger.info(f"[DoctorRating] Request data: {request.data}")
            
            patient = None
            if request.user and request.user.is_authenticated:
                patient = request.user
            else:
                patient_id = request.data.get('patient_id')
                if patient_id:
                    patient = CustomUser.objects.get(id=patient_id, user_type='patient')
            
            if not patient:
                return Response(
                    {'error': 'Patient not found or not authenticated'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            doctor_id = request.data.get('doctor_id')
            try:
                doctor = DoctorProfile.objects.get(id=doctor_id)
            except DoctorProfile.DoesNotExist:
                return Response(
                    {'error': f'Doctor not found with ID: {doctor_id}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            appointment = None
            appointment_id = request.data.get('appointment_id')
            if appointment_id:
                try:
                    appointment = Appointment.objects.get(id=appointment_id)
                except Appointment.DoesNotExist:
                    pass
            
            if appointment:
                existing = DoctorRating.objects.filter(
                    doctor=doctor,
                    patient=patient,
                    appointment=appointment
                ).first()
                
                if existing:
                    existing.rating = request.data.get('rating')
                    existing.review = request.data.get('review', '')
                    existing.pros = request.data.get('pros', '')
                    existing.cons = request.data.get('cons', '')
                    existing.would_recommend = request.data.get('would_recommend', True)
                    existing.save()
                    
                    serializer = self.get_serializer(existing)
                    return Response(serializer.data, status=status.HTTP_200_OK)
            
            rating = DoctorRating.objects.create(
                doctor=doctor,
                patient=patient,
                appointment=appointment,
                rating=request.data.get('rating'),
                review=request.data.get('review', ''),
                pros=request.data.get('pros', ''),
                cons=request.data.get('cons', ''),
                would_recommend=request.data.get('would_recommend', True)
            )
            
            logger.info(f"[DoctorRating]  Rating created: {rating.id}")
            
            serializer = self.get_serializer(rating)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"[DoctorRating] Error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_patient_doctors(request):
    patient_id = request.query_params.get('patient')
    
    logger.info(f"[get_patient_doctors] Request received for patient: {patient_id}")
    
    if not patient_id:
        return Response(
            {'error': 'patient parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        try:
            patient = CustomUser.objects.get(id=patient_id, user_type='patient')
            logger.info(f"[get_patient_doctors]  Found patient: {patient.username}")
        except CustomUser.DoesNotExist:
            logger.error(f"[get_patient_doctors]  Patient not found: {patient_id}")
            return Response(
                {'error': 'Patient not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        logger.info(f"[get_patient_doctors] Looking for appointments with phone: {patient.phone_number}")
        appointments = Appointment.objects.filter(
            patient_phone=patient.phone_number
        ).select_related('doctor__user').order_by('-created_at')
        
        logger.info(f"[get_patient_doctors] Found {appointments.count()} appointments")
        
        doctors_data = {}
        for apt in appointments:
            if not apt.doctor:
                logger.warning(f"[get_patient_doctors] Appointment {apt.id} has no doctor")
                continue
                
            doctor = apt.doctor
            
            if doctor.id not in doctors_data:
                logger.info(f"[get_patient_doctors] Processing doctor: Dr. {doctor.user.get_full_name()}")
                
                patient_rating = DoctorRating.objects.filter(
                    doctor=doctor,
                    patient=patient
                ).first()
                
                doctors_data[doctor.id] = {
                    'id': doctor.id,
                    'user_id': str(doctor.user.id),
                    'name': f"Dr. {doctor.user.get_full_name()}",
                    'first_name': doctor.user.first_name,
                    'last_name': doctor.user.last_name,
                    'specialization': doctor.specialization,
                    'specialization_display': doctor.get_specialization_display(),
                    'qualification': doctor.qualification,
                    'experience_years': doctor.experience_years,
                    'consultation_fee': float(doctor.consultation_fee),
                    'profile_picture_url': request.build_absolute_uri(doctor.user.profile_picture.url) if doctor.user.profile_picture else None,
                    'average_rating': float(doctor.average_rating) if doctor.average_rating else 0.0,
                    'total_ratings': doctor.ratings.count(),
                    'total_consultations': 1,
                    'my_rating': patient_rating.rating if patient_rating else None,
                    'my_review': patient_rating.review if patient_rating else None,
                    'last_visit': apt.preferred_date.isoformat(),
                }
            else:
                doctors_data[doctor.id]['total_consultations'] += 1
                
                if apt.preferred_date.isoformat() > doctors_data[doctor.id]['last_visit']:
                    doctors_data[doctor.id]['last_visit'] = apt.preferred_date.isoformat()
        
        doctors_list = list(doctors_data.values())
        logger.info(f"[get_patient_doctors]  Returning {len(doctors_list)} doctors")
        
        return Response({
            'success': True,
            'doctors': doctors_list
        })
        
    except Exception as e:
        logger.error(f"[get_patient_doctors]  Error: {str(e)}")
        import traceback
        logger.error(f"[get_patient_doctors] Traceback: {traceback.format_exc()}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([AllowAny])
def get_doctor_rating_summary(request, doctor_id):
    try:
        logger.info(f"[get_doctor_rating_summary] Looking up doctor with ID: {doctor_id}")
        
        doctor = None
        
        try:
            doctor_profile_id = int(doctor_id)
            doctor = DoctorProfile.objects.get(id=doctor_profile_id)
            logger.info(f"[get_doctor_rating_summary]  Found by DoctorProfile ID: {doctor_profile_id}")
        except (ValueError, DoctorProfile.DoesNotExist):
            pass
        
        if not doctor:
            try:
                import uuid
                user_uuid = uuid.UUID(str(doctor_id))
                user = CustomUser.objects.get(id=user_uuid, user_type='doctor')
                doctor = DoctorProfile.objects.get(user=user)
                logger.info(f"[get_doctor_rating_summary]  Found by User UUID: {user_uuid}")
            except (ValueError, CustomUser.DoesNotExist, DoctorProfile.DoesNotExist):
                pass
        if not doctor:
            logger.error(f"[get_doctor_rating_summary]  Doctor not found: {doctor_id}")
            return Response(
                {'error': 'Doctor not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        ratings = doctor.ratings.all()
        total_ratings = ratings.count()
        
        if total_ratings == 0:
            return Response({
                'success': True,
                'doctor_id': doctor.id,
                'average_rating': 0.0,
                'total_ratings': 0,
                'rating_distribution': {str(i): 0 for i in range(1, 6)},
                'recommend_percentage': 0,
                'five_star_count': 0,
                'ratings': [],
                'summary': {
                    'average_rating': 0.0,
                    'total_ratings': 0,
                    'rating_distribution': {str(i): 0 for i in range(1, 6)},
                    'recommend_percentage': 0,
                    'five_star_count': 0,
                }
            })
        
        from django.db.models import Avg
        avg = ratings.aggregate(Avg('rating'))['rating__avg']
        
        distribution = doctor.get_rating_distribution()
        distribution = {str(k): v for k, v in distribution.items()}
        
        recommend_count = ratings.filter(would_recommend=True).count()
        recommend_percentage = round((recommend_count / total_ratings) * 100, 1)
        
        five_star_count = distribution.get('5', 0)
        
        ratings_data = DoctorRatingSerializer(ratings, many=True).data
        
        summary = {
            'average_rating': round(avg, 1),
            'total_ratings': total_ratings,
            'rating_distribution': distribution,
            'recommend_percentage': recommend_percentage,
            'five_star_count': five_star_count,
        }
        
        logger.info(f"[get_doctor_rating_summary]  Summary: {summary}")
        
        return Response({
            'success': True,
            'doctor_id': doctor.id,
            'ratings': ratings_data,
            'summary': summary
        })
        
    except Exception as e:
        logger.error(f"[get_doctor_rating_summary]  Error: {str(e)}")
        import traceback
        logger.error(f"[get_doctor_rating_summary] Traceback: {traceback.format_exc()}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.all()
    serializer_class = ConversationSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = Conversation.objects.all()
        
        user_id = self.request.query_params.get('user_id')
        
        logger.info(f"[ConversationViewSet] get_queryset called")
        logger.info(f"  Authenticated: {self.request.user.is_authenticated}")
        logger.info(f"  User ID param: {user_id}")
        
        if self.request.user and self.request.user.is_authenticated:
            queryset = queryset.filter(user=self.request.user)
            logger.info(f"[ConversationViewSet] Filtering by authenticated user: {self.request.user.username}")
        elif user_id:
            queryset = queryset.filter(user_id_anonymous=user_id)
            logger.info(f"[ConversationViewSet] Filtering by anonymous user: {user_id}")
        else:
            logger.warning("[ConversationViewSet] No user identification provided")
            return Conversation.objects.none()
        
        is_archived = self.request.query_params.get('is_archived')
        if is_archived is not None:
            queryset = queryset.filter(is_archived=is_archived.lower() == 'true')
        
        count = queryset.count()
        logger.info(f"[ConversationViewSet] Returning {count} conversations")
        
        return queryset.order_by('-is_pinned', '-last_message_at')

    
    def retrieve(self, request, pk=None):
        try:
            logger.info(f"[ConversationViewSet] Retrieving conversation: {pk}")
            logger.info(f"[ConversationViewSet] User authenticated: {request.user.is_authenticated}")
            logger.info(f"[ConversationViewSet] Query params: {request.query_params}")
            try:
                conversation = Conversation.objects.get(id=pk)
                logger.info(f"[ConversationViewSet] Found conversation: {conversation.id}")
                logger.info(f"  Title: {conversation.title}")
                logger.info(f"  User owner: {conversation.user}")
                logger.info(f"  Anonymous owner: {conversation.user_id_anonymous}")
            except Conversation.DoesNotExist:
                logger.error(f"[ConversationViewSet] Conversation not found: {pk}")
                return Response(
                    {'error': 'Conversation not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            user_owns_conversation = False
            
            if request.user and request.user.is_authenticated:
                if conversation.user and conversation.user.id == request.user.id:
                    user_owns_conversation = True
                    logger.info(f"[ConversationViewSet]  Authenticated user owns conversation")
            else:
                user_id = request.query_params.get('user_id')
                logger.info(f"[ConversationViewSet] Anonymous user check, user_id: {user_id}")
                logger.info(f"[ConversationViewSet] Conversation owner: {conversation.user_id_anonymous}")
                
                if user_id and conversation.user_id_anonymous == user_id:
                    user_owns_conversation = True
                    logger.info(f"[ConversationViewSet]  Anonymous user owns conversation")
                else:
                    logger.warning(f"[ConversationViewSet] User ID mismatch: {user_id} != {conversation.user_id_anonymous}")
            
            if not user_owns_conversation:
                logger.error(f"[ConversationViewSet]  Permission denied")
                return Response(
                    {'error': 'You do not have permission to access this conversation'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            logger.info(f"[ConversationViewSet]  Returning conversation")
            serializer = ConversationDetailSerializer(conversation)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"[ConversationViewSet]  Error: {str(e)}")
            import traceback
            logger.error(f"[ConversationViewSet] Traceback: {traceback.format_exc()}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['patch'])
    def update_title(self, request, pk=None):
        try:
            conversation = self.get_queryset().filter(id=pk).first()
            
            if not conversation:
                return Response(
                    {'error': 'Conversation not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            title = request.data.get('title', '').strip()
            
            if not title:
                return Response(
                    {'error': 'Title is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            conversation.title = title
            conversation.save(update_fields=['title'])
            
            logger.info(f"[ConversationViewSet]  Updated title: {title}")
            
            return Response({
                'success': True,
                'conversation': ConversationSerializer(conversation).data
            })
        except Exception as e:
            logger.error(f"[ConversationViewSet] Error updating title: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['patch'])
    def archive(self, request, pk=None):
        try:
            conversation = self.get_queryset().filter(id=pk).first()
            
            if not conversation:
                return Response(
                    {'error': 'Conversation not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            is_archived = request.data.get('is_archived', True)
            
            conversation.is_archived = is_archived
            conversation.save(update_fields=['is_archived'])
            
            logger.info(f"[ConversationViewSet]  Archived: {is_archived}")
            
            return Response({
                'success': True,
                'conversation': ConversationSerializer(conversation).data
            })
        except Exception as e:
            logger.error(f"[ConversationViewSet] Error archiving: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['patch'])
    def pin(self, request, pk=None):
        try:
            conversation = self.get_queryset().filter(id=pk).first()
            
            if not conversation:
                return Response(
                    {'error': 'Conversation not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            is_pinned = request.data.get('is_pinned', True)
            
            conversation.is_pinned = is_pinned
            conversation.save(update_fields=['is_pinned'])
            
            logger.info(f"[ConversationViewSet]  Pinned: {is_pinned}")
            
            return Response({
                'success': True,
                'conversation': ConversationSerializer(conversation).data
            })
        except Exception as e:
            logger.error(f"[ConversationViewSet] Error pinning: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, pk=None):
        try:
            logger.info(f"[ConversationViewSet] DELETE request for conversation: {pk}")
            logger.info(f"[ConversationViewSet] Request user: {request.user if request.user.is_authenticated else 'Anonymous'}")
            logger.info(f"[ConversationViewSet] Query params: {request.query_params}")
            try:
                conversation = Conversation.objects.get(id=pk)
                logger.info(f"[ConversationViewSet] Found conversation: {conversation.id}")
                logger.info(f"  Title: {conversation.title}")
                logger.info(f"  User: {conversation.user}")
                logger.info(f"  Anonymous ID: {conversation.user_id_anonymous}")
            except Conversation.DoesNotExist:
                logger.error(f"[ConversationViewSet]  Conversation does not exist: {pk}")
                return Response(
                    {'error': 'Conversation not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            user_owns_conversation = False
            
            if request.user and request.user.is_authenticated:
                if conversation.user and conversation.user.id == request.user.id:
                    user_owns_conversation = True
                    logger.info(f"[ConversationViewSet]  Authenticated user owns conversation")
                else:
                    logger.warning(f"[ConversationViewSet] User {request.user.id} does not own conversation (owner: {conversation.user})")
            else:
                user_id = request.query_params.get('user_id')
                logger.info(f"[ConversationViewSet] Anonymous delete, user_id from params: {user_id}")
                
                if user_id and conversation.user_id_anonymous == user_id:
                    user_owns_conversation = True
                    logger.info(f"[ConversationViewSet]  Anonymous user owns conversation")
                else:
                    logger.warning(f"[ConversationViewSet] Anonymous user {user_id} does not own conversation (owner: {conversation.user_id_anonymous})")
            
            if not user_owns_conversation:
                logger.error(f"[ConversationViewSet]  Permission denied for conversation {pk}")
                return Response(
                    {'error': 'You do not have permission to delete this conversation'},
                    status=status.HTTP_403_FORBIDDEN
                )

            title = conversation.title
            conversation.delete()
            
            logger.info(f"[ConversationViewSet]  Deleted conversation: {title}")
            
            return Response(
                status=status.HTTP_204_NO_CONTENT
            )
            
        except Exception as e:
            logger.error(f"[ConversationViewSet]  Error deleting: {str(e)}")
            import traceback
            logger.error(f"[ConversationViewSet] Traceback: {traceback.format_exc()}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
@permission_classes([AllowAny])
def get_or_create_conversation(request):
    try:
        conversation_id = request.data.get('conversation_id')
        user_id = request.data.get('user_id')
        language = request.data.get('language', 'English')
        
        if conversation_id:
            try:
                if request.user and request.user.is_authenticated:
                    conversation = Conversation.objects.get(
                        id=conversation_id,
                        user=request.user
                    )
                else:
                    conversation = Conversation.objects.get(
                        id=conversation_id,
                        user_id_anonymous=user_id
                    )
                
                logger.info(f"[Conversation] Using existing conversation: {conversation.id}")
                return Response({
                    'success': True,
                    'conversation': ConversationDetailSerializer(conversation).data,
                    'is_new': False
                })
                
            except Conversation.DoesNotExist:
                logger.warning(f"[Conversation] Conversation not found: {conversation_id}")
              
        conversation_data = {
            'language': language,
            'title': '' 
        }
        
        if request.user and request.user.is_authenticated:
            conversation_data['user'] = request.user
        else:
            conversation_data['user_id_anonymous'] = user_id
        
        conversation = Conversation.objects.create(**conversation_data)
        
        logger.info(f"[Conversation] Created new conversation: {conversation.id}")
        
        return Response({
            'success': True,
            'conversation': ConversationDetailSerializer(conversation).data,
            'is_new': True
        })
        
    except Exception as e:
        logger.error(f"[Conversation] Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
from .helpers import get_response_language
@api_view(['POST'])
@csrf_exempt
def chat_stream(request):
    try:
        serializer = ChatMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        msg = data['msg']
        user_id = data['user_id']
        
        user_selected_language = data.get('language', 'English')
        detected_language = get_response_language(msg, user_selected_language)

        if user_selected_language and user_selected_language != 'English':
            language = user_selected_language
        else:
            language = detected_language

        conversation_id = data.get('conversation_id')

        logger.info(f"[chat_stream] User: {user_id}, Language: {language}, Conversation: {conversation_id}")
        logger.info(f"[chat_stream] Message: {msg[:50]}...")

        from .helpers import detect_emergency_level, should_show_hospitals, check_ai_response_for_hospital_trigger
        
        emergency_level = detect_emergency_level(msg)
        show_hospitals_from_user = should_show_hospitals(msg)
        
        logger.info(f"[chat_stream] Emergency level from user: {emergency_level}")
        logger.info(f"[chat_stream] Show hospitals from user: {show_hospitals_from_user}")

        conversation = None
        is_new_conversation = False
        
        if conversation_id:
            try:
                if request.user and request.user.is_authenticated:
                    conversation = Conversation.objects.get(id=conversation_id, user=request.user)
                else:
                    conversation = Conversation.objects.get(id=conversation_id, user_id_anonymous=user_id)
                logger.info(f"[chat_stream]  Found existing conversation: {conversation.id}")
            except Conversation.DoesNotExist:
                logger.warning(f"[chat_stream] Conversation not found: {conversation_id}")
        
        if not conversation:
            conversation_data = {'language': language}
            if request.user and request.user.is_authenticated:
                conversation_data['user'] = request.user
            else:
                conversation_data['user_id_anonymous'] = user_id
            
            conversation = Conversation.objects.create(**conversation_data)
            is_new_conversation = True
            logger.info(f"[chat_stream]  Created new conversation: {conversation.id}")

        user_message = ChatHistory.objects.create(
            conversation=conversation,
            user_id=user_id,
            role='user',
            message=msg,
            language=language
        )
        logger.info(f"[chat_stream]  Saved user message: {user_message.id}")

        if is_new_conversation or not conversation.title:
            title = msg[:50].strip()
            if len(msg) > 50:
                title += "..."
            conversation.title = title
            conversation.save(update_fields=['title'])
            logger.info(f"[chat_stream]  Set conversation title: {title}")

        emergency_prefix = ""
        if emergency_level == 'critical':
            emergency_prefix = "🚨 EMERGENCY ALERT: This appears to be a medical emergency. Please call 108/102 immediately or go to the nearest emergency room. "
        elif emergency_level == 'urgent':
            emergency_prefix = " URGENT MEDICAL ATTENTION NEEDED: Please seek medical care within 24 hours. "

        chatbot = get_chatbot()

        def generate():
            try:
                full_response = ""
                
                if emergency_prefix:
                    full_response += emergency_prefix
                    yield f"data: {json.dumps({'chunk': emergency_prefix})}\n\n"
                
                for chunk in chatbot.get_response(msg, language):
                    full_response += chunk
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"

                show_hospitals = show_hospitals_from_user
                
                ai_suggests_doctor = check_ai_response_for_hospital_trigger(full_response)
                if ai_suggests_doctor:
                    show_hospitals = True
                    logger.info("[chat_stream] 🏥 AI suggested doctor visit - enabling hospital finder")

                assistant_message = ChatHistory.objects.create(
                    conversation=conversation,
                    user_id=user_id,
                    role='assistant',
                    message=full_response,
                    language=language
                )
                logger.info(f"[chat_stream]  Saved assistant message: {assistant_message.id}")

                from django.utils import timezone
                conversation.last_message_at = timezone.now()
                conversation.message_count = conversation.messages.count()
                conversation.save(update_fields=['last_message_at', 'message_count'])
                logger.info(f"[chat_stream]  Updated conversation metadata")

                completion_data = {
                    'done': True,
                    'conversation_id': str(conversation.id),
                    'show_hospitals': show_hospitals, 
                    'emergency_level': emergency_level 
                }
                
                logger.info(f"[chat_stream] 🏥 Sending completion data:")
                logger.info(f"  show_hospitals: {show_hospitals}")
                logger.info(f"  emergency_level: {emergency_level}")
                
                yield f"data: {json.dumps(completion_data)}\n\n"

            except Exception as e:
                logger.error(f"[chat_stream]  Error in streaming: {str(e)}")
                import traceback
                logger.error(f"[chat_stream] Traceback: {traceback.format_exc()}")
                
                error_msg = f"I apologize, but I encountered an error: {str(e)}"
                yield f"data: {json.dumps({'chunk': error_msg, 'error': True})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

        response = StreamingHttpResponse(
            generate(),
            content_type='text/event-stream'
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    except Exception as e:
        logger.error(f"[chat_stream]  Error: {str(e)}")
        import traceback
        logger.error(f"[chat_stream] Traceback: {traceback.format_exc()}")
        
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def chat_with_image(request):
    temp_path = None
    
    try:
        print("\n" + "="*80)
        print(" IMAGE UPLOAD RECEIVED")
        print("="*80)
        user_message = request.POST.get('msg', '')
        user_id = request.POST.get('user_id', 'anonymous')
        language = request.POST.get('language', 'English')
        image_file = request.FILES.get('image')
        
        print(f"User ID: {user_id}")
        print(f"Message: {user_message}")
        print(f"Image: {image_file.name if image_file else 'NONE'}")
        
        if not image_file:
            print(" NO IMAGE FILE")
            return JsonResponse({'error': 'No image provided'}, status=400)
        
        print(f" Image: {image_file.name} ({image_file.size} bytes)")
        
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}.jpg")
        
        with open(temp_path, 'wb') as f:
            for chunk in image_file.chunks():
                f.write(chunk)
        
        print(f" Saved to: {temp_path}")
        
        def generate():
            try:
                response = f""" IMAGE RECEIVED: {image_file.name}

Your message: {user_message}

 This is a test response to verify the endpoint works.

For full AI image analysis, you need to:
1. Install vision AI: pip install groq
2. Set API key: export GROQ_API_KEY=your_key
3. Restart Django

Please consult a healthcare professional for image evaluation."""
                
                for word in response.split():
                    yield word + " "
                
                print(" Response sent")
                
            except Exception as e:
                print(f" Error: {e}")
                yield f"Error: {str(e)}"
            
            finally:
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                        print(" Cleanup done")
                    except:
                        pass
        
        print(" Streaming...")
        
        return StreamingHttpResponse(
            generate(),
            content_type='text/plain; charset=utf-8',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )
        
    except Exception as e:
        print("="*80)
        print(f" ERROR: {str(e)}")
        print("="*80)
        
        import traceback
        traceback.print_exc()
        
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        
        return JsonResponse({
            'error': str(e),
            'type': type(e).__name__
        }, status=500)
    


@api_view(['POST'])
@permission_classes([AllowAny])
def generate_health_report(request):
    try:
        conversation_id = request.data.get('conversation_id')
        user_id = request.data.get('user_id')
        patient_name = request.data.get('patient_name', '')
        
        if not conversation_id:
            return Response(
                {'error': 'conversation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response(
                {'error': 'Conversation not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if request.user.is_authenticated:
            if conversation.user and conversation.user.id != request.user.id:
                return Response(
                    {'error': 'Unauthorized'},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            if conversation.user_id_anonymous != user_id:
                return Response(
                    {'error': 'Unauthorized'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        report_data = analyze_conversation_for_report(conversation)
        report_data['patient_name'] = patient_name
        
        health_report, created = HealthReportData.objects.update_or_create(
            conversation=conversation,
            defaults={
                'symptoms': report_data['symptoms'],
                'duration': report_data['duration'],
                'severity': report_data['severity'],
                'additional_symptoms': report_data.get('additional_symptoms', []),
                'medical_history_mentioned': report_data.get('medical_history', ''),
                'current_medications_mentioned': report_data.get('medications', ''),
                'possible_conditions': report_data.get('possible_conditions', []),
                'advice_given': report_data.get('advice_given', ''),
                'emergency_warning': report_data.get('emergency_warning', ''),
                'report_generated': True,
                'generated_at': timezone.now()
            }
        )
        report_text = generate_health_report_text(report_data)
        
        return Response({
            'success': True,
            'report_text': report_text,
            'report_data': HealthReportDataSerializer(health_report).data,
            'message': 'Health report generated successfully'
        })
        
    except Exception as e:
        logger.error(f"[generate_health_report] Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def download_health_report_pdf(request):
    try:
        conversation_id = request.data.get('conversation_id')
        
        if not conversation_id:
            return Response(
                {'error': 'conversation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            health_report = HealthReportData.objects.get(conversation_id=conversation_id)
        except HealthReportData.DoesNotExist:
            return Response(
                {'error': 'Health report not found. Generate report first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        report_data = {
            'patient_name': request.data.get('patient_name', 'Patient'),
            'symptoms': health_report.symptoms,
            'duration': health_report.duration,
            'severity': health_report.severity,
            'additional_symptoms': health_report.additional_symptoms,
            'possible_conditions': health_report.possible_conditions,
            'advice_given': health_report.advice_given,
            'medical_history': health_report.medical_history_mentioned,
            'medications': health_report.current_medications_mentioned,
            'emergency_warning': health_report.emergency_warning,
        }
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor='#00B38E',
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor='#00B38E',
            spaceAfter=12,
            spaceBefore=12
        )
        
        story = []
        story.append(Paragraph("HEALTH CONSULTATION REPORT", title_style))
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"<b>Patient:</b> {report_data['patient_name']}", styles['Normal']))
        story.append(Paragraph(f"<b>Date:</b> {datetime.now().strftime('%B %d, %Y')}", styles['Normal']))
        story.append(Spacer(1, 12))
        if report_data.get('emergency_warning'):
            warning_style = ParagraphStyle(
                'Warning',
                parent=styles['Normal'],textColor='red',fontSize=12,spaceBefore=12,spaceAfter=12
            )
            story.append(Paragraph(" EMERGENCY ALERT", heading_style))
            story.append(Paragraph(report_data['emergency_warning'], warning_style))
            story.append(Spacer(1, 12))
        
        story.append(Paragraph("SYMPTOMS REPORTED", heading_style))
        if report_data['symptoms']:
            for symptom in report_data['symptoms']:
                story.append(Paragraph(f"• {symptom.title()}", styles['Normal']))
        story.append(Spacer(1, 12))
        
        if report_data.get('duration'):
            story.append(Paragraph(f"<b>Duration:</b> {report_data['duration']}", styles['Normal']))
            story.append(Spacer(1, 12))
        if report_data.get('severity') and report_data['severity'] != 'unknown':
            story.append(Paragraph(f"<b>Severity:</b> {report_data['severity'].title()}", styles['Normal']))
            story.append(Spacer(1, 12))
        
        if report_data.get('advice_given'):
            story.append(Paragraph("RECOMMENDATIONS & ADVICE", heading_style))
            story.append(Paragraph(report_data['advice_given'][:500], styles['Normal'])) 
            story.append(Spacer(1, 12))
        
        disclaimer_style = ParagraphStyle(
            'Disclaimer',
            parent=styles['Normal'],
            fontSize=10,
            textColor='gray',
            spaceBefore=20
        )
        story.append(Paragraph(
            "<b>DISCLAIMER:</b> This report is generated from an AI conversation and is NOT "
            "a medical diagnosis. Please consult a qualified healthcare professional for "
            "accurate diagnosis and treatment.",
            disclaimer_style
        ))
        doc.build(story)
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="health_report_{conversation_id}.pdf"'
        
        return response
        
    except Exception as e:
        logger.error(f"[download_health_report_pdf] Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def download_health_report_pdf(request):
    try:
        logger.info("[download_health_report_pdf] Starting PDF generation")
        
        conversation_id = request.data.get('conversation_id')
        patient_name = request.data.get('patient_name', 'Patient')
        
        if not conversation_id:
            logger.error("[download_health_report_pdf] No conversation_id provided")
            return Response(
                {'error': 'conversation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logger.info(f"[download_health_report_pdf] Conversation ID: {conversation_id}")
        logger.info(f"[download_health_report_pdf] Patient name: {patient_name}")
        
        try:
            health_report = HealthReportData.objects.get(conversation_id=conversation_id)
            logger.info(f"[download_health_report_pdf] Found health report data")
        except HealthReportData.DoesNotExist:
            logger.error("[download_health_report_pdf] Health report not found")
            return Response(
                {'error': 'Health report not found. Please generate report first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        report_data = {
            'patient_name': patient_name,
            'symptoms': health_report.symptoms if health_report.symptoms else [],
            'duration': health_report.duration or '',
            'severity': health_report.severity or 'unknown',
            'additional_symptoms': health_report.additional_symptoms if health_report.additional_symptoms else [],
            'possible_conditions': health_report.possible_conditions if health_report.possible_conditions else [],
            'advice_given': health_report.advice_given or '',
            'medical_history': health_report.medical_history_mentioned or '',
            'medications': health_report.current_medications_mentioned or '',
            'emergency_warning': health_report.emergency_warning or '',
        }
        
        logger.info(f"[download_health_report_pdf] Report data prepared")
        logger.info(f"  Symptoms: {len(report_data['symptoms'])}")
        logger.info(f"  Severity: {report_data['severity']}")
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=letter,
            rightMargin=72, 
            leftMargin=72,
            topMargin=72, 
            bottomMargin=18
        )
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor='#00B38E',
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor='#00B38E',
            spaceAfter=12,
            spaceBefore=12
        )
        
        story = []
        
        story.append(Paragraph("HEALTH CONSULTATION REPORT", title_style))
        story.append(Spacer(1, 12))
        
        story.append(Paragraph(f"<b>Patient:</b> {report_data['patient_name']}", styles['Normal']))
        story.append(Paragraph(f"<b>Date:</b> {datetime.now().strftime('%B %d, %Y')}", styles['Normal']))
        story.append(Spacer(1, 12))
        
        if report_data.get('emergency_warning'):
            warning_style = ParagraphStyle(
                'Warning',
                parent=styles['Normal'],
                textColor='red',
                fontSize=12,
                spaceBefore=12,
                spaceAfter=12
            )
            story.append(Paragraph(" EMERGENCY ALERT", heading_style))
            story.append(Paragraph(report_data['emergency_warning'], warning_style))
            story.append(Spacer(1, 12))
        story.append(Paragraph("SYMPTOMS REPORTED", heading_style))
        if report_data['symptoms']:
            for symptom in report_data['symptoms']:
                symptom_text = str(symptom).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                story.append(Paragraph(f"• {symptom_text.title()}", styles['Normal']))
        else:
            story.append(Paragraph("• No specific symptoms reported", styles['Normal']))
        story.append(Spacer(1, 12))
        
        if report_data.get('duration'):
            duration_text = str(report_data['duration']).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(f"<b>Duration:</b> {duration_text}", styles['Normal']))
            story.append(Spacer(1, 12))
        
        if report_data.get('severity') and report_data['severity'] != 'unknown':
            severity_text = str(report_data['severity']).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(f"<b>Severity:</b> {severity_text.title()}", styles['Normal']))
            story.append(Spacer(1, 12))
        
        if report_data.get('advice_given'):
            story.append(Paragraph("RECOMMENDATIONS & ADVICE", heading_style))
            advice_text = str(report_data['advice_given'])[:500]
            advice_text = advice_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(advice_text, styles['Normal']))
            story.append(Spacer(1, 12))
        
        disclaimer_style = ParagraphStyle(
            'Disclaimer',
            parent=styles['Normal'],
            fontSize=10,
            textColor='gray',
            spaceBefore=20
        )
        story.append(Paragraph(
            "<b>DISCLAIMER:</b> This report is generated from an AI conversation and is NOT "
            "a medical diagnosis. Please consult a qualified healthcare professional for "
            "accurate diagnosis and treatment.",
            disclaimer_style
        ))
        
        logger.info("[download_health_report_pdf] Building PDF...")
        
        try:
            doc.build(story)
            logger.info("[download_health_report_pdf]  PDF built successfully")
        except Exception as e:
            logger.error(f"[download_health_report_pdf] PDF build error: {str(e)}")
            raise
        
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        filename = f'health_report_{conversation_id}_{datetime.now().strftime("%Y%m%d")}.pdf'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        logger.info(f"[download_health_report_pdf]  PDF ready: {filename}")
        
        return response
        
    except Exception as e:
        logger.error(f"[download_health_report_pdf]  Error: {str(e)}")
        import traceback
        logger.error(f"[download_health_report_pdf] Traceback: {traceback.format_exc()}")
        
        return Response(
            {'error': f'PDF generation failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def download_health_report_pdf_simple(request):
    try:
        conversation_id = request.data.get('conversation_id')
        patient_name = request.data.get('patient_name', 'Patient')
        
        if not conversation_id:
            return Response(
                {'error': 'conversation_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            health_report = HealthReportData.objects.get(conversation_id=conversation_id)
        except HealthReportData.DoesNotExist:
            return Response(
                {'error': 'Health report not found. Generate report first.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        report_data = {
            'patient_name': patient_name,
            'symptoms': health_report.symptoms or [],
            'duration': health_report.duration or '',
            'severity': health_report.severity or 'unknown',
            'advice_given': health_report.advice_given or '',
            'emergency_warning': health_report.emergency_warning or '',
        }
        
        report_text = generate_health_report_text(report_data)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        for line in report_text.split('\n'):
            if line.strip():
                story.append(Paragraph(line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), styles['Normal']))
            else:
                story.append(Spacer(1, 6))
        
        doc.build(story)
        buffer.seek(0)
        
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="health_report_{conversation_id}.pdf"'
        
        return response
        
    except Exception as e:
        logger.error(f"[download_health_report_pdf_simple] Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class CartViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    
    def get_user_or_session(self, request):
        if request.user and request.user.is_authenticated:
            return {'user': request.user}, 'user'
        
        session_id = request.data.get('session_id') or request.query_params.get('session_id')
        if session_id:
            return {'session_id': session_id}, 'session'
        
        return None, None
    
    def list(self, request):
        try:
            identifier, id_type = self.get_user_or_session(request)
            
            if not identifier:
                return Response(
                    {'error': 'User authentication or session_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            cart_items = CartItem.objects.filter(**identifier).select_related('medicine')
            subtotal = sum(item.get_subtotal() for item in cart_items)
            delivery_fee = 0 if subtotal >= 500 else 40
            applied_coupon = None
            discount = 0
            total = subtotal - discount + delivery_fee
            
            cart_data = {
                'items': CartItemSerializer(cart_items, many=True).data,
                'subtotal': subtotal,
                'discount': discount,
                'delivery_fee': delivery_fee,
                'total': total,
                'item_count': cart_items.count(),
                'applied_coupon': applied_coupon
            }
            
            return Response({
                'success': True,
                'cart': cart_data
            })
            
        except Exception as e:
            logger.error(f"[Cart] Error getting cart: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def add_item(self, request):
        try:
            serializer = AddToCartSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            data = serializer.validated_data
            medicine_id = data['medicine_id']
            quantity = data['quantity']
            identifier, id_type = self.get_user_or_session(request)
            
            if not identifier:
                return Response(
                    {'error': 'User authentication or session_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                medicine = Medicine.objects.get(id=medicine_id)
            except Medicine.DoesNotExist:
                return Response(
                    {'error': 'Medicine not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            if medicine.stock_quantity < quantity:
                return Response(
                    {'error': f'Only {medicine.stock_quantity} items available'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            cart_item, created = CartItem.objects.get_or_create(
                medicine=medicine,
                **identifier,
                defaults={'quantity': quantity}
            )
            
            if not created:
                new_quantity = cart_item.quantity + quantity
                
                if new_quantity > medicine.stock_quantity:
                    return Response(
                        {'error': f'Cannot add more than {medicine.stock_quantity} items'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                cart_item.quantity = new_quantity
                cart_item.save()
            
            logger.info(f"[Cart] Added {medicine.name} x{quantity}")
            
            return Response({
                'success': True,
                'message': f'Added {medicine.name} to cart',
                'cart_item': CartItemSerializer(cart_item).data
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"[Cart] Error adding item: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['patch'])
    def update_quantity(self, request, pk=None):
        try:
            serializer = UpdateCartItemSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            quantity = serializer.validated_data['quantity']
            
            identifier, id_type = self.get_user_or_session(request)
            
            if not identifier:
                return Response(
                    {'error': 'User authentication or session_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                cart_item = CartItem.objects.get(id=pk, **identifier)
            except CartItem.DoesNotExist:
                return Response(
                    {'error': 'Cart item not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            if quantity == 0:
                cart_item.delete()
                return Response({
                    'success': True,
                    'message': 'Item removed from cart'
                })
            
            if quantity > cart_item.medicine.stock_quantity:
                return Response(
                    {'error': f'Only {cart_item.medicine.stock_quantity} items available'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            cart_item.quantity = quantity
            cart_item.save()
            
            return Response({
                'success': True,
                'cart_item': CartItemSerializer(cart_item).data
            })
            
        except Exception as e:
            logger.error(f"[Cart] Error updating quantity: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['delete'])
    def remove_item(self, request, pk=None):
        try:
            identifier, id_type = self.get_user_or_session(request)
            
            if not identifier:
                return Response(
                    {'error': 'User authentication or session_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                cart_item = CartItem.objects.get(id=pk, **identifier)
                medicine_name = cart_item.medicine.name
                cart_item.delete()
                
                return Response({
                    'success': True,
                    'message': f'Removed {medicine_name} from cart'
                })
            except CartItem.DoesNotExist:
                return Response(
                    {'error': 'Cart item not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
        except Exception as e:
            logger.error(f"[Cart] Error removing item: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['delete'])
    def clear(self, request):
        try:
            identifier, id_type = self.get_user_or_session(request)
            
            if not identifier:
                return Response(
                    {'error': 'User authentication or session_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            count = CartItem.objects.filter(**identifier).delete()[0]
            
            return Response({
                'success': True,
                'message': f'Cleared {count} items from cart'
            })
            
        except Exception as e:
            logger.error(f"[Cart] Error clearing cart: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def apply_coupon(self, request):
        try:
            serializer = ApplyCouponSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
            coupon_code = serializer.validated_data['coupon_code'].upper()
            identifier, id_type = self.get_user_or_session(request)
            
            if not identifier:
                return Response(
                    {'error': 'User authentication or session_id required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            try:
                coupon = Coupon.objects.get(code=coupon_code)
            except Coupon.DoesNotExist:
                return Response(
                    {'error': 'Invalid coupon code'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            is_valid, message = coupon.is_valid()
            if not is_valid:
                return Response(
                    {'error': message},
                    status=status.HTTP_400_BAD_REQUEST
                )
            cart_items = CartItem.objects.filter(**identifier)
            subtotal = sum(item.get_subtotal() for item in cart_items)
            
            if subtotal < coupon.minimum_purchase_amount:
                return Response(
                    {'error': f'Minimum purchase amount is ₹{coupon.minimum_purchase_amount}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if id_type == 'user':
                usage_count = CouponUsage.objects.filter(
                    coupon=coupon,
                    user=request.user
                ).count()
                
                if usage_count >= coupon.max_uses_per_user:
                    return Response(
                        {'error': 'You have already used this coupon'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            discount_amount = coupon.calculate_discount(subtotal)
            
            return Response({
                'success': True,
                'message': f'Coupon "{coupon_code}" applied successfully',
                'coupon': CouponSerializer(coupon).data,
                'discount_amount': float(discount_amount),
                'new_total': float(subtotal - discount_amount)
            })
            
        except Exception as e:
            logger.error(f"[Cart] Error applying coupon: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['GET'])
@permission_classes([AllowAny])
def get_cart_count(request):
    try:
        if request.user and request.user.is_authenticated:
            count = CartItem.objects.filter(user=request.user).count()
        else:
            session_id = request.query_params.get('session_id')
            if session_id:
                count = CartItem.objects.filter(session_id=session_id).count()
            else:
                count = 0
        
        return Response({
            'success': True,
            'count': count
        })
        
    except Exception as e:
        logger.error(f"[Cart] Error getting count: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def saved_for_later(request):
    try:
        if request.method == 'GET':
            saved_items = SavedForLater.objects.filter(
                user=request.user
            ).select_related('medicine')
            
            return Response({
                'success': True,
                'items': SavedForLaterSerializer(saved_items, many=True).data
            })
        
        elif request.method == 'POST':
            medicine_id = request.data.get('medicine_id')
            
            try:
                medicine = Medicine.objects.get(id=medicine_id)
            except Medicine.DoesNotExist:
                return Response(
                    {'error': 'Medicine not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            saved_item, created = SavedForLater.objects.get_or_create(
                user=request.user,
                medicine=medicine,
                defaults={'notes': request.data.get('notes', '')}
            )
            
            return Response({
                'success': True,
                'message': 'Item saved for later',
                'item': SavedForLaterSerializer(saved_item).data
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"[SavedForLater] Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([AllowAny]) 
def create_order_from_cart(request):

    try:
        logger.info("=" * 80)
        logger.info("[create_order_from_cart] 🛒 Starting order creation")
        logger.info(f"[create_order_from_cart] Authenticated: {request.user.is_authenticated}")
        logger.info(f"[create_order_from_cart] Request data: {request.data}")
        
        patient = None
        session_id = None

        if request.user and request.user.is_authenticated:
            patient = request.user
            logger.info(f"[create_order_from_cart]  Authenticated user: {patient.username}")
        else:
            session_id = request.data.get('session_id')
            logger.info(f"[create_order_from_cart] 👤 Anonymous session: {session_id}")
            
            if not session_id:
                logger.error("[create_order_from_cart]  No session_id provided")
                return Response(
                    {'error': 'Session ID is required for anonymous orders'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            delivery_phone = request.data.get('delivery_phone')
            
            if not delivery_phone:
                logger.error("[create_order_from_cart]  No delivery phone provided")
                return Response(
                    {'error': 'Delivery phone is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            from api.models import CustomUser
            
            patient = CustomUser.objects.filter(
                phone_number=delivery_phone,
                user_type='patient'
            ).first()
            
            if not patient:
                full_name = request.data.get('full_name', 'Guest User')
                name_parts = full_name.split()
                first_name = name_parts[0] if name_parts else 'Guest'
                last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
                
                username = f"patient_{delivery_phone}"
                
                if CustomUser.objects.filter(username=username).exists():
                    username = f"patient_{delivery_phone}_{int(timezone.now().timestamp())}"
                
                patient = CustomUser.objects.create_user(
                    username=username,
                    phone_number=delivery_phone,
                    first_name=first_name,
                    last_name=last_name,
                    user_type='patient',
                    is_verified=True,
                    password=None  
                )
                
                try:
                    patient_group, _ = Group.objects.get_or_create(name='Patient')
                    patient.groups.add(patient_group)
                except Exception as group_error:
                    logger.warning(f"[create_order_from_cart] Failed to add to group: {group_error}")
                
                logger.info(f"[create_order_from_cart]  Created temp patient: {patient.username}")
            else:
                logger.info(f"[create_order_from_cart]  Found existing patient: {patient.username}")
        
        from api.models import CartItem
        
        if patient:
            cart_items = CartItem.objects.filter(user=patient).select_related('medicine')
            logger.info(f"[create_order_from_cart] Fetching cart for user: {patient.username}")
        else:
            cart_items = CartItem.objects.filter(session_id=session_id).select_related('medicine')
            logger.info(f"[create_order_from_cart] Fetching cart for session: {session_id}")
        
        if not cart_items.exists():
            logger.error("[create_order_from_cart]  Cart is empty")
            return Response(
                {'error': 'Cart is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logger.info(f"[create_order_from_cart] Found {cart_items.count()} cart items")
        
        delivery_address = request.data.get('delivery_address')
        delivery_phone = request.data.get('delivery_phone')
        payment_method = request.data.get('payment_method', 'cash_on_delivery')
        
        if not delivery_address or not delivery_phone:
            logger.error("[create_order_from_cart]  Missing delivery info")
            return Response(
                {'error': 'Delivery address and phone are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        subtotal = sum(item.get_subtotal() for item in cart_items)
        
        delivery_charge = Decimal(str(request.data.get('delivery_charge', 0 if subtotal >= 500 else 40)))
        discount = Decimal(str(request.data.get('discount', 0)))
        total_amount = Decimal(str(request.data.get('total_amount', subtotal - discount + delivery_charge)))
        
        logger.info(f"[create_order_from_cart]  Subtotal: ₹{subtotal}")
        logger.info(f"[create_order_from_cart]  Delivery: ₹{delivery_charge}")
        logger.info(f"[create_order_from_cart]  Discount: ₹{discount}")
        logger.info(f"[create_order_from_cart]  Total: ₹{total_amount}")
        for item in cart_items:
            if item.medicine.stock_quantity < item.quantity:
                logger.error(f"[create_order_from_cart]  Insufficient stock for {item.medicine.name}")
                return Response(
                    {'error': f'Insufficient stock for {item.medicine.name}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        order_items = []
        for item in cart_items:
            order_items.append({
                'medicine_id': item.medicine.id,
                'medicine_name': item.medicine.name,
                'quantity': item.quantity,
                'price': float(item.price_at_addition),
                'subtotal': float(item.get_subtotal())
            })
        
        order_number = f"ORD{timezone.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:6].upper()}"
        
        from api.models import MedicineOrder
        
        order = MedicineOrder.objects.create(
            order_number=order_number,
            patient=patient, 
            delivery_address=delivery_address,
            delivery_phone=delivery_phone,
            payment_method=payment_method,
            order_items=order_items,
            subtotal=subtotal,
            discount=discount,
            delivery_charge=delivery_charge,
            total_amount=total_amount,
            order_status='pending',
            payment_status='pending'
        )
        
        logger.info(f"[create_order_from_cart]  Order created: {order_number}")
        
        for item in cart_items:
            medicine = item.medicine
            medicine.stock_quantity -= item.quantity
            medicine.save(update_fields=['stock_quantity'])
            logger.info(f"[create_order_from_cart] 📦 Updated stock for {medicine.name}: -{item.quantity}")
        
        deleted_count = cart_items.count()
        cart_items.delete()
        logger.info(f"[create_order_from_cart] 🧹 Cleared {deleted_count} items from cart")
        
        logger.info("=" * 80)
        
        return Response({
            'success': True,
            'message': 'Order placed successfully',
            'order': {
                'id': str(order.id),
                'order_number': order.order_number,
                'total_amount': float(order.total_amount),
                'order_status': order.order_status,
                'payment_status': order.payment_status,
                'delivery_address': order.delivery_address,
                'delivery_phone': order.delivery_phone,
                'created_at': order.created_at.isoformat(),
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error("=" * 80)
        logger.error(f"[create_order_from_cart]  EXCEPTION: {str(e)}")
        import traceback
        logger.error(f"[create_order_from_cart] Traceback:\n{traceback.format_exc()}")
        logger.error("=" * 80)
        
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_my_orders(request):
    session_id = request.query_params.get('session_id')
    phone      = request.query_params.get('phone')

    queryset = MedicineOrder.objects.all()

    if session_id:
        queryset = queryset.filter(session_id=session_id)
    elif phone:
        queryset = queryset.filter(delivery_phone=phone)
    elif request.user.is_authenticated:
        queryset = queryset.filter(patient=request.user)
    else:
        queryset = MedicineOrder.objects.none()

    queryset = queryset.order_by('-created_at')
    serializer = MedicineOrderSerializer(queryset, many=True)
    return Response(serializer.data)



@api_view(['GET'])
@permission_classes([AllowAny])
def get_order_details(request, order_id):
    try:
        order = MedicineOrder.objects.get(id=order_id)
        
        if request.user and request.user.is_authenticated:
            if order.patient and order.patient.id != request.user.id:
                return Response(
                    {'error': 'Unauthorized'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = MedicineOrderSerializer(order)
        
        return Response({
            'success': True,
            'order': serializer.data
        })
        
    except MedicineOrder.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"[get_order_details] Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def autocorrect_query(request):
    try:
        query = request.data.get('query', '').strip()
        
        if not query:
            return Response(
                {'error': 'Query is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        medicine_names = Medicine.objects.values_list('name', 'generic_name')
        custom_terms = set()
        for name, generic in medicine_names:
            if name:
                custom_terms.add(name.lower())
            if generic:
                custom_terms.add(generic.lower())
        
        result = auto_correct_search_query(query, custom_terms)
        
        logger.info(f"[AutoCorrect] '{query}' -> '{result['corrected']}'")
        
        return Response({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        logger.error(f"[AutoCorrect] Error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([AllowAny])
def test_language_detection(request):
    try:
        message = request.data.get('message', '')
        
        if not message:
            return Response({'error': 'message is required'}, status=400)
        
        from .helpers import (
            detect_romanized_language,
            detect_language,
            get_response_language
        )
        
        romanized = detect_romanized_language(message)
        from langdetect import detect as langdetect_detect
        
        try:
            native_code = langdetect_detect(message)
        except:
            native_code = None
        
        final_language = get_response_language(message, 'English')
        
        from .helpers import (
            MALAYALAM_PATTERNS, TAMIL_PATTERNS, TELUGU_PATTERNS,
            KANNADA_PATTERNS, HINDI_PATTERNS
        )
        
        pattern_matches = {
            'Malayalam': sum(1 for p in MALAYALAM_PATTERNS if re.search(p, message.lower())),
            'Tamil': sum(1 for p in TAMIL_PATTERNS if re.search(p, message.lower())),
            'Telugu': sum(1 for p in TELUGU_PATTERNS if re.search(p, message.lower())),
            'Kannada': sum(1 for p in KANNADA_PATTERNS if re.search(p, message.lower())),
            'Hindi': sum(1 for p in HINDI_PATTERNS if re.search(p, message.lower())),
        }
        
        matched_patterns = {}
        for lang, patterns in [
            ('Malayalam', MALAYALAM_PATTERNS),
            ('Tamil', TAMIL_PATTERNS),
            ('Telugu', TELUGU_PATTERNS),
            ('Kannada', KANNADA_PATTERNS),
            ('Hindi', HINDI_PATTERNS)
        ]:
            matches = []
            for pattern in patterns:
                if re.search(pattern, message.lower()):
                    
                    match = re.search(pattern, message.lower())
                    if match:
                        matches.append(match.group(0))
            if matches:
                matched_patterns[lang] = matches
        
        return Response({
            'success': True,
            'message': message,
            'detection_results': {
                'romanized_language': romanized,
                'native_script_code': native_code,
                'final_language_used': final_language,
            },
            'pattern_scores': pattern_matches,
            'matched_words': matched_patterns,
            'explanation': {
                'romanized': f"Romanized detection found: {romanized or 'None'}",
                'native': f"Native script detection code: {native_code or 'None'}",
                'final': f"Final language that will be used: {final_language}",
            }
        })
        
    except Exception as e:
        import traceback
        return Response({
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)

@api_view(['GET'])
def ocr_statistics(request):
    
    from .helpers import get_ocr_statistics
    
    user_id = request.query_params.get('user_id')
    stats = get_ocr_statistics(user_id)
    
    return Response({
        'success': True,
        'statistics': stats
    })

def _call_claude_prescription(file_bytes: bytes, file_type: str) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    system_prompt = """You are a medical prescription analyzer AI. 
Extract ALL medication information from the prescription provided.

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "medicines": [
    {
      "name": "medicine brand/name as written",
      "generic_name": "generic/chemical name if visible or empty string",
      "dosage": "e.g., 500mg or empty string",
      "frequency": "e.g., twice daily or empty string",
      "duration": "e.g., 7 days or empty string",
      "instructions": "e.g., after meals or empty string"
    }
  ],
  "doctorInfo": {
    "name": "doctor name or empty string",
    "qualification": "qualification or empty string",
    "clinic": "clinic/hospital name or empty string",
    "phone": "phone or empty string",
    "registration": "registration number or empty string"
  },
  "patientInfo": {
    "name": "patient name or empty string",
    "age": "age or empty string",
    "gender": "gender or empty string"
  },
  "diagnosis": "diagnosis/condition if mentioned or empty string"
}

IMPORTANT:
- Extract every single medicine listed
- Include brand names and generic names separately
- Return ONLY the JSON object, nothing else"""

    if file_type == 'application/pdf':
        b64 = base64.standard_b64encode(file_bytes).decode('utf-8')
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": b64,
                },
            },
            {
                "type": "text",
                "text": "Extract all medicines and prescription information from this PDF prescription."
            }
        ]
    elif file_type in ('image/jpeg', 'image/jpg', 'image/png', 'image/webp'):
        b64 = base64.standard_b64encode(file_bytes).decode('utf-8')
        media_type_map = {
            'image/jpeg': 'image/jpeg',
            'image/jpg': 'image/jpeg',
            'image/png': 'image/png',
            'image/webp': 'image/webp',
        }
        content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type_map.get(file_type, 'image/jpeg'),
                    "data": b64,
                },
            },
            {
                "type": "text",
                "text": "Extract all medicines and prescription information from this prescription image."
            }
        ]
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=system_prompt,
        messages=[
            {"role": "user", "content": content}
        ]
    )

    raw_text = response.content[0].text.strip()

    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_text)
    if json_match:
        raw_text = json_match.group(1)

    start = raw_text.find('{')
    end = raw_text.rfind('}')
    if start != -1 and end != -1:
        raw_text = raw_text[start:end + 1]

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"[PrescriptionScan] JSON parse error: {e}\nRaw: {raw_text[:500]}")
        raise ValueError("AI returned invalid response. Please try with a clearer image.")

    return data


def _match_medicines(medicines: list) -> dict:
    matched = []
    unmatched = []

    for med in medicines:
        medicine_name = med.get('name', '').strip()
        generic_name = med.get('generic_name', '').strip()

        if not medicine_name:
            continue

        product = None
        search_terms = [t for t in [medicine_name, generic_name] if t]

        for term in search_terms:
            if not term:
                continue

            product = Medicine.objects.filter(
                name__iexact=term,
                is_active=True
            ).first()

            if product:
                break

            product = Medicine.objects.filter(
                name__icontains=term,
                is_active=True
            ).first()

            if product:
                break

            product = Medicine.objects.filter(
                generic_name__icontains=term,
                is_active=True
            ).first()

            if product:
                break

        if product:
            matched.append({
                'medicine': med,
                'product': {
                    'id': product.id,
                    'name': product.name,
                    'generic_name': product.generic_name or '',
                    'category': product.category or '',
                    'form': product.form or '',
                    'strength': product.strength or '',
                    'manufacturer': product.manufacturer or '',
                    'price': float(product.price),
                    'mrp': float(product.mrp) if product.mrp else float(product.price),
                    'discount_percentage': float(product.discount_percentage or 0),
                    'stock_quantity': product.stock_quantity,
                    'requires_prescription': product.requires_prescription,
                    'is_active': product.is_active,
                }
            })
        else:
            unmatched.append(med)

    return {'matched': matched, 'unmatched': unmatched}

@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def scan_prescription(request):
    if request.method == 'OPTIONS':
        response = JsonResponse({})
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response

    try:
        if 'prescription' not in request.FILES:
            return JsonResponse(
                {'error': 'No prescription file uploaded. Include a file in the "prescription" field.'},
                status=400
            )

        prescription_file = request.FILES['prescription']
        file_type = prescription_file.content_type

        allowed_types = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
        ]
        if file_type not in allowed_types:
            return JsonResponse(
                {'error': f'Unsupported file type: {file_type}. Please upload a PDF or image (JPG, PNG, WEBP).'},
                status=400
            )

        max_size = 10 * 1024 * 1024
        if prescription_file.size > max_size:
            return JsonResponse(
                {'error': 'File too large. Maximum size is 10MB.'},
                status=400
            )

        file_bytes = prescription_file.read()

        logger.info(f"[PrescriptionScan] Processing {file_type} file, size={prescription_file.size} bytes")

        try:
            extracted_data = _call_claude_prescription(file_bytes, file_type)
        except ValueError as e:
            return JsonResponse({'error': str(e)}, status=422)
        except Exception as e:
            logger.error(f"[PrescriptionScan] Claude API error: {e}")
            return JsonResponse(
                {'error': 'AI analysis failed. Please ensure your prescription image is clear and try again.'},
                status=500
            )

        medicines = extracted_data.get('medicines', [])

        if not medicines:
            return JsonResponse(
                {
                    'error': 'No medicines detected in this prescription.',
                    'hint': 'Please ensure the prescription text is clearly visible and try again.',
                    'extracted_data': extracted_data,
                },
                status=422
            )

        logger.info(f"[PrescriptionScan] Extracted {len(medicines)} medicines")

        match_results = _match_medicines(medicines)

        logger.info(
            f"[PrescriptionScan] Matched: {len(match_results['matched'])}, "
            f"Unmatched: {len(match_results['unmatched'])}"
        )

        return JsonResponse({
            'success': True,
            'extracted_medicines': medicines,
            'matched_products': match_results['matched'],
            'unavailable_medicines': match_results['unmatched'],
            'prescription_info': {
                'doctorInfo': extracted_data.get('doctorInfo', {}),
                'patientInfo': extracted_data.get('patientInfo', {}),
                'diagnosis': extracted_data.get('diagnosis', ''),
            },
            'summary': {
                'total_medicines': len(medicines),
                'available_count': len(match_results['matched']),
                'unavailable_count': len(match_results['unmatched']),
            }
        })

    except Exception as e:
        logger.error(f"[PrescriptionScan] Unexpected error: {e}", exc_info=True)
        return JsonResponse(
            {'error': 'An unexpected error occurred. Please try again.'},
            status=500
        )

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)

def _get_groq_client():
    try:
        from groq import Groq
        api_key = os.environ.get('GROQ_API_KEY')
        if not api_key:
            raise ValueError("GROQ_API_KEY not set in environment / .env")
        return Groq(api_key=api_key)
    except ImportError:
        raise ImportError("groq package not installed. Run: pip install groq")


PRESCRIPTION_SYSTEM_PROMPT = """You are a medical prescription analyzer. Extract ALL medication information from the prescription provided.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "medicines": [
    {
      "name": "medicine name",
      "generic_name": "generic/chemical name if visible",
      "dosage": "e.g., 500mg",
      "frequency": "e.g., twice daily",
      "duration": "e.g., 7 days",
      "instructions": "e.g., after meals"
    }
  ],
  "doctorInfo": {
    "name": "doctor name or empty string",
    "qualification": "qualification or empty string",
    "clinic": "clinic/hospital name or empty string",
    "phone": "phone or empty string",
    "registration": "registration number or empty string"
  },
  "patientInfo": {
    "name": "patient name or empty string",
    "age": "age or empty string",
    "gender": "gender or empty string"
  },
  "diagnosis": "diagnosis/condition if mentioned, or empty string"
}

Extract every medicine name accurately. Include both brand and generic names if visible. Return ONLY the JSON object."""


def _parse_groq_json(text: str) -> dict:
    import re
    text = text.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from response: {text[:200]}")


def _analyze_image_with_groq(image_b64: str, mime_type: str) -> dict:
    client = _get_groq_client()

    completion = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct", 
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_b64}",
                        },
                    },
                    {
                        "type": "text",
                        "text": PRESCRIPTION_SYSTEM_PROMPT + "\n\nAnalyze this prescription image and extract all medicines and information.",
                    },
                ],
            }
        ],
        temperature=0.1,
        max_tokens=2048,
    )

    response_text = completion.choices[0].message.content
    return _parse_groq_json(response_text)


def _analyze_pdf_with_groq(pdf_b64: str) -> dict:
    client = _get_groq_client()
    try:
        import fitz 
        pdf_bytes = base64.b64decode(pdf_b64)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        extracted_text = ""
        for page in doc:
            extracted_text += page.get_text()
        doc.close()

        if extracted_text.strip():
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": PRESCRIPTION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Here is the prescription text extracted from a PDF:\n\n{extracted_text}\n\nExtract all medicines and information.",
                    },
                ],
                temperature=0.1,
                max_tokens=2048,
            )
            return _parse_groq_json(completion.choices[0].message.content)

    except ImportError:
        logger.warning("PyMuPDF not installed. Falling back to image conversion for PDFs.")
    except Exception as e:
        logger.warning(f"PDF text extraction failed: {e}. Falling back to image.")

    try:
        import fitz
        pdf_bytes = base64.b64decode(pdf_b64)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        doc.close()

        img_b64 = base64.b64encode(img_bytes).decode('utf-8')
        return _analyze_image_with_groq(img_b64, "image/png")

    except ImportError:
        raise ImportError(
            "PyMuPDF not installed. PDF scanning requires it. "
            "Run: pip install pymupdf"
        )

@csrf_exempt
@require_http_methods(["POST"])
def scan_prescription(request):
    
    try:
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return JsonResponse(
                {"success": False, "error": "No file uploaded. Use field name 'file'."},
                status=400
            )

        mime_type = uploaded_file.content_type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
        if mime_type not in allowed_types:
            return JsonResponse(
                {"success": False, "error": f"Unsupported file type: {mime_type}"},
                status=400
            )
        max_size = 25 * 1024 * 1024
        if uploaded_file.size > max_size:
            return JsonResponse(
                {"success": False, "error": "File too large. Maximum size is 25MB."},
                status=400
            )

        file_bytes = uploaded_file.read()
        file_b64 = base64.b64encode(file_bytes).decode('utf-8')

        logger.info(f"[scan_prescription] Analyzing {mime_type} file ({uploaded_file.size} bytes)")

        if mime_type == 'application/pdf':
            extracted = _analyze_pdf_with_groq(file_b64)
        else:
            extracted = _analyze_image_with_groq(file_b64, mime_type)

        medicines = extracted.get('medicines', [])
        if not medicines:
            return JsonResponse({
                "success": False,
                "error": "No medicines found in this prescription. Please ensure the image is clear and complete."
            }, status=422)

        from django.db.models import Q
        try:
            from .models import Medicine 
        except ImportError:
            from api.models import Medicine

        matched_products = []
        unmatched_medicines = []

        for medicine in medicines:
            med_name = (medicine.get('name') or '').strip()
            generic_name = (medicine.get('generic_name') or '').strip()

            if not med_name:
                continue

            query = Q(name__icontains=med_name) | Q(generic_name__icontains=med_name)
            if generic_name:
                query |= Q(name__icontains=generic_name) | Q(generic_name__icontains=generic_name)

            product = Medicine.objects.filter(query, is_active=True).first()

            if product:
                matched_products.append({
                    "medicine": medicine,
                    "product": {
                        "id": product.id,
                        "name": product.name,
                        "generic_name": product.generic_name or "",
                        "manufacturer": product.manufacturer or "",
                        "price": str(product.price),
                        "mrp": str(product.mrp),
                        "discount_percentage": str(product.discount_percentage),
                        "stock_quantity": product.stock_quantity,
                        "requires_prescription": product.requires_prescription,
                        "strength": product.strength or "",
                        "form": product.form or "",
                        "category": product.category or "",
                        "image": request.build_absolute_uri(product.image.url) if product.image else None,
                    }
                })
            else:
                unmatched_medicines.append(medicine)

        return JsonResponse({
            "success": True,
            "medicines": medicines,
            "doctorInfo": extracted.get('doctorInfo', {}),
            "patientInfo": extracted.get('patientInfo', {}),
            "diagnosis": extracted.get('diagnosis', ''),
            "matched_products": matched_products,
            "unmatched_medicines": unmatched_medicines,
        })

    except ValueError as e:
        logger.error(f"[scan_prescription] Parse error: {e}")
        return JsonResponse(
            {"success": False, "error": "Could not parse prescription data. Please try a clearer image."},
            status=422
        )
    except Exception as e:
        logger.error(f"[scan_prescription] Unexpected error: {e}", exc_info=True)
        return JsonResponse(
            {"success": False, "error": f"Prescription analysis failed: {str(e)}"},
            status=500
        )
    
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')


import json
import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q, Avg
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def analyze_medicine_image(request):
    try:
        image_file = request.FILES.get('image')
        if not image_file:
            return Response(
                {'error': 'No image provided. Please upload an image file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        if image_file.content_type not in allowed_types:
            return Response(
                {'error': f'Invalid file type: {image_file.content_type}. Use JPG, PNG, or WebP.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        max_size = 10 * 1024 * 1024 
        if image_file.size > max_size:
            return Response(
                {'error': 'Image too large. Maximum size is 10MB.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        image_data = image_file.read()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        media_type = image_file.content_type 

        groq_api_key = os.environ.get('GROQ_API_KEY')
        if not groq_api_key:
            logger.error('GROQ_API_KEY not set in environment')
            return Response(
                {'error': 'AI service not configured. Contact administrator.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            from groq import Groq
        except ImportError:
            logger.error('groq package not installed. Run: pip install groq')
            return Response(
                {'error': 'AI service unavailable (groq package missing).'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        client = Groq(api_key=groq_api_key)

        prompt = """You are a pharmacy assistant AI. Analyze this medicine or medical product image and extract all visible information.

Return ONLY a valid JSON object with these exact keys (use null for missing values):

{
  "name": "Product/medicine name",
  "generic_name": "Generic/chemical name",
  "manufacturer": "Company that made it",
  "brand": "Brand name if different from manufacturer",
  "category": "One of: medicines, antibiotics, painkillers, vitamins, ayurvedic, homeopathy, thermometers, bp_monitors, glucometers, pulse_oximeters, nebulizers, bandages, antiseptics, first_aid_kits, syringes, gloves, diapers, baby_food, sanitizers, masks, diabetic_supplies, other",
  "form": "One of: tablet, capsule, syrup, injection, cream, drops, inhaler, powder, or device type",
  "strength": "Dosage strength e.g. 500mg, 10ml",
  "price": null,
  "mrp": null,
  "pack_size": "e.g. 10 tablets, 100ml",
  "description": "Brief product description",
  "composition": "Active ingredients if visible",
  "side_effects": "Common side effects if listed",
  "contraindications": "Who should not use it",
  "storage_instructions": "One of: room_temp, cool_place, refrigerated",
  "requires_prescription": false,
  "expiry_date": null,
  "batch_number": null
}

Important:
- Extract ONLY what is clearly visible in the image
- Do not guess or fabricate prices
- Keep description concise (1-2 sentences)
- Return ONLY the JSON, no other text"""

        logger.info(f'Sending image to Groq for analysis: {image_file.name}, size={image_file.size}')

        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_base64}"
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ],
            temperature=0.1,
            max_tokens=1024,
        )

        raw_response = completion.choices[0].message.content.strip()
        logger.info(f'Groq raw response: {raw_response[:300]}')

        if raw_response.startswith('```'):
            raw_response = raw_response.split('```')[1]
            if raw_response.startswith('json'):
                raw_response = raw_response[4:]
        raw_response = raw_response.strip()

        try:
            extracted_data = json.loads(raw_response)
        except json.JSONDecodeError as e:
            logger.error(f'JSON parse error: {e}. Raw: {raw_response}')
            return Response(
                {
                    'success': False,
                    'error': 'AI returned unstructured response. Please try a clearer image.',
                    'raw': raw_response
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        cleaned_data = {k: v for k, v in extracted_data.items() if v is not None and v != ''}

        if 'requires_prescription' in cleaned_data:
            val = cleaned_data['requires_prescription']
            cleaned_data['requires_prescription'] = bool(val) if not isinstance(val, bool) else val

        for price_field in ('price', 'mrp'):
            if price_field in cleaned_data:
                cleaned_data[price_field] = str(cleaned_data[price_field])

        logger.info(f'Successfully extracted data for: {cleaned_data.get("name", "unknown")}')

        return Response(
            {
                'success': True,
                'data': cleaned_data,
                'message': f'Successfully extracted information from image'
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.exception(f'Unexpected error in analyze_medicine_image: {e}')
        return Response(
            {
                'success': False,
                'error': f'Server error: {str(e)}'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

@api_view(['POST'])
@permission_classes([AllowAny])
def sync_medication_logs(request):
    reminder_id = request.data.get('reminder_id') or request.data.get('reminderId')
    status_value = request.data.get('status', 'taken')
    scheduled_time = request.data.get('scheduled_time') or request.data.get('scheduledTime')
    taken_at = request.data.get('taken_at') or request.data.get('takenAt')
    notes = request.data.get('notes', '')

    if not reminder_id:
        return Response({'error': 'reminder_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        reminder = MedicationReminder.objects.get(id=reminder_id)
    except MedicationReminder.DoesNotExist:
        return Response({'error': 'Reminder not found'}, status=status.HTTP_404_NOT_FOUND)

    from django.utils.dateparse import parse_datetime

    scheduled_dt = parse_datetime(scheduled_time) if scheduled_time else timezone.now()
    taken_at_dt = None
    if taken_at and status_value == 'taken':
        taken_at_dt = parse_datetime(taken_at) or timezone.now()
    elif status_value == 'taken':
        taken_at_dt = timezone.now()

    existing = MedicationLog.objects.filter(
        reminder=reminder,
        scheduled_time=scheduled_dt
    ).first()

    if existing:
        existing.status = status_value
        existing.taken_at = taken_at_dt
        existing.notes = notes
        existing.save()
        log = existing
    else:
        log = MedicationLog.objects.create(
            reminder=reminder,
            patient=reminder.patient,
            scheduled_time=scheduled_dt or timezone.now(),
            taken_at=taken_at_dt,
            status=status_value,
            notes=notes,
        )

    return Response({
        'success': True,
        'synced': True,
        'log_id': log.id,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def sync_missed_reminders(request):
    missed_list = request.data.get('missed', [])
    synced = 0

    from django.utils.dateparse import parse_datetime

    for item in missed_list:
        reminder_id = item.get('reminderId') or item.get('reminder_id')
        scheduled_time = item.get('scheduledTime') or item.get('scheduled_time')

        try:
            reminder = MedicationReminder.objects.get(id=reminder_id)
            scheduled_dt = parse_datetime(scheduled_time) if scheduled_time else timezone.now()

            MedicationLog.objects.get_or_create(
                reminder=reminder,
                scheduled_time=scheduled_dt,
                defaults={
                    'patient': reminder.patient,
                    'status': 'missed',
                    'notes': 'Synced from offline PWA',
                }
            )
            synced += 1
        except (MedicationReminder.DoesNotExist, Exception):
            continue

    return Response({'success': True, 'synced': synced})


@api_view(['POST'])
def adherence_prediction(request):
    patient_id = request.data.get('patient_id')
    reminders = request.data.get('reminders', [])

    if not reminders:
        return Response({
            'predicted_adherence_rate': 100,
            'risk_level': 'low',
            'recommendations': ['Keep up the good work!'],
            'insights': 'No active reminders to analyze.',
        })

    total_logs = 0
    taken_logs = 0
    for reminder_data in reminders:
        reminder_id = reminder_data.get('id')
        if not reminder_id:
            continue
        try:
            reminder = MedicationReminder.objects.get(id=reminder_id)
            logs = MedicationLog.objects.filter(reminder=reminder)
            total_logs += logs.count()
            taken_logs += logs.filter(status='taken').count()
        except MedicationReminder.DoesNotExist:
            pass

    adherence_rate = (taken_logs / total_logs * 100) if total_logs > 0 else 100

    if adherence_rate >= 80:
        risk_level = 'low'
        recommendations = [
            'Excellent adherence! Keep it up.',
            'Consider setting backup reminders for critical medications.',
        ]
    elif adherence_rate >= 60:
        risk_level = 'medium'
        recommendations = [
            'Try to take medications at the same time each day.',
            'Use the "Mark as Taken" button immediately after taking medication.',
            'Consider linking medications to daily habits like meals.',
        ]
    else:
        risk_level = 'high'
        recommendations = [
            'Please consult your doctor about your medication schedule.',
            'Set multiple reminder times to avoid missing doses.',
            'Ask a family member to help remind you.',
        ]

    return Response({
        'predicted_adherence_rate': round(adherence_rate, 1),
        'risk_level': risk_level,
        'recommendations': recommendations,
        'insights': f'Based on {total_logs} logged doses, you have taken {taken_logs} on time.',
    })


@api_view(['GET'])
def reminder_stats(request):
    patient_id = request.query_params.get('patient')
    qs = MedicationReminder.objects.all()
    if patient_id:
        qs = qs.filter(patient__id=patient_id)

    total = qs.count()
    active = qs.filter(is_active=True).count()

    from django.utils.timezone import now
    today = now().date()
    logs_today = MedicationLog.objects.filter(
        reminder__in=qs,
        scheduled_time__date=today
    )

    return Response({
        'total_reminders': total,
        'active_reminders': active,
        'logs_today': logs_today.count(),
        'taken_today': logs_today.filter(status='taken').count(),
        'missed_today': logs_today.filter(status='missed').count(),
    })

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import EnhancedPrescription, CustomUser
from .serializers import EnhancedPrescriptionSerializer


from rest_framework.permissions import BasePermission

class IsPatientOnly(BasePermission):
    message = "Only patients can access this endpoint."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.user_type == 'patient'
        )

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, EnhancedPrescription):
            if obj.patient and obj.patient == request.user:
                return True
            if obj.patient_phone and obj.patient_phone == request.user.phone_number:
                return True
            return False
        return False

class PatientPrescriptionViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = EnhancedPrescriptionSerializer
    permission_classes = [IsAuthenticated, IsPatientOnly]

    def get_queryset(self):
        user = self.request.user

        queryset = EnhancedPrescription.objects.filter(
            patient=user
        ) | EnhancedPrescription.objects.filter(
            patient__isnull=True,
            patient_phone=user.phone_number
        )

        queryset = queryset.order_by('-created_at')

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                diagnosis__icontains=search
            ) | queryset.filter(
                doctor_name__icontains=search
            ) | queryset.filter(
                medications__icontains=search
            )

        return queryset

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='active')
    def active_prescriptions(self, request):
        queryset = self.get_queryset().filter(status='active')
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'prescriptions': serializer.data
        })

    @action(detail=False, methods=['get'], url_path='stats')
    def prescription_stats(self, request):
        queryset = self.get_queryset()
        total = queryset.count()
        active = queryset.filter(status='active').count()
        completed = queryset.filter(status='completed').count()
        cancelled = queryset.filter(status='cancelled').count()

        ninety_days_ago = timezone.now().date() - timezone.timedelta(days=90)
        recent = queryset.filter(date__gte=ninety_days_ago).count()

        upcoming_followups = queryset.filter(
            follow_up_date__gte=timezone.now().date(),
            status='active'
        ).order_by('follow_up_date')[:3]

        return Response({
            'total': total,
            'active': active,
            'completed': completed,
            'cancelled': cancelled,
            'recent_90_days': recent,
            'upcoming_followups': EnhancedPrescriptionSerializer(
                upcoming_followups, many=True, context={'request': request}
            ).data
        })

    @action(detail=True, methods=['get'], url_path='medications')
    def prescription_medications(self, request, pk=None):
        prescription = self.get_object()
        return Response({
            'prescription_id': str(prescription.id),
            'date': prescription.date,
            'doctor_name': prescription.doctor_name,
            'medications': prescription.medications or []
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsPatientOnly])
def patient_my_prescriptions(request):
    user = request.user

    prescriptions = EnhancedPrescription.objects.filter(
        patient=user
    ).union(
        EnhancedPrescription.objects.filter(
            patient__isnull=True,
            patient_phone=user.phone_number
        )
    ).order_by('-created_at')

    status_filter = request.query_params.get('status')
    if status_filter:
        prescriptions = prescriptions.filter(status=status_filter)

    serializer = EnhancedPrescriptionSerializer(
        prescriptions, many=True, context={'request': request}
    )
    return Response({
        'patient': user.get_full_name() or user.username,
        'total': prescriptions.count(),
        'prescriptions': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsPatientOnly])
def patient_prescription_detail(request, prescription_id):
    user = request.user

    prescription = EnhancedPrescription.objects.filter(
        id=prescription_id
    ).filter(
        patient=user
    ).first()
    if not prescription:
        prescription = EnhancedPrescription.objects.filter(
            id=prescription_id,
            patient__isnull=True,
            patient_phone=user.phone_number
        ).first()

    if not prescription:
        return Response(
            {'error': 'Prescription not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = EnhancedPrescriptionSerializer(
        prescription, context={'request': request}
    )
    return Response(serializer.data)

class PharmacistsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, pk=None):
        try:
            user = CustomUser.objects.get(pk=pk, user_type='pharmacist')
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Pharmacist not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = PharmacistUserSerializer(user, context={'request': request})
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        return self._update(request, pk, partial=True)

    def update(self, request, pk=None):
        return self._update(request, pk, partial=False)

    def _update(self, request, pk, partial):
        try:
            user = CustomUser.objects.get(pk=pk, user_type='pharmacist')
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Pharmacist not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.user.pk != user.pk and not request.user.is_staff:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = PharmacistUserSerializer(
            user,
            data=request.data,
            partial=partial,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(
        detail=True,
        methods=['post'],
        url_path='upload_profile_picture',
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_profile_picture(self, request, pk=None):
        try:
            user = CustomUser.objects.get(pk=pk, user_type='pharmacist')
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'Pharmacist not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.user.pk != user.pk and not request.user.is_staff:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        file = request.FILES.get('profile_picture') or request.FILES.get('image')
        if not file:
            return Response(
                {'error': 'No image file provided. Use key "profile_picture" or "image".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user.profile_picture:
            try:
                user.profile_picture.delete(save=False)
            except Exception:
                pass

        user.profile_picture = file
        user.save(update_fields=['profile_picture'])

        serializer = PharmacistUserSerializer(user, context={'request': request})
        return Response({
            'message': 'Profile picture updated successfully',
            'profile_picture_url': serializer.data.get('profile_picture_url'),
        })

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def voice_to_text(request):
    try:
        audio_file = request.FILES.get('audio')
        language = request.data.get('language', 'English')
        selected_language = request.data.get('selected_language', language)

        print(f"[VOICE] Language param: {language}")
        print(f"[VOICE] Selected language: {selected_language}")

        if selected_language and selected_language != 'English':
            language = selected_language

        if not audio_file:
            return Response({'error': 'No audio file'}, status=400)

        groq_api_key = os.getenv('GROQ_API_KEY')
        if not groq_api_key:
            return Response({'error': 'GROQ_API_KEY not configured'}, status=500)

        try:
            from groq import Groq
        except ImportError:
            return Response({'error': 'groq package not installed'}, status=500)

        client = Groq(api_key=groq_api_key)

        lang_code_map = {
            'English': 'en', 'Hindi': 'hi', 'Kannada': 'kn',
            'Tamil': 'ta', 'Telugu': 'te', 'Malayalam': 'ml'
        }
        lang_code = lang_code_map.get(language, 'en')

        audio_bytes = audio_file.read()
        file_size = len(audio_bytes)
        logger.info(f"[voice_to_text] Received audio: {audio_file.name}, "
                    f"size={file_size}, content_type={audio_file.content_type}")

        if file_size < 1000:
            return Response({
                'success': False,
                'error': 'Audio too short'
            }, status=400)

        # Determine extension from content type or filename
        content_type = audio_file.content_type or ''
        filename = audio_file.name or 'voice.webm'

        if 'ogg' in content_type or filename.endswith('.ogg'):
            ext = 'ogg'
        elif 'mp4' in content_type or filename.endswith('.mp4'):
            ext = 'mp4'
        else:
            ext = 'webm'

        # Save to temp file
        with tempfile.NamedTemporaryFile(
            suffix=f'.{ext}', delete=False
        ) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            logger.info(f"[voice_to_text] Sending to Groq Whisper: {tmp_path}")
            with open(tmp_path, 'rb') as f:
                transcription = client.audio.transcriptions.create(
                    model="whisper-large-v3",
                    file=(f'audio.{ext}', f, f'audio/{ext}'),
                    language=lang_code,
                    response_format="text"
                )

            text = transcription if isinstance(transcription, str) else transcription.text
            text = (text or '').strip()

            logger.info(f"[voice_to_text] Transcribed: '{text}'")

            # Filter out Whisper hallucinations (dots, empty, thank you, etc.)
            hallucinations = {'.', '..', '...', 'thank you', 'thanks',
                              'you', 'bye', 'okay', 'ok', ''}
            if text.lower() in hallucinations or len(text) < 2:
                return Response({
                    'success': False,
                    'error': 'Could not understand speech. Please speak clearly.'
                }, status=200)

            from .helpers import get_response_language
            detected_lang = get_response_language(text, language)

            print(f"[VOICE] Detected language: {detected_lang}")

            from .helpers import get_response_language, detect_romanized_language

            romanized_lang = detect_romanized_language(text)

            if romanized_lang:
                final_lang = romanized_lang
                print(f"[VOICE] Romanized detected: {final_lang}")
            elif language and language != 'English':
                final_lang = language
                print(f"[VOICE] Using user selected language: {final_lang}")
            else:
                final_lang = get_response_language(text, language)
                print(f"[VOICE] Auto detected: {final_lang}")

            print(f"[VOICE] Final language: {final_lang} | Text: '{text}'")

            return Response({
                'success': True,
                'text': text,
                'language': final_lang
            })

        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

    except Exception as e:
        logger.error(f"[voice_to_text] Error: {e}", exc_info=True)
        return Response({'error': str(e)}, status=500)

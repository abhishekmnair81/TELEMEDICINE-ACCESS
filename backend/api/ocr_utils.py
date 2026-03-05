# ============================================================================
# OCR UTILITIES FOR MEDICAL IMAGE PROCESSING
# Django + React Medical Chatbot
# ============================================================================

from PIL import Image, ImageFilter, ImageEnhance
import numpy as np
import os


def extract_text_from_image(image_path, language='en'):
    """
    Extract text from image using OCR
    Supports both pytesseract and EasyOCR
    
    Args:
        image_path: Path to the image file
        language: Language code (default: 'en')
    
    Returns:
        str: Extracted text from image
    """
    try:
        # Open and preprocess image
        image = Image.open(image_path)
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Preprocess image for better OCR
        image = preprocess_image_for_ocr(image)
        
        # Try EasyOCR first (no external dependencies required)
        try:
            import easyocr
            reader = easyocr.Reader(['en'])
            
            # Convert PIL image to numpy array
            img_array = np.array(image)
            result = reader.readtext(img_array, detail=0)
            text = '\n'.join(result)
            
            if text.strip():
                return text.strip()
        except ImportError:
            pass
        
        # Fallback to pytesseract
        try:
            import pytesseract
            text = pytesseract.image_to_string(image, lang=language)
            return text.strip()
        except ImportError:
            return "Error: No OCR library available. Please install easyocr or pytesseract."
    
    except Exception as e:
        return f"Error extracting text: {str(e)}"


def preprocess_image_for_ocr(image):
    """
    Preprocess image to improve OCR accuracy
    - Enhance contrast
    - Convert to grayscale
    - Apply thresholding
    - Denoise
    
    Args:
        image: PIL Image object
    
    Returns:
        PIL Image: Preprocessed image
    """
    try:
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        
        # Enhance sharpness
        sharpener = ImageEnhance.Sharpness(image)
        image = sharpener.enhance(1.5)
        
        # Convert to grayscale
        image = image.convert('L')
        
        # Apply slight blur to reduce noise
        image = image.filter(ImageFilter.MedianFilter(size=3))
        
        # Apply thresholding
        threshold = 150
        image = image.point(lambda p: 255 if p > threshold else 0)
        
        return image
    except Exception as e:
        # Return original if preprocessing fails
        print(f"Preprocessing failed: {e}")
        return image


def classify_medical_image_type(text, filename=''):
    """
    Classify the type of medical image based on extracted text and filename
    
    Args:
        text: Extracted text from image
        filename: Original filename
    
    Returns:
        str: One of 'prescription', 'lab_report', 'ct_scan', 'xray', 'mri', 'other'
    """
    text_lower = text.lower()
    filename_lower = filename.lower()
    
    # Prescription indicators
    prescription_keywords = [
        'prescription', 'rx', 'sig:', 'dispense', 'refill', 'tablet', 'capsule',
        'medicine', 'medication', 'dosage', 'frequency', 'duration', 'mg', 'ml',
        'doctor', 'dr.', 'physician', 'clinic', 'hospital', 'patient name', 
        'date of birth', 'instructions:', 'take', 'times daily', 'before meal',
        'after meal', 'syrup', 'ointment', 'drops'
    ]
    
    # Lab report indicators
    lab_report_keywords = [
        'lab report', 'laboratory', 'test results', 'specimen', 'hemoglobin',
        'blood count', 'cbc', 'glucose', 'cholesterol', 'triglycerides',
        'creatinine', 'urea', 'bilirubin', 'sgpt', 'sgot', 'thyroid', 'tsh',
        'pathology', 'reference range', 'normal range', 'test name', 'result',
        'units', 'sample collected', 'hba1c', 'lipid profile', 'kidney function'
    ]
    
    # CT Scan indicators
    ct_scan_keywords = [
        'ct scan', 'computed tomography', 'ct report', 'axial', 'coronal',
        'sagittal', 'contrast', 'hounsfield', 'slice thickness', 'cect',
        'non-contrast ct', 'ct chest', 'ct abdomen', 'ct brain', 'ct angiography'
    ]
    
    # X-Ray indicators
    xray_keywords = [
        'x-ray', 'xray', 'radiograph', 'chest x-ray', 'skeletal', 'bone',
        'fracture', 'radiology report', 'radiologist', 'ap view', 'lateral view',
        'pa view', 'chest radiograph', 'skeletal survey'
    ]
    
    # MRI indicators
    mri_keywords = [
        'mri', 'magnetic resonance', 'mr imaging', 't1 weighted', 't2 weighted',
        'flair', 'diffusion', 'gadolinium', 'mri brain', 'mri spine', 'contrast enhanced'
    ]
    
    # Check filename first
    if any(keyword in filename_lower for keyword in ['ct', 'ctscan', 'computed']):
        return 'ct_scan'
    if any(keyword in filename_lower for keyword in ['xray', 'x-ray', 'radiograph']):
        return 'xray'
    if 'mri' in filename_lower:
        return 'mri'
    if any(keyword in filename_lower for keyword in ['prescription', 'rx', 'presc']):
        return 'prescription'
    if any(keyword in filename_lower for keyword in ['lab', 'report', 'test', 'blood']):
        return 'lab_report'
    
    # Check text content with scoring
    prescription_score = sum(1 for keyword in prescription_keywords if keyword in text_lower)
    lab_score = sum(1 for keyword in lab_report_keywords if keyword in text_lower)
    ct_score = sum(1 for keyword in ct_scan_keywords if keyword in text_lower)
    xray_score = sum(1 for keyword in xray_keywords if keyword in text_lower)
    mri_score = sum(1 for keyword in mri_keywords if keyword in text_lower)
    
    scores = {
        'prescription': prescription_score,
        'lab_report': lab_score,
        'ct_scan': ct_score,
        'xray': xray_score,
        'mri': mri_score
    }
    
    max_score = max(scores.values())
    
    # Require at least 2 matching keywords for classification
    if max_score >= 2:
        return max(scores, key=scores.get)
    
    # Check for single strong indicator
    if 'prescription' in text_lower or 'rx' in text_lower:
        return 'prescription'
    if 'ct scan' in text_lower or 'computed tomography' in text_lower:
        return 'ct_scan'
    if 'x-ray' in text_lower or 'radiograph' in text_lower:
        return 'xray'
    if 'mri' in text_lower or 'magnetic resonance' in text_lower:
        return 'mri'
    if 'lab report' in text_lower or 'test results' in text_lower:
        return 'lab_report'
    
    return 'other'


def get_medical_image_disclaimer(image_type):
    """
    Get appropriate disclaimer based on image type
    
    Args:
        image_type: Type of medical image
    
    Returns:
        str: Disclaimer text
    """
    disclaimers = {
        'ct_scan': """
⚠️ EDUCATIONAL INFORMATION ONLY ⚠️

This is NOT a medical diagnosis. AI cannot interpret medical imaging.

CRITICAL LIMITATIONS:
• Only qualified radiologists can diagnose from CT scans
• Image quality affects interpretation
• Clinical correlation required
• Findings must be confirmed by medical professional

YOU MUST:
✓ Consult a radiologist or doctor immediately
✓ Get professional medical evaluation
✓ Do not make health decisions based on this information

This information is for educational purposes only.
""",
        'xray': """
⚠️ EDUCATIONAL INFORMATION ONLY ⚠️

This is NOT a medical diagnosis. AI cannot interpret X-ray images.

CRITICAL LIMITATIONS:
• Only qualified radiologists can diagnose from X-rays
• Image quality and positioning affect interpretation
• Multiple views may be needed for accurate diagnosis
• Clinical history is essential for proper evaluation

YOU MUST:
✓ Consult a radiologist or doctor immediately
✓ Get professional medical evaluation
✓ Do not make health decisions based on this information

This information is for educational purposes only.
""",
        'mri': """
⚠️ EDUCATIONAL INFORMATION ONLY ⚠️

This is NOT a medical diagnosis. AI cannot interpret MRI images.

CRITICAL LIMITATIONS:
• Only qualified radiologists can diagnose from MRI scans
• Multiple sequences required for proper evaluation
• Clinical correlation essential
• Findings must be confirmed by medical professional

YOU MUST:
✓ Consult a radiologist or doctor immediately
✓ Get professional medical evaluation
✓ Do not make health decisions based on this information

This information is for educational purposes only.
""",
        'prescription': """
ℹ️ INFORMATION ONLY ℹ️

This is a simple explanation of the text found in your prescription.

IMPORTANT:
• Always follow your doctor's instructions exactly
• Do not change medications without consulting your doctor
• Do not adjust dosages on your own
• This is not medical advice

Consult your healthcare provider for any questions about your prescription.
""",
        'lab_report': """
ℹ️ INFORMATION ONLY ℹ️

This is a simple explanation of the values in your lab report.

IMPORTANT:
• Lab results must be interpreted by your healthcare provider
• Values may vary based on lab methods and standards
• Clinical context is essential for proper interpretation
• This is not medical advice

Always discuss your lab results with your doctor.
"""
    }
    
    return disclaimers.get(image_type, """
ℹ️ INFORMATION ONLY ℹ️

IMPORTANT:
• This is general information only
• Always consult healthcare professionals
• Do not make medical decisions based on this
• This is not medical advice
""")


def build_ocr_analysis_prompt(extracted_text, image_type, user_message=''):
    """
    Build appropriate prompt for chatbot based on image type and extracted text
    
    Args:
        extracted_text: Text extracted from image
        image_type: Type of medical image
        user_message: Optional user message/question
    
    Returns:
        str: Formatted prompt for chatbot
    """
    if image_type in ['ct_scan', 'xray', 'mri']:
        # For medical imaging - educational only
        prompt = f"""The user has uploaded a {image_type.replace('_', ' ').title()} image. 
        
The text extracted from the image is:
{extracted_text}

CRITICAL INSTRUCTIONS:
- DO NOT provide any medical diagnosis
- DO NOT interpret imaging findings
- Only provide general educational information about what a {image_type.replace('_', ' ')} typically shows
- Emphasize that only radiologists can interpret these images
- Recommend immediate consultation with a qualified radiologist

User's question: {user_message if user_message else 'Can you explain what this shows?'}

Provide only educational information about the imaging modality itself, not specific diagnostic interpretations."""
    
    elif image_type == 'prescription':
        prompt = f"""The user has uploaded a prescription. 

The text extracted from the prescription is:
{extracted_text}

Please provide a simple, easy-to-understand explanation of:
1. What medications are listed (if clearly visible)
2. General information about these medications (if identifiable)
3. Dosage and frequency information
4. Any general precautions

User's question: {user_message if user_message else 'Can you explain this prescription?'}

Remember to emphasize following the doctor's instructions exactly and not making any changes without consulting the prescribing doctor."""
    
    elif image_type == 'lab_report':
        prompt = f"""The user has uploaded a lab report.

The text extracted from the lab report is:
{extracted_text}

Please provide a simple explanation of:
1. What tests are included
2. General information about these tests
3. Any values that appear in the report (explain what they typically measure)
4. General guidance on understanding the results

User's question: {user_message if user_message else 'Can you explain this lab report?'}

Emphasize that lab results must be interpreted by their healthcare provider with clinical context."""
    
    else:
        prompt = f"""The user has uploaded a medical document.

The text extracted is:
{extracted_text}

User's question: {user_message if user_message else 'Can you explain this document?'}

Please provide helpful information while emphasizing the need to consult healthcare professionals."""
    
    return prompt


def save_temp_image(uploaded_file):
    """
    Save uploaded image to temporary location
    
    Args:
        uploaded_file: Django UploadedFile object
    
    Returns:
        str: Path to saved image
    """
    import tempfile
    import uuid
    
    # Create temp directory if it doesn't exist
    temp_dir = os.path.join(tempfile.gettempdir(), 'medical_ocr')
    os.makedirs(temp_dir, exist_ok=True)
    
    # Generate unique filename
    file_ext = os.path.splitext(uploaded_file.name)[1]
    temp_filename = f"{uuid.uuid4()}{file_ext}"
    temp_path = os.path.join(temp_dir, temp_filename)
    
    # Save file
    with open(temp_path, 'wb+') as destination:
        for chunk in uploaded_file.chunks():
            destination.write(chunk)
    
    return temp_path


def cleanup_temp_image(temp_path):
    """
    Remove temporary image file
    
    Args:
        temp_path: Path to temporary file
    """
    try:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    except Exception as e:
        print(f"Error cleaning up temp file: {e}")


def validate_image_file(uploaded_file):
    """
    Validate uploaded image file
    
    Args:
        uploaded_file: Django UploadedFile object
    
    Returns:
        tuple: (is_valid, error_message)
    """
    # Check file size (max 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    if uploaded_file.size > max_size:
        return False, "Image file size must be less than 10MB"
    
    # Check file extension
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff']
    file_ext = os.path.splitext(uploaded_file.name)[1].lower()
    if file_ext not in allowed_extensions:
        return False, f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
    
    # Try to open as image
    try:
        image = Image.open(uploaded_file)
        image.verify()
        return True, None
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"
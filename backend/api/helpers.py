import os
import logging
from pathlib import Path
from typing import Optional, List, Dict
import time
import base64
import io
from PIL import Image
from langdetect import detect, DetectorFactory
from langdetect.lang_detect_exception import LangDetectException
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

GTTS_LANGUAGE_MAP = {
    'English': 'en',
    'Hindi': 'hi',
    'Kannada': 'kn',
    'Tamil': 'ta',
    'Telugu': 'te',
    'Malayalam': 'ml'
}

LANGUAGE_PROMPTS = {
    'English': (
        'You must respond ONLY in English language.'
    ),

    'Hindi': (
        'CRITICAL INSTRUCTION: The user is writing in Hinglish '
        '(Hindi words typed in English/Roman letters). '
        'You MUST reply in Hinglish — Hindi words written in Roman script. '
        'NEVER use Devanagari script (हिंदी). '
        'ALWAYS write Hindi words in English letters. '
        'Example: "Aapko doctor se milna chahiye. '
        'Yeh symptoms serious lag rahe hain. '
        'Dard kab se ho raha hai?" '
        'Medical terms stay in English: fever, pain, tablet, doctor, hospital.'
    ),

    'Kannada': (
        'CRITICAL INSTRUCTION: The user is writing in Kanglish '
        '(Kannada words typed in English/Roman letters). '
        'You MUST reply in Kanglish — Kannada words written in Roman script. '
        'NEVER use Kannada script (ಕನ್ನಡ). '
        'ALWAYS write Kannada words in English letters. '
        'Example: "Nimma symptoms nodi doctor hatra hogbeku. '
        'Jvara idhre rest thakolli. Novu eshthu dina aythu?" '
        'Medical terms stay in English: fever, pain, tablet, doctor, hospital.'
    ),

    'Tamil': (
        'CRITICAL INSTRUCTION: The user is writing in Tanglish '
        '(Tamil words typed in English/Roman letters). '
        'You MUST reply in Tanglish — Tamil words written in Roman script. '
        'NEVER use Tamil script (தமிழ்). '
        'ALWAYS write Tamil words in English letters. '
        'Example: "Ungalukku doctor kita poganam. '
        'Indha symptoms serious ah irukku. '
        'Vali eppo start achu?" '
        'Medical terms stay in English: fever, pain, tablet, doctor, hospital.'
    ),

    'Telugu': (
        'CRITICAL INSTRUCTION: The user is writing in Tenglish '
        '(Telugu words typed in English/Roman letters). '
        'You MUST reply in Tenglish — Telugu words written in Roman script. '
        'NEVER use Telugu script (తెలుగు). '
        'ALWAYS write Telugu words in English letters. '
        'Example: "Meeru doctor dggara vellali. '
        'Ee symptoms chala serious ga unnai. '
        'Noppi eppatinundi undi?" '
        'Medical terms stay in English: fever, pain, tablet, doctor, hospital.'
    ),

    'Malayalam': (
        'CRITICAL INSTRUCTION: The user is writing in Manglish '
        '(Malayalam words typed in English/Roman letters). '
        'You MUST reply in Manglish — Malayalam words written in Roman script. '
        'NEVER use Malayalam script (മലയാളം). '
        'ALWAYS write Malayalam words in English letters. '
        'Example: "Ningal doctor ine kaananam. '
        'Ee symptoms serious aanu. '
        'Vedana evideyaanu? Enthu muthala undu?" '
        'Medical terms stay in English: fever, pain, tablet, doctor, hospital.'
    ),
}



CRITICAL_EMERGENCY_KEYWORDS = [
    'heart attack', 'cardiac arrest', 'heart stopped',
    
    'cannot breathe', 'not breathing', 'stopped breathing',
    
    'unconscious', 'stroke', 'seizure right now',
    
    'severe bleeding', 'bleeding wont stop',
    
    'overdosed', 'drank poison',
]

SERIOUS_MEDICAL_KEYWORDS = [
    'severe pain', 'intense pain', 'unbearable pain',
    'high fever', 'fever above 103', 'fever won\'t go down',
    'difficulty breathing', 'shortness of breath', 'breathless',
    'chest pain', 'chest discomfort', 'chest tightness',
    'severe headache', 'migraine', 'persistent headache',
    'severe infection', 'spreading infection', 'red streaks',
    'serious injury', 'deep cut', 'wound won\'t stop bleeding',
    'critical condition', 'emergency', 'urgent medical',
    'severe symptoms', 'sudden onset', 'rapid deterioration',
    'coughing blood', 'vomiting blood', 'blood in stool', 'blood in urine',
    'sudden vision loss', 'sudden hearing loss',
    'severe dizziness', 'vertigo', 'fainting',
    'confusion', 'disorientation', 'altered mental state'
]

MEDICAL_KEYWORDS = [
    'pain', 'ache', 'hurt', 'sore', 'tender', 'discomfort',
    'symptom', 'symptoms', 'sign', 'signs',
    'fever', 'temperature', 'chills', 'sweating',
    'cough', 'cold', 'flu', 'sneeze', 'runny nose', 'congestion',
    'headache', 'migraine', 'dizziness', 'vertigo',
    'nausea', 'vomiting', 'diarrhea', 'constipation',
    'stomach', 'abdomen', 'belly', 'gastric',
    'fatigue', 'tired', 'weakness', 'exhaustion',
    'rash', 'itching', 'skin condition', 'bumps', 'hives',
    'swelling', 'inflammation', 'lump', 'mass',
    'head', 'eye', 'ear', 'nose', 'throat', 'mouth', 'teeth', 'gums',
    'neck', 'shoulder', 'back', 'spine',
    'chest', 'heart', 'lung', 'breathing',
    'stomach', 'liver', 'kidney', 'bladder',
    'arm', 'hand', 'finger', 'leg', 'foot', 'toe',
    'joint', 'muscle', 'bone',
    'disease', 'condition', 'disorder', 'syndrome',
    'infection', 'bacteria', 'virus', 'fungal',
    'allergy', 'allergic', 'reaction',
    'diabetes', 'blood sugar', 'glucose', 'insulin',
    'hypertension', 'blood pressure', 'bp',
    'asthma', 'bronchitis', 'pneumonia',
    'arthritis', 'osteoporosis', 'fracture',
    'cancer', 'tumor', 'malignant', 'benign',
    'thyroid', 'hormone', 'gland',
    'anemia', 'blood', 'hemoglobin',
    'treatment', 'therapy', 'medicine', 'medication',
    'drug', 'pill', 'tablet', 'capsule', 'syrup',
    'doctor', 'physician', 'specialist', 'hospital', 'clinic',
    'diagnosis', 'test', 'scan', 'x-ray', 'mri', 'ct scan',
    'surgery', 'operation', 'procedure',
    'prescription', 'dose', 'dosage',
    'side effect', 'adverse effect', 'reaction',
    'health', 'medical', 'clinical',
    'wellness', 'wellbeing', 'fitness',
    'nutrition', 'diet', 'food', 'eating',
    'vitamin', 'mineral', 'supplement',
    'exercise', 'workout', 'physical activity',
    'sleep', 'insomnia', 'rest',
    'stress', 'anxiety', 'depression', 'mental health',
    'pregnancy', 'prenatal', 'postnatal',
    'vaccination', 'vaccine', 'immunization',
    'prevent', 'cure', 'heal', 'recover', 'manage',
    'diagnose', 'treat', 'remedy', 'relief'
]

NON_MEDICAL_KEYWORDS = [
    'recipe', 'cooking', 'baking', 'cuisine',
    'movie', 'film', 'cinema', 'series', 'tv show',
    'song', 'music', 'album', 'singer', 'band',
    'game', 'gaming', 'video game', 'play',
    'sports', 'football', 'cricket', 'tennis', 'basketball',
    'weather', 'forecast', 'climate',
    'politics', 'election', 'government', 'politician',
    'business', 'company', 'startup', 'entrepreneurship',
    'stock market', 'shares', 'trading', 'investment',
    'cryptocurrency', 'bitcoin', 'blockchain',
    'programming', 'code', 'coding', 'developer',
    'software', 'app', 'application', 'website',
    'hardware', 'computer', 'laptop', 'phone',
    'travel', 'vacation', 'tourism', 'destination',
    'hotel', 'resort', 'accommodation',
    'restaurant', 'cafe', 'dining',
    'book', 'novel', 'author', 'literature',
    'shopping', 'purchase', 'buy', 'store',
    'fashion', 'clothing', 'style', 'outfit',
    'makeup', 'cosmetics', 'beauty products',
    'hairstyle', 'haircut', 'salon',
    'joke', 'funny', 'humor', 'comedy',
    'story', 'tale', 'narrative',
    'celebrity', 'famous', 'star', 'actor',
    'entertainment', 'show', 'performance',
    'news', 'current events', 'headline',
    'history', 'historical', 'ancient',
    'science', 'physics', 'chemistry', 'biology',
    'mathematics', 'calculation', 'equation'
]

MEDICAL_IMAGE_KEYWORDS = {
    'xray': ['x-ray', 'xray', 'radiograph', 'chest x-ray', 'bone x-ray', 'dental x-ray'],
    'ct': ['ct scan', 'cat scan', 'computed tomography', 'ct angiography'],
    'mri': ['mri', 'magnetic resonance', 'brain mri', 'spine mri', 'fmri'],
    'ultrasound': ['ultrasound', 'sonography', 'echocardiogram', 'doppler'],
    'pet': ['pet scan', 'positron emission', 'pet-ct'],
    'mammogram': ['mammogram', 'breast scan', 'breast imaging'],
    'bone_scan': ['bone scan', 'bone density', 'dexa scan', 'skeletal scan'],
    'angiogram': ['angiogram', 'angiography', 'blood vessel scan'],
    'endoscopy': ['endoscopy', 'colonoscopy', 'gastroscopy', 'bronchoscopy'],
    'ecg': ['ecg', 'ekg', 'electrocardiogram', 'heart trace'],
    'pathology': ['biopsy', 'histopathology', 'tissue sample', 'microscopy'],
    'dermatology': ['skin lesion', 'mole', 'rash photo', 'skin condition'],
    'wound': ['wound', 'injury photo', 'burn', 'laceration'],
    'lab': ['lab report', 'blood test', 'urinalysis', 'test results']
}

URGENT_EMERGENCY_KEYWORDS = [
    'difficulty breathing lying down', 'shortness of breath getting worse',
    'chest pain with sweating', 'chest pain radiating to arm',
    'severe pain 9/10', 'severe pain 10/10', 'unbearable pain',
    'high fever above 104', 'fever 105', 'fever with stiff neck',
    'severe headache with vomiting', 'severe headache sudden onset',
    'coughing up blood', 'vomiting blood', 'blood in vomit',
    'severe abdominal pain rigid', 'abdomen hard as board',
    'severe bleeding', 'heavy bleeding won\'t slow',
    'sudden vision loss', 'sudden blindness', 'can\'t see suddenly',
    'severe allergic reaction', 'face swelling rapidly',
    'confusion disoriented', 'altered mental state',
    'severe dizziness can\'t stand', 'fainting repeatedly',
]

IMAGE_ANALYSIS_STRUCTURE = {
    'brief': {
        'max_words': 150,
        'sections': ['Image Type', 'Key Findings', 'Urgency Level', 'Next Steps']
    },
    'detailed': {
        'max_words': 800,
        'sections': [
            'Image Type & Quality',
            'Anatomical Structures',
            'Findings & Observations',
            'Clinical Significance',
            'Differential Diagnosis',
            'Recommendations',
            'Limitations'
        ]
    }
}

def is_medical_query(message: str) -> bool:
    message_lower = message.lower()

    non_medical_matches = sum(1 for keyword in NON_MEDICAL_KEYWORDS if keyword in message_lower)
    medical_matches = sum(1 for keyword in MEDICAL_KEYWORDS if keyword in message_lower)

    if non_medical_matches > medical_matches and medical_matches == 0:
        return False

    if medical_matches > 0:
        return True

    health_patterns = [
        'what is', 'what are', 'what causes', 'what triggers',
        'how to', 'how do', 'how can', 'how to treat', 'how to cure',
        'why do', 'why does', 'why am', 'why is',
        'causes of', 'symptoms of', 'signs of',
        'treatment for', 'cure for', 'remedy for',
        'prevent', 'prevention of', 'avoid',
        'manage', 'deal with', 'cope with',
        'good for', 'bad for', 'healthy', 'unhealthy',
        'should i', 'can i', 'is it safe', 'is it normal',
        'when to see', 'do i need', 'should i worry'
    ]

    for pattern in health_patterns:
        if pattern in message_lower:
            context_words = ['body', 'feel', 'feeling', 'health', 'medical', 'sick']
            if any(word in message_lower for word in context_words):
                return True

    return False


def classify_severity(message: str) -> str:

    message_lower = message.lower()

    critical_count = sum(1 for keyword in CRITICAL_EMERGENCY_KEYWORDS if keyword in message_lower)
    if critical_count > 0:
        return "critical"

    serious_count = sum(1 for keyword in SERIOUS_MEDICAL_KEYWORDS if keyword in message_lower)
    if serious_count > 0:
        return "serious"

    return "general"


def is_greeting(message: str) -> bool:

    greetings = [
        'hi', 'hello', 'hey', 'namaste', 'vanakkam', 'namaskar',
        'good morning', 'good afternoon', 'good evening', 'good night',
        'thanks', 'thank you', 'bye', 'goodbye', 'ok', 'okay',
        'sure', 'yes', 'no', 'hmm', 'ohh'
    ]
    m = message.lower().strip()
    return m in greetings or (len(message.split()) <= 3 and any(g in m for g in greetings))


def classify_image_query_intent(query: str) -> str:

    query_lower = query.lower()

    image_keywords = [
        'analyze', 'analysis', 'scan', 'x-ray', 'xray', 'mri', 'ct', 'ultrasound',
        'image', 'picture', 'photo', 'radiograph', 'radiography',
        'report', 'findings', 'result', 'diagnosis', 'diagnose',
        'what do you see', 'what is this', 'look at', 'check this',
        'examine', 'review', 'interpret', 'read'
    ]

    for keyword in image_keywords:
        if keyword in query_lower:
            return 'image_analysis'

    return 'general_medical'


def get_medical_image_disclaimer(language: str) -> str:
    disclaimers = {
        'English': """⚠️ IMPORTANT MEDICAL DISCLAIMER ⚠️

This AI analysis is for EDUCATIONAL PURPOSES ONLY and is NOT a medical diagnosis.

CRITICAL LIMITATIONS:
• Only a qualified radiologist/doctor can provide accurate diagnosis
• Image quality, angle, and technical factors significantly affect interpretation
• AI cannot replace professional medical examination
• Clinical correlation with symptoms and history is essential

YOU MUST:
✓ Consult a qualified healthcare provider immediately
✓ Share this image with your doctor for professional evaluation
✓ Get appropriate diagnostic tests as recommended
✓ Seek emergency care if you have severe symptoms

This information is for educational guidance only, not medical advice.""",

        'Hindi': """⚠️ महत्वपूर्ण चिकित्सा अस्वीकरण ⚠️

यह AI विश्लेषण केवल शैक्षिक उद्देश्यों के लिए है और चिकित्सा निदान नहीं है।

महत्वपूर्ण सीमाएं:
• केवल योग्य रेडियोलॉजिस्ट/डॉक्टर ही सटीक निदान प्रदान कर सकते हैं
• छवि गुणवत्ता, कोण और तकनीकी कारक व्याख्या को प्रभावित करते हैं
• AI पेशेवर चिकित्सा परीक्षा का स्थान नहीं ले सकता

आपको अवश्य करना चाहिए:
✓ तुरंत योग्य स्वास्थ्य सेवा प्रदाता से परामर्श लें
✓ पेशेवर मूल्यांकन के लिए अपने डॉक्टर के साथ यह छवि साझा करें
✓ अनुशंसित उचित निदान परीक्षण करवाएं
✓ गंभीर लक्षणों के साथ आपातकालीन देखभाल लें

यह जानकारी केवल शैक्षिक मार्गदर्शन के लिए है।"""
    }

    return disclaimers.get(language, disclaimers['English'])


def build_enhanced_image_analysis_prompt(user_message: str, language: str, elaborate: bool = False) -> str:

    language_instruction = LANGUAGE_PROMPTS.get(language, LANGUAGE_PROMPTS["English"])

    if elaborate:
        structure = IMAGE_ANALYSIS_STRUCTURE['detailed']
        response_style = "comprehensive and detailed"
    else:
        structure = IMAGE_ANALYSIS_STRUCTURE['brief']
        response_style = "concise and focused on key points"

    disclaimer = get_medical_image_disclaimer(language)

    if elaborate:
        clinical_context_section = """- Detailed explanation of observed findings
- Discuss potential differential diagnoses
- Explain pathophysiology in simple terms
- Mention associated symptoms or conditions
- Note what findings are normal vs abnormal"""
    else:
        clinical_context_section = "- Brief explanation of what findings typically indicate"

    prompt = f"""You are an expert medical imaging analysis assistant with specialized knowledge in radiology, pathology, and diagnostic imaging interpretation.

LANGUAGE REQUIREMENT:
{language_instruction}

RESPONSE STYLE: {response_style}
TARGET LENGTH: {structure['max_words']} words maximum

USER'S QUERY:
{user_message if user_message else "User uploaded a medical image for analysis"}

CRITICAL ANALYSIS PROTOCOL:

**STEP 1: IMMEDIATE DISCLAIMER**
{disclaimer}

**STEP 2: IMAGE IDENTIFICATION** (20-30 words)
- Identify the exact type of medical imaging (X-ray, CT, MRI, ultrasound, photograph, etc.)
- Specify the anatomical region/body part
- Note image orientation and quality

**STEP 3: KEY FINDINGS** ({'40-60 words' if not elaborate else '100-150 words'})
- List ONLY the most significant observations
- Use bullet points for clarity
- Prioritize abnormal findings over normal anatomy
- Note any critical or urgent findings first

**STEP 4: URGENCY ASSESSMENT** (20-30 words)
Classify the urgency level:
- 🚨 CRITICAL: Life-threatening, requires immediate emergency care (within hours)
  Examples: Acute fractures, hemorrhage, pneumothorax, large masses, complete obstructions
- ⚠️ URGENT: Serious findings requiring prompt medical attention (within 24-48 hours)
  Examples: Significant infections, moderate masses, partial obstructions
- ℹ️ ROUTINE: Non-urgent findings, can be evaluated at regular appointment
  Examples: Minor abnormalities, chronic conditions, preventive findings

**STEP 5: CLINICAL CONTEXT** ({'40-60 words' if not elaborate else '150-200 words'})
{clinical_context_section}

**STEP 6: RECOMMENDATIONS** (30-50 words)
- Specify which medical specialist to consult (e.g., orthopedist, radiologist, oncologist)
- Suggest additional tests if needed (e.g., MRI, biopsy, blood work)
- Provide timeline for follow-up
- Include emergency instructions if critical

{'**STEP 7: LIMITATIONS** (20-30 words)' if elaborate else ''}
{'''- Image quality factors
- What cannot be determined from this single image
- Why professional correlation is essential''' if elaborate else ''}

CRITICAL RULES:
• Start with disclaimer ALWAYS
• Use cautious language: "appears to show", "suggests", "possibly indicates"
• NEVER provide definitive diagnoses
• Clearly mark urgency level with emoji indicators
• Prioritize patient safety over thoroughness
• Be direct but empathetic
• Focus on actionable information
• Highlight critical findings prominently

RESPONSE FORMAT:
{"Use clear headings and bullet points for easy scanning" if not elaborate else "Use detailed paragraphs with clear section headings"}

If image shows CRITICAL findings:
- Start response with: 🚨 CRITICAL FINDING DETECTED
- Bold the critical finding description
- Provide immediate action steps
- Emphasize urgency to seek emergency care

Total response: {structure['max_words']} words (strictly enforce this limit)

Remember: Balance thoroughness with clarity. Patient safety is paramount."""

    return prompt


# ============================================================================
# AI PROVIDERS (Text-based)
# ============================================================================

class AIProvider:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.available = False

    def test_connection(self) -> bool:
        return False

    def generate_response(self, system_prompt: str, user_message: str, **kwargs):
        """Generate response - yields chunks for streaming"""
        raise NotImplementedError


class OllamaProvider(AIProvider):
    def __init__(self):
        super().__init__()
        self.model = os.getenv("OLLAMA_MODEL", "phi3:mini")
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    def test_connection(self) -> bool:
        try:
            import ollama
            if self.base_url != "http://localhost:11434":
                os.environ['OLLAMA_HOST'] = self.base_url
            ollama.list()
            self.available = True
            logger.info(f"✅ Ollama connected at: {self.base_url} (model: {self.model})")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Ollama not available: {e}")
            self.available = False
            return False

    def generate_response(self, system_prompt: str, user_message: str, **kwargs):
        """Generate streaming response"""
        import ollama
        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message}
        ]

        stream = kwargs.get('stream', True)

        if stream:
            response_stream = ollama.chat(
                model=self.model,
                messages=messages,
                stream=True,
                options={
                    'temperature': kwargs.get('temperature', 0.3),
                    'top_p': kwargs.get('top_p', 0.9),
                    'num_predict': kwargs.get('max_tokens', 500),
                    'num_ctx': 2048,
                }
            )

            for chunk in response_stream:
                content = chunk.get('message', {}).get('content', '')
                if content:
                    yield content
        else:
            response = ollama.chat(
                model=self.model,
                messages=messages,
                stream=False,
                options={
                    'temperature': kwargs.get('temperature', 0.3),
                    'top_p': kwargs.get('top_p', 0.9),
                    'num_predict': kwargs.get('max_tokens', 500),
                    'num_ctx': 2048,
                }
            )
            yield response.get('message', {}).get('content', '').strip()


class GroqProvider(AIProvider):
    def __init__(self):
        super().__init__(os.getenv("GROQ_API_KEY"))
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    def test_connection(self) -> bool:
        if not self.api_key:
            logger.warning("⚠️ Groq: No API key found (GROQ_API_KEY)")
            return False
        try:
            from groq import Groq
            self.client = Groq(api_key=self.api_key)
            self.available = True
            logger.info(f"✅ Groq initialized (model: {self.model})")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Groq initialization failed: {e}")
            self.available = False
            return False

    def generate_response(self, system_prompt: str, user_message: str, **kwargs):
        """Generate streaming response"""
        stream = kwargs.get('stream', True)

        if stream:
            response_stream = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=kwargs.get('temperature', 0.3),
                max_tokens=kwargs.get('max_tokens', 800),
                top_p=kwargs.get('top_p', 0.9),
                stream=True
            )

            for chunk in response_stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=kwargs.get('temperature', 0.3),
                max_tokens=kwargs.get('max_tokens', 800),
                top_p=kwargs.get('top_p', 0.9)
            )
            yield response.choices[0].message.content.strip()


# ============================================================================
# VISION AI PROVIDERS (NEW - For Medical Image Analysis)
# ============================================================================

class VisionProvider:
    """Base class for vision AI providers"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.available = False

    def test_connection(self) -> bool:
        return False

    def analyze_image(self, image_data: bytes, prompt: str, **kwargs):
        """Analyze medical image - yields chunks for streaming"""
        raise NotImplementedError


class GroqVisionProvider(VisionProvider):
    """Groq Vision (llama-3.2-90b-vision-preview) - Fast and Free"""

    def __init__(self):
        super().__init__(os.getenv("GROQ_API_KEY"))
        self.model = "llama-3.2-90b-vision-preview"

    def test_connection(self) -> bool:
        if not self.api_key:
            logger.warning("⚠️ Groq Vision: No API key found")
            return False
        try:
            from groq import Groq
            self.client = Groq(api_key=self.api_key)
            self.available = True
            logger.info(f"✅ Groq Vision initialized (model: {self.model})")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Groq Vision initialization failed: {e}")
            return False

    def analyze_image(self, image_data: bytes, prompt: str, **kwargs):
        """Analyze image with Groq Vision"""
        try:
            # Convert image to base64
            base64_image = base64.b64encode(image_data).decode('utf-8')

            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ]

            stream = kwargs.get('stream', True)

            if stream:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=kwargs.get('temperature', 0.2),
                    max_tokens=kwargs.get('max_tokens', 1500),
                    top_p=kwargs.get('top_p', 0.85),
                    stream=True
                )

                for chunk in response:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            else:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=kwargs.get('temperature', 0.2),
                    max_tokens=kwargs.get('max_tokens', 1500),
                    top_p=kwargs.get('top_p', 0.85)
                )
                yield response.choices[0].message.content

        except Exception as e:
            logger.error(f"Groq Vision analysis error: {e}")
            raise


class ClaudeVisionProvider(VisionProvider):
    """Anthropic Claude Vision (claude-3-5-sonnet) - Highest Quality"""

    def __init__(self):
        super().__init__(os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-3-5-sonnet-20241022"

    def test_connection(self) -> bool:
        if not self.api_key:
            logger.warning("⚠️ Claude Vision: No API key found")
            return False
        try:
            import anthropic
            self.client = anthropic.Anthropic(api_key=self.api_key)
            self.available = True
            logger.info(f"✅ Claude Vision initialized (model: {self.model})")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Claude Vision initialization failed: {e}")
            return False

    def analyze_image(self, image_data: bytes, prompt: str, **kwargs):
        """Analyze image with Claude Vision"""
        try:
            import anthropic

            # Convert image to base64
            base64_image = base64.b64encode(image_data).decode('utf-8')

            # Determine image type
            try:
                img = Image.open(io.BytesIO(image_data))
                media_type = f"image/{img.format.lower()}" if img.format else "image/jpeg"
            except:
                media_type = "image/jpeg"

            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": base64_image
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]

            stream = kwargs.get('stream', True)

            if stream:
                with self.client.messages.stream(
                        model=self.model,
                        max_tokens=kwargs.get('max_tokens', 1500),
                        temperature=kwargs.get('temperature', 0.2),
                        messages=messages
                ) as stream:
                    for text in stream.text_stream:
                        yield text
            else:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=kwargs.get('max_tokens', 1500),
                    temperature=kwargs.get('temperature', 0.2),
                    messages=messages
                )
                yield response.content[0].text

        except Exception as e:
            logger.error(f"Claude Vision analysis error: {e}")
            raise


class OpenAIVisionProvider(VisionProvider):
    """OpenAI GPT-4 Vision - High Quality"""

    def __init__(self):
        super().__init__(os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"

    def test_connection(self) -> bool:
        if not self.api_key:
            logger.warning("⚠️ OpenAI Vision: No API key found")
            return False
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.api_key)
            self.available = True
            logger.info(f"✅ OpenAI Vision initialized (model: {self.model})")
            return True
        except Exception as e:
            logger.warning(f"⚠️ OpenAI Vision initialization failed: {e}")
            return False

    def analyze_image(self, image_data: bytes, prompt: str, **kwargs):
        """Analyze image with OpenAI Vision"""
        try:
            base64_image = base64.b64encode(image_data).decode('utf-8')

            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ]

            stream = kwargs.get('stream', True)

            if stream:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=kwargs.get('temperature', 0.2),
                    max_tokens=kwargs.get('max_tokens', 1500),
                    stream=True
                )

                for chunk in response:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            else:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=kwargs.get('temperature', 0.2),
                    max_tokens=kwargs.get('max_tokens', 1500)
                )
                yield response.choices[0].message.content

        except Exception as e:
            logger.error(f"OpenAI Vision analysis error: {e}")
            raise


class GeminiVisionProvider(VisionProvider):
    """Google Gemini Vision - Free and Good Quality"""

    def __init__(self):
        super().__init__(os.getenv("GEMINI_API_KEY"))
        self.model = "gemini-1.5-flash"

    def test_connection(self) -> bool:
        if not self.api_key:
            logger.warning("⚠️ Gemini Vision: No API key found")
            return False
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel(self.model)
            self.available = True
            logger.info(f"✅ Gemini Vision initialized (model: {self.model})")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Gemini Vision initialization failed: {e}")
            return False

    def analyze_image(self, image_data: bytes, prompt: str, **kwargs):
        """Analyze image with Gemini Vision"""
        try:
            import google.generativeai as genai

            # Load image
            img = Image.open(io.BytesIO(image_data))

            stream = kwargs.get('stream', True)

            if stream:
                response = self.client.generate_content(
                    [prompt, img],
                    stream=True,
                    generation_config=genai.GenerationConfig(
                        temperature=kwargs.get('temperature', 0.2),
                        max_output_tokens=kwargs.get('max_tokens', 1500),
                    )
                )

                for chunk in response:
                    if chunk.text:
                        yield chunk.text
            else:
                response = self.client.generate_content(
                    [prompt, img],
                    generation_config=genai.GenerationConfig(
                        temperature=kwargs.get('temperature', 0.2),
                        max_output_tokens=kwargs.get('max_tokens', 1500),
                    )
                )
                yield response.text

        except Exception as e:
            logger.error(f"Gemini Vision analysis error: {e}")
            raise


# ============================================================================
# MEDICAL CHATBOT CLASS (Enhanced with Vision AI)
# ============================================================================

class MedicalChatbot:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MedicalChatbot, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.initialize()
            self._initialized = True
            self.conversation_history = {}

    def initialize(self):
        logger.info("🚀 Initializing Enhanced Medical Chatbot with Vision AI...")

        # Initialize text providers
        self.providers = {
            'ollama': OllamaProvider(),
            'groq': GroqProvider(),
        }

        # Initialize vision providers (NEW)
        self.vision_providers = {
            'groq_vision': GroqVisionProvider(),
            'claude_vision': ClaudeVisionProvider(),
            'openai_vision': OpenAIVisionProvider(),
            'gemini_vision': GeminiVisionProvider(),
        }

        # Test text providers
        self.available_providers = []
        for name, provider in self.providers.items():
            if provider.test_connection():
                self.available_providers.append(name)

        # Test vision providers (NEW)
        self.available_vision_providers = []
        for name, provider in self.vision_providers.items():
            if provider.test_connection():
                self.available_vision_providers.append(name)

        # Set text provider priority
        priority_env = os.getenv("AI_PROVIDER_PRIORITY", "groq,ollama")
        self.priority_order = [p.strip() for p in priority_env.split(',')]
        self.priority_order = [p for p in self.priority_order if p in self.available_providers]

        # Set vision provider priority (NEW)
        vision_priority_env = os.getenv("VISION_PROVIDER_PRIORITY",
                                        "groq_vision,gemini_vision,claude_vision,openai_vision")
        self.vision_priority_order = [p.strip() for p in vision_priority_env.split(',')]
        self.vision_priority_order = [p for p in self.vision_priority_order if p in self.available_vision_providers]

        if not self.priority_order:
            logger.error("❌ No text AI providers available! Please configure at least one.")
            raise RuntimeError("No AI providers configured")

        logger.info(f"✅ Text providers: {', '.join(self.available_providers)}")
        logger.info(f"✅ Vision providers: {', '.join(self.available_vision_providers)}")
        logger.info(f"🎯 Text priority: {' → '.join(self.priority_order)}")
        logger.info(f"🎯 Vision priority: {' → '.join(self.vision_priority_order)}")

    def analyze_medical_image(self, image_buffer, user_message: str, language: str = "English",
                              elaborate: bool = False):
        """
        Analyze medical image using vision AI models

        Args:
            image_buffer: BytesIO object containing the image
            user_message: User's question about the image
            language: Response language
            elaborate: Whether to provide detailed analysis

        Yields:
            Text chunks for streaming response
        """
        try:
            if not self.available_vision_providers:
                error_msg = (
                    "Medical image analysis requires vision AI. "
                    "Please configure at least one vision provider (Groq, Claude, OpenAI, or Gemini). "
                    "For now, please consult a healthcare professional directly with your image."
                )
                words = error_msg.split()
                for i, word in enumerate(words):
                    yield word + (' ' if i < len(words) - 1 else '')
                return

            # Read image data
            image_buffer.seek(0)
            image_data = image_buffer.read()

            # Build specialized prompt for medical image analysis
            prompt = build_enhanced_image_analysis_prompt(user_message, language, elaborate)

            # Try vision providers in priority order
            last_error = None
            for provider_name in self.vision_priority_order:
                provider = self.vision_providers[provider_name]
                if not provider.available:
                    continue

                try:
                    logger.info(f"⚡ Analyzing image with {provider_name} (elaborate={elaborate})")
                    start_time = time.time()

                    max_tokens = 1500 if elaborate else 800

                    response_generator = provider.analyze_image(
                        image_data=image_data,
                        prompt=prompt,
                        temperature=0.2,
                        max_tokens=max_tokens,
                        top_p=0.85,
                        stream=True
                    )

                    full_response = ""
                    for chunk in response_generator:
                        full_response += chunk
                        yield chunk

                    elapsed = time.time() - start_time
                    logger.info(f"✅ {provider_name} completed analysis in {elapsed:.2f}s ({len(full_response)} chars)")

                    if full_response and len(full_response) > 100:
                        return
                    else:
                        logger.warning(f"⚠️ {provider_name} returned insufficient response")
                        continue

                except Exception as e:
                    last_error = e
                    logger.warning(f"⚠️ {provider_name} failed: {e}")
                    continue

            # If all providers failed
            error_msg = (
                "I encountered difficulties analyzing the image. "
                "Please ensure it's a clear medical image and try again, "
                "or consult a healthcare professional directly for immediate assistance."
            )
            words = error_msg.split()
            for i, word in enumerate(words):
                yield word + (' ' if i < len(words) - 1 else '')

        except Exception as e:
            logger.error(f"❌ Critical error in image analysis: {e}")
            error_msg = "An unexpected error occurred during image analysis. Please seek professional medical evaluation."
            words = error_msg.split()
            for i, word in enumerate(words):
                yield word + (' ' if i < len(words) - 1 else '')

    def get_critical_emergency_response(self, language: str) -> str:
        """Response for life-threatening emergencies"""
        responses = {
            'English': """🚨 CRITICAL EMERGENCY DETECTED! 🚨

⚠️ CALL EMERGENCY SERVICES IMMEDIATELY: 108 / 102

This is a life-threatening emergency that requires immediate medical attention.

TAKE ACTION NOW:
• Call an ambulance RIGHT NOW (108 / 102)
• Go to the nearest hospital emergency room immediately
• Do NOT wait or try home remedies
• Inform emergency responders about all symptoms
• If someone is with you, have them call while you provide first aid
• Do not drive yourself - call emergency services

This is not a situation for online advice. Please seek emergency medical help immediately.""",

            'Hindi': """🚨 गंभीर आपात स्थिति! 🚨

⚠️ तुरंत 108 / 102 पर कॉल करें।

यह जानलेवा स्थिति है जिसमें तत्काल चिकित्सा सहायता की आवश्यकता है।

अभी कार्रवाई करें:
• अभी एम्बुलेंस बुलाएं (108 / 102)
• नजदीकी अस्पताल के आपातकालीन विभाग में तुरंत जाएं
• घरेलू इलाज या प्रतीक्षा न करें
• आपातकालीन कर्मचारियों को सभी लक्षणों के बारे में बताएं
• यदि कोई साथ है, तो उन्हें कॉल करने दें
• खुद गाड़ी न चलाएं - आपातकालीन सेवाओं को बुलाएं

यह ऑनलाइन सलाह की स्थिति नहीं है। कृपया तुरंत आपातकालीन चिकित्सा सहायता लें।"""
        }
        return responses.get(language, responses['English'])

    def get_serious_medical_response(self, language: str) -> str:
        """Response for serious but not immediately life-threatening conditions"""
        responses = {
            'English': """⚠️ SERIOUS MEDICAL CONDITION DETECTED ⚠️

This appears to be a serious health issue that needs professional medical attention.

RECOMMENDED ACTIONS:
• Consult a doctor within 24 hours
• Do not delay in seeking professional medical help
• If symptoms worsen rapidly, call 108 / 102 immediately
• Visit your nearest hospital or clinic for proper examination
• Get appropriate diagnostic tests if recommended
• Do not self-medicate for serious symptoms

While I can provide general information, your symptoms require proper medical examination by a qualified healthcare professional.""",

            'Hindi': """⚠️ गंभीर चिकित्सा स्थिति का पता चला ⚠️

यह एक गंभीर स्वास्थ्य समस्या प्रतीत हो रही है जिसे पेशेवर चिकित्सा ध्यान की आवश्यकता है।

अनुशंसित कार्रवाई:
• 24 घंटे के भीतर डॉक्टर से परामर्श लें
• पेशेवर चिकित्सा सहायता में देरी न करें
• यदि लक्षण तेजी से बिगड़ें, तो 108 / 102 पर तुरंत कॉल करें
• उचित जांच के लिए निकटतम अस्पताल या क्लिनिक जाएं
• डॉक्टर द्वारा सुझाए गए उचित निदान परीक्षण करवाएं
• गंभीर लक्षणों के लिए स्वयं दवा न लें

हालांकि मैं सामान्य जानकारी प्रदान कर सकता हूं, आपके लक्षणों के लिए योग्य स्वास्थ्य पेशेवर द्वारा उचित चिकित्सा परीक्षा की आवश्यकता है।"""
        }
        return responses.get(language, responses['English'])

    def get_non_medical_response(self, language: str) -> str:
        """Response for non-medical queries"""
        responses = {
            'English': """I'm a specialized medical assistant designed to help with health and medical questions only.

I can help you with:
• Symptoms and their possible causes
• Medical conditions and diseases
• Treatment options and medications
• Preventive healthcare and wellness
• Nutrition and diet-related health advice
• Mental health concerns
• Medical image analysis (X-rays, CT scans, MRI, etc.)
• When to seek medical attention

Please ask me a health or medical-related question, and I'll be happy to help!""",

            'Hindi': """मैं एक विशेष चिकित्सा सहायक हूं जो केवल स्वास्थ्य और चिकित्सा प्रश्नों में मदद करने के लिए डिज़ाइन किया गया है।

मैं इनमें आपकी मदद कर सकता हूं:
• लक्षण और उनके संभावित कारण
• चिकित्सा स्थितियां और बीमारियां
• उपचार विकल्प और दवाएं
• निवारक स्वास्थ्य देखभाल और कल्याण
• पोषण और आहार संबंधी स्वास्थ्य सलाह
• मानसिक स्वास्थ्य चिंताएं
• चिकित्सा छवि विश्लेषण (X-rays, CT scans, MRI, आदि)
• चिकित्सा ध्यान कब लेना है

कृपया मुझसे कोई स्वास्थ्य या चिकित्सा संबंधी प्रश्न पूछें, और मुझे मदद करने में खुशी होगी!"""
        }
        return responses.get(language, responses['English'])

    def build_enhanced_system_prompt(self, language: str, elaborate: bool, severity: str) -> str:
        """Build comprehensive system prompt for accurate medical responses"""

        language_instruction = LANGUAGE_PROMPTS.get(language, LANGUAGE_PROMPTS["English"])

        if severity == "general":
            if elaborate:
                word_limit = "400-600 words"
                detail_level = "comprehensive and detailed"
            else:
                word_limit = "200-300 words"
                detail_level = "concise yet informative"
        else:
            word_limit = "300-400 words"
            detail_level = "thorough and informative"

        system_prompt = f"""You are an expert medical information assistant with deep knowledge of medicine, healthcare, and wellness.

LANGUAGE REQUIREMENT:
{language_instruction}

RESPONSE GUIDELINES:
1. Provide {detail_level} medical information
2. Use clear, simple language that patients can understand
3. Write in natural paragraph style
4. Keep response between {word_limit}
5. Be accurate, evidence-based, and up-to-date
6. Focus on KEY POINTS first, then add details if needed

CONTENT REQUIREMENTS FOR BRIEF RESPONSES (default):
• Start with the MOST IMPORTANT information
• Answer the specific question directly
• Mention key symptoms or signs
• State when to see a doctor (if relevant)
• Keep it focused and actionable

CONTENT REQUIREMENTS FOR DETAILED RESPONSES (when asked):
• Explain the condition/symptom thoroughly
• Discuss possible causes or contributing factors
• Mention common symptoms or related signs
• Explain pathophysiology in simple terms
• Discuss treatment options (home care, medical treatment)
• Include prevention tips if applicable
• Add lifestyle or dietary advice when relevant

CRITICAL RULES:
• NEVER diagnose specific diseases - only discuss possibilities
• NEVER prescribe specific medications or dosages
• ALWAYS recommend consulting a doctor for:
  - Severe or persistent symptoms
  - Unclear diagnosis
  - Treatment decisions
  - Medication choices
• Emphasize seeking immediate medical attention for serious symptoms
• Provide balanced information without causing panic
• Do not include greetings, sign-offs, or disclaimers
• Focus entirely on answering the medical question

TONE:
• Professional yet compassionate
• Informative but not overwhelming
• Reassuring but realistic
• Patient-centered and empathetic

Remember: Prioritize KEY information first. Add details only when appropriate."""

        return system_prompt

    def get_response(self, message: str, language: str = "English", elaborate: bool = False, user_id: str = None):
        """Generate medical response with streaming"""
        try:
            message = (message or "").strip()
            if not message:
                yield "Please ask a health or medical question."
                return

            if is_greeting(message):
                greetings = {
                    'English': "Hello! 👋 I'm your medical assistant. Ask me about symptoms, conditions, treatments, or upload medical images for analysis. How can I help?",
                    'Hindi': "नमस्ते! 👋 मैं आपका चिकित्सा सहायक हूं। लक्षण, बीमारी, उपचार के बारे में पूछें या चिकित्सा छवियां अपलोड करें। मैं कैसे मदद कर सकता हूं?"
                }
                greeting_text = greetings.get(language, greetings['English'])
                for chunk in greeting_text.split():
                    yield chunk + ' '
                return

            if not is_medical_query(message):
                non_medical_text = self.get_non_medical_response(language)
                for chunk in non_medical_text.split():
                    yield chunk + ' '
                return

            severity = classify_severity(message)

            if severity == "critical":
                emergency_text = self.get_critical_emergency_response(language)
                for chunk in emergency_text.split():
                    yield chunk + ' '
                return

            if severity == "serious":
                serious_text = self.get_serious_medical_response(language)
                for chunk in serious_text.split():
                    yield chunk + ' '
                yield "\n\n---\n\nGENERAL INFORMATION:\n"

            system_prompt = self.build_enhanced_system_prompt(language, elaborate, severity)

            last_error = None
            for provider_name in self.priority_order:
                provider = self.providers[provider_name]
                if not provider.available:
                    continue

                try:
                    logger.info(f"⚡ Querying {provider_name}: {message[:60]}...")
                    start_time = time.time()

                    temperature = 0.3 if severity in ["critical", "serious"] else 0.4
                    max_tokens = 800 if elaborate else 500

                    response_generator = provider.generate_response(
                        system_prompt=system_prompt,
                        user_message=message,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        top_p=0.9,
                        stream=True
                    )

                    full_response = ""
                    for chunk in response_generator:
                        full_response += chunk
                        yield chunk

                    elapsed = time.time() - start_time
                    logger.info(f"✅ {provider_name} responded in {elapsed:.2f}s ({len(full_response)} chars)")

                    if full_response and len(full_response) > 50:
                        return
                    else:
                        logger.warning(f"⚠️ {provider_name} returned insufficient response")
                        continue

                except Exception as e:
                    last_error = e
                    logger.warning(f"⚠️ {provider_name} failed: {e}")
                    continue

            error_text = "I'm experiencing technical difficulties. Please try again or consult a healthcare professional."
            for chunk in error_text.split():
                yield chunk + ' '

        except Exception as e:
            logger.error(f"❌ Critical error in get_response: {e}")
            error_text = "An unexpected error occurred. Please try again or seek professional medical advice."
            for chunk in error_text.split():
                yield chunk + ' '


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_chatbot_instance = None


def get_chatbot():
    """Get singleton chatbot instance"""
    global _chatbot_instance
    if _chatbot_instance is None:
        _chatbot_instance = MedicalChatbot()
    return _chatbot_instance


# ============================================================================
# TESTING (if run directly)
# ============================================================================

if __name__ == "__main__":
    bot = get_chatbot()

    test_queries = [
        "What causes diabetes?",
        "I have mild headache",
        "Severe chest pain can't breathe",
        "How to prevent heart disease?",
    ]

    print("\n🧪 Testing Enhanced Medical Chatbot")
    print("=" * 80)

    for query in test_queries:
        print(f"\n{'=' * 80}")
        print(f"Query: {query}")
        print(f"{'=' * 80}")
        for response in bot.get_response(query, language="English", elaborate=False):
            print(response, end='', flush=True)
        print()
        input("\nPress Enter to continue...")


# helpers.py - Add these new functions

import re
from datetime import datetime
from typing import Dict, List, Tuple

# Symptom detection patterns
SYMPTOM_PATTERNS = {
    'fever': r'\b(fever|temperature|hot|warm|chills)\b',
    'cough': r'\b(cough|coughing|phlegm|mucus)\b',
    'headache': r'\b(headache|head pain|migraine)\b',
    'pain': r'\b(pain|ache|aching|hurt|hurting|sore)\b',
    'fatigue': r'\b(tired|fatigue|exhausted|weak|weakness)\b',
    'nausea': r'\b(nausea|vomit|vomiting|sick)\b',
    'breathing': r'\b(breathing|breathe|shortness of breath|dyspnea)\b',
    'stomach': r'\b(stomach|abdomen|belly|digestive)\b',
    'dizziness': r'\b(dizzy|dizziness|lightheaded|vertigo)\b',
}

# Duration patterns
DURATION_PATTERNS = [
    r'(\d+)\s+(day|days|week|weeks|month|months|year|years)',
    r'(yesterday|today|last night|this morning)',
    r'(for|since|about)\s+(\d+)\s+(day|days|week|weeks)',
]

# Severity indicators
SEVERITY_PATTERNS = {
    'mild': r'\b(slight|mild|little|barely)\b',
    'moderate': r'\b(moderate|noticeable|significant)\b',
    'severe': r'\b(severe|intense|extreme|unbearable|terrible|worst)\b',
}

# Emergency keywords
EMERGENCY_KEYWORDS = [
    'chest pain', 'difficulty breathing', 'severe bleeding',
    'unconscious', 'stroke symptoms', 'heart attack',
    'severe allergic reaction', 'suicidal', 'seizure'
]


def extract_symptoms_from_conversation(messages: List[Dict]) -> List[str]:
    """
    Extract symptoms from conversation messages
    
    Args:
        messages: List of message dicts with 'role' and 'message' keys
    
    Returns:
        List of detected symptoms
    """
    symptoms_found = set()
    
    for msg in messages:
        if msg.get('role') == 'user':
            text = msg.get('message', '').lower()
            
            # Check each symptom pattern
            for symptom, pattern in SYMPTOM_PATTERNS.items():
                if re.search(pattern, text, re.IGNORECASE):
                    symptoms_found.add(symptom)
    
    return list(symptoms_found)


def extract_duration(messages: List[Dict]) -> str:
    """
    Extract duration information from conversation
    
    Returns:
        Duration string or empty string
    """
    for msg in messages:
        if msg.get('role') == 'user':
            text = msg.get('message', '')
            
            for pattern in DURATION_PATTERNS:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    return match.group(0)
    
    return ""


def detect_severity(messages: List[Dict]) -> str:
    """
    Detect severity level from conversation
    
    Returns:
        'mild', 'moderate', 'severe', or 'unknown'
    """
    severity_scores = {'mild': 0, 'moderate': 0, 'severe': 0}
    
    for msg in messages:
        if msg.get('role') == 'user':
            text = msg.get('message', '').lower()
            
            for severity, pattern in SEVERITY_PATTERNS.items():
                if re.search(pattern, text):
                    severity_scores[severity] += 1
    
    # Return highest scoring severity
    if any(severity_scores.values()):
        return max(severity_scores.items(), key=lambda x: x[1])[0]
    
    return 'unknown'


def check_emergency_indicators(messages: List[Dict]) -> Tuple[bool, str]:
    """
    Check if conversation mentions emergency symptoms
    
    Returns:
        Tuple of (is_emergency, warning_message)
    """
    for msg in messages:
        if msg.get('role') == 'user':
            text = msg.get('message', '').lower()
            
            for keyword in EMERGENCY_KEYWORDS:
                if keyword in text:
                    return True, (
                        f"⚠️ EMERGENCY ALERT: {keyword.title()} detected. "
                        "Please seek immediate medical attention or call emergency services."
                    )
    
    return False, ""


def generate_health_report_text(report_data: Dict) -> str:
    """
    Generate formatted text report from extracted data
    
    Args:
        report_data: Dictionary containing health information
    
    Returns:
        Formatted report text
    """
    from datetime import datetime
    
    report = []
    report.append("=" * 60)
    report.append("HEALTH CONSULTATION REPORT")
    report.append("=" * 60)
    report.append("")
    
    # Patient info
    if report_data.get('patient_name'):
        report.append(f"Patient Name: {report_data['patient_name']}")
    
    report.append(f"Date: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}")
    report.append("")
    
    # Emergency warning (if any)
    if report_data.get('emergency_warning'):
        report.append("⚠️ EMERGENCY ALERT ⚠️")
        report.append(report_data['emergency_warning'])
        report.append("")
    
    # Symptoms
    report.append("SYMPTOMS REPORTED:")
    report.append("-" * 60)
    symptoms = report_data.get('symptoms', [])
    if symptoms:
        for symptom in symptoms:
            report.append(f"  • {symptom.title()}")
    else:
        report.append("  • No specific symptoms identified")
    report.append("")
    
    # Duration
    if report_data.get('duration'):
        report.append(f"Duration: {report_data['duration']}")
        report.append("")
    
    # Severity
    if report_data.get('severity') and report_data['severity'] != 'unknown':
        report.append(f"Severity: {report_data['severity'].title()}")
        report.append("")
    
    # Additional symptoms
    additional = report_data.get('additional_symptoms', [])
    if additional:
        report.append("ADDITIONAL SYMPTOMS:")
        report.append("-" * 60)
        for symptom in additional:
            report.append(f"  • {symptom}")
        report.append("")
    
    # Possible conditions
    conditions = report_data.get('possible_conditions', [])
    if conditions:
        report.append("POSSIBLE CONDITIONS (AI SUGGESTION):")
        report.append("-" * 60)
        report.append("⚠️ This is NOT a diagnosis. Consult a doctor for accurate diagnosis.")
        for condition in conditions:
            report.append(f"  • {condition}")
        report.append("")
    
    # Advice given
    if report_data.get('advice_given'):
        report.append("RECOMMENDATIONS & ADVICE:")
        report.append("-" * 60)
        report.append(report_data['advice_given'])
        report.append("")
    
    # Medical history mentioned
    if report_data.get('medical_history'):
        report.append("MEDICAL HISTORY MENTIONED:")
        report.append("-" * 60)
        report.append(report_data['medical_history'])
        report.append("")
    
    # Current medications
    if report_data.get('medications'):
        report.append("CURRENT MEDICATIONS MENTIONED:")
        report.append("-" * 60)
        report.append(report_data['medications'])
        report.append("")
    
    # Disclaimer
    report.append("=" * 60)
    report.append("IMPORTANT DISCLAIMER:")
    report.append("=" * 60)
    report.append("This report is generated from an AI conversation and is NOT")
    report.append("a medical diagnosis. Please consult a qualified healthcare")
    report.append("professional for accurate diagnosis and treatment.")
    report.append("=" * 60)
    
    return "\n".join(report)


def analyze_conversation_for_report(conversation) -> Dict:
    
    messages = list(conversation.messages.all().values('role', 'message'))
    
    symptoms = extract_symptoms_from_conversation(messages)
    duration = extract_duration(messages)
    severity = detect_severity(messages)
    is_emergency, emergency_warning = check_emergency_indicators(messages)
    
    report_data = {
        'symptoms': symptoms,
        'duration': duration,
        'severity': severity,
        'emergency_warning': emergency_warning if is_emergency else '',
        'additional_symptoms': [],
        'possible_conditions': [],
        'advice_given': '',
        'medical_history': '',
        'medications': '',
    }
    
    advice_parts = []
    for msg in messages:
        if msg.get('role') == 'assistant':
            text = msg.get('message', '')
            if any(keyword in text.lower() for keyword in ['recommend', 'suggest', 'should', 'try', 'consider']):
                advice_parts.append(text)
    
    if advice_parts:
        report_data['advice_given'] = "\n\n".join(advice_parts[:3]) 
    
    return report_data

EMERGENCY_KEYWORDS = {
    'critical': [
        # Cardiac/Heart emergencies
        'heart attack', 'cardiac arrest', 'stroke', 'brain attack',
        'chest pain', 'heart pain', 'crushing chest pain', 'chest pressure',
        'chest tightness', 'pain radiating to arm', 'jaw pain with chest pain',
        'irregular heartbeat severe', 'heart racing uncontrollably',
        
        # Respiratory emergencies
        'can\'t breathe', 'cannot breathe', 'not breathing', 'difficulty breathing severe',
        'choking', 'airway blocked', 'gasping for air', 'suffocating',
        'blue lips', 'turning blue', 'cyanosis',
        
        # Neurological emergencies
        'unconscious', 'unresponsive', 'passed out', 'fainting repeatedly',
        'seizure', 'convulsing', 'fits', 'convulsion',
        'sudden paralysis', 'can\'t move one side', 'face drooping',
        'sudden confusion', 'sudden severe headache', 'worst headache ever',
        'thunderclap headache', 'loss of consciousness',
        'slurred speech suddenly', 'sudden numbness', 'sudden weakness',
        
        # Bleeding/Trauma
        'severe bleeding', 'heavy bleeding', 'bleeding won\'t stop', 'hemorrhage',
        'uncontrolled bleeding', 'bleeding profusely', 'blood gushing',
        'head injury severe', 'skull fracture', 'brain injury',
        'broken bone protruding', 'compound fracture', 'bone sticking out',
        'severe trauma', 'crushed limb', 'amputation',
        
        # Allergic/Anaphylaxis
        'anaphylaxis', 'severe allergic reaction', 'throat closing', 'throat swelling',
        'tongue swelling', 'can\'t swallow', 'allergic shock',
        'hives all over body', 'face swelling rapidly',
        
        # Poisoning/Overdose
        'overdose', 'took too many pills', 'drank poison', 'swallowed poison',
        'poisoning', 'chemical exposure', 'carbon monoxide',
        'drug overdose', 'accidental poisoning',
        
        # Burns/Environmental
        'severe burn', 'large burn', 'third degree burn', 'chemical burn',
        'electric shock', 'electrocution', 'lightning strike',
        'drowning', 'near drowning', 'water inhalation',
        'hypothermia severe', 'heat stroke',
        
        # Abdominal emergencies
        'severe abdominal pain', 'severe stomach pain', 'abdomen rigid',
        'vomiting blood', 'throwing up blood', 'coughing up blood',
        'blood in vomit', 'black tarry stools', 'rectal bleeding severe',
        
        # Mental health emergencies
        'suicide attempt', 'want to kill myself', 'going to end my life',
        'suicidal right now', 'have a plan to die', 'harming myself',
        
        # Pregnancy emergencies
        'severe pregnancy pain', 'heavy vaginal bleeding pregnant',
        'baby not moving', 'severe contractions early pregnancy',
        
        # Other critical
        'aneurysm rupture', 'internal bleeding', 'organ failure',
        'diabetic coma', 'blood sugar extremely high', 'blood sugar extremely low',
        'can\'t see suddenly', 'sudden blindness', 'eye injury severe',
        'testicular torsion', 'severe testicle pain sudden',
    ],
    'urgent': [
        'severe pain', 'intense pain', 'unbearable pain', 'excruciating pain',
        'pain 10/10', 'worst pain ever', 'extreme pain',
        'severe headache', 'migraine severe', 'cluster headache',
        'severe back pain', 'severe neck pain',
        'severe joint pain', 'severe muscle pain',
        
        # Fever/Infection
        'high fever', 'fever above 103', 'fever above 104', 'fever won\'t go down',
        'fever with rash', 'fever with stiff neck', 'persistent high fever',
        'fever in infant', 'baby fever high',
        'severe infection', 'spreading infection', 'red streaks from wound',
        'pus discharge heavy', 'infected wound severe',
        'sepsis symptoms', 'chills with fever severe',
        
        # Respiratory (non-critical)
        'difficulty breathing', 'shortness of breath', 'breathless',
        'wheezing severe', 'asthma attack', 'breathing very fast',
        'persistent cough severe', 'coughing continuously',
        
        # Bleeding (non-life-threatening)
        'heavy bleeding', 'wound won\'t stop bleeding', 'deep cut',
        'serious injury', 'laceration deep', 'gash',
        'nosebleed won\'t stop', 'bleeding for hours',
        
        # Vision/Hearing
        'sudden vision loss', 'sudden hearing loss', 'sudden blurred vision',
        'seeing flashes of light', 'eye pain severe', 'foreign object in eye',
        'chemical in eye', 'sudden double vision',
        
        # Digestive
        'vomiting blood', 'blood in stool', 'blood in urine',
        'severe vomiting', 'can\'t keep anything down', 'vomiting for days',
        'severe diarrhea', 'bloody diarrhea', 'black stools',
        'severe constipation', 'haven\'t had bowel movement in days',
        'severe abdominal cramps', 'appendicitis symptoms',
        
        # Neurological (non-critical)
        'severe dizziness', 'vertigo severe', 'room spinning',
        'confusion', 'disorientation', 'altered mental state',
        'severe tremors', 'uncontrollable shaking',
        'memory loss sudden', 'can\'t remember recent events',
        'slurred speech', 'difficulty speaking',
        
        # Skin/Allergic
        'severe rash', 'rash spreading rapidly', 'hives severe',
        'swelling severe', 'face swelling', 'limb swelling severe',
        'skin blistering', 'skin peeling off',
        'severe itching all over', 'allergic reaction moderate',
        
        # Urinary/Kidney
        'blood in urine', 'can\'t urinate', 'urinary retention',
        'kidney pain severe', 'flank pain severe',
        'painful urination extreme', 'urinary tract infection severe',
        
        # Chest/Cardiac (non-critical)
        'chest discomfort', 'chest tightness mild', 'palpitations severe',
        'irregular heartbeat', 'rapid heartbeat persistent',
        'heart racing', 'pounding heart',
        
        # Pregnancy (non-critical)
        'severe morning sickness', 'vaginal bleeding pregnancy',
        'severe cramping pregnancy', 'decreased fetal movement',
        'severe swelling pregnancy', 'severe headache pregnancy',
        
        # Bone/Joint
        'suspected fracture', 'bone pain severe', 'can\'t walk suddenly',
        'can\'t move limb', 'joint swollen severely', 'dislocated joint',
        'severe sprain', 'ankle swollen can\'t walk',
        
        # Mental Health
        'severe anxiety attack', 'panic attack severe', 'can\'t calm down',
        'severe depression', 'psychotic episode', 'hallucinations',
        'suicidal thoughts', 'self-harm urges', 'mental breakdown',
        
        # Dental
        'severe toothache', 'tooth abscess', 'swollen jaw',
        'dental emergency', 'tooth knocked out',
        
        # Other urgent
        'dehydration severe', 'can\'t drink water', 'no urine output',
        'severe weakness', 'can\'t stand up', 'collapsed',
        'severe insect bite', 'animal bite', 'snake bite',
        'medication reaction', 'adverse drug reaction',
        'severe allergic symptoms', 'foreign object swallowed',
        'chemical exposure', 'toxic fumes inhaled',
        'severe burn infection', 'wound infection spreading',
    ]
}

# Hospital/medical facility keywords
HOSPITAL_REQUEST_KEYWORDS = [
    # Direct hospital requests
    'hospital', 'nearest hospital', 'hospital near me', 'closest hospital',
    'where can i go', 'where should i go', 'which hospital',
    'hospital location', 'find hospital', 'show hospital',
    'hospital address', 'hospital contact',
    
    # Emergency services
    'emergency room', 'er', 'emergency department', 'emergency care',
    'urgent care', 'urgent care center', 'walk-in clinic',
    'emergency services', 'ambulance', 'emergency number',
    
    # Medical facilities
    'clinic', 'medical center', 'health center', 'healthcare facility',
    'doctor near me', 'hospital nearby', 'emergency hospital',
    
    # Help seeking
    'need help now', 'where to get help', 'immediate help',
    'medical emergency location', 'emergency contact',
]

# Moderate triage keywords - suggest doctor consultation
MODERATE_TRIAGE_KEYWORDS = [
    # General consultation triggers
    'consult a doctor', 'see a doctor', 'visit a doctor', 'doctor consultation',
    'medical attention', 'healthcare provider', 'seek medical help',
    'professional help', 'get checked', 'should see doctor',
    'need to see doctor', 'recommend doctor visit',
    
    # Persistent symptoms
    'persistent symptoms', 'symptoms not improving', 'getting worse',
    'not getting better', 'lasting for weeks', 'ongoing symptoms',
    
    # Diagnostic needs
    'need diagnosis', 'need tests', 'need examination',
    'need prescription', 'need treatment', 'need medication',
    
    # Follow-up needs
    'follow up needed', 'need monitoring', 'need checkup',
    'routine examination', 'preventive care',
    
    # Concerning but not urgent
    'concerning symptoms', 'worried about', 'unusual symptoms',
    'abnormal', 'strange symptoms', 'never had before',
    'family history of', 'risk factors for',
]


def detect_emergency_level(message: str) -> str:
    if not message:
        return None

    message_lower = message.lower().strip()

    # Patterns that mean the user is ASKING ABOUT something, not experiencing it
    question_only_patterns = [
        r'^what (is|are|causes?|happens?)',
        r'^how (does?|do|is|are|to)',
        r'^(can you |please )?(explain|tell me|describe|define)',
        r'^(i want to know|i am learning|just curious)',
        r'information about',
        r'tell me about',
    ]
    for pat in question_only_patterns:
        if re.search(pat, message_lower):
            return None

    # Negation: "no chest pain", "not having", "never had"
    negation_patterns = [
        r"\bno\b.{0,20}(pain|bleeding|breath|conscious|seiz)",
        r"\bnot\b.{0,20}(having|experiencing|feeling)",
        r"\bnever\b.{0,20}(had|experienced)",
        r"\bwithout\b",
        r"\bdoesn't?\b.{0,15}(hurt|bleed|work)",
    ]
    for pat in negation_patterns:
        if re.search(pat, message_lower):
            return None

    # Words that signal the user is experiencing it RIGHT NOW
    active_now_patterns = [
        r"\b(i am|i'm|i have|i've|experiencing|happening|right now|just (started|happened)|suddenly|cannot|can't)\b",
        r"\b(please help|help me|need help|emergency|urgent)\b",
        r"\b(my (chest|heart|head|stomach|arm|leg|eye|body))\b",
    ]
    has_active = any(re.search(p, message_lower) for p in active_now_patterns)

    # CRITICAL symptoms - only trigger if user seems to be experiencing them
    critical_symptoms = [
        r"\b(heart attack|cardiac arrest|stroke|cannot breathe|can't breathe|not breathing|stopped breathing)\b",
        r"\b(unconscious|unresponsive|passed out|seizure|convuls)\b",
        r"\b(severe bleeding|bleeding won.?t stop|heavy bleeding)\b",
        r"\b(overdos|drank poison|swallowed poison)\b",
        r"\b(anaphylaxis|throat (closing|swelling))\b",
        r"\b(chest pain).{0,30}(sweat|arm|jaw|radiat)\b",
    ]
    for pat in critical_symptoms:
        if re.search(pat, message_lower):
            if has_active:
                return 'critical'
            # Even without explicit "I have", very direct phrasing = critical
            direct_phrases = [
                r"^(chest pain|can't breathe|not breathing|heart attack|stroke|seizure)",
                r"(chest pain|can't breathe|bleeding).{0,20}(help|please|now|bad)",
            ]
            if any(re.search(p, message_lower) for p in direct_phrases):
                return 'critical'

    # URGENT symptoms
    urgent_symptoms = [
        r"\b(severe|extreme|unbearable|excruciating).{0,20}(pain|headache|bleeding|vomit)\b",
        r"\b(high fever|fever above 10[34]|fever (won.?t|not) (go down|break))\b",
        r"\b(difficulty breathing|shortness of breath|breathless)\b",
        r"\b(vomiting blood|coughing up blood|blood in (vomit|stool|urine))\b",
        r"\b(sudden (vision|hearing) loss|sudden blindness)\b",
        r"\b(severe (dizziness|headache|abdominal|stomach) pain)\b",
    ]
    for pat in urgent_symptoms:
        if re.search(pat, message_lower):
            if has_active:
                return 'urgent'

    return None



def get_emergency_response_message(emergency_level: str, language: str = 'English') -> str:
    """
    Get appropriate emergency response message
    """
    messages = {
        'critical': {
            'English': """🚨 CRITICAL MEDICAL EMERGENCY DETECTED! 🚨

⚠️ IMMEDIATE ACTION REQUIRED:

1. CALL EMERGENCY SERVICES NOW: 108 / 102
2. If someone is with you, have them call while you follow these steps
3. Do NOT wait - this requires immediate medical attention
4. Go to the nearest emergency room immediately
5. Do NOT drive yourself - call an ambulance

This is a life-threatening emergency. Professional medical help is needed RIGHT NOW.""",

            'Hindi': """🚨 गंभीर चिकित्सा आपात स्थिति! 🚨

⚠️ तत्काल कार्रवाई आवश्यक:

1. अभी आपातकालीन सेवाओं को कॉल करें: 108 / 102
2. यदि कोई साथ है, तो उन्हें कॉल करने दें
3. प्रतीक्षा न करें - तत्काल चिकित्सा ध्यान चाहिए
4. निकटतम आपातकालीन कक्ष में तुरंत जाएं
5. स्वयं ड्राइव न करें - एम्बुलेंस बुलाएं

यह जानलेवा आपात स्थिति है। पेशेवर चिकित्सा सहायता अभी चाहिए।"""
        },
        
        'urgent': {
            'English': """⚠️ URGENT MEDICAL ATTENTION NEEDED ⚠️

Your symptoms require prompt medical evaluation.

RECOMMENDED ACTIONS:
- Seek medical care within 24 hours
- Visit your nearest hospital or clinic
- If symptoms worsen rapidly, call 108/102 immediately
- Do not delay in getting professional medical help
- Monitor your symptoms closely

While not immediately life-threatening, this requires professional medical evaluation soon.""",

            'Hindi': """⚠️ तत्काल चिकित्सा ध्यान आवश्यक ⚠️

आपके लक्षणों के लिए शीघ्र चिकित्सा मूल्यांकन आवश्यक है।

अनुशंसित कार्रवाई:
- 24 घंटे के भीतर चिकित्सा देखभाल लें
- निकटतम अस्पताल या क्लिनिक जाएं
- यदि लक्षण तेजी से बिगड़ें, तो 108/102 पर कॉल करें
- पेशेवर चिकित्सा सहायता में देरी न करें
- अपने लक्षणों की बारीकी से निगरानी करें

हालांकि तुरंत जानलेवा नहीं, इसके लिए जल्द ही पेशेवर चिकित्सा मूल्यांकन की आवश्यकता है।"""
        }
    }
    
    return messages.get(emergency_level, {}).get(language, messages[emergency_level]['English'])


def should_show_hospitals(message: str) -> bool:
    if not message:
        return False

    message_lower = message.lower()

    # Explicit hospital requests always show
    explicit_requests = [
        r'\b(nearest|closest|nearby|find|where is|show me|hospital near|hospital location)\b.{0,20}\b(hospital|clinic|emergency|doctor)\b',
        r'\b(hospital|clinic|emergency room|urgent care)\b.{0,20}\b(near|close|location|address|around)\b',
        r'\b(take me to|go to|get to).{0,20}(hospital|emergency)\b',
        r'\bhospital near me\b',
        r'\bnearest hospital\b',
        r'\bemergency room near\b',
    ]
    for pat in explicit_requests:
        if re.search(pat, message_lower):
            logger.info(f"[Hospital Finder] Explicit hospital request detected")
            return True

    # Only show for CRITICAL emergencies, not urgent or general
    emergency_level = detect_emergency_level(message)
    if emergency_level == 'critical':
        logger.info(f"[Hospital Finder] Critical emergency - showing hospitals")
        return True

    return False


def check_ai_response_for_hospital_trigger(ai_response: str) -> bool:
    if not ai_response:
        return False
    
    response_lower = ai_response.lower()
    
    # ONLY trigger for emergency phrases
    emergency_phrases = [
        'call 108', 'call 102', 'emergency services',
        'emergency room', 'go to emergency', 'immediate emergency',
        'life-threatening', 'critical emergency', 'call ambulance'
    ]
    
    for phrase in emergency_phrases:
        if phrase in response_lower:
            logger.info(f"[check_ai_response_for_hospital_trigger] 🚨 AI emergency phrase: '{phrase}'")
            return True
    
    # DON'T trigger for general doctor recommendations
    logger.info(f"[check_ai_response_for_hospital_trigger] ℹ️ No emergency phrases - just doctor advice")
    return False



MALAYALAM_PATTERNS = [
    # Whisper-style transcriptions
    r'\b(enikku|eniku|nannu|njan|njaan|ente|entey|njangal|njangalku)\b',
    r'\b(enthanu|enthan|engane|evidey|entha|enthu|engana|enthaa|enthokke)\b',
    r'\b(ningal|ningale|nammal|namuk|avanu|avan|aval|avale|avannu)\b',
    r'\b(eppol|eppo|ethra|aaranu|aaraan|evide|evideyaa)\b',
    r'\b(cheyyanam|cheyyunnu|cheythu|cheyyanda|cheyyan)\b',
    r'\b(enthe|enthanu|enthaanu|enthu|entha|enthokke|enthineya)\b',
    r'\b(nokku|nokkam|nokkuka|parayan|paranju|parayum)\b',
    r'\b(vayar|vayaru|thalavedan|thalayivedana|vedana|vyadhi)\b',
    r'\b(doktare|doctore|aasupathri|marunnu|marunu|oushadham)\b',
    r'\b(sukham|sukhama|rogam|arogya|pidikku|pidikkum)\b',
    r'\b(nallathu|nallath|nannayi|sheriyayi|shari|sheriyanu)\b',
    r'\b(alle|alleda|allee|undo|undoo|undu|und)\b',
    r'\b(poyi|povuka|pokunnu|pokum|vannu|vann)\b',
    r'\b(cheyyu|cheyyum|cheythu|cheyyuka|cheyyanam)\b',
    r'\b(ippol|ippo|appozu|appol|pinne|appozha)\b',
    r'\b(njan|njaan|njaane|njangal)\b',
    r'\b(thalavedana|thalavedan|thalayil|thalakku)\b',
    r'\b(vayathin|vayathu|vayarinu|vayaril|hridayam)\b',

    # Core verbs
    r'\b(undu|und|illa|ilya|illaa|aayi|aayirunnu|aanu|aan)\b',
    r'\b(venam|venda|varanam|varilla|vanna|vannu|varatte)\b',
    r'\b(parayam|ariyam|cheyyam|cheyyan|paranju|parayan)\b',
    r'\b(kaanan|kaananam|kandu|kandilla|nokkan|nokkam)\b',
    r'\b(kittan|kittiyilla|kodukkam|kodukkan|tharum|tharaan)\b',
    r'\b(ariyam|ariyilla|ariyunnu|arikayanu|arinjilla)\b',
    r'\b(kaanam|kaanunnu|kaanilla|kaaniyirunnilla)\b',
    r'\b(thinnam|thinnunnu|kazhikkunnu|kazhikkam|kudikkunnu)\b',
    r'\b(uyarkkam|uyarkkuka|kidakkunnu|ezhunelkkuka)\b',
    r'\b(odicchu|odum|odunnu|nadakkunnu|nadakkanam)\b',
    r'\b(padikunnu|padikkunnu|padichu|padikkam)\b',
    r'\b(kelkkunnu|kelkkanam|kelkkunnundo|kettu|ketu)\b',
    r'\b(marannu|marannilla|marakkunnu|marakkanam)\b',
    r'\b(manassilayi|manassila|manassilaayi|purinjilla)\b',

    # Medical / body / feelings
    r'\b(vedana|nenju|thalayachan|vali|novu|pani|thooki|veppam)\b',
    r'\b(vayaru|vayar|thala|kannu|kivi|mookkil|naavu|vayil|kal|kai)\b',
    r'\b(veekkam|thallu|doctorinu|hospitalil|marunnu|kashaayam)\b',
    r'\b(rogam|asugham|sukham|kashttam|kashtam|santosham|aarogyam)\b',
    r'\b(shevasam|ulsasam|maarbu|mulachu|mutti|thirikkal)\b',
    r'\b(raktham|mootram|malam|veekkam|punn|muram|thazhamppu)\b',
    r'\b(jwaraam|pani|thottu|kanneer|nattu|kurukkal|vedana)\b',
    r'\b(thalavedana|thalayivedana|thalakku|thalakkunnu)\b',
    r'\b(valikkuka|valikkunu|valikkunundo|novu|noppundu)\b',
    r'\b(ozhukkam|ozhukkilla|mayakkam|thalachil|thalakal)\b',
    r'\b(manappuram|veezhcha|moochu|moochu mutt|shwasam)\b',
    r'\b(hridayam|nenjil|nenjinu|nenjattu|ullu|ullil)\b',
    r'\b(kaal|kaallinu|kaikku|kaiyinu|mulachu|mulach)\b',
    r'\b(kannu|kanninu|kanna|kannukku|kaazhcha|kaazhcha illa)\b',
    r'\b(kivi|kivinutha|kiviyil|kivi vayikkunnu|maandam)\b',
    r'\b(thottu|thottal|thottilla|parakkam|parashyam)\b',
    r'\b(sleep|urakkam|urachu|urakkanam|urakkam varunnilla)\b',
    r'\b(stress|tension|veruppu|vishamam|dukhkham|sambhavam)\b',
    r'\b(paranoia|bhayam|bhayapadunnu|bhayanakam|atanku)\b',
    r'\b(allergy|thadicchal|chirichal|pottikkal|chirayunnu)\b',
    r'\b(blood pressure|sugar|diabetes|thyroid|cancer|tumour)\b',

    # Adjectives / intensifiers
    r'\b(nalla|nallathu|nannayi|valare|kooduthal|kurach|kurache)\b',
    r'\b(cheriya|valiya|puthiya|pazhaya|mosham|moshamaayi)\b',
    r'\b(valuthu|cheruthu|pedikkam|pediyundu|kedakkam)\b',
    r'\b(adipoli|kidu|mast|ente ammo|ayyoo|ayyo|aiyoo)\b',
    r'\b(mushkilaanu|mushkilanu|pettannu|pettenna|sudden)\b',
    r'\b(ethrayo|ethreyum|valare|athikam|kurachu|nannaayi)\b',
    r'\b(venda|vendatha|pedikkenda|bhayappedenda)\b',
    r'\b(sherikkum|sachivam|sathyam|sathyamaanu|nijam)\b',

    # Family
    r'\b(chettan|chechi|chetta|ammaye|achane|umma|uppa|mole|mone)\b',
    r'\b(amma|achan|appa|uppappa|ammamma|appupan|vallyamma)\b',
    r'\b(muthachan|muthassi|ammavan|ammaayi|appooppan|appuppan)\b',
    r'\b(aniyathi|aniyan|muthappan|muthamma|kaakka|amma)\b',
    r'\b(chechi|chettan|mol|mon|kochu|kochu mol|kochu mon)\b',

    # Time / discourse
    r'\b(innu|inne|naale|kaaleyi|raathri|rathri|vaikittu)\b',
    r'\b(aano|aane|alle|ille|allo|illo|undallo|atho|itho)\b',
    r'\b(shari|sheriyanu|sheri|athu|ithu|ethu|athe|ithe|pinne)\b',
    r'\b(ippo|ippol|appozhaan|pinne|pinna|appol|eppozhaanennu)\b',
    r'\b(raavilae|raavile|udane|pattiyilla|pattum|patilla)\b',
    r'\b(munpe|munpil|pinnale|pinnalil|innale|innalethe)\b',
    r'\b(onnum|onnum|onnum|oru|oru nimisham|oru neram)\b',
    r'\b(kure neram|kure naal|kure divasam|kure naalaayi)\b',
    r'\b(ippozhu|ippozhaanennu|appozhaanennu|enthu neram)\b',

    # Questions / responses
    r'\b(aano|aane|sheri|aayirikkum|aayirikkumo|undaakum)\b',
    r'\b(enthu parranju|enthu paranju|enthu cheythu)\b',
    r'\b(enthokke|enthokkeyaanu|evideyaanu|engott)\b',
    r'\b(paranjilla|paranjillallo|parayillallo|ariyilla)\b',
    r'\b(manassilaayo|manassilaaythallo|purinjallo)\b',

    # Unique Malayalam phrases
    r'\b(njan doctor|njan hospital|njan medicine|kure naal)\b',
    r'\b(sherikkum|vishwasikkaan|manasilayi|manasilayilla)\b',
    r'\b(enikku ariyilla|enikku manasilaayi|enikku parayaan)\b',
    r'\b(njan vichaarikkukayaanu|njan parayan|njan kelkkunnu)\b',
    r'\b(veruthe|veruthennu|vedikkuka|vedikkanam|kedillathe)\b',
    r'\b(okay|otay|aathe|aathe mone|aathe mole|njan okke)\b',
]

TAMIL_PATTERNS = [
    # Pronouns & question words
    r'\b(enakku|enaku|naan|naanu|ennaku|enoda|naanga|nangaluku)\b',
    r'\b(yenna|enna|epdi|eppadi|yeppadi|enga|enge|engey|ennanu)\b',
    r'\b(ungal|ungala|unkal|naanga|namma|nammala|ungaluku)\b',
    r'\b(yaar|yaaru|yaarukku|ellarum|ellam|yavlo)\b',
    r'\b(seyyanam|seyyanum|seithen|seiyanum|seiyal)\b',
    r'\b(enakku|unakku|avanukku|avalukku|nammakku|ungalukku)\b',
    r'\b(yenna|yennadhu|yenna pannureenga|yenna achu)\b',
    r'\b(eppadi|yeppadi|epdi irukeenga|epdi irukinga)\b',

    # Core verbs
    r'\b(irukku|iruku|irukken|illai|ilai|illaya|ilaiye|irundha)\b',
    r'\b(venam|vena|vendaam|venda|varum|varuma|varuveen|varaama)\b',
    r'\b(sollunga|sollu|solla|sonnanga|sonnen|solunga|solren)\b',
    r'\b(pannunga|pannu|pannalam|pannanum|pannitaanga|pannaama)\b',
    r'\b(poidalam|poitu|poittu|vaanga|vaa|povomaa|poga)\b',
    r'\b(aagum|aaga|aayidum|aachu|aana|aagala)\b',
    r'\b(therium|theriyum|theriyaadu|therinjuchu|therila)\b',
    r'\b(paakanum|paakaren|paakuren|paakuren|paartha)\b',
    r'\b(kelkanum|kelkuren|kettaen|kettilla|kelkala)\b',
    r'\b(saapduven|saapduvaen|saapitaen|saapidala|kudikuren)\b',
    r'\b(thoonguven|thoonguvaen|thoonginaen|thoongala)\b',
    r'\b(nadakuren|nadanthaen|nadakala|nadakanum)\b',
    r'\b(padikuren|padichhaen|padikkala|padikkanum)\b',
    r'\b(vanthaen|varaen|varuvaen|vara maataen|varuvom)\b',
    r'\b(ponaen|povaen|poren|pogala|poganum)\b',

    # Medical / body
    r'\b(vedanai|thalai|vali|noi|kaayichchal|suram|juram|kasham)\b',
    r'\b(vayiru|vayir|kannupaka|kannu|nenju|moochu|kai|kaal|thol)\b',
    r'\b(doctorta|hospitalku|doctorkitta|marundhu|neerilippu|tablet)\b',
    r'\b(rogam|noyal|arogiyam|arogiyama|udalnilamai)\b',
    r'\b(muchu|maarppu|thommalu|thalai suthuthu|vomit)\b',
    r'\b(rathiram|moottiram|malaivu|veekkam|punn|kaayam)\b',
    r'\b(thalai vali|vayiru vali|nenju vali|kaal vali|kai vali)\b',
    r'\b(juram|kaayicchal|oora|ooral|sirukkal|irummal)\b',
    r'\b(thalaichuttal|mayal|maayakkam|thalarchi|susti)\b',
    r'\b(moochu tinapal|moochu vaangudhu|moochu padaral)\b',
    r'\b(hridayam|nenjam|nenjathu|nenjukku|ullam)\b',
    r'\b(kannu|kannuku|paarvai|paakka mudiyala|kurudanam)\b',
    r'\b(kivi|seviyal|kivi kekkala|seviyal kekkala)\b',
    r'\b(thooimai|allargi|allergy|thidichu|thadicchal)\b',
    r'\b(pressure|sugar|diabetis|thyroid|cancer|kaayicchal)\b',
    r'\b(thookam|thookam varala|padukka mudiyala|kadamai)\b',
    r'\b(bayam|tension|stress|kovalai|visanam|kavalay)\b',

    # Adjectives / intensifiers
    r'\b(nalladhu|nallaah|romba|perusa|chinna|sinna|super|mosama)\b',
    r'\b(pudusa|pazhaya|kevalamaa|mosamaa|semma|namma|konjam)\b',
    r'\b(periya|chinna|nalla|ketta|azhaga|mosama|semma)\b',
    r'\b(romba nalla|romba mosam|romba vali|romba bayam)\b',
    r'\b(konjam|kocham|siru|peru|muzhusa|muzhuvadum)\b',
    r'\b(mudiyala|mudiyum|mudinja|mudinjuchu|mudichirukku)\b',
    r'\b(aacharyam|aachu|purichirukku|purila|therila)\b',

    # Family
    r'\b(anna|akka|thambi|thangachi|mama|mami|maama|paati|thatha)\b',
    r'\b(amma|appa|ammaa|appaa|chithi|periappa|periyamma)\b',
    r'\b(athai|maama|chithappa|periyappa|periyamma|chithi)\b',
    r'\b(paati|thatha|patti|thaatha|aaya|ayya|ayah)\b',
    r'\b(paiyan|ponnu|pillai|kulandhai|baby|pasanga)\b',

    # Time / discourse
    r'\b(innikku|innaiku|naalaikku|nethu|kaalai|madhiyam|iravula)\b',
    r'\b(theriyuma|theriyum|theriyadhu|konjam|konnchi|puriyuthu)\b',
    r'\b(eppothu|eppo|inga|inge|ippo|ipo|appo|appovae)\b',
    r'\b(paarunga|paaru|mudiyala|mudiyum|mudiyadha|mudinjuchu)\b',
    r'\b(dhan|dhaan|than|thaan|thaane|yaa|ooh)\b',
    r'\b(ipothe|ippove|ipovae|appothe|appove|appovae)\b',
    r'\b(mundha|munnadhi|pinnadi|pinnadhi|appozhudhu)\b',
    r'\b(seekiram|mella|velaga|kashtama|aasaiya)\b',

    # Questions / responses
    r'\b(aama|aaamaa|illai|illaya|seri|sari|okay|otay)\b',
    r'\b(enna achu|enna panrom|enna panna|enna solra)\b',
    r'\b(yenna solreenga|yenna panneenga|yenna aagum)\b',
    r'\b(theriyuma|therinjucha|purinju|purinjucha)\b',

    # Unique Tamil phrases
    r'\b(enna panrathu|enna seivom|epdi irukeenga|nalla irukeenga)\b',
    r'\b(romba naal|konjam naal|innikku matum)\b',
    r'\b(doctor kita poga|hospital poga|marundhu vaanga)\b',
    r'\b(vali edukkaradhu|vali thaangala|romba vali)\b',
]

TELUGU_PATTERNS = [
    # Pronouns & question words
    r'\b(naku|naaku|nenu|neenu|nannu|naavalla|memu|meeru)\b',
    r'\b(enti|ela|yela|elaa|ekkada|eppudu|yeppudu|enduku|emiti)\b',
    r'\b(meeku|meeru|manam|manaku|manamu|meerandariki)\b',
    r'\b(evaru|yevaru|evariki|andaru|andariki|elanti)\b',
    r'\b(chesindhi|chesaanu|cheyyali|cheyyalani|chestaa)\b',
    r'\b(nenu|meeru|vaadu|aame|vaallu|meeru|memu|modhi)\b',
    r'\b(enti|emiti|emundi|entundi|enti vishayam|em aindi)\b',
    r'\b(ela|elaa|ela undi|ela chesaaru|ela cheppali)\b',

    # Core verbs
    r'\b(undi|undhi|undha|ledu|ledhu|leda|ledaa|unnaraa)\b',
    r'\b(vaddu|vaddhu|raadu|radhu|ravaali|raavali|raavadam)\b',
    r'\b(cheppandi|cheppu|cheppali|chesanu|chesaanu|cheppukunta)\b',
    r'\b(cheyyandi|cheyyali|cheyyaali|chesaanu|chestaanu)\b',
    r'\b(raave|raandi|ravaali|vacchi|vachchaanu|vasthaanu)\b',
    r'\b(avutundi|avutadhi|aindi|avtundhi|ayyindhi|avvadam)\b',
    r'\b(telustundi|telusthundi|telusaa|teliyadu|teliyadu)\b',
    r'\b(vinnanu|vinnaanu|vinnadu|vinadam|vinaali)\b',
    r'\b(choodaali|choodaanu|choosanu|chusaanu|chudaali)\b',
    r'\b(tintaanu|tintundi|tinnaanu|tinadam|tinaali)\b',
    r'\b(taagutaanu|taagutundi|taaginaanu|taagadam)\b',
    r'\b(padutaanu|padutundi|padukovadam|padukovali)\b',
    r'\b(nadustunna|nadustunnanu|nadichanu|nadavadam)\b',
    r'\b(veltaanu|veltundi|vellaanu|velladam|vellali)\b',
    r'\b(vasthanu|vasthundi|vachchanu|ravadam|raavali)\b',

    # Medical / body
    r'\b(noppi|thala|kashtam|kastam|vedana|manta|mandu|javaramu)\b',
    r'\b(jwaram|cheyyi|kaalu|kalu|vayithalli|ottu|gundelu|motte)\b',
    r'\b(doctorki|hospitalki|doctorgaru|maatalu|vayyaram|gudda)\b',
    r'\b(rogam|arogya|arogyam|arogyamu|janma|pilupa|dhaga)\b',
    r'\b(dimma|thalaburra|vadakam|vegati|parigedu|pallu)\b',
    r'\b(noppi|noppiga|noppigaundi|chaalaa noppi|baaga noppi)\b',
    r'\b(thala noppi|vayithu noppi|nenu noppi|ottu noppi)\b',
    r'\b(jwaram|jwaramgaundi|joram|kaayam|veppam|nidu)\b',
    r'\b(daggara|daggaragaa|matlaadadam|matlaadali)\b',
    r'\b(moochu|moochu tiyyadam|moochu levadu|gunde)\b',
    r'\b(kannu|kannulu|choodadam|choodalenu|kannu noppi)\b',
    r'\b(chevi|chevillu|vinadam|vinaledu|chevi noppi)\b',
    r'\b(thalla|thallaadi|vomit|vaanti|vaantiga undi)\b',
    r'\b(nidra|nidra raaledu|nidrapovadam|melukonaledu)\b',
    r'\b(bayam|tension|stress|kaaladham|vishaadham)\b',
    r'\b(pressure|sugar|diabetis|thyroid|cancer|gunde noppi)\b',
    r'\b(raktham|muutram|malamu|cheedhu|punn|gadda)\b',

    # Adjectives / intensifiers
    r'\b(bagundi|baagundi|baaga|chaalaa|chaala|pedha|chinna|pedda)\b',
    r'\b(kotha|paatha|mosam|manchidi|andhamaina|chakkaga|chala)\b',
    r'\b(chaalaa manchidi|chaalaa kastam|chaalaa noppi)\b',
    r'\b(konchem|kochem|koddiga|pedda|chinna|bayya|bhayya)\b',
    r'\b(baagaa|baagaledu|manchiga|manchiga ledu|kashtanga)\b',
    r'\b(veelaite|veelanante|veelakapothe|avvadam ledu)\b',

    # Family
    r'\b(tammudu|chelli|babai|atta|nannagaru|ammamma|thaatha)\b',
    r'\b(nanna|ammana|amma|avadhaanam|akka|anna|maama)\b',
    r'\b(pinni|peddamma|chinnamma|babai|mama|attayya)\b',
    r'\b(pillalu|pilla|abbayi|ammayi|bidda|biddalu)\b',

    # Time / discourse
    r'\b(repu|ninna|nedu|reypu|paata|udayam|madhyaanam|raatri)\b',
    r'\b(telusaa|telusa|thelsindhi|teliyale|teliyadu|telustundha)\b',
    r'\b(konchem|kontha|saraina|sare|sariga|cheppemaa|adhe)\b',
    r'\b(ippudu|ipudu|akkada|ikkada|appudu|apudu|antey|anthe)\b',
    r'\b(choodandi|chudu|choosanu|chusara|chepta|cheppataniki)\b',
    r'\b(mundu|mundhu|taruvata|taruvaata|akkadi|ikkadi)\b',
    r'\b(vegam|veganga|mellaga|aagutundi|avvadam|kaadu)\b',

    # Unique Telugu phrases
    r'\b(ela undi|enti vishayam|evvadu cheppadu|ela chesaaru)\b',
    r'\b(kosta undi|kastanga undi|manchiga ledu)\b',
    r'\b(doctor daggara vellali|hospital ki vellali)\b',
    r'\b(maatalu vinandi|cheppandi|ardham chesukunnaru)\b',
    r'\b(noppi thaagaledu|chaalaa noppi|baadha gaa undi)\b',
]

KANNADA_PATTERNS = [
    # Pronouns & question words
    r'\b(nanage|nange|naanu|naan|nannu|nanna|naavu|navarige)\b',
    r'\b(yenu|yaav|hege|heege|yelli|yaake|yavag|yaavag|yeshtu)\b',
    r'\b(nimma|nimmage|nimge|navu|namage|namma|navarige)\b',
    r'\b(yaaru|yaarunu|yaaranna|ellaru|yellaru|avaru)\b',
    r'\b(maadabeku|maadali|maadide|maadu|maadthini)\b',
    r'\b(naanu|neevu|avanu|avalu|avaru|namma|nimma)\b',
    r'\b(yenu|yenidhu|yenu aagide|yenu aaythu|yenu madli)\b',
    r'\b(hege|heege|hege iddira|hege maadali|hege hogi)\b',

    # Core verbs
    r'\b(idhe|ildhe|ille|ilva|idya|iddhe|idheyaa)\b',
    r'\b(beda|beku|bekilla|beko|barutta|bandu|bartini)\b',
    r'\b(heli|helakke|helalu|helidare|helidru|helodu|helthini)\b',
    r'\b(maadi|maadakke|maadbeku|maadide|maadu|maadona)\b',
    r'\b(baa|banni|hogu|hogakke|hogona|hogbedi|hogthini)\b',
    r'\b(aagutta|aagthide|aaithu|aagbeku|aagtide|aagthilla)\b',
    r'\b(gothu|gottilla|gottide|gothaagide|gothaagilla)\b',
    r'\b(nodbeku|nodthini|nodthilla|nodidhe|nodala)\b',
    r'\b(kelisabeku|kelthini|kelthilla|kelidhe|kelala)\b',
    r'\b(tinbeku|tinthini|tinnthilla|tindhe|tinala)\b',
    r'\b(kudibeku|kudithini|kudithilla|kudidhe|kudiala)\b',
    r'\b(madkobaeku|madkothini|madkothilla|madkodhe)\b',
    r'\b(hogbeku|hogthini|hogthilla|hodhe|hogala)\b',
    r'\b(barбeku|barthini|barthilla|bandhe|barala)\b',
    r'\b(maathadabeku|maathadthini|maathadthilla|maathadidhe)\b',

    # Medical / body
    r'\b(novu|tale|kashta|kashtaa|hotta|sorethana|noppu|vedane)\b',
    r'\b(jvara|jwara|kai|kaalu|hotte|tala|tale|moogu|kannu|bevu)\b',
    r'\b(doctorge|hospitalge|doctarige|maathu|oushadha|maddu)\b',
    r'\b(roga|arogyaa|arogya|aushadha|gunaamu|dehavasthe)\b',
    r'\b(talabyatha|thumba|hasivu|baayi|gedda|makkalu)\b',
    r'\b(tale novu|hotte novu|kaal novu|kai novu|novu idhe)\b',
    r'\b(jwara|jwaravidhe|jwara idhe|odale|odaladhe)\b',
    r'\b(kesaru|kesarithu|kempu|kempaaythu|kempaagide)\b',
    r'\b(moochu|moochuttu|moochu kashtaa|haagilla)\b',
    r'\b(kannu|kannige|nodu|nodokke|nodilla|nodala)\b',
    r'\b(kivi|kivige|kelisabeku|kelilla|kelala)\b',
    r'\b(vomit|vaaanthiaaythu|vaanti|vaanti bandide)\b',
    r'\b(nidde|nidde barilla|nidde aagilla|jaagide)\b',
    r'\b(bhaya|tenshan|stress|kalata|chintne|dukha)\b',
    r'\b(pressure|sugar|diabetis|thyroid|cancer|gunde novu)\b',
    r'\b(raktha|mutra|mala|kaayile|gaayanaa|punn)\b',

    # Adjectives / intensifiers
    r'\b(chennagide|chennagi|chennag|thumba|dodda|chikka|tumba)\b',
    r'\b(hosa|haala|ketta|olleyadu|sundara|olleya|bari|baree)\b',
    r'\b(thumba chennagide|thumba kashtaa|thumba novu)\b',
    r'\b(swalpa|swalpaa|dodda|chikka|hecchu|kammi)\b',
    r'\b(aagilla|aagthilla|aagbeku|maadalla|maadthilla)\b',
    r'\b(gothaagide|gothaaygide|gotthu|gottilla)\b',

    # Family
    r'\b(ajja|ajji|aththayya|maava|appa|amma|anna|akka|tangi|tamma)\b',
    r'\b(doddappa|doddamma|chikkappa|chikkamma|atthe|maava)\b',
    r'\b(makkalu|makkal|huduga|hudugi|bidda|biddalu)\b',
    r'\b(ganda|hendthi|henbidda|gandu bidda|jothe)\b',

    # Time / discourse
    r'\b(ivatt|naale|ninne|heege|beegane|adre|adru|aadre)\b',
    r'\b(beligge|madhyaahna|saayamkaala|raathri|irulinda)\b',
    r'\b(gothu|gottilla|gottila|gottaythu|gottide|gottu)\b',
    r'\b(konje|kontha|sarina|sari|sarige|sariyaagi|summane)\b',
    r'\b(nodu|nodakke|nodidare|nodona|nodi|nodthini|nodthilla)\b',
    r'\b(agbeku|agalla|agthu|agtilla|aglilla|agthide|agthilla)\b',
    r'\b(mundhe|mundhhe|nantara|nantare|appozhige|appozhigu)\b',
    r'\b(bega|begane|nidhaana|nidhaanavaagi|asupatrege)\b',

    # Questions / responses
    r'\b(howdu|howdaa|illa|illaa|sari|sariya|okay|otay)\b',
    r'\b(yenu aagide|yenu aaythu|yenu madtheera)\b',
    r'\b(hege iddira|hege irtheera|hege maadali)\b',
    r'\b(gotthaagide|gotthu|gotthilla|gottaythu)\b',

    # Unique Kannada phrases
    r'\b(hege iddira|hege idheera|yenu aagide|yenu aaythu)\b',
    r'\b(tumba kashta|tumba novu|hotte novu)\b',
    r'\b(doctorge hogbeku|hospitalge hogbeku|maddu thagolli)\b',
    r'\b(novu idhe|novu thumba|novu kashtaa|novu aagthide)\b',
]

HINDI_PATTERNS = [
    # Pronouns & question words
    r'\b(mujhe|mujhko|mera|mere|mujhse|meri|hamara|hamare)\b',
    r'\b(kya|kyon|kyun|kaise|kab|kaha|kahaan|kidhar|kyunki)\b',
    r'\b(aapka|aapko|aapke|humara|humare|tumhara|tumhe|tumko)\b',
    r'\b(kaun|kiski|kiska|kiske|sabko|sabhi|sab)\b',
    r'\b(karna|karke|kiya|kiye|karunga|karna|karo|kare)\b',
    r'\b(main|mein|hum|tum|aap|vo|woh|yeh|ye)\b',
    r'\b(kya|kyaa|kyun|kyon|kaise|kaisa|kaisi)\b',
    r'\b(iska|uska|inka|unka|apna|apni|apne)\b',

    # Core verbs
    r'\b(hain|hoon|honge|hoga|hogi|hoge|huaa|hui)\b',
    r'\b(nahi|nahin|mat|bilkul|nhi|nai|naa)\b',
    r'\b(chahiye|chaahiye|chahte|chahti|chahta)\b',
    r'\b(aana|aane|aaya|aaye|aao|aaiye|aati|aata|aayi)\b',
    r'\b(khana|khao|khaya|khaana|piyo|piya|pina|khaiye)\b',
    r'\b(jaana|jaao|gaya|gayi|jaaiye|jayenge|jaate)\b',
    r'\b(dekhna|dekho|dekha|dikha|dikhta|dekhiye|dekhte)\b',
    r'\b(sunna|suno|suna|sunte|suniye|sunaai|sunayi)\b',
    r'\b(bolna|bolo|bola|bolte|boliye|bolunga|bolenge)\b',
    r'\b(karna|karo|kiya|karte|kariye|karunga|karenge)\b',
    r'\b(lena|lo|liya|lete|lijiye|lunga|lenge)\b',
    r'\b(dena|do|diya|dete|dijiye|dunga|denge)\b',
    r'\b(uthna|utho|utha|uthte|uthiye|uthunga|uthenge)\b',
    r'\b(baithna|baitho|baitha|baithte|baithiye)\b',
    r'\b(sona|so|soya|soye|soiye|sounga|soenge)\b',
    r'\b(padhna|padho|padha|padhte|padhiye|padhlunga)\b',
    r'\b(likhna|likho|likha|likhte|likhiye|likhunga)\b',
    r'\b(samajhna|samjho|samjha|samjhe|samjhiye)\b',
    r'\b(rehna|raho|raha|rahi|rahiye|rahunga|rahenge)\b',

    # Medical / body
    r'\b(dard|takleef|seer|peeth|gala|bukhar|sujan|dhadkan)\b',
    r'\b(khujli|jalan|ghav|zakham|chot|lagi|dawai|dawaai|tablet)\b',
    r'\b(doctorko|hospitalme|doctorsaab|vaidya|dawakhana|clinic)\b',
    r'\b(bimari|rog|swasthya|sehat|tabiyat|body|andar)\b',
    r'\b(pet|sar|aankhein|kaan|naak|muh|haath|pair|seena|kamar)\b',
    r'\b(sir dard|pet dard|seena dard|kamar dard|paon dard)\b',
    r'\b(bukhar|jwara|tapman|garmi|thandi|kaapna)\b',
    r'\b(khansi|khaans|naak beh|naak band|zukam|sardi)\b',
    r'\b(ulti|vomit|matli|chakkar|behoshi|gir jaana)\b',
    r'\b(khoon|khoon nikalna|peshab|peshab mein|latrine)\b',
    r'\b(aankhon mein|aankhon se|aankhein dukh|dhundhla)\b',
    r'\b(kaanon mein|kaanon se|sunaai nahi|bahra)\b',
    r'\b(thakaan|kamzori|aanv|susti|neend|neend nahi)\b',
    r'\b(tension|stress|chinta|ghabrahat|darr|darna)\b',
    r'\b(pressure|sugar|madhumeh|thyroid|cancer|tumor)\b',
    r'\b(heart|dil|dil ki dhadkan|dil dard|dil mein)\b',
    r'\b(saas|saas lena|saas phoolna|saas ki takleef)\b',
    r'\b(dawa|dawai|goli|capsule|syrup|injection|ilaaj)\b',

    # Adjectives / intensifiers
    r'\b(achha|accha|achchhi|bahut|bohot|zyada|jyada|thoda|bilkul)\b',
    r'\b(bada|badi|bade|chota|choti|chote|naya|purana|purani)\b',
    r'\b(theek|theekh|sahi|galat|mushkil|aasaan)\b',
    r'\b(bahut zyada|bahut takleef|bahut dard|bahut bura)\b',
    r'\b(thoda sa|thodi si|zyada nahi|kam hai|kaafi hai)\b',
    r'\b(seedha|seedhi|ulta|achanak|jaldi|dhire)\b',
    r'\b(purana|naya|pehle se|abhi se|kal se|aaj se)\b',

    # Family
    r'\b(bhai|didi|bhaiya|dada|dadi|nana|nani|chacha|chachi)\b',
    r'\b(maa|papa|baba|ammi|abbu|pitaji|mataji|beta|beti)\b',
    r'\b(naana|naani|dada|daadi|taya|tayi|mama|maami)\b',
    r'\b(pati|patni|biwi|shohar|baccha|bachchey|pariwar)\b',

    # Time
    r'\b(aaj|subah|shaam|raat|dophar|savere|dopahar|kal|parson)\b',
    r'\b(abhi|pehle|baad|jab|tab|phir|agle|pichle)\b',
    r'\b(do din se|teen din se|ek hafte se|mahine se)\b',
    r'\b(subah se|raat se|kuch ghante se|thodi der se)\b',
    r'\b(kabse|kitne din se|kab se hai|kab hua)\b',

    # Discourse particles
    r'\b(batao|pata|malum|maloom|jaanta|jaante|janta|samjha)\b',
    r'\b(thoda|thodi|zara|ekdum|puri|poora|sirf|bas)\b',
    r'\b(haan|han|ji|bhi|toh|kyunki|lekin|aur|ya|par)\b',
    r'\b(samajh|samjha|samjho|milega|mila|mile|samjhe)\b',
    r'\b(achha ji|theek hai|haan ji|nahin ji|shukriya)\b',
    r'\b(please|zaroor|bilkul|zaruri|important|problem)\b',

    # Questions / responses
    r'\b(kya hua|kya ho raha|kya problem|kya takleef)\b',
    r'\b(theek nahi|theek ho|theek hai|sahi nahi|sahi hai)\b',
    r'\b(dard ho raha|takleef ho rahi|bura lag raha)\b',
    r'\b(doctor ke paas|hospital jana|dawai lena|ilaaj)\b',
    r'\b(kya khaaun|kya peeun|kya karun|kya na karun)\b',
    r'\b(kitna lena|kab lena|kaise lena|kitni baar)\b',
]

LANGUAGE_CODE_MAP = {
    'en': 'English',
    'hi': 'Hindi',
    'kn': 'Kannada',
    'ta': 'Tamil',
    'te': 'Telugu',
    'ml': 'Malayalam',
}


def detect_romanized_language(text: str) -> Optional[str]:
    if not text or len(text.strip()) < 3:
        return None

    text_lower = text.lower().strip()

    # Skip if text is clearly English only (no Indian language markers)
    # But still check — some mixed sentences need detection
    pattern_map = {
        'Malayalam': MALAYALAM_PATTERNS,
        'Tamil':     TAMIL_PATTERNS,
        'Telugu':    TELUGU_PATTERNS,
        'Kannada':   KANNADA_PATTERNS,
        'Hindi':     HINDI_PATTERNS,
    }

    scores = {}
    for lang, patterns in pattern_map.items():
        score = 0
        for p in patterns:
            match = re.search(p, text_lower, re.IGNORECASE)
            if match:
                # Weight by match length — longer matches are more specific
                score += 1 + (len(match.group(0)) // 4)
        scores[lang] = score

    logger.debug(f'[detect_romanized_language] scores={scores} text="{text[:80]}"')

    max_score = max(scores.values())

    if max_score >= 1:
        detected = max(scores, key=lambda k: scores[k])
        logger.info(
            f'[detect_romanized_language] ✅ {detected} '
            f'(score={max_score}) for: "{text[:60]}"'
        )
        return detected

    return None


def detect_language(text: str) -> str:
    """
    Detect language from text.
    Priority:
      1. Romanized Indian language detection (Manglish / Tanglish / etc.)
      2. Native script via langdetect
      3. Default → English
    """
    try:
        text = (text or '').strip()
        if not text or len(text) < 3:
            return 'English'

        # Step 1: Check romanized first
        romanized = detect_romanized_language(text)
        if romanized:
            logger.info(f'[detect_language] ✅ ROMANIZED → {romanized}')
            return romanized

        # Step 2: Native script via langdetect
        try:
            from langdetect import detect as _detect
            code = _detect(text)
            lang = LANGUAGE_CODE_MAP.get(code, 'English')
            logger.info(f'[detect_language] ✅ NATIVE → {lang} (code={code})')
            return lang
        except Exception as exc:
            logger.warning(f'[detect_language] langdetect failed: {exc}')

        return 'English'

    except Exception as exc:
        logger.error(f'[detect_language] error: {exc}')
        return 'English'


def get_response_language(
    user_message: str,
    user_selected_language: Optional[str] = None,
) -> str:

    # 1. Check native scripts FIRST (highest priority)
    native_script_ranges = [
        ('\u0d00', '\u0d7f', 'Malayalam'),
        ('\u0b80', '\u0bff', 'Tamil'),
        ('\u0c00', '\u0c7f', 'Telugu'),
        ('\u0c80', '\u0cff', 'Kannada'),
        ('\u0900', '\u097f', 'Hindi'),
    ]
    for start, end, lang_name in native_script_ranges:
        if any(start <= char <= end for char in user_message):
            logger.info(f'[get_response_language] Native script detected: {lang_name}')
            return lang_name

    # 2. Explicit non-English selection
    if user_selected_language and user_selected_language != 'English':
        logger.info(f'[get_response_language] User selected: {user_selected_language}')
        return user_selected_language
    # 3. Native script
    try:
        native = detect_language(user_message)
        if native and native != 'English':
            logger.info(f'[get_response_language] Auto-detected native: {native}')
            return native
    except Exception:
        pass

    # 4. Default
    return 'English'



import re
from difflib import SequenceMatcher
from collections import Counter

# Common medical terms dictionary (expandable)
MEDICAL_DICTIONARY = {
    'headache', 'fever', 'cough', 'cold', 'flu', 'pain', 'diabetes', 'asthma',
    'cancer', 'heart', 'blood', 'pressure', 'sugar', 'throat', 'stomach',
    'nausea', 'vomiting', 'diarrhea', 'constipation', 'infection', 'allergy',
    'medicine', 'tablet', 'capsule', 'syrup', 'injection', 'vaccine',
    'doctor', 'hospital', 'clinic', 'pharmacy', 'prescription', 'treatment',
    'symptom', 'disease', 'condition', 'illness', 'injury', 'fracture',
    'paracetamol', 'ibuprofen', 'amoxicillin', 'azithromycin', 'cetirizine',
    'dolo', 'crocin', 'combiflam', 'calpol', 'vicks', 'dettol'
}

def levenshtein_distance(s1, s2):
    """Calculate Levenshtein distance between two strings"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]


def get_close_matches(word, possibilities, n=3, cutoff=0.6):
    """Get close matches for a word from possibilities"""
    if not word or not possibilities:
        return []
    
    word = word.lower()
    matches = []
    
    for possibility in possibilities:
        possibility_lower = possibility.lower()
        
        # Calculate similarity ratio
        ratio = SequenceMatcher(None, word, possibility_lower).ratio()
        
        if ratio >= cutoff:
            matches.append((possibility, ratio))
    
    # Sort by ratio (descending) and return top n
    matches.sort(key=lambda x: x[1], reverse=True)
    return [match[0] for match in matches[:n]]


def correct_spelling(text, custom_dictionary=None):
    """
    Correct spelling mistakes in text
    
    Args:
        text: Input text with potential spelling mistakes
        custom_dictionary: Additional words to check against
    
    Returns:
        tuple: (corrected_text, corrections_made, suggestions)
    """
    if not text or not text.strip():
        return text, [], {}
    
    # Combine dictionaries
    dictionary = MEDICAL_DICTIONARY.copy()
    if custom_dictionary:
        dictionary.update(custom_dictionary)
    
    words = text.lower().split()
    corrected_words = []
    corrections_made = []
    suggestions = {}
    
    for word in words:
        # Remove punctuation for checking
        clean_word = re.sub(r'[^\w\s]', '', word)
        
        if not clean_word:
            corrected_words.append(word)
            continue
        
        # Check if word is already correct
        if clean_word.lower() in dictionary:
            corrected_words.append(word)
            continue
        
        # Find close matches
        matches = get_close_matches(clean_word, dictionary, n=3, cutoff=0.7)
        
        if matches:
            best_match = matches[0]
            corrected_words.append(best_match)
            
            corrections_made.append({
                'original': word,
                'corrected': best_match,
                'alternatives': matches[1:] if len(matches) > 1 else []
            })
            
            suggestions[word] = matches
        else:
            # No good match found, keep original
            corrected_words.append(word)
    
    corrected_text = ' '.join(corrected_words)
    
    return corrected_text, corrections_made, suggestions


def auto_correct_search_query(query, custom_terms=None):
    """
    Auto-correct search query with detailed feedback
    
    Args:
        query: Search query string
        custom_terms: Additional terms to match against (e.g., medicine names)
    
    Returns:
        dict: {
            'original': original query,
            'corrected': corrected query,
            'has_corrections': bool,
            'corrections': list of corrections,
            'suggestions': dict of suggestions,
            'confidence': float (0-1)
        }
    """
    if not query or len(query.strip()) < 2:
        return {
            'original': query,
            'corrected': query,
            'has_corrections': False,
            'corrections': [],
            'suggestions': {},
            'confidence': 1.0
        }
    
    # Build custom dictionary from medicine names if provided
    custom_dict = set()
    if custom_terms:
        custom_dict = {term.lower() for term in custom_terms}
    
    corrected_text, corrections, suggestions = correct_spelling(query, custom_dict)
    
    # Calculate confidence score
    if not corrections:
        confidence = 1.0
    else:
        # Average similarity of corrections
        similarities = []
        for corr in corrections:
            orig = corr['original'].lower()
            fixed = corr['corrected'].lower()
            sim = SequenceMatcher(None, orig, fixed).ratio()
            similarities.append(sim)
        confidence = sum(similarities) / len(similarities) if similarities else 0.5
    
    return {
        'original': query,
        'corrected': corrected_text,
        'has_corrections': len(corrections) > 0,
        'corrections': corrections,
        'suggestions': suggestions,
        'confidence': confidence
    }


def fuzzy_search_medicines(query, medicines_queryset, threshold=0.6):
    """
    Perform fuzzy search on medicines with auto-correction
    
    Args:
        query: Search query
        medicines_queryset: Django queryset of Medicine objects
        threshold: Minimum similarity threshold (0-1)
    
    Returns:
        tuple: (results_queryset, correction_info)
    """
    from django.db.models import Q
    
    # Get all medicine names for spell checking
    all_names = list(medicines_queryset.values_list('name', flat=True))
    all_generic = list(medicines_queryset.values_list('generic_name', flat=True))
    custom_terms = set(all_names + all_generic)
    
    # Auto-correct the query
    correction_info = auto_correct_search_query(query, custom_terms)
    
    # Use corrected query if confidence is high
    search_query = correction_info['corrected'] if correction_info['confidence'] > 0.7 else query
    
    # Search with corrected query
    results = medicines_queryset.filter(
        Q(name__icontains=search_query) |
        Q(generic_name__icontains=search_query) |
        Q(manufacturer__icontains=search_query)
    )
    
    # If no results with corrected query, try original
    if not results.exists() and search_query != query:
        results = medicines_queryset.filter(
            Q(name__icontains=query) |
            Q(generic_name__icontains=query) |
            Q(manufacturer__icontains=query)
        )
        correction_info['used_original'] = True
    else:
        correction_info['used_original'] = False
    
    return results, correction_info

def test_language_detection():
    """Test the language detection with various inputs"""
    test_cases = [
        ("Enikku nenju vedana undu", "Malayalam"),
        ("Enakku thalai vali irukku", "Tamil"),
        ("Naku thala noppi undi", "Telugu"),
        ("Nanage tale novu ide", "Kannada"),
        ("Mujhe sir dard hai", "Hindi"),
        ("I have a headache", "English"),
    ]
    
    print("\n" + "="*80)
    print("TESTING ROMANIZED LANGUAGE DETECTION")
    print("="*80)
    
    for text, expected in test_cases:
        detected = get_response_language(text)
        status = "✅" if detected == expected else "❌"
        print(f"{status} Input: '{text}'")
        print(f"   Expected: {expected}, Got: {detected}")
        print()

if __name__ == "__main__":
    test_language_detection()


# api/helpers.py
import re
import logging
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)

# ============================================================================
# EXISTING HELPER FUNCTIONS (KEEP ALL OF THESE)
# ============================================================================

# Your existing functions like:
# - detect_emergency_level()
# - should_show_hospitals()
# - get_response_language()
# - detect_language()
# etc.

# ============================================================================
# NEW: OCR HELPER FUNCTIONS
# ============================================================================

def extract_medications_from_text(text: str) -> List[Dict[str, str]]:
    """
    Extract medication information from prescription text
    
    Args:
        text: OCR extracted text from prescription
    
    Returns:
        List of medications with name, dosage, frequency
    """
    medications = []
    
    # Common medication patterns
    patterns = [
        # Pattern: "Tab. Paracetamol 500mg - 1-0-1"
        r'(?:Tab\.|Tablet|Cap\.|Capsule|Syrup)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*mg|ml)\s*[-–]\s*([0-9-]+)',
        # Pattern: "Paracetamol 500mg TDS"
        r'([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*mg|ml)\s+(OD|BD|TDS|QDS|PRN|SOS)',
        # Pattern: "Amoxicillin 250mg three times daily"
        r'([A-Za-z]+)\s+(\d+\s*mg|ml)\s+(once|twice|thrice|three times|four times)\s+(?:a\s+)?daily',
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            med = {
                'name': match.group(1).strip(),
                'dosage': match.group(2).strip() if len(match.groups()) > 1 else '',
                'frequency': match.group(3).strip() if len(match.groups()) > 2 else ''
            }
            medications.append(med)
    
    return medications


def extract_lab_values_from_text(text: str) -> List[Dict[str, str]]:
    """
    Extract lab test values from report text
    
    Args:
        text: OCR extracted text from lab report
    
    Returns:
        List of test results with name, value, range
    """
    test_results = []
    
    # Pattern for lab values: "Hemoglobin 13.5 g/dL (12-16)"
    pattern = r'([A-Za-z\s]+?)\s+(\d+\.?\d*)\s*([a-zA-Z/%]+)?\s*(?:\(([0-9.\-\s]+)\))?'
    
    matches = re.finditer(pattern, text)
    for match in matches:
        test_name = match.group(1).strip()
        value = match.group(2).strip()
        unit = match.group(3).strip() if match.group(3) else ''
        ref_range = match.group(4).strip() if match.group(4) else ''
        
        # Filter out noise (only keep likely lab test names)
        if len(test_name) > 3 and not test_name.isdigit():
            test_results.append({
                'test': test_name,
                'value': value,
                'unit': unit,
                'reference_range': ref_range
            })
    
    return test_results


def extract_doctor_info_from_text(text: str) -> Dict[str, Optional[str]]:
    """
    Extract doctor and clinic information from prescription
    
    Args:
        text: OCR extracted text
    
    Returns:
        Dict with doctor_name, clinic_name, contact
    """
    info = {
        'doctor_name': None,
        'clinic_name': None,
        'contact': None
    }
    
    # Pattern for doctor name
    doctor_patterns = [
        r'Dr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
        r'(?:Physician|Doctor):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
    ]
    
    for pattern in doctor_patterns:
        match = re.search(pattern, text)
        if match:
            info['doctor_name'] = match.group(1).strip()
            break
    
    # Pattern for clinic/hospital
    clinic_patterns = [
        r'(?:Clinic|Hospital|Medical Center):\s*([A-Z][A-Za-z\s]+)',
        r'([A-Z][A-Za-z\s]+(?:Clinic|Hospital|Medical Center))',
    ]
    
    for pattern in clinic_patterns:
        match = re.search(pattern, text)
        if match:
            info['clinic_name'] = match.group(1).strip()
            break
    
    # Pattern for phone number
    phone_pattern = r'(?:\+91|0)?[6-9]\d{9}'
    phone_match = re.search(phone_pattern, text)
    if phone_match:
        info['contact'] = phone_match.group(0)
    
    return info


def extract_dates_from_text(text: str) -> Dict[str, Optional[str]]:
    """
    Extract dates from medical documents
    
    Args:
        text: OCR extracted text
    
    Returns:
        Dict with prescription_date, test_date, etc.
    """
    dates = {
        'document_date': None,
        'expiry_date': None
    }
    
    # Common date patterns
    date_patterns = [
        r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',  # DD/MM/YYYY or DD-MM-YYYY
        r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})',    # YYYY-MM-DD
        r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})',  # DD Month YYYY
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text)
        if match:
            dates['document_date'] = match.group(1)
            break
    
    return dates


def calculate_ocr_confidence(text: str, image_type: str) -> float:
    """
    Calculate OCR confidence score (0.0 - 1.0)
    """
    if not text or len(text.strip()) == 0:
        return 0.0
    
    # Base confidence on text length and keywords
    confidence = 0.5  # Base
    
    # More text = higher confidence
    if len(text) > 100:
        confidence += 0.2
    elif len(text) > 50:
        confidence += 0.1
    
    # Specific keywords boost confidence
    keywords = {
        'prescription': ['rx', 'prescription', 'tablet', 'capsule', 'mg', 'doctor'],
        'lab_report': ['test', 'result', 'normal range', 'hemoglobin', 'glucose'],
        'ct_scan': ['ct', 'scan', 'radiology', 'contrast'],
        'xray': ['x-ray', 'radiograph', 'chest'],
        'mri': ['mri', 'magnetic', 't1', 't2']
    }
    
    if image_type in keywords:
        matches = sum(1 for kw in keywords[image_type] if kw.lower() in text.lower())
        confidence += min(matches * 0.1, 0.3)
    
    return min(confidence, 1.0)


# ============================================================================
# NEW: VOICE HELPER FUNCTIONS
# ============================================================================

def detect_voice_language(text: str) -> str:
    """
    Detect language from voice input text
    Uses same logic as existing detect_language() but optimized for voice
    
    Args:
        text: Transcribed text from voice input
    
    Returns:
        Language name (English, Hindi, Kannada, etc.)
    """
    # You can reuse your existing detect_language() function
    # or add voice-specific detection logic here
    from .helpers import detect_language  # Import your existing function
    return detect_language(text)


def map_language_to_voice_code(language: str) -> str:
    """
    Map language name to browser voice API language code
    
    Args:
        language: Language name (e.g., 'English', 'Hindi')
    
    Returns:
        Voice API language code (e.g., 'en-US', 'hi-IN')
    """
    mapping = {
        'English': 'en-US',
        'Hindi': 'hi-IN',
        'Kannada': 'kn-IN',
        'Tamil': 'ta-IN',
        'Telugu': 'te-IN',
        'Malayalam': 'ml-IN',
    }
    return mapping.get(language, 'en-US')


def validate_voice_input(text: str, max_length: int = 500) -> Tuple[bool, str]:
    """
    Validate voice input text
    
    Args:
        text: Transcribed text
        max_length: Maximum allowed length
    
    Returns:
        (is_valid, error_message)
    """
    if not text or not text.strip():
        return False, "Voice input is empty"
    
    if len(text) > max_length:
        return False, f"Voice input too long (max {max_length} characters)"
    
    # Check for gibberish (very basic check)
    words = text.split()
    if len(words) < 2 and len(text) > 50:
        return False, "Voice input may be unclear, please try again"
    
    return True, ""


# ============================================================================
# ANALYTICS HELPER FUNCTIONS
# ============================================================================

def get_ocr_statistics(user_id: str = None) -> Dict:
    """
    Get OCR processing statistics
    
    Args:
        user_id: Optional user ID to filter by
    
    Returns:
        Dictionary with OCR statistics
    """
    from .models import ChatHistory, OCRProcessingLog
    from django.db.models import Count, Avg
    
    query = ChatHistory.objects.filter(ocr_extracted_text__isnull=False)
    if user_id:
        query = query.filter(user_id=user_id)
    
    stats = {
        'total_ocr_processed': query.count(),
        'by_type': query.values('image_type').annotate(count=Count('id')),
        'average_confidence': query.aggregate(Avg('ocr_confidence'))['ocr_confidence__avg'],
    }
    
    # Processing performance
    if OCRProcessingLog.objects.exists():
        perf_stats = OCRProcessingLog.objects.aggregate(
            avg_time=Avg('processing_time_ms'),
            success_rate=Avg('success')
        )
        stats['performance'] = perf_stats
    
    return stats


def log_ocr_processing(
    chat_message_id: str,
    image_type: str,
    ocr_method: str,
    processing_time_ms: int,
    text_length: int,
    success: bool = True,
    error_message: str = None
):
    """
    Log OCR processing for analytics
    
    Args:
        chat_message_id: ID of the ChatHistory record
        image_type: Type of image processed
        ocr_method: Method used (easyocr, tesseract, none)
        processing_time_ms: Processing time in milliseconds
        text_length: Length of extracted text
        success: Whether processing was successful
        error_message: Error message if failed
    """
    from .models import OCRProcessingLog, ChatHistory
    
    try:
        chat_message = ChatHistory.objects.get(id=chat_message_id)
        
        OCRProcessingLog.objects.create(
            chat_message=chat_message,
            image_type=image_type,
            ocr_method=ocr_method,
            processing_time_ms=processing_time_ms,
            text_length=text_length,
            success=success,
            error_message=error_message
        )
    except Exception as e:
        logger.error(f"Failed to log OCR processing: {e}")


# ============================================================================
# STRUCTURED DATA EXTRACTION
# ============================================================================

def extract_structured_medical_data(
    extracted_text: str,
    image_type: str
) -> Dict:
    """
    Extract structured data from OCR text based on image type
    
    Args:
        extracted_text: Raw OCR text
        image_type: Type of medical document
    
    Returns:
        Structured data dictionary
    """
    data = {
        'raw_text': extracted_text,
        'image_type': image_type,
    }
    
    if image_type == 'prescription':
        data['medications'] = extract_medications_from_text(extracted_text)
        doctor_info = extract_doctor_info_from_text(extracted_text)
        data.update(doctor_info)
        dates = extract_dates_from_text(extracted_text)
        data['prescription_date'] = dates.get('document_date')
    
    elif image_type == 'lab_report':
        data['test_results'] = extract_lab_values_from_text(extracted_text)
        dates = extract_dates_from_text(extracted_text)
        data['test_date'] = dates.get('document_date')
    
    # Calculate confidence
    data['confidence_score'] = calculate_ocr_confidence(extracted_text, image_type)
    
    return data


# ============================================================================
# EXPORT FUNCTIONS
# ============================================================================

__all__ = [
    # Existing functions (keep all)
    'detect_emergency_level',
    'should_show_hospitals',
    'get_response_language',
    'detect_language',
    
    # New OCR functions
    'extract_medications_from_text',
    'extract_lab_values_from_text',
    'extract_doctor_info_from_text',
    'extract_dates_from_text',
    'calculate_ocr_confidence',
    'extract_structured_medical_data',
    
    # New Voice functions
    'detect_voice_language',
    'map_language_to_voice_code',
    'validate_voice_input',
    
    # Analytics
    'get_ocr_statistics',
    'log_ocr_processing',
]

# def detect_voice_language(text: str) -> str:
#     return detect_language(text)

# def map_language_to_voice_code(language: str) -> str:
#     mapping = {
#         'English': 'en-US',
#         'Hindi': 'hi-IN',
#         'Kannada': 'kn-IN',
#         'Tamil': 'ta-IN',
#         'Telugu': 'te-IN',
#         'Malayalam': 'ml-IN',
#     }
#     return mapping.get(language, 'en-US')

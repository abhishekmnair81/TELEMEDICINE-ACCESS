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
    'English': 'You must respond ONLY in English language.',
    'Hindi': 'आपको केवल हिंदी भाषा में जवाब देना है।',
    'Kannada': 'ನೀವು ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ ಮಾತ್ರ ಉತ್ತರಿಸಬೇಕು।',
    'Tamil': 'நீங்கள் தமிழ் மொழியில் மட்டுமே பதிலளிக்க வேண்டும்.',
    'Telugu': 'మీరు తెలుగు భాషలో మాత్రమే సమాధానం ఇవ్వాలి.',
    'Malayalam': 'നിങ്ങൾ മലയാളം ഭാഷയിൽ മാത്രം മറുപടി നൽകണം.'
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
    """
    STRICTEST emergency detection - only life-threatening situations
    
    Returns: 'critical', 'urgent', or None
    """
    if not message:
        return None
    
    message_lower = message.lower()
    
    # ✅ CHECK FOR NEGATION FIRST - "not having", "no chest pain", etc.
    negation_patterns = [
        'not having', 'no ', "don't have", "doesn't have", 
        'without', 'never had', 'not experiencing',
        'what is', 'what are', 'how to', 'can you explain',
        'tell me about', 'information about'
    ]
    
    has_negation = any(neg in message_lower for neg in negation_patterns)
    
    # ✅ CHECK IF IT'S JUST A QUESTION (not experiencing symptoms)
    question_indicators = [
        'what is', 'what are', 'what causes', 'how to',
        'can you explain', 'tell me about', 'information about',
        'should i', 'when should', 'do i need'
    ]
    
    is_question = any(q in message_lower for q in question_indicators)
    
    # ✅ CRITICAL: Only trigger on ACTUAL emergencies with action words
    critical_action_patterns = [
        'right now', 'happening now', 'currently happening',
        'just started', 'suddenly started', 'just happened',
        'i am having', 'i have', 'experiencing now',
        'cant breathe', 'cannot breathe', "can't breathe"
    ]
    
    has_active_emergency = any(action in message_lower for action in critical_action_patterns)
    
    # ✅ If it's just a question OR has negation, NOT an emergency
    if is_question or has_negation:
        logger.info(f"[Emergency Detection] ℹ️ Just a question or negation - not emergency")
        return None
    
    # Check for critical keywords (much shorter list now)
    critical_found = False
    for keyword in CRITICAL_EMERGENCY_KEYWORDS:
        if keyword in message_lower:
            # Must have active emergency indicator
            if has_active_emergency:
                logger.info(f"[Emergency Detection] 🚨 CRITICAL: {keyword} (active emergency)")
                critical_found = True
                break
            else:
                logger.info(f"[Emergency Detection] ℹ️ Keyword '{keyword}' but no active emergency")
    
    if critical_found:
        return 'critical'
    
    # For 'urgent' - keep your existing logic but don't make it critical
    severe_modifiers = ['severe ', 'extreme ', 'terrible ', 'unbearable ', 'worst ', 'intense ']
    urgent_symptoms = [
        'chest pain', 'difficulty breathing', 'vomiting blood', 
        'bleeding heavily', 'high fever', 'severe headache'
    ]
    
    has_severe = any(mod in message_lower for mod in severe_modifiers)
    has_urgent_symptom = any(symptom in message_lower for symptom in urgent_symptoms)
    
    if has_severe and has_urgent_symptom and has_active_emergency:
        logger.info(f"[Emergency Detection] ⚠️ URGENT detected")
        return 'urgent'
    
    logger.info(f"[Emergency Detection] ℹ️ No emergency - general medical query")
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
    """
    ✅ STRICTEST: Only show hospitals for CRITICAL life-threatening emergencies or explicit requests
    
    Returns: True ONLY if:
    1. CRITICAL life-threatening emergency happening NOW
    2. Explicit "find hospital" / "hospital near me" request
    """
    if not message:
        return False
    
    message_lower = message.lower()
    
    # ✅ CHECK FOR NEGATION (not having, no chest pain, what is...)
    negation_patterns = ['not ', 'no ', "don't", "doesn't", 'never', 'without', 'what is', 'what are', 'how to', 'tell me about']
    has_negation = any(neg in message_lower for neg in negation_patterns)
    
    # ✅ CHECK IF JUST A QUESTION (not experiencing symptoms)
    question_patterns = ['what is', 'what are', 'how to', 'tell me about', 'can you explain', 'what causes', 'why does']
    is_question = any(q in message_lower for q in question_patterns)
    
    if has_negation or is_question:
        logger.info(f"[Hospital Finder] ℹ️ Question or negation - NO hospitals")
        return False
    
    # ============================================================
    # 1. EXPLICIT hospital/clinic location requests
    # ============================================================
    explicit_requests = [
        'nearest hospital', 'hospital near me', 'find hospital',
        'where is hospital', 'hospital location', 'hospital address',
        'emergency room near', 'where can i go', 'take me to hospital',
        'closest hospital', 'hospital nearby', 'show me hospitals',
    ]
    
    for request in explicit_requests:
        if request in message_lower:
            logger.info(f"[Hospital Finder] 🏥 Explicit hospital request: {request}")
            return True
    
    # ============================================================
    # 2. ONLY for CRITICAL emergencies (NOT urgent, NOT general)
    # ============================================================
    emergency_level = detect_emergency_level(message)
    
    if emergency_level == 'critical':
        logger.info(f"[Hospital Finder] 🚨 CRITICAL emergency - showing hospitals")
        return True
    
    # ✅ CRITICAL FIX: Don't show for 'urgent' or general queries
    if emergency_level == 'urgent':
        logger.info(f"[Hospital Finder] ⚠️ Urgent but NOT critical - NO hospitals (see doctor within 24h)")
        return False
    
    logger.info(f"[Hospital Finder] ℹ️ General query - NO hospitals needed")
    return False


def check_ai_response_for_hospital_trigger(ai_response: str) -> bool:
    """
    ✅ FIXED: Only trigger if AI explicitly says "emergency" or "call 108/102"
    Don't trigger just for "see a doctor"
    
    Returns: True only for emergency-level recommendations
    """
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



# Malayalam romanization patterns (Manglish) - COMPREHENSIVE
MALAYALAM_PATTERNS = [
    # Common pronouns and question words
    r'\b(enikku?|eniku|njan|njaan|ente|entey|enik|njangal|njangalkku?)\b',
    r'\b(enthanu|enthan|engane|evidey?|evide|entha|enthu|engana|enthaa)\b',
    r'\b(ningal|ningale|nammal|namuk|avanu|avan|aval|avale|avar)\b',
    r'\b(eppol|eppo|ethra|enthina|yaar|aaranu|aaraan|aara)\b',
    
    # Common verbs - MASSIVELY EXPANDED
    r'\b(undu?|und|illa|ilya|illaa|aayi|aayirunnu|aanu|aan)\b',
    r'\b(vendey?|venam|venda|varanam|varilla|varan|vanna|vannu)\b',
    r'\b(parayam|ariyam|cheyyam|cheyyan|cheyyatte|paranju|parayan)\b',
    r'\b(kannam|kanan|kelkam|kelkan|varaam|pokan|pokam)\b',
    r'\b(kayikam|kayikan|kayichu|aakam|aakan|kittan|kittiyilla)\b',
    r'\b(kodukkam|kodukkan|tharum|tharaan|edukkan|edukkam)\b',
    r'\b(poyi|povuka|poyittu|poyittundu|pokkunnu|pokunnilla)\b',
    
    # Common adjectives and adverbs
    r'\b(nalla|nallathu|nannayi|valare|kooduthal|kurach|kurache)\b',
    r'\b(cheriya|valiya|puthiya|pazhaya|mosham|moshamaayi)\b',
    r'\b(mattey?|verey|athrem|ingane|angane|ithupole)\b',
    
    # Family and social terms
    r'\b(chettan|chechi|chetta|ammaye?|achane?|amma|achan|appa)\b',
    r'\b(uppappa|aacha|umma|ninte|mone|mole|pennu|aannu)\b',
    
    # Medical/health terms - COMPREHENSIVE
    r'\b(vedana|nenju|thala|vali|novu|pani|thooki|veppam)\b',
    r'\b(visham|kai|kaal|vayar|vayaru|tala|kannu|kivi)\b',
    r'\b(veekkam|thallu|chavittu|kozhupu|thanne|vayil|naavu)\b',
    r'\b(doctorinu|hospitalilek|doctorde|vaidyan|hospitalil)\b',
    r'\b(rogam|asugham|sukham|oushadham|marunnu|marunn)\b',
    r'\b(pokam|pokaan|porum|kashttam|kashtam|santosham)\b',
    
    # Common words - MASSIVELY EXPANDED
    r'\b(shari|sheriyanu|sheri|athu|ithu|ethu|athe|ithe)\b',
    r'\b(appozhaan|ippo|ippol|pinne|pinna|appol|appoozha)\b',
    r'\b(koodey?|koode|kure|oru|onnu|randu|moonnu|naalu)\b',
    r'\b(aanen|alley?|aanennu|allaathe|enkilum|enkil)\b',
    r'\b(endhu?|enthinu|ethrem|ethrayum|ellam|ellaam)\b',
    r'\b(parayunnu|parayan|paranhu|chodhichu|chodhikkam)\b',
    r'\b(pattu|upayogikkan|vendenn|ellaarum|angane|ingane)\b',
    
    # Time expressions
    r'\b(innu|inne|naale|kaaleyi|raathri|rathri|reethri)\b',
    r'\b(prabhaathe|ucha|vaikittu|vaikunneram)\b',
    
    # Common particles
    r'\b(aano|aane|alle|ille|allo|illo|um|undallo)\b',
]

# Tamil romanization (Tanglish) - MASSIVELY EXPANDED
TAMIL_PATTERNS = [
    # Common pronouns and question words
    r'\b(enakku?|enaku|naan|naanu|ennaku|enoda|enakaga)\b',
    r'\b(yenna|enna|epdi|eppadi|yeppadi|enga|enge|engey?)\b',
    r'\b(ungal|ungala|unkal|engada|naanga|namma|nammala)\b',
    r'\b(yaar|yaaru|yaarukku?|yaarelam|ellam|ellarum)\b',
    
    # Common verbs - MASSIVELY EXPANDED
    r'\b(irukku?|iruku|irukken|illa|illai|ilai|illaya|illaiye)\b',
    r'\b(venam|vena|vendaam|venda|venaam|varum|varuma)\b',
    r'\b(sollunga|sollu|solla|sollitaanga|sonnanga|sonnen)\b',
    r'\b(pannunga|pannu|pannalam|pannanum|pannitaanga|pannen)\b',
    r'\b(vaa|vaanga|ponga|po|poidalam|poitu|poittu)\b',
    r'\b(aagum|aaga|aagama|aayidum|aachu|aana|aachu)\b',
    r'\b(saapdunga|saapdu|saapten|kudunga|kudu|kuduthen)\b',
    
    # Common adjectives and adverbs
    r'\b(nalla|nalladhu|nallaah?|romba|perusa|chinna|sinna)\b',
    r'\b(pudusa|pazhaya|kevalamaa|mosamaa|azaga|azhaga)\b',
    r'\b(adhu|idhu|adhaan|idhaan|mattum|mattuma)\b',
    
    # Family and social terms
    r'\b(anna|akka|thambi|thangachi|mama|mami|maama)\b',
    r'\b(amma|appa|ammaa|appaa|paatti|thatha|patti)\b',
    
    # Medical/health terms - COMPREHENSIVE
    r'\b(vedanai|thalai|vali|noi|valiy?|kaayichchal|kaayichaal)\b',
    r'\b(suram|juram|kai|kaal|vayiru|vayir|kannupaka|kannu)\b',
    r'\b(veekkam|soodu|kammal|kashtam|nenju|moochu)\b',
    r'\b(doctorta|hospitalku|doctorkitta|vaidyar|marundhu)\b',
    r'\b(marundhu|rogam|noyal|arogiyam|arogiyama)\b',
    
    # Common words - MASSIVELY EXPANDED
    r'\b(theriyuma|theriyum|theriyadhu|therinjukka)\b',
    r'\b(konjam|konnchi|seriya|seri|seriyana|serithaana)\b',
    r'\b(eppothu|eppo|anga|inge|ippo|ipo|appo)\b',
    r'\b(paarunga|paaru|paathale|paakkanam|paatha)\b',
    r'\b(mudiyala|mudiyum|mudiyadha|agadhu|aagadhu)\b',
    r'\b(vaanga|varum|vandhuduven|vandhutan|vanthen)\b',
    
    # Time expressions
    r'\b(innikku?|innaiku|naalaikku?|nethu|yesterday)\b',
    r'\b(kaalai|madhiyam|saayangaalam|raathri)\b',
    
    # Common particles
    r'\b(dhan|dhaan|than|thaan|la|tha|da|nga)\b',
]

# Telugu romanization (Tenglish) - MASSIVELY EXPANDED
TELUGU_PATTERNS = [
    # Common pronouns and question words
    r'\b(naku|naaku|nenu|neenu|nannu|naa|naavalla)\b',
    r'\b(enti|ela|yela|elaa|ekkada|eppudu?|epudu|yeppudu?)\b',
    r'\b(meeku|mee|meeru|manam|manaku|mana|manamu)\b',
    r'\b(evaru|yevaru|evariki|andaru|andariki|emi)\b',
    
    # Common verbs - MASSIVELY EXPANDED
    r'\b(undi|undhi|undha|ledu|ledhu|leda|ledaa|ledhu)\b',
    r'\b(vaddu|vaddhu|vaddha|raadu|radhu|raadha|ravaali)\b',
    r'\b(cheppandi|cheppu|cheppali|cheppana|cheppara|cheppanu)\b',
    r'\b(cheyyandi|chey|cheyyali|cheyyaali|chesanu|chesaanu)\b',
    r'\b(raave|raandi|raavali|raavaalante|vacchi|vachchaanu)\b',
    r'\b(avutundi|avutadhi|aindi|avtundhi|ayyindhi)\b',
    r'\b(thinandi|thinu|thinaali|thinanu|ivvandi|ivvu)\b',
    
    # Common adjectives and adverbs
    r'\b(bagundi|baagundi|baaga|chaalaa|chaala|pedhha|chinna)\b',
    r'\b(kotha|paatha|mosam|manchidi|andhamaina|chakkaga)\b',
    r'\b(adhi|idhi|aa|ee|danini|dhini|idi|adi)\b',
    
    # Family and social terms
    r'\b(anna|akka|tammudu|chelli|babai|atta|maama)\b',
    r'\b(amma|nanna|nana|ammana|nannagaru|ammamma)\b',
    
    # Medical/health terms - COMPREHENSIVE
    r'\b(noppi|thala|kashtam|kastam|vedana|manta|mandu)\b',
    r'\b(jwaram|cheyyi|kaalu|kalu|vayithalli|ottu|gundelu)\b',
    r'\b(veppam|manta|budakaluga|kastam|noppi|nashtam)\b',
    r'\b(doctorki|hospitalki|doctorgaru|vaidyudu|vaidyudi)\b',
    r'\b(mandu|rogam|arogya|arogyam|arogyamu)\b',
    
    # Common words - MASSIVELY EXPANDED
    r'\b(telusaa|telusa|thelsindhi|teliyale|teliyadu)\b',
    r'\b(konchem|kontha|zara|saraina|sare|sariga)\b',
    r'\b(ippudu?|ipudu|akkada|ikkada|appudu?|apudu)\b',
    r'\b(choodandi|chudu|choosanu|chusara|chudu)\b',
    r'\b(kaavaali|kaavaalante|raavaali|undaali|undali)\b',
    r'\b(chepta|cheptha|cheptaanu|kaavalante)\b',
    
    # Time expressions
    r'\b(eppudu?|repu|ninna|nedu|reypu|paata)\b',
    r'\b(udayam|madhyaanam|sayantram|raatri)\b',
    
    # Common particles
    r'\b(gaa|kaa|naa|ee|aa|oo|ani|ani|kada)\b',
]

# Kannada romanization (Kanglish) - MASSIVELY EXPANDED
KANNADA_PATTERNS = [
    # Common pronouns and question words
    r'\b(nanage|nange|naanu|naan|nannu|nanna|naa|naavu)\b',
    r'\b(yenu|yaav|hege|heege|yelli|yaake|yavag|yaavag)\b',
    r'\b(nimma|nimmage|nimge|navu|namage|naavu|namma)\b',
    r'\b(yaaru|yaarunu|yaaranna|ellaru|yellaru|yaava)\b',
    
    # Common verbs - MASSIVELY EXPANDED
    r'\b(ide|idey?|idhe|illa|ilde|ille|ilva|idya|ide)\b',
    r'\b(beda|beku|bekilla|beko|barutta|bandu|bartini)\b',
    r'\b(heli|helakke|helalu|helidare|helidru|helodu)\b',
    r'\b(maadi|maadakke|maadbeku|maadide|maadidare|maadu)\b',
    r'\b(baa|banni|hogu|hogakke|hogona|hogbedi|hogthini)\b',
    r'\b(aagutta|aagthide|aaithu|aagbeku|aagtide)\b',
    r'\b(thinno|thinnu|thinbeku|thinde|kodu|kodthini)\b',
    
    # Common adjectives and adverbs
    r'\b(chennagide|chennagi|chennag|thumba|dodda|chikka)\b',
    r'\b(hosa|haala|ketta|olleyadu|sundara|olleya)\b',
    r'\b(adhu|idhu|aa|ii|ivanu|avanu|avalu)\b',
    
    # Family and social terms
    r'\b(anna|akka|thambi|thangi|ajja|ajji|amma)\b',
    r'\b(amma|appa|ammana|appana|aththayya|maava)\b',
    
    # Medical/health terms - COMPREHENSIVE
    r'\b(novu|tale|kashta|kashtaa|hotta|sorethana|noppu)\b',
    r'\b(jvara|jwara|kai|kaalu|hotte|hotta|vayithalli)\b',
    r'\b(hotta|novu|sorethana|kaashu|thala|tale|moogu)\b',
    r'\b(doctorge|hospitalge|doctarige|vaidyaru|vaidya)\b',
    r'\b(maddu|roga|arogyaa|arogya|aushadha)\b',
    
    # Common words - MASSIVELY EXPANDED
    r'\b(gothu|gottilla|gottila|gottaythu|gottide|gottu)\b',
    r'\b(konje|kontha|sarina|sari|sarige|sariyaagi)\b',
    r'\b(yeshtu|yaava|yeshtu|yavaga|illi|alli|illa)\b',
    r'\b(nodu|nodakke|nodidare|nodona|nodthiya|nodi)\b',
    r'\b(agbeku|agalla|agthu|agtilla|aglilla|aagodu)\b',
    r'\b(helthini|helthiya|helidhe|helbekadre)\b',
    
    # Time expressions
    r'\b(ivatt|naale|ninne|yeshtu|yeashtu|heege)\b',
    r'\b(beligge|madhyaahna|saayamkaala|raathri)\b',
    
    # Common particles
    r'\b(alla|alle|appa|enu|yaake|henge|li|ge)\b',
]

# Hindi romanization (Hinglish) - MASSIVELY EXPANDED
HINDI_PATTERNS = [
    # Common pronouns and question words
    r'\b(mujhe|mujhko|main|mai|mera|mere|mujh|mujse|mujhse)\b',
    r'\b(kya|kyon|kyun|kaise|kab|kaha|kahaan|kidhar|kyaa)\b',
    r'\b(aapka|aapko|aapke|humara|humare|tumhara|tumhe)\b',
    r'\b(kaun|kiski|kiska|kiske|sabh|sabko|sab)\b',
    
    # Common verbs - MASSIVELY EXPANDED
    r'\b(hai|hain|hoon|ho|tha|thi|the|honge|hoga)\b',
    r'\b(nahi|nahin|naa|mat|bilkul|nhi|ni)\b',
    r'\b(chahiye|chaahiye|chahte|chahti|chaah|chahta)\b',
    r'\b(karo|karna|karne|karke|kiya|kiye|karu|karunga)\b',
    r'\b(aana|aane|aaya|aaye|aao|aaiye|aati|aata)\b',
    r'\b(hoga|hogi|hoge|honge|hogaya|hojaega|hojayega)\b',
    r'\b(khana|khao|khaya|khaana|piyo|piya|pina)\b',
    
    # Common adjectives and adverbs
    r'\b(achha|accha|achchhi|bahut|bohot|zyada|kam|jyada)\b',
    r'\b(bada|badi|bade|chota|choti|chote|naya|purana)\b',
    r'\b(yeh|ye|voh|vo|woh|wo|iska|uska|isse)\b',
    
    # Family and social terms
    r'\b(bhai|didi|bhaiya|dada|dadi|nana|nani|maa)\b',
    r'\b(maa|papa|baba|ammi|abbu|pitaji|mataji)\b',
    
    # Medical/health terms - COMPREHENSIVE
    r'\b(dard|takleef|sir|sar|seer|peeth|gala|pet)\b',
    r'\b(bukhar|haath|pair|pet|payt|seene|sine|sar)\b',
    r'\b(sujan|khujli|jalan|ghav|zakham|chot|lagi)\b',
    r'\b(doctorko|hospitalme|doctorsaab|vaidya|dawai)\b',
    r'\b(dawa|dawaai|bimari|rog|swasthya|sehat)\b',
    
    # Common words - MASSIVELY EXPANDED
    r'\b(batao|pata|malum|maloom|jaanta|jaante|janta)\b',
    r'\b(thoda|thodi|zara|bilkul|ekdum|puri|poora)\b',
    r'\b(kitna|kitni|kahan|kahaan|kab|kabhi|jab)\b',
    r'\b(dekho|dekhna|dekhe|dekha|dekhi|dikhta|dikha)\b',
    r'\b(samajh|samjha|samjho|milega|mila|mile|mil)\b',
    r'\b(chalega|chalegi|chalo|chale|chalna|jayega)\b',
    
    # Time expressions
    r'\b(aaj|kal|parso|subah|shaam|raat|dophar)\b',
    r'\b(savere|subah|dopahar|saam|raat|raatri)\b',
    
    # Common particles
    r'\b(haan|han|naa|na|ji|bhi|toh|to|kyunki)\b',
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
    """
    ✅ FIXED: Detect romanized Indian languages with MUCH better accuracy
    
    Returns: Language name if detected, None otherwise
    """
    if not text or len(text.strip()) < 3:
        return None
        
    text_lower = text.lower()
    
    # Count matches for each language
    scores = {
        'Malayalam': sum(1 for pattern in MALAYALAM_PATTERNS if re.search(pattern, text_lower, re.IGNORECASE)),
        'Tamil': sum(1 for pattern in TAMIL_PATTERNS if re.search(pattern, text_lower, re.IGNORECASE)),
        'Telugu': sum(1 for pattern in TELUGU_PATTERNS if re.search(pattern, text_lower, re.IGNORECASE)),
        'Kannada': sum(1 for pattern in KANNADA_PATTERNS if re.search(pattern, text_lower, re.IGNORECASE)),
        'Hindi': sum(1 for pattern in HINDI_PATTERNS if re.search(pattern, text_lower, re.IGNORECASE)),
    }
    
    max_score = max(scores.values())
    
    # ✅ CRITICAL FIX: Lower threshold from 2 to 1
    # Even a SINGLE romanized word means we should treat it as that language
    if max_score >= 1:
        detected_lang = max(scores.items(), key=lambda x: x[1])[0]
        logger.info(f"[detect_romanized_language] ✅ Detected: {detected_lang} (score: {max_score})")
        logger.info(f"[detect_romanized_language] All scores: {scores}")
        logger.info(f"[detect_romanized_language] Text sample: {text[:100]}")
        return detected_lang
    
    logger.info(f"[detect_romanized_language] No romanized language detected (max score: {max_score})")
    return None


def detect_language(text: str) -> str:
    """
    Enhanced language detection with better romanization support
    
    Returns: Language name (e.g., 'English', 'Hindi', 'Malayalam', etc.)
    """
    try:
        text = text.strip()
        
        if not text or len(text) < 3:
            return 'English'
        
        logger.info(f"[detect_language] Analyzing: {text[:100]}")
        
        # ✅ STEP 1: Check romanized languages FIRST (highest priority)
        romanized_lang = detect_romanized_language(text)
        if romanized_lang:
            logger.info(f"[detect_language] ✅ ROMANIZED: {romanized_lang}")
            return romanized_lang
        
        # ✅ STEP 2: Try native script detection
        try:
            from langdetect import detect as langdetect_detect
            lang_code = langdetect_detect(text)
            language = LANGUAGE_CODE_MAP.get(lang_code, 'English')
            
            # If detected as English but has non-ASCII, might be romanized
            if language == 'English':
                ascii_ratio = sum(1 for c in text if c.isascii()) / len(text)
                logger.info(f"[detect_language] ASCII ratio: {ascii_ratio:.2f}")
                
                # If mostly ASCII, it's probably English
                if ascii_ratio > 0.9:
                    logger.info(f"[detect_language] ✅ NATIVE: English (high ASCII)")
                    return 'English'
                else:
                    # Might be mixed - check romanized again with lower threshold
                    logger.info(f"[detect_language] ℹ️ Low ASCII - might be mixed")
                    return 'English'  # Default to English for mixed
            
            logger.info(f"[detect_language] ✅ NATIVE: {language} (code: {lang_code})")
            return language
            
        except Exception as e:
            logger.warning(f"[detect_language] langdetect failed: {e}")
            
            # Fallback: check ASCII ratio
            if text:
                ascii_ratio = sum(1 for c in text if c.isascii()) / len(text)
                if ascii_ratio > 0.8:
                    logger.info(f"[detect_language] ✅ FALLBACK: English (ASCII ratio: {ascii_ratio:.2f})")
                    return 'English'
        
        # ✅ STEP 3: Default to English
        logger.info(f"[detect_language] ✅ DEFAULT: English")
        return 'English'
        
    except Exception as e:
        logger.error(f"[detect_language] Error: {e}")
        return 'English'



def is_mixed_language(text):
    """
    Check if text is mixed language (like Manglish, Tanglish)
    
    Returns:
        True if mixed, False otherwise
    """
    try:
        # Count English characters
        english_chars = sum(1 for c in text if c.isascii() and c.isalpha())
        
        # Count non-English characters
        non_english_chars = sum(1 for c in text if not c.isascii() and c.isalpha())
        
        total_chars = english_chars + non_english_chars
        
        if total_chars == 0:
            return False
        
        # If both English and non-English present, it's mixed
        english_ratio = english_chars / total_chars
        
        # Mixed if 20-80% English (adjust threshold as needed)
        is_mixed = 0.2 < english_ratio < 0.8
        
        if is_mixed:
            logger.info(f"[is_mixed_language] Detected mixed language (English ratio: {english_ratio:.2f})")
        
        return is_mixed
        
    except Exception as e:
        logger.error(f"[is_mixed_language] Error: {e}")
        return False


def get_response_language(user_message: str, user_selected_language: Optional[str] = None) -> str:
    """
    ✅ FIXED: Determine response language with improved detection
    
    Args:
        user_message: User's input text
        user_selected_language: Language selected in dropdown (optional)
    
    Returns: Language to use for response
    """
    # ✅ PRIORITY 1: If user explicitly selected a non-English language, use it
    if user_selected_language and user_selected_language != 'English':
        logger.info(f"[get_response_language] Using user selection: {user_selected_language}")
        return user_selected_language
    
    # ✅ PRIORITY 2: Auto-detect romanized language
    detected_language = detect_romanized_language(user_message)
    
    if detected_language:
        logger.info(f"[get_response_language] ✅ Auto-detected romanized: {detected_language}")
        return detected_language
    
    # ✅ PRIORITY 3: Try native script detection
    try:
        native_lang = detect_language(user_message)
        if native_lang and native_lang != 'English':
            logger.info(f"[get_response_language] Auto-detected native: {native_lang}")
            return native_lang
    except:
        pass
    
    # ✅ DEFAULT: English
    logger.info(f"[get_response_language] ✅ DEFAULT: English")
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

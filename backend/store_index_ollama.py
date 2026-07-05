"""
Advanced Medical AI Chatbot System v2.0
========================================
Features:
- Multi-agent architecture with specialized medical domains
- Conversational memory with context management
- RAG (Retrieval-Augmented Generation) for medical knowledge
- Enhanced NLP with entity recognition
- Advanced prompt engineering with chain-of-thought
- Patient profile management
- Drug interaction checking
- Symptom tracking and risk assessment
- Multi-image comparison for medical imaging
- Audit logging and compliance
"""

import os
import logging
import json
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from collections import defaultdict
import time
import base64
import io
from PIL import Image
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

SUPPORTED_LANGUAGES = {
    'English': 'en',
    'Hindi': 'hi',
    'Kannada': 'kn',
    'Tamil': 'ta',
    'Telugu': 'te',
    'Malayalam': 'ml',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de'
}

LANGUAGE_PROMPTS = {
    'English': 'You must respond ONLY in English language.',
    'Hindi': 'आपको केवल हिंदी भाषा में जवाब देना है।',
    'Kannada': 'ನೀವು ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ ಮಾತ್ರ ಉತ್ತರಿಸಬೇಕು।',
    'Tamil': 'நீங்கள் தமிழ் மொழியில் மட்டுமே பதிலளிக்க வேண்டும்.',
    'Telugu': 'మీరు తెలుగు భాషలో మాత్రమే సమాధానం ఇవ్వాలి.',
    'Malayalam': 'നിങ്ങൾ മലയാളം ഭാഷയിൽ മാത്രം മറുപടി നൽകണം.',
    'Spanish': 'Debes responder SOLO en español.',
    'French': 'Vous devez répondre UNIQUEMENT en français.',
    'German': 'Sie müssen NUR auf Deutsch antworten.'
}

# Medical specialization domains
MEDICAL_SPECIALIZATIONS = {
    'general': 'General Medicine',
    'cardiology': 'Cardiology',
    'neurology': 'Neurology',
    'pediatrics': 'Pediatrics',
    'psychiatry': 'Mental Health',
    'dermatology': 'Dermatology',
    'orthopedics': 'Orthopedics',
    'gynecology': 'Women\'s Health',
    'emergency': 'Emergency Medicine',
    'nutrition': 'Nutrition & Dietetics',
    'radiology': 'Medical Imaging'
}

# Enhanced medical keywords by category
MEDICAL_CATEGORIES = {
    'cardiovascular': ['heart', 'cardiac', 'chest pain', 'palpitation', 'hypertension', 'blood pressure'],
    'respiratory': ['breathing', 'cough', 'asthma', 'lung', 'pneumonia', 'bronchitis'],
    'neurological': ['headache', 'migraine', 'seizure', 'stroke', 'paralysis', 'numbness'],
    'gastrointestinal': ['stomach', 'abdomen', 'nausea', 'vomiting', 'diarrhea', 'constipation'],
    'musculoskeletal': ['joint', 'muscle', 'bone', 'fracture', 'arthritis', 'back pain'],
    'dermatological': ['skin', 'rash', 'itching', 'lesion', 'mole', 'burn'],
    'mental_health': ['anxiety', 'depression', 'stress', 'insomnia', 'panic', 'mood'],
    'endocrine': ['diabetes', 'thyroid', 'hormone', 'glucose', 'insulin'],
    'infectious': ['fever', 'infection', 'virus', 'bacteria', 'flu', 'covid']
}

# Emergency keywords with severity levels
EMERGENCY_KEYWORDS = {
    'critical': [
        'heart attack', 'cardiac arrest', 'stroke', 'can\'t breathe', 'unconscious',
        'suicide', 'overdose', 'severe bleeding', 'choking', 'seizure now',
        'anaphylaxis', 'paralyzed', 'chest crushing'
    ],
    'urgent': [
        'severe pain', 'high fever', 'difficulty breathing', 'chest pain',
        'severe headache', 'vomiting blood', 'sudden vision loss', 'confusion'
    ],
    'serious': [
        'persistent pain', 'fever', 'bleeding', 'swelling', 'infection signs',
        'abnormal symptoms', 'worsening condition'
    ]
}

# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class PatientProfile:
    """Patient profile for personalized care"""
    user_id: str
    age: Optional[int] = None
    gender: Optional[str] = None
    chronic_conditions: List[str] = None
    allergies: List[str] = None
    current_medications: List[str] = None
    risk_factors: List[str] = None
    preferred_language: str = "English"
    created_at: datetime = None
    
    def __post_init__(self):
        if self.chronic_conditions is None:
            self.chronic_conditions = []
        if self.allergies is None:
            self.allergies = []
        if self.current_medications is None:
            self.current_medications = []
        if self.risk_factors is None:
            self.risk_factors = []
        if self.created_at is None:
            self.created_at = datetime.now()
    
    def to_dict(self):
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data):
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)


@dataclass
class ConversationMessage:
    """Single conversation message"""
    role: str  # user, assistant, system
    content: str
    timestamp: datetime
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
    
    def to_dict(self):
        return {
            'role': self.role,
            'content': self.content,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class ConversationContext:
    """Conversation context with memory"""
    user_id: str
    messages: List[ConversationMessage] = None
    current_topic: Optional[str] = None
    detected_symptoms: List[str] = None
    mentioned_conditions: List[str] = None
    urgency_level: str = "general"
    specialization: str = "general"
    
    def __post_init__(self):
        if self.messages is None:
            self.messages = []
        if self.detected_symptoms is None:
            self.detected_symptoms = []
        if self.mentioned_conditions is None:
            self.mentioned_conditions = []
    
    def add_message(self, role: str, content: str, metadata: Dict = None):
        """Add message to context"""
        msg = ConversationMessage(
            role=role,
            content=content,
            timestamp=datetime.now(),
            metadata=metadata or {}
        )
        self.messages.append(msg)
        
        # Keep only last 10 messages for context window
        if len(self.messages) > 10:
            self.messages = self.messages[-10:]
    
    def get_recent_context(self, max_messages: int = 5) -> str:
        """Get formatted recent conversation context"""
        recent = self.messages[-max_messages:]
        context_lines = []
        for msg in recent:
            context_lines.append(f"{msg.role.upper()}: {msg.content[:200]}")
        return "\n".join(context_lines)


@dataclass
class MedicalEntity:
    """Extracted medical entity"""
    text: str
    category: str  # symptom, condition, medication, body_part
    confidence: float
    
    def to_dict(self):
        return asdict(self)


@dataclass
class SymptomRecord:
    """Symptom tracking record"""
    symptom: str
    severity: int  # 1-10
    duration: str
    frequency: str
    timestamp: datetime
    
    def to_dict(self):
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


# ============================================================================
# ADVANCED NLP & ENTITY RECOGNITION
# ============================================================================

class MedicalNLPProcessor:
    """Advanced NLP processing for medical text"""
    
    def __init__(self):
        # Medical terminology patterns
        self.symptom_patterns = [
            r'\b(pain|ache|hurt|sore|discomfort|burning|tingling)\b',
            r'\b(fever|temperature|chills|sweating)\b',
            r'\b(nausea|vomiting|diarrhea|constipation)\b',
            r'\b(cough|cold|sneeze|congestion|runny nose)\b',
            r'\b(dizzy|dizziness|vertigo|lightheaded)\b',
            r'\b(tired|fatigue|weakness|exhaustion)\b',
            r'\b(rash|itching|swelling|inflammation)\b',
            r'\b(bleeding|bruising|blood)\b',
            r'\b(anxiety|stress|depression|worried)\b'
        ]
        
        self.body_parts = [
            'head', 'eye', 'ear', 'nose', 'throat', 'mouth', 'teeth',
            'neck', 'shoulder', 'chest', 'back', 'abdomen', 'stomach',
            'arm', 'hand', 'finger', 'leg', 'foot', 'knee', 'ankle',
            'heart', 'lung', 'liver', 'kidney', 'brain'
        ]
        
        self.common_conditions = [
            'diabetes', 'hypertension', 'asthma', 'arthritis', 'migraine',
            'depression', 'anxiety', 'allergies', 'infection', 'flu',
            'covid', 'pneumonia', 'bronchitis', 'gastritis'
        ]
    
    def extract_entities(self, text: str) -> List[MedicalEntity]:
        """Extract medical entities from text"""
        entities = []
        text_lower = text.lower()
        
        # Extract symptoms
        for pattern in self.symptom_patterns:
            matches = re.finditer(pattern, text_lower, re.IGNORECASE)
            for match in matches:
                entities.append(MedicalEntity(
                    text=match.group(),
                    category='symptom',
                    confidence=0.8
                ))
        
        # Extract body parts
        for body_part in self.body_parts:
            if body_part in text_lower:
                entities.append(MedicalEntity(
                    text=body_part,
                    category='body_part',
                    confidence=0.9
                ))
        
        # Extract conditions
        for condition in self.common_conditions:
            if condition in text_lower:
                entities.append(MedicalEntity(
                    text=condition,
                    category='condition',
                    confidence=0.85
                ))
        
        return entities
    
    def detect_medical_category(self, text: str) -> str:
        """Detect primary medical category"""
        text_lower = text.lower()
        category_scores = defaultdict(int)
        
        for category, keywords in MEDICAL_CATEGORIES.items():
            for keyword in keywords:
                if keyword in text_lower:
                    category_scores[category] += 1
        
        if category_scores:
            return max(category_scores.items(), key=lambda x: x[1])[0]
        return 'general'
    
    def classify_urgency(self, text: str) -> Tuple[str, List[str]]:
        """Classify urgency level and return matched keywords"""
        text_lower = text.lower()
        matched_keywords = []
        
        # Check critical
        for keyword in EMERGENCY_KEYWORDS['critical']:
            if keyword in text_lower:
                matched_keywords.append(keyword)
                return 'critical', matched_keywords
        
        # Check urgent
        for keyword in EMERGENCY_KEYWORDS['urgent']:
            if keyword in text_lower:
                matched_keywords.append(keyword)
        
        if matched_keywords:
            return 'urgent', matched_keywords
        
        # Check serious
        for keyword in EMERGENCY_KEYWORDS['serious']:
            if keyword in text_lower:
                matched_keywords.append(keyword)
        
        if matched_keywords:
            return 'serious', matched_keywords
        
        return 'general', []
    
    def spell_correct_medical_terms(self, text: str) -> str:
        """Basic spell correction for common medical terms"""
        corrections = {
            'diabetis': 'diabetes',
            'asthama': 'asthma',
            'arthiritis': 'arthritis',
            'migrane': 'migraine',
            'pnemonia': 'pneumonia',
            'diarhea': 'diarrhea',
            'nausea': 'nausea',
            'stomache': 'stomach',
            'symtom': 'symptom',
            'symtoms': 'symptoms'
        }
        
        corrected = text
        for wrong, correct in corrections.items():
            corrected = re.sub(r'\b' + wrong + r'\b', correct, corrected, flags=re.IGNORECASE)
        
        return corrected


# ============================================================================
# MEDICAL KNOWLEDGE BASE (Simplified RAG)
# ============================================================================

class MedicalKnowledgeBase:
    """Simplified medical knowledge base for RAG"""
    
    def __init__(self):
        self.knowledge = {
            'diabetes': {
                'description': 'A chronic condition affecting blood sugar regulation',
                'symptoms': ['increased thirst', 'frequent urination', 'fatigue', 'blurred vision'],
                'risk_factors': ['obesity', 'sedentary lifestyle', 'family history', 'age over 45'],
                'management': ['blood sugar monitoring', 'medication', 'diet control', 'exercise']
            },
            'hypertension': {
                'description': 'High blood pressure condition',
                'symptoms': ['headache', 'shortness of breath', 'nosebleeds', 'chest pain'],
                'risk_factors': ['obesity', 'high salt intake', 'stress', 'lack of exercise'],
                'management': ['medication', 'low sodium diet', 'regular exercise', 'stress management']
            },
            'asthma': {
                'description': 'Chronic respiratory condition causing breathing difficulties',
                'symptoms': ['wheezing', 'shortness of breath', 'chest tightness', 'coughing'],
                'risk_factors': ['allergies', 'family history', 'smoking', 'air pollution'],
                'management': ['inhalers', 'avoid triggers', 'medication', 'breathing exercises']
            },
            'migraine': {
                'description': 'Severe recurring headache disorder',
                'symptoms': ['intense headache', 'nausea', 'light sensitivity', 'visual disturbances'],
                'risk_factors': ['stress', 'lack of sleep', 'certain foods', 'hormonal changes'],
                'management': ['pain medication', 'rest in dark room', 'avoid triggers', 'preventive medication']
            }
        }
        
        self.drug_interactions = {
            'aspirin': {
                'interactions': ['warfarin', 'ibuprofen', 'alcohol'],
                'warnings': 'Increases bleeding risk when combined with blood thinners'
            },
            'ibuprofen': {
                'interactions': ['aspirin', 'warfarin', 'lisinopril'],
                'warnings': 'May reduce effectiveness of blood pressure medications'
            }
        }
    
    def search_condition(self, condition: str) -> Optional[Dict]:
        """Search for condition information"""
        condition_lower = condition.lower()
        for key, info in self.knowledge.items():
            if key in condition_lower or condition_lower in key:
                return info
        return None
    
    def check_drug_interactions(self, medications: List[str]) -> Dict[str, List[str]]:
        """Check for drug interactions"""
        interactions = {}
        
        for med in medications:
            med_lower = med.lower()
            if med_lower in self.drug_interactions:
                interactions[med] = self.drug_interactions[med_lower]['interactions']
        
        return interactions
    
    def get_relevant_context(self, entities: List[MedicalEntity]) -> str:
        """Get relevant medical context based on extracted entities"""
        context_parts = []
        
        for entity in entities:
            if entity.category == 'condition':
                info = self.search_condition(entity.text)
                if info:
                    context_parts.append(f"About {entity.text}: {info['description']}")
        
        return "\n".join(context_parts) if context_parts else ""


# ============================================================================
# SPECIALIZED MEDICAL AGENTS
# ============================================================================

class MedicalAgentRouter:
    """Routes queries to specialized medical agents"""
    
    def __init__(self):
        self.agents = {
            'emergency': EmergencyTriageAgent(),
            'general': GeneralMedicineAgent(),
            'mental_health': MentalHealthAgent(),
            'nutrition': NutritionAgent(),
            'pediatrics': PediatricsAgent()
        }
    
    def route_query(self, query: str, context: ConversationContext, 
                   profile: PatientProfile) -> str:
        """Route query to appropriate specialized agent"""
        
        # Emergency takes priority
        if context.urgency_level in ['critical', 'urgent']:
            return 'emergency'
        
        # Mental health keywords
        mental_keywords = ['anxiety', 'depression', 'stress', 'panic', 'worried', 'sad']
        if any(kw in query.lower() for kw in mental_keywords):
            return 'mental_health'
        
        # Nutrition keywords
        nutrition_keywords = ['diet', 'nutrition', 'food', 'weight', 'eating', 'vitamin']
        if any(kw in query.lower() for kw in nutrition_keywords):
            return 'nutrition'
        
        # Pediatrics (if age < 18)
        if profile.age and profile.age < 18:
            return 'pediatrics'
        
        return 'general'
    
    def get_agent_prompt_enhancement(self, agent_type: str) -> str:
        """Get specialized prompt enhancement for agent"""
        return self.agents[agent_type].get_system_prompt_enhancement()


class BaseAgent:
    """Base class for specialized agents"""
    
    def get_system_prompt_enhancement(self) -> str:
        return ""


class EmergencyTriageAgent(BaseAgent):
    """Emergency triage specialized agent"""
    
    def get_system_prompt_enhancement(self) -> str:
        return """
EMERGENCY TRIAGE PROTOCOL:
• Immediately assess life-threatening conditions
• Prioritize ABC: Airway, Breathing, Circulation
• Provide clear, immediate action steps
• Direct to emergency services (108/102) when critical
• Be calm but urgent in communication
• Ask critical questions about symptoms duration and severity
"""


class GeneralMedicineAgent(BaseAgent):
    """General medicine agent"""
    
    def get_system_prompt_enhancement(self) -> str:
        return """
GENERAL MEDICINE APPROACH:
• Take comprehensive symptom history
• Consider differential diagnoses
• Discuss common causes and treatments
• Recommend when to see a doctor
• Provide evidence-based information
• Consider patient's medical history
"""


class MentalHealthAgent(BaseAgent):
    """Mental health specialized agent"""
    
    def get_system_prompt_enhancement(self) -> str:
        return """
MENTAL HEALTH COUNSELING APPROACH:
• Show empathy and non-judgmental support
• Validate feelings and emotions
• Assess risk factors for self-harm
• Provide coping strategies and resources
• Recommend professional mental health support
• Use trauma-informed language
• Encourage professional therapy when needed
"""


class NutritionAgent(BaseAgent):
    """Nutrition and dietetics agent"""
    
    def get_system_prompt_enhancement(self) -> str:
        return """
NUTRITION ADVISORY APPROACH:
• Assess current dietary habits
• Provide evidence-based nutrition advice
• Consider medical conditions and restrictions
• Suggest balanced meal plans
• Discuss micronutrients and supplements
• Promote sustainable healthy eating habits
• Consider cultural food preferences
"""


class PediatricsAgent(BaseAgent):
    """Pediatrics specialized agent"""
    
    def get_system_prompt_enhancement(self) -> str:
        return """
PEDIATRIC CARE APPROACH:
• Use age-appropriate assessment
• Consider developmental milestones
• Address parent/caregiver concerns
• Provide child-friendly explanations
• Consider childhood-specific conditions
• Recommend pediatrician consultation for serious issues
• Focus on preventive care and vaccination
"""


# ============================================================================
# ENHANCED AI PROVIDERS
# ============================================================================

class AIProvider:
    """Base AI provider class"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.available = False
    
    def test_connection(self) -> bool:
        return False
    
    def generate_response(self, messages: List[Dict], **kwargs):
        raise NotImplementedError


class GroqProvider(AIProvider):
    """Groq AI provider"""
    
    def __init__(self):
        super().__init__(os.getenv("GROQ_API_KEY"))
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    def test_connection(self) -> bool:
        if not self.api_key:
            logger.warning("⚠️ Groq: No API key found")
            return False
        try:
            from groq import Groq
            self.client = Groq(api_key=self.api_key)
            self.available = True
            logger.info(f"✅ Groq initialized (model: {self.model})")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Groq initialization failed: {e}")
            return False
    
    def generate_response(self, messages: List[Dict], **kwargs):
        """Generate streaming response"""
        stream = kwargs.get('stream', True)
        
        if stream:
            response_stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.3),
                max_tokens=kwargs.get('max_tokens', 1000),
                top_p=kwargs.get('top_p', 0.9),
                stream=True
            )
            
            for chunk in response_stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get('temperature', 0.3),
                max_tokens=kwargs.get('max_tokens', 1000),
                top_p=kwargs.get('top_p', 0.9)
            )
            yield response.choices[0].message.content.strip()


class OllamaProvider(AIProvider):
    """Ollama local AI provider"""
    
    def __init__(self):
        super().__init__()
        self.model = os.getenv("OLLAMA_MODEL", "llama3:8b")
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    
    def test_connection(self) -> bool:
        try:
            import ollama
            if self.base_url != "http://localhost:11434":
                os.environ['OLLAMA_HOST'] = self.base_url
            ollama.list()
            self.available = True
            logger.info(f"✅ Ollama connected (model: {self.model})")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Ollama not available: {e}")
            return False
    
    def generate_response(self, messages: List[Dict], **kwargs):
        """Generate streaming response"""
        import ollama
        
        stream = kwargs.get('stream', True)
        
        if stream:
            response_stream = ollama.chat(
                model=self.model,
                messages=messages,
                stream=True,
                options={
                    'temperature': kwargs.get('temperature', 0.3),
                    'top_p': kwargs.get('top_p', 0.9),
                    'num_predict': kwargs.get('max_tokens', 800),
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
                stream=False
            )
            yield response.get('message', {}).get('content', '').strip()


# ============================================================================
# VISION AI PROVIDERS
# ============================================================================

class VisionProvider:
    """Base vision AI provider"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.available = False
    
    def test_connection(self) -> bool:
        return False
    
    def analyze_image(self, image_data: bytes, prompt: str, **kwargs):
        raise NotImplementedError


class GroqVisionProvider(VisionProvider):
    """Groq Vision provider"""
    
    def __init__(self):
        super().__init__(os.getenv("GROQ_API_KEY"))
        self.model = "llama-3.2-90b-vision-preview"
    
    def test_connection(self) -> bool:
        if not self.api_key:
            return False
        try:
            from groq import Groq
            self.client = Groq(api_key=self.api_key)
            self.available = True
            logger.info(f"✅ Groq Vision initialized")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Groq Vision failed: {e}")
            return False
    
    def analyze_image(self, image_data: bytes, prompt: str, **kwargs):
        """Analyze image with Groq Vision"""
        try:
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            messages = [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                ]
            }]
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
                max_tokens=1500,
                stream=True
            )
            
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error(f"Groq Vision error: {e}")
            raise


# ============================================================================
# ADVANCED MEDICAL CHATBOT
# ============================================================================

class AdvancedMedicalChatbot:
    """Advanced medical chatbot with multi-agent architecture"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AdvancedMedicalChatbot, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.initialize()
            self._initialized = True
    
    def initialize(self):
        """Initialize all components"""
        logger.info("🚀 Initializing Advanced Medical Chatbot v2.0...")
        
        # Initialize NLP processor
        self.nlp = MedicalNLPProcessor()
        
        # Initialize knowledge base
        self.knowledge_base = MedicalKnowledgeBase()
        
        # Initialize agent router
        self.agent_router = MedicalAgentRouter()
        
        # Initialize AI providers
        self.providers = {
            'groq': GroqProvider(),
            'ollama': OllamaProvider(),
        }
        
        # Initialize vision providers
        self.vision_providers = {
            'groq_vision': GroqVisionProvider(),
        }
        
        # Test providers
        self.available_providers = []
        for name, provider in self.providers.items():
            if provider.test_connection():
                self.available_providers.append(name)
        
        self.available_vision_providers = []
        for name, provider in self.vision_providers.items():
            if provider.test_connection():
                self.available_vision_providers.append(name)
        
        # Set priorities
        self.provider_priority = [p for p in ['groq', 'ollama'] if p in self.available_providers]
        self.vision_priority = [p for p in ['groq_vision'] if p in self.available_vision_providers]
        
        # Storage
        self.conversations = {}  # user_id -> ConversationContext
        self.profiles = {}  # user_id -> PatientProfile
        self.symptom_tracker = {}  # user_id -> List[SymptomRecord]
        
        # Audit log
        self.audit_log = []
        
        if not self.provider_priority:
            raise RuntimeError("No AI providers available")
        
        logger.info(f"✅ Initialized with providers: {', '.join(self.available_providers)}")
        logger.info(f"✅ Vision providers: {', '.join(self.available_vision_providers)}")
    
    def get_or_create_profile(self, user_id: str) -> PatientProfile:
        """Get or create patient profile"""
        if user_id not in self.profiles:
            self.profiles[user_id] = PatientProfile(user_id=user_id)
        return self.profiles[user_id]
    
    def get_or_create_context(self, user_id: str) -> ConversationContext:
        """Get or create conversation context"""
        if user_id not in self.conversations:
            self.conversations[user_id] = ConversationContext(user_id=user_id)
        return self.conversations[user_id]
    
    def log_interaction(self, user_id: str, query: str, response: str, metadata: Dict):
        """Log interaction for audit and compliance"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'user_id': hashlib.sha256(user_id.encode()).hexdigest()[:16],  # Anonymized
            'query_length': len(query),
            'response_length': len(response),
            'metadata': metadata
        }
        self.audit_log.append(log_entry)
        
        # Keep only last 1000 logs in memory
        if len(self.audit_log) > 1000:
            self.audit_log = self.audit_log[-1000:]
    
    def build_enhanced_prompt(self, query: str, context: ConversationContext, 
                            profile: PatientProfile, knowledge_context: str,
                            agent_type: str) -> str:
        """Build enhanced system prompt with all context"""
        
        language_instruction = LANGUAGE_PROMPTS.get(profile.preferred_language, LANGUAGE_PROMPTS['English'])
        
        # Get agent-specific enhancement
        agent_enhancement = self.agent_router.get_agent_prompt_enhancement(agent_type)
        
        # Build profile context
        profile_context = ""
        if profile.age:
            profile_context += f"\nPatient Age: {profile.age}"
        if profile.chronic_conditions:
            profile_context += f"\nChronic Conditions: {', '.join(profile.chronic_conditions)}"
        if profile.allergies:
            profile_context += f"\nAllergies: {', '.join(profile.allergies)}"
        if profile.current_medications:
            profile_context += f"\nCurrent Medications: {', '.join(profile.current_medications)}"
        
        # Build conversation context
        conv_context = context.get_recent_context(max_messages=5)
        
        system_prompt = f"""You are an advanced AI medical assistant with expertise across multiple medical specializations.

LANGUAGE REQUIREMENT:
{language_instruction}

PATIENT CONTEXT:{profile_context}

CONVERSATION HISTORY:
{conv_context if conv_context else "First interaction"}

DETECTED MEDICAL CATEGORY: {context.specialization.upper()}
URGENCY LEVEL: {context.urgency_level.upper()}

{agent_enhancement}

MEDICAL KNOWLEDGE CONTEXT:
{knowledge_context if knowledge_context else "No specific condition information available"}

RESPONSE GUIDELINES:
1. Use chain-of-thought reasoning: Think step-by-step before answering
2. Consider the patient's complete medical profile
3. Reference conversation history for continuity
4. Provide evidence-based, accurate information
5. Use clear, compassionate language
6. Structure responses with:
   - Direct answer to the question
   - Supporting explanation
   - Actionable recommendations
   - When to seek professional help

CRITICAL SAFETY RULES:
• NEVER provide definitive diagnoses - only discuss possibilities
• NEVER prescribe specific medications or dosages
• ALWAYS recommend professional medical consultation for:
  - Serious or persistent symptoms
  - Medication decisions
  - Diagnosis confirmation
  - Treatment plans
• Prioritize patient safety above all else
• Use cautious language: "may indicate", "could suggest", "consider consulting"

CHAIN-OF-THOUGHT APPROACH:
1. Understand: What is the patient really asking?
2. Analyze: What medical knowledge applies here?
3. Context: How does their history affect this?
4. Safety: What are the risks if untreated?
5. Respond: Clear, actionable, compassionate answer

Remember: You are a supportive medical information resource, not a replacement for professional healthcare."""

        return system_prompt
    
    def process_query(self, user_id: str, query: str, language: str = "English", 
                     elaborate: bool = False):
        """Process medical query with full context and multi-agent routing"""
        
        try:
            start_time = time.time()
            
            # Get/create profile and context
            profile = self.get_or_create_profile(user_id)
            profile.preferred_language = language
            context = self.get_or_create_context(user_id)
            
            # Spell correction
            corrected_query = self.nlp.spell_correct_medical_terms(query)
            
            # Extract entities
            entities = self.nlp.extract_entities(corrected_query)
            
            # Update context with entities
            for entity in entities:
                if entity.category == 'symptom':
                    if entity.text not in context.detected_symptoms:
                        context.detected_symptoms.append(entity.text)
                elif entity.category == 'condition':
                    if entity.text not in context.mentioned_conditions:
                        context.mentioned_conditions.append(entity.text)
            
            # Classify urgency
            urgency_level, urgency_keywords = self.nlp.classify_urgency(corrected_query)
            context.urgency_level = urgency_level
            
            # Detect medical category
            category = self.nlp.detect_medical_category(corrected_query)
            context.specialization = category
            
            # Route to appropriate agent
            agent_type = self.agent_router.route_query(corrected_query, context, profile)
            
            # Get knowledge base context
            knowledge_context = self.knowledge_base.get_relevant_context(entities)
            
            # Check drug interactions if medications mentioned
            if profile.current_medications:
                interactions = self.knowledge_base.check_drug_interactions(profile.current_medications)
                if interactions:
                    knowledge_context += f"\n\nDRUG INTERACTION WARNING: {interactions}"
            
            # Handle critical emergencies immediately
            if urgency_level == 'critical':
                emergency_response = self._get_emergency_response(language)
                context.add_message('user', query)
                context.add_message('assistant', emergency_response)
                
                self.log_interaction(user_id, query, emergency_response, {
                    'urgency': urgency_level,
                    'keywords': urgency_keywords,
                    'agent': agent_type
                })
                
                for word in emergency_response.split():
                    yield word + ' '
                return
            
            # Build enhanced prompt
            system_prompt = self.build_enhanced_prompt(
                corrected_query, context, profile, knowledge_context, agent_type
            )
            
            # Add query to context
            context.add_message('user', corrected_query)
            
            # Prepare messages for AI
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": corrected_query}
            ]
            
            # Generate response
            full_response = ""
            for provider_name in self.provider_priority:
                provider = self.providers[provider_name]
                if not provider.available:
                    continue
                
                try:
                    logger.info(f"⚡ Using {provider_name} ({agent_type} agent)")
                    
                    max_tokens = 1200 if elaborate else 800
                    temperature = 0.3 if urgency_level in ['critical', 'urgent'] else 0.4
                    
                    for chunk in provider.generate_response(
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        stream=True
                    ):
                        full_response += chunk
                        yield chunk
                    
                    # Add response to context
                    context.add_message('assistant', full_response)
                    
                    # Log interaction
                    elapsed = time.time() - start_time
                    self.log_interaction(user_id, query, full_response, {
                        'provider': provider_name,
                        'agent': agent_type,
                        'urgency': urgency_level,
                        'category': category,
                        'entities_count': len(entities),
                        'response_time': elapsed
                    })
                    
                    logger.info(f"✅ Response completed in {elapsed:.2f}s")
                    return
                    
                except Exception as e:
                    logger.error(f"❌ {provider_name} failed: {e}")
                    continue
            
            # If all providers failed
            error_msg = "I'm experiencing technical difficulties. Please try again or consult a healthcare professional."
            for word in error_msg.split():
                yield word + ' '
        
        except Exception as e:
            logger.error(f"❌ Critical error: {e}")
            error_msg = "An unexpected error occurred. Please seek professional medical advice."
            for word in error_msg.split():
                yield word + ' '
    
    def analyze_medical_image(self, user_id: str, image_buffer, query: str,
                             language: str = "English", elaborate: bool = False):
        """Analyze medical image with enhanced context"""
        
        try:
            profile = self.get_or_create_profile(user_id)
            context = self.get_or_create_context(user_id)
            
            if not self.available_vision_providers:
                error_msg = "Medical image analysis requires vision AI configuration."
                for word in error_msg.split():
                    yield word + ' '
                return
            
            # Read image data
            image_buffer.seek(0)
            image_data = image_buffer.read()
            
            # Build vision prompt
            vision_prompt = self._build_vision_prompt(query, language, elaborate, profile)
            
            # Analyze with vision AI
            for provider_name in self.vision_priority:
                provider = self.vision_providers[provider_name]
                if not provider.available:
                    continue
                
                try:
                    logger.info(f"⚡ Analyzing image with {provider_name}")
                    
                    full_response = ""
                    for chunk in provider.analyze_image(
                        image_data=image_data,
                        prompt=vision_prompt,
                        temperature=0.2,
                        max_tokens=1500 if elaborate else 800,
                        stream=True
                    ):
                        full_response += chunk
                        yield chunk
                    
                    # Log interaction
                    context.add_message('user', f"[IMAGE ANALYSIS] {query}")
                    context.add_message('assistant', full_response)
                    
                    self.log_interaction(user_id, f"IMAGE: {query}", full_response, {
                        'type': 'image_analysis',
                        'provider': provider_name,
                        'elaborate': elaborate
                    })
                    
                    return
                
                except Exception as e:
                    logger.error(f"❌ {provider_name} vision failed: {e}")
                    continue
            
            error_msg = "Unable to analyze image. Please consult a healthcare professional."
            for word in error_msg.split():
                yield word + ' '
        
        except Exception as e:
            logger.error(f"❌ Image analysis error: {e}")
            error_msg = "Error analyzing image. Please seek professional evaluation."
            for word in error_msg.split():
                yield word + ' '
    
    def _build_vision_prompt(self, query: str, language: str, elaborate: bool, 
                            profile: PatientProfile) -> str:
        """Build enhanced vision analysis prompt"""
        
        language_instruction = LANGUAGE_PROMPTS.get(language, LANGUAGE_PROMPTS['English'])
        
        disclaimer = """⚠️ IMPORTANT MEDICAL DISCLAIMER ⚠️

This AI analysis is for EDUCATIONAL PURPOSES ONLY and is NOT a medical diagnosis.

CRITICAL LIMITATIONS:
• Only qualified radiologists/doctors can provide accurate diagnosis
• Image quality and technical factors affect interpretation
• AI cannot replace professional medical examination
• Clinical correlation with symptoms is essential

YOU MUST:
✓ Consult a healthcare provider immediately
✓ Share this image with your doctor for professional evaluation
✓ Get appropriate diagnostic tests as recommended
✓ Seek emergency care if you have severe symptoms"""

        prompt = f"""You are an expert medical imaging analysis AI with specialized radiology knowledge.

LANGUAGE REQUIREMENT:
{language_instruction}

USER QUERY: {query if query else "Analyze this medical image"}

PATIENT CONTEXT:
{"Age: " + str(profile.age) if profile.age else "Age: Not specified"}
{"Conditions: " + ", ".join(profile.chronic_conditions) if profile.chronic_conditions else ""}

ANALYSIS PROTOCOL:

{disclaimer}

**STEP 1: IMAGE IDENTIFICATION**
- Identify imaging type (X-ray, CT, MRI, ultrasound, photo, etc.)
- Specify anatomical region
- Note image quality and orientation

**STEP 2: KEY FINDINGS**
- List significant observations
- Prioritize abnormal findings
- Note critical/urgent findings first

**STEP 3: URGENCY ASSESSMENT**
Classify urgency:
- 🚨 CRITICAL: Requires immediate emergency care
- ⚠️ URGENT: Needs prompt medical attention (24-48h)
- ℹ️ ROUTINE: Can be evaluated at regular appointment

**STEP 4: RECOMMENDATIONS**
- Specify which specialist to consult
- Suggest additional tests if needed
- Provide timeline for follow-up
- Include emergency instructions if critical

CRITICAL RULES:
• Start with disclaimer ALWAYS
• Use cautious language: "appears to", "suggests", "possibly"
• NEVER provide definitive diagnoses
• Clearly mark urgency level
• Prioritize patient safety
• Be empathetic and clear

Response length: {'800 words' if elaborate else '400 words'}

Remember: Patient safety is paramount. When in doubt, recommend immediate professional consultation."""

        return prompt
    
    def _get_emergency_response(self, language: str) -> str:
        """Get emergency response"""
        responses = {
            'English': """🚨 CRITICAL EMERGENCY DETECTED! 🚨

⚠️ CALL EMERGENCY SERVICES IMMEDIATELY: 108 / 102

This is a life-threatening emergency requiring immediate medical attention.

TAKE ACTION NOW:
• Call ambulance RIGHT NOW (108/102)
• Go to nearest hospital emergency room
• Do NOT wait or try home remedies
• Inform emergency responders about all symptoms
• If someone is with you, have them call while you provide first aid
• Do not drive yourself

This is not a situation for online advice. Seek emergency medical help immediately.""",
            
            'Hindi': """🚨 गंभीर आपात स्थिति! 🚨

⚠️ तुरंत 108/102 पर कॉल करें

यह जानलेवा स्थिति है।

अभी कार्रवाई करें:
• अभी एम्बुलेंस बुलाएं (108/102)
• नजदीकी अस्पताल जाएं
• घरेलू इलाज न करें
• आपातकालीन कर्मचारियों को लक्षण बताएं

कृपया तुरंत चिकित्सा सहायता लें।"""
        }
        return responses.get(language, responses['English'])
    
    def update_patient_profile(self, user_id: str, **kwargs):
        """Update patient profile"""
        profile = self.get_or_create_profile(user_id)
        
        for key, value in kwargs.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        
        logger.info(f"Updated profile for user {user_id}")
    
    def track_symptom(self, user_id: str, symptom: str, severity: int, 
                     duration: str, frequency: str):

        if user_id not in self.symptom_tracker:
            self.symptom_tracker[user_id] = []
        
        record = SymptomRecord(
            symptom=symptom,
            severity=severity,
            duration=duration,
            frequency=frequency,
            timestamp=datetime.now()
        )
        
        self.symptom_tracker[user_id].append(record)
        logger.info(f"Tracked symptom for user {user_id}: {symptom}")
    
    def get_conversation_summary(self, user_id: str) -> Dict:
        """Get conversation summary for user"""
        context = self.get_or_create_context(user_id)
        profile = self.get_or_create_profile(user_id)
        
        return {
            'total_messages': len(context.messages),
            'detected_symptoms': context.detected_symptoms,
            'mentioned_conditions': context.mentioned_conditions,
            'urgency_level': context.urgency_level,
            'specialization': context.specialization,
            'profile': profile.to_dict()
        }


_chatbot_instance = None

def get_chatbot() -> AdvancedMedicalChatbot:
    """Get singleton chatbot instance"""
    global _chatbot_instance
    if _chatbot_instance is None:
        _chatbot_instance = AdvancedMedicalChatbot()
    return _chatbot_instance


if __name__ == "__main__":
    bot = get_chatbot()
    
    print("\n" + "="*80)
    print("Example 1: Simple Medical Query")
    print("="*80)
    user_id = "test_user_001"
    query = "I have a headache and fever for 2 days"
    
    print(f"Query: {query}\n")
    print("Response:")
    for chunk in bot.process_query(user_id, query, language="English", elaborate=False):
        print(chunk, end='', flush=True)
    print("\n")
    
    print("\n" + "="*80)
    print("Example 2: Follow-up Query (with context)")
    print("="*80)
    query2 = "Should I take ibuprofen?"
    print(f"Query: {query2}\n")
    print("Response:")
    for chunk in bot.process_query(user_id, query2, language="English"):
        print(chunk, end='', flush=True)
    print("\n")
    
    print("\n" + "="*80)
    print("Example 3: Updating Patient Profile")
    print("="*80)
    bot.update_patient_profile(
        user_id,
        age=35,
        chronic_conditions=["hypertension"],
        allergies=["penicillin"],
        current_medications=["lisinopril"]
    )
    print("Profile updated!")
    
    print("\n" + "="*80)
    print("Example 4: Conversation Summary")
    print("="*80)
    summary = bot.get_conversation_summary(user_id)
    print(json.dumps(summary, indent=2))
    
    print("\n✅ Advanced Medical Chatbot System Ready!")
    print("="*80)
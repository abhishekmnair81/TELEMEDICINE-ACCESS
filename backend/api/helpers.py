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

TRANSLITERATION_MAPS = {'Hindi': {'consonants': {'क': 'ka',
                          'क्ष': 'ksha',
                          'ख': 'kha',
                          'ग': 'ga',
                          'घ': 'gha',
                          'ङ': 'nga',
                          'च': 'cha',
                          'छ': 'chha',
                          'ज': 'ja',
                          'ज्ञ': 'gya',
                          'झ': 'jha',
                          'ञ': 'nya',
                          'ट': 'ta',
                          'ठ': 'tha',
                          'ड': 'da',
                          'ढ': 'dha',
                          'ण': 'na',
                          'त': 'ta',
                          'त्र': 'tra',
                          'थ': 'tha',
                          'द': 'da',
                          'ध': 'dha',
                          'न': 'na',
                          'प': 'pa',
                          'फ': 'pha',
                          'ब': 'ba',
                          'भ': 'bha',
                          'म': 'ma',
                          'य': 'ya',
                          'र': 'ra',
                          'ल': 'la',
                          'ळ': 'la',
                          'व': 'va',
                          'श': 'sha',
                          'ष': 'sha',
                          'स': 'sa',
                          'ह': 'ha'},
           'matras': {'ं': 'm',
                      'ः': 'h',
                      'ा': 'aa',
                      'ि': 'i',
                      'ी': 'ee',
                      'ु': 'u',
                      'ू': 'oo',
                      'ृ': 'ru',
                      'े': 'e',
                      'ै': 'ai',
                      'ो': 'o',
                      'ौ': 'au'},
           'virama': '्',
           'vowels': {'अ': 'a',
                      'आ': 'aa',
                      'इ': 'i',
                      'ई': 'ee',
                      'उ': 'u',
                      'ऊ': 'oo',
                      'ऋ': 'ru',
                      'ए': 'e',
                      'ऐ': 'ai',
                      'ओ': 'o',
                      'औ': 'au'}},
 'Kannada': {'consonants': {'ಕ': 'ka',
                            'ಖ': 'kha',
                            'ಗ': 'ga',
                            'ಘ': 'gha',
                            'ಙ': 'nga',
                            'ಚ': 'cha',
                            'ಛ': 'chha',
                            'ಜ': 'ja',
                            'ಝ': 'jha',
                            'ಞ': 'nya',
                            'ಟ': 'ta',
                            'ಠ': 'tha',
                            'ಡ': 'da',
                            'ಢ': 'dha',
                            'ಣ': 'na',
                            'ತ': 'ta',
                            'ಥ': 'tha',
                            'ದ': 'da',
                            'ಧ': 'dha',
                            'ನ': 'na',
                            'ಪ': 'pa',
                            'ಫ': 'pha',
                            'ಬ': 'ba',
                            'ಭ': 'bha',
                            'ಮ': 'ma',
                            'ಯ': 'ya',
                            'ರ': 'ra',
                            'ಲ': 'la',
                            'ಳ': 'la',
                            'ವ': 'va',
                            'ಶ': 'sha',
                            'ಷ': 'sha',
                            'ಸ': 'sa',
                            'ಹ': 'ha'},
             'matras': {'ಂ': 'm',
                        'ಃ': 'h',
                        'ಾ': 'aa',
                        'ಿ': 'i',
                        'ೀ': 'ee',
                        'ು': 'u',
                        'ೂ': 'oo',
                        'ೃ': 'ru',
                        'ೆ': 'e',
                        'ೇ': 'ee',
                        'ೈ': 'ai',
                        'ೊ': 'o',
                        'ೋ': 'oo',
                        'ೌ': 'au'},
             'virama': '್',
             'vowels': {'ಅ': 'a',
                        'ಆ': 'aa',
                        'ಇ': 'i',
                        'ಈ': 'ee',
                        'ಉ': 'u',
                        'ಊ': 'oo',
                        'ಋ': 'ru',
                        'ಎ': 'e',
                        'ಏ': 'ee',
                        'ಐ': 'ai',
                        'ಒ': 'o',
                        'ಓ': 'oo',
                        'ಔ': 'au'}},
 'Malayalam': {'consonants': {'ക': 'ka',
                              'ഖ': 'kha',
                              'ഗ': 'ga',
                              'ഘ': 'gha',
                              'ങ': 'nga',
                              'ച': 'cha',
                              'ഛ': 'chha',
                              'ജ': 'ja',
                              'ഝ': 'jha',
                              'ഞ': 'nya',
                              'ട': 'ta',
                              'ഠ': 'tha',
                              'ഡ': 'da',
                              'ഢ': 'dha',
                              'ണ': 'na',
                              'ത': 'ta',
                              'ഥ': 'tha',
                              'ദ': 'da',
                              'ധ': 'dha',
                              'ന': 'na',
                              'പ': 'pa',
                              'ഫ': 'pha',
                              'ബ': 'ba',
                              'ഭ': 'bha',
                              'മ': 'ma',
                              'യ': 'ya',
                              'ര': 'ra',
                              'റ': 'ra',
                              'ല': 'la',
                              'ള': 'la',
                              'ഴ': 'zha',
                              'വ': 'va',
                              'ശ': 'sha',
                              'ഷ': 'sha',
                              'സ': 'sa',
                              'ഹ': 'ha',
                              'ൺ': 'n',
                              'ൻ': 'n',
                              'ർ': 'r',
                              'ൽ': 'l',
                              'ൾ': 'l',
                              'ൿ': 'k'},
               'matras': {'ം': 'm',
                          'ഃ': 'h',
                          'ാ': 'aa',
                          'ി': 'i',
                          'ീ': 'ee',
                          'ു': 'u',
                          'ൂ': 'oo',
                          'ൃ': 'ru',
                          'െ': 'e',
                          'േ': 'ee',
                          'ൈ': 'ai',
                          'ൊ': 'o',
                          'ോ': 'oo',
                          'ൌ': 'au'},
               'virama': '്',
               'vowels': {'അ': 'a',
                          'ആ': 'aa',
                          'ഇ': 'i',
                          'ഈ': 'ee',
                          'ഉ': 'u',
                          'ഊ': 'oo',
                          'ഋ': 'ru',
                          'എ': 'e',
                          'ഏ': 'ee',
                          'ഐ': 'ai',
                          'ഒ': 'o',
                          'ഓ': 'oo',
                          'ഔ': 'au'}},
 'Tamil': {'consonants': {'க': 'ka',
                          'ங': 'nga',
                          'ச': 'cha',
                          'ஜ': 'ja',
                          'ஞ': 'nya',
                          'ட': 'ta',
                          'ண': 'na',
                          'த': 'ta',
                          'ந': 'na',
                          'ன': 'na',
                          'ப': 'pa',
                          'ம': 'ma',
                          'ய': 'ya',
                          'ர': 'ra',
                          'ற': 'ra',
                          'ல': 'la',
                          'ள': 'la',
                          'ழ': 'zha',
                          'வ': 'va',
                          'ஷ': 'sha',
                          'ஸ': 'sa',
                          'ஹ': 'ha'},
           'matras': {'ஃ': 'h',
                      'ா': 'aa',
                      'ி': 'i',
                      'ீ': 'ee',
                      'ு': 'u',
                      'ூ': 'oo',
                      'ெ': 'e',
                      'ே': 'ee',
                      'ை': 'ai',
                      'ொ': 'o',
                      'ோ': 'oo',
                      'ௌ': 'au'},
           'virama': '்',
           'vowels': {'அ': 'a',
                      'ஆ': 'aa',
                      'இ': 'i',
                      'ஈ': 'ee',
                      'உ': 'u',
                      'ஊ': 'oo',
                      'எ': 'e',
                      'ஏ': 'ee',
                      'ஐ': 'ai',
                      'ஒ': 'o',
                      'ஓ': 'oo',
                      'ஔ': 'au'}},
 'Telugu': {'consonants': {'క': 'ka',
                           'ఖ': 'kha',
                           'గ': 'ga',
                           'ఘ': 'gha',
                           'ఙ': 'nga',
                           'చ': 'cha',
                           'ఛ': 'chha',
                           'జ': 'ja',
                           'ఝ': 'jha',
                           'ఞ': 'nya',
                           'ట': 'ta',
                           'ఠ': 'tha',
                           'డ': 'da',
                           'ఢ': 'dha',
                           'ణ': 'na',
                           'త': 'ta',
                           'థ': 'tha',
                           'ద': 'da',
                           'ధ': 'dha',
                           'న': 'na',
                           'ప': 'pa',
                           'ఫ': 'pha',
                           'బ': 'ba',
                           'భ': 'bha',
                           'మ': 'ma',
                           'య': 'ya',
                           'ర': 'ra',
                           'ల': 'la',
                           'ళ': 'la',
                           'వ': 'va',
                           'శ': 'sha',
                           'ష': 'sha',
                           'స': 'sa',
                           'హ': 'ha'},
            'matras': {'ం': 'm',
                       'ః': 'h',
                       'ా': 'aa',
                       'ి': 'i',
                       'ీ': 'ee',
                       'ు': 'u',
                       'ూ': 'oo',
                       'ృ': 'ru',
                       'ె': 'e',
                       'ే': 'ee',
                       'ై': 'ai',
                       'ొ': 'o',
                       'ో': 'oo',
                       'ౌ': 'au'},
            'virama': '్',
            'vowels': {'అ': 'a',
                       'ఆ': 'aa',
                       'ఇ': 'i',
                       'ఈ': 'ee',
                       'ఉ': 'u',
                       'ఊ': 'oo',
                       'ఋ': 'ru',
                       'ఎ': 'e',
                       'ఏ': 'ee',
                       'ఐ': 'ai',
                       'ఒ': 'o',
                       'ఓ': 'oo',
                       'ఔ': 'au'}}}

def transliterate_text(text: str, language: str) -> str:
    lang_map = TRANSLITERATION_MAPS.get(language)
    if not lang_map:
        return text
        
    vowels = lang_map['vowels']
    consonants = lang_map['consonants']
    matras = lang_map['matras']
    virama = lang_map['virama']
    
    res = []
    i = 0
    while i < len(text):
        char = text[i]
        if char in vowels:
            res.append(vowels[char])
            i += 1
            continue
        if char in consonants:
            base = consonants[char]
            if i + 1 < len(text) and text[i+1] == virama:
                res.append(base[:-1])
                i += 2
                continue
            elif i + 1 < len(text) and text[i+1] in matras:
                res.append(base[:-1] + matras[text[i+1]])
                i += 2
                continue
            else:
                res.append(base)
                i += 1
                continue
        if char in matras:
            res.append(matras[char])
            i += 1
            continue
        if char != virama:
            res.append(char)
        i += 1
    return ''.join(res)

LANGUAGE_PROMPTS = {
    'English': (
        'You must respond ONLY in English language. Ensure the response is natural, fluent, and contextually accurate.'
    ),
    'Hindi': (
        'You MUST respond ONLY in Hindi language using Devanagari script (हिंदी). '
        'Do not use Roman/English letters for Hindi words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Make your response detailed, comprehensive, and explanatory in Hindi just like the English structure. '
        'Medical terms like fever, tablet, doctor, hospital may stay in English.'
    ),
    'Kannada': (
        'You MUST respond ONLY in Kannada language using Kannada script (ಕನ್ನಡ). '
        'Do not use Roman/English letters for Kannada words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Make your response detailed, comprehensive, and explanatory in Kannada just like the English structure. '
        'Medical terms like fever, tablet, doctor, hospital may stay in English.'
    ),
    'Tamil': (
        'You MUST respond ONLY in Tamil language using Tamil script (தமிழ்). '
        'Do not use Roman/English letters for Tamil words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Make your response detailed, comprehensive, and explanatory in Tamil just like the English structure. '
        'Medical terms like fever, tablet, doctor, hospital may stay in English.'
    ),
    'Telugu': (
        'You MUST respond ONLY in Telugu language using Telugu script (తెలుగు). '
        'Do not use Roman/English letters for Telugu words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Make your response detailed, comprehensive, and explanatory in Telugu just like the English structure. '
        'Medical terms like fever, tablet, doctor, hospital may stay in English.'
    ),
    'Malayalam': (
        'You MUST respond ONLY in Malayalam language using Malayalam script (മലയാളം). '
        'Do not use Roman/English letters for Malayalam words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Make your response detailed, comprehensive, and explanatory in Malayalam just like the English structure. '
        'Medical terms like fever, tablet, doctor, hospital may stay in English.'
    ),
}

# Prompts for when users write in native scripts (Devanagari, Tamil script, etc.)
NATIVE_SCRIPT_LANGUAGE_PROMPTS = {
    'Hindi': (
        'You MUST respond ONLY in Hindi language using Devanagari script (हिंदी). Do not use Roman/English letters for Hindi words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Your Hindi response MUST follow the exact structured formats, bullet lists, home care steps, warning signs, '
        'and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. Make it as explanatory, '
        'comprehensive, and detailed as an English medical response.'
    ),
    'Kannada': (
        'You MUST respond ONLY in Kannada language using Kannada script (ಕನ್ನಡ). Do not use Roman/English letters for Kannada words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Your Kannada response MUST follow the exact structured formats, bullet lists, home care steps, warning signs, '
        'and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. Make it as explanatory, '
        'comprehensive, and detailed as an English medical response.'
    ),
    'Tamil': (
        'You MUST respond ONLY in Tamil language using Tamil script (தமிழ்). Do not use Roman/English letters for Tamil words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Your Tamil response MUST follow the exact structured formats, bullet lists, home care steps, warning signs, '
        'and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. Make it as explanatory, '
        'comprehensive, and detailed as an English medical response.'
    ),
    'Telugu': (
        'You MUST respond ONLY in Telugu language using Telugu script (తెలుగు). Do not use Roman/English letters for Telugu words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Your Telugu response MUST follow the exact structured formats, bullet lists, home care steps, warning signs, '
        'and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. Make it as explanatory, '
        'comprehensive, and detailed as an English medical response.'
    ),
    'Malayalam': (
        'You MUST respond ONLY in Malayalam language using Malayalam script (മലയാളം). Do not use Roman/English letters for Malayalam words. '
        'Ensure the response is natural, fluent, grammatically correct, and contextually accurate. '
        'CRITICAL: Your Malayalam response MUST follow the exact structured formats, bullet lists, home care steps, warning signs, '
        'and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. Make it as explanatory, '
        'comprehensive, and detailed as an English medical response.'
    ),
    'English': 'You must respond ONLY in English language. Ensure the response is natural, fluent, grammatically correct, and contextually accurate like ChatGPT.'
}

ROMANIZED_LANGUAGE_PROMPTS = {
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

    # Heart and Chest pain emergency triggers (multi-language and romanized)
    'heart pain', 'heartpain', 'chest pain', 'chest discomfort', 'chest tightness',
    'dil me dard', 'dil mein dard', 'seene me dard', 'seene mein dard', 'chhati me dard', 'chhati mein dard',
    'nenju vedana', 'nenju vedhana', 'nenjuvethana', 'hridaya vedana', 'nenju vali', 'idaya vali',
    'ede novu', 'edeyalli novu', 'gunde noppi', 'chathi noppi', 'chathi noppi',
    
    # Native scripts for chest pain / heart attack / breathing issues
    # Hindi
    'सीने में दर्द', 'छाती में दर्द', 'दिल में दर्द', 'हार्ट अटैक', 'दिल का दौरा', 'सांस लेने में तकलीफ', 'सांस नहीं आ रही',
    # Malayalam
    'നെഞ്ചുവേദന', 'നെഞ്ചു വേദന', 'ശ്വാസം മുട്ടൽ', 'ശ്വാസമെടുക്കാൻ ബുദ്ധിമുട്ട്', 'ഹാർട്ട് അറ്റാക്ക്',
    # Tamil
    'நெஞ்சு வலி', 'மாரடைப்பு', 'மூச்சு திணறல்', 'மூச்சு விட முடியவில்லை',
    # Telugu
    'గుండె నొప్పి', 'ఛాతీ నొప్పి', 'గుండెపోటు', 'శ్వాస తీసుకోవడం ఇబ్బంది',
    # Kannada
    'ಎದೆ ನೋವು', 'ಹೃದಯಾಘಾತ', 'ಉಸಿರಾಟದ ತೊಂದರೆ'
]

SERIOUS_MEDICAL_KEYWORDS = [
    'severe pain', 'intense pain', 'unbearable pain',
    'high fever', 'fever above 103', 'fever won\'t go down',
    'difficulty breathing', 'shortness of breath', 'breathless',
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

    # 1. Native script detection (always allow native script inputs to pass through to LLM)
    native_script_ranges = [
        ('\u0d00', '\u0d7f'),  # Malayalam
        ('\u0b80', '\u0bff'),  # Tamil
        ('\u0c00', '\u0c7f'),  # Telugu
        ('\u0c80', '\u0cff'),  # Kannada
        ('\u0900', '\u097f'),  # Hindi
    ]
    has_native = any(
        any(start <= char <= end for char in message)
        for start, end in native_script_ranges
    )
    if has_native:
        return True

    # 2. Regional medical keywords check (romanized regional inputs)
    REGIONAL_MEDICAL_KEYWORDS = [
        # Hindi
        'bukhar', 'dard', 'zukaam', 'jukham', 'khansi', 'pait', 'pet', 'dawa', 'dawai', 'sar', 'sardard',
        'vomit', 'ultila', 'ulti', 'kamzori', 'thakan', 'chot', 'khoon', 'aspatal', 'aspataal', 'vaidya',
        # Kannada
        'novu', 'tale', 'jvara', 'jwara', 'kemmu', 'hotte', 'tala', 'roga', 'arogya', 'oushadha', 'maddu',
        'doctorge', 'hospitalge', 'doctarige', 'aushadha', 'talabyatha', 'tale novu', 'hotte novu', 'novu idhe',
        # Malayalam
        'vedana', 'pani', 'chumi', 'vayaru', 'vayar', 'thala', 'rogam', 'asugham', 'sukham', 'raktham',
        'mootram', 'marunnu', 'marunu', 'aasupathri', 'thalavedana', 'vayarinu', 'shwasam', 'shevasam',
        # Tamil
        'vali', 'kaachal', 'irumal', 'vayanru', 'vayiru', 'thalai', 'noy', 'marundhu', 'raththam', 'irumal',
        'moochu', 'thalaivali', 'vayiressu', 'aaspathiri', 'udambu', 'sali',
        # Telugu
        'noppi', 'jwaram', 'daggara', 'dagu', 'pottu', 'thala', 'roham', 'jabbulu', 'raktham', 'marundu',
        'thalanoppi', 'vontinoppi', 'ashupathri', 'moola', 'moolalu'
    ]
    if any(k in message_lower for k in REGIONAL_MEDICAL_KEYWORDS):
        return True

    # 3. English medical keywords check
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
        'hi', 'hello', 'hey', 'namaste', 'vanakkam', 'namaskar', 'namaskara', 'namaskaram', 'namaskari',
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
        'English': "[DISCLAIMER]This is for informational purposes only. For medical advice or diagnosis, consult a professional.[/DISCLAIMER]",
        'Hindi': "[DISCLAIMER]यह केवल सूचनात्मक उद्देश्यों के लिए है। चिकित्सीय सलाह या निदान के लिए, किसी पेशेवर से परामर्श लें।[/DISCLAIMER]",
        'Spanish': "[DISCLAIMER]Esto es solo para fines informativos. Para asesoramiento o diagnóstico médico, consulte a un profesional.[/DISCLAIMER]",
        'French': "[DISCLAIMER]Ceci est uniquement à des fins d'information. Pour obtenir des conseils médicaux ou un diagnostic, consultez un professionnel.[/DISCLAIMER]",
        'Arabic': "[DISCLAIMER]هذا للأغراض الإعلامية فقط. للحصول على المشورة الطبية أو التشخيص، استشر طبيبًا متخصصًا.[/DISCLAIMER]",
        'Tamil': "[DISCLAIMER]இது தகவல் நோக்கங்களுக்காக மட்டுமே. மருத்துவ ஆலோசனை அல்லது கண்டறிதலுக்கு, ஒரு நிபுணரை அணுகவும்.[/DISCLAIMER]",
        'Telugu': "[DISCLAIMER]ఇది కేవలం సమాచార ప్రయోజనాల కొరకు మాత్రమే. వైద్య సలహా లేదా రోగనిర్ధారణ కోసం, నిపుణుడిని సంప్రదించండి.[/DISCLAIMER]",
        'Kannada': "[DISCLAIMER]ಇದು ಮಾಹಿತಿ ಉದ್ದೇಶಗಳಿಗಾಗಿ ಮಾತ್ರ. ವೈದ್ಯಕೀಯ ಸಲಹೆ ಅಥವಾ ರೋಗನಿರ್ಣಯಕ್ಕಾಗಿ, ತಜ್ಞರನ್ನು ಸಂಪರ್ಕಿಸಿ.[/DISCLAIMER]",
        'Malayalam': "[DISCLAIMER]ഇത് വിവര ആവശ്യങ്ങൾക്ക് മാത്രമുള്ളതാണ്. വൈദ്യോപദേശത്തിനോ രോഗനിർണയത്തിനോ ഒരു വിദഗ്ദ്ധനെ സമീപിക്കുക.[/DISCLAIMER]",
        'Bengali': "[DISCLAIMER]এটি শুধুমাত্র তথ্যগত উদ্দেশ্যে। চিকিৎসা পরামর্শ বা রোগ নির্ণয়ের জন্য, একজন পেশাদারের সাথে পরামর্শ করুন।[/DISCLAIMER]",
        'Marathi': "[DISCLAIMER]हे केवळ माहितीच्या उद्देशाने आहे. वैद्यकीय सल्ला किंवा निदानासाठी, तज्ञांचा सल्ला घ्या.[/DISCLAIMER]"
    }
    return disclaimers.get(language, disclaimers['English'])


def build_enhanced_image_analysis_prompt(user_message: str, language: str, elaborate: bool = False) -> str:
    language_instruction = LANGUAGE_PROMPTS.get(language, LANGUAGE_PROMPTS["English"])
    disclaimer = get_medical_image_disclaimer(language)

    prompt = f"""You are a professional medical assistant. Analyze the user's uploaded medical image (scan, report, X-ray, MRI, CT, etc.) and write a structured clinical response.

CRITICAL INSTRUCTIONS:
1. Always start your response with this exact disclaimer line (do not modify it):
{disclaimer}

2. You MUST structure your analysis using the following headings (translated to the requested language: {language}):
   - **Image Type & Quality**
   - **Key Findings**
   - **Urgency Assessment** (Provide a clear rating like "🚨 CRITICAL", "⚠️ MODERATE", or "🟢 NORMAL" followed by an explanation of the level of urgency. If any critical findings are found, explain them clearly.)
   - **Clinical Significance**
   - **Recommendations**
   - **Limitations**

3. In your analysis:
   - Carefully describe what is shown (scan type, sequence, body parts).
   - Detail any abnormal or key findings visible in the scan or report.
   - Explain what these findings mean in simple terms.
   - Do NOT use phrases like "educational purposes" or "for study purpose". Instead, frame this as informational guidance.
   - Instruct the user on appropriate next steps under the Recommendations heading.

LANGUAGE REQUIREMENT:
{language_instruction}

USER'S QUERY:
{user_message if user_message else "Please analyze my medical image."}
"""
    return prompt


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
        history = kwargs.get('history', [])
        messages = [{'role': 'system', 'content': system_prompt}]
        for h in history:
            messages.append({'role': h['role'], 'content': h['message']})
        messages.append({'role': 'user', 'content': user_message})

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
        history = kwargs.get('history', [])
        messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            messages.append({"role": h['role'], "content": h['message']})
        messages.append({"role": "user", "content": user_message})

        if stream:
            response_stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
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
                messages=messages,
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
    """Groq Vision - Fast and Free (dynamically loaded)"""

    def __init__(self):
        super().__init__(os.getenv("GROQ_API_KEY"))
        self.model = "llama-3.2-11b-vision-preview"  # default fallback

    def test_connection(self) -> bool:
        if not self.api_key:
            logger.warning("⚠️ Groq Vision: No API key found")
            return False
        try:
            from groq import Groq
            self.client = Groq(api_key=self.api_key)
            
            # Dynamically check for available vision models
            models = self.client.models.list()
            supported_models = [m.id for m in models.data]
            vision_models = [m for m in supported_models if "vision" in m.lower()]
            
            if not vision_models:
                logger.warning("⚠️ Groq Vision: No active vision models are available on your Groq account currently.")
                return False
                
            self.model = vision_models[0]
            self.available = True
            logger.info(f"✅ Groq Vision initialized dynamically (model: {self.model})")
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
    """OpenAI GPT-4 Vision - High Quality (supports OpenRouter fallback)"""

    def __init__(self):
        super().__init__(os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"
        self.is_openrouter = self.api_key and self.api_key.startswith("sk-or-v1-")
        if self.is_openrouter:
            # Use google/gemini-2.5-flash on OpenRouter to prevent safety refusals for medical scans
            self.model = "google/gemini-2.5-flash"

    def test_connection(self) -> bool:
        if not self.api_key:
            logger.warning("⚠️ OpenAI Vision: No API key found")
            return False
        try:
            from openai import OpenAI
            if self.is_openrouter:
                self.client = OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=self.api_key
                )
                logger.info(f"✅ OpenAI Vision (OpenRouter) initialized (model: {self.model})")
            else:
                self.client = OpenAI(api_key=self.api_key)
                logger.info(f"✅ OpenAI Vision initialized (model: {self.model})")
            self.available = True
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
        # Trigger Django autoreload for vision provider keys refresh
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
                                        "openai_vision,gemini_vision,claude_vision,groq_vision")
        self.vision_priority_order = [p.strip() for p in vision_priority_env.split(',')]
        self.vision_priority_order = [p for p in self.vision_priority_order if p in self.available_vision_providers]

        if not self.priority_order:
            logger.error("❌ No text AI providers available! Please configure at least one.")
            raise RuntimeError("No AI providers configured")

        logger.info(f"✅ Text providers: {', '.join(self.available_providers)}")
        logger.info(f"✅ Vision providers: {', '.join(self.available_vision_providers)}")
        logger.info(f"🎯 Text priority: {' → '.join(self.priority_order)}")
        logger.info(f"🎯 Vision priority: {' → '.join(self.vision_priority_order)}")

    def analyze_medical_image(
        self,
        image_buffer,
        user_message: str,
        language: str = "English",
        elaborate: bool = False,
    ):
        """
        Analyze a medical image using vision AI models.
        Yields text chunks for SSE streaming.
        """
        try:
            if not self.available_vision_providers:
                msg = (
                    "Medical image analysis requires a vision AI provider. "
                    "Please configure GROQ_API_KEY, ANTHROPIC_API_KEY, "
                    "OPENAI_API_KEY, or GEMINI_API_KEY."
                )
                for word in msg.split():
                    yield word + ' '
                return
 
            # Read image ONCE into memory so multiple providers can use it
            image_buffer.seek(0)
            image_data = image_buffer.read()
 
            if len(image_data) == 0:
                yield "Error: image data is empty. Please try uploading again."
                return
 
            logger.info(
                f"[Vision] Image size: {len(image_data)} bytes | "
                f"Language: {language} | Elaborate: {elaborate}"
            )
 
            prompt = build_enhanced_image_analysis_prompt(
                user_message, language, elaborate
            )
            max_tokens = 1500 if elaborate else 800
 
            last_error = None
            for provider_name in self.vision_priority_order:
                provider = self.vision_providers[provider_name]
                if not provider.available:
                    continue
 
                try:
                    logger.info(f"[Vision] Trying provider: {provider_name}")
                    start_time = time.time()
 
                    full_response = ""
                    for chunk in provider.analyze_image(
                        image_data=image_data,
                        prompt=prompt,
                        temperature=0.2,
                        max_tokens=max_tokens,
                        top_p=0.85,
                        stream=True,
                    ):
                        full_response += chunk
                        yield chunk
 
                    elapsed = time.time() - start_time
                    logger.info(
                        f"[Vision] {provider_name} completed in {elapsed:.2f}s "
                        f"({len(full_response)} chars)"
                    )
 
                    if full_response and len(full_response) > 80:
                        return   # success — stop trying other providers
                    else:
                        logger.warning(
                            f"[Vision] {provider_name} returned a very short response, "
                            "trying next provider."
                        )
                        continue
 
                except Exception as e:
                    last_error = e
                    logger.warning(f"[Vision] {provider_name} failed: {e}")
                    continue
 
            # All providers failed
            error_msg = (
                "I encountered difficulties analyzing this image. "
                "Please ensure it is a clear medical image and try again, "
                "or consult a healthcare professional directly."
            )
            logger.error(f"[Vision] All providers failed. Last error: {last_error}")
            for word in error_msg.split():
                yield word + ' '
 
        except Exception as e:
            logger.error(f"[Vision] Critical error in analyze_medical_image: {e}", exc_info=True)
            yield "An unexpected error occurred during image analysis. Please seek professional medical evaluation."

            
    def get_critical_emergency_response(self, language: str, use_romanized: bool = False) -> str:
        if use_romanized:
            responses = {
                'English': """This is for informational purposes only. For medical advice or diagnosis, consult a professional.
Please contact emergency medical services or go to the nearest emergency room immediately.

Chest pain or heart pain can be a sign of a life-threatening medical emergency, such as a heart attack. Do not wait to see if it passes.

While you are waiting for medical help:

Stop all physical activity and sit or lie down in a safe, comfortable position.

Loosen any tight clothing around your neck or chest.

Inform someone near you or call a family member, friend, or neighbor right away so they know what you are experiencing.

If you are alone, unlock your front door so emergency responders can enter easily.

Please seek professional medical attention right now.""",

                'Hindi': """Yeh sirf informational purposes ke liye hai. Medical advice ya diagnosis ke liye, kisi professional se consult karein.
Kripya aur turant emergency medical services se sampark karein ya nearest emergency room mein jayein.

Chest pain ya heart pain ek life-threatening medical emergency ka sanket ho sakta hai, jaise ki heart attack. Yeh dekhne ke liye wait na karein ki kya yeh theek ho jata hai.

Jab aap medical help ka wait kar rahe hain:

Sabhi physical activity band kar dein aur safe, comfortable position mein baith jayein ya let jayein.

Apne neck ya chest ke aas-paas ke tight kapdo ko dheela karein.

Apne aas-paas ke kisi vyakti ko inform karein ya turant kisi family member, friend, ya neighbor ko call karein taaki unhe pata chale ki aap kya mahsoos kar rahe hain.

Agar aap akele hain, to apna main door unlock kar dein taaki emergency responders aasani se andar aa sakein.

Kripya abhi professional medical attention lein.""",

                'Malayalam': """Ithu informational purposesinu mathramullathanu. Medical advice ya diagnosisinu professionaline consult cheyyuka.
Dayavayi udan thanne emergency medical servicesine contact cheyyuka allenkil arikilulla emergency roomil poga.

Chest pain allenkil heart pain oru life-threatening medical emergencyude lakshanamaakam, udharanathinu heart attack. Ithu maarumo ennu nokki thamasikkaruthu.

Ningal medical helpinu vendi wait cheyyumbozh:

Ella physical activityum nirthi safe aya, comfortable aya positionil irikkuka allenkil kidakkuka.

Kazhuthinu chuttum chestinu chuttumulla tight aya vasthrangal loose aakkuka.

Arikilulla aareyengilum ariyikkuka allenkil udan thanne kudumbangangale, friendine, neighborine vilichu vivaram parayuka.

Ningal alone aanengil, emergency respondersinu easily enter cheyyan front door unlock cheyyuka.

Dayavayi ippo thanne professional medical attention theduka.""",

                'Tamil': """Idhu informational purposes kaga mattum dhaan. Medical advice illati diagnosis kaga qualified doctor ah qualified professional ah consult pannunga.
Dayavu seidhu udanadiyaga emergency medical services ah contact pannunga, illati pakkathula irukra emergency roomuku ponga.

Chest pain illati heart pain oru life-threatening medical emergency oda arikuriya irukalam, udharanathuku heart attack. Idhu sariyaaguma nu wait pannadhiga.

Neenga medical help kaga wait pannum podhu:

Ella physical activity um niruthi, safe and comfortable position la uthkarunga illati padunga.

Kazhuthu illati chest kitta tight ah irukra cloth ah loose pannunga.

Pakkathula irukra yaarkitayavadhu sollunga illati family member, friend, neighbor ah call panni ungaluku enna pannudhu nu sollunga.

Neenga thaniya irundha, emergency responders ulla varradhuku unga veetu main door ah unlock panni vainga.

Dayavu seidhu ippove professional medical attention edunga.""",

                'Kannada': """Idu informational purposesgagi matra. Medical advice athava diagnosisgagi professional doctoranna consult madi.
Dayavittu thakshana emergency medical servicesige contact madi athava nearest emergency roomige hogi.

Chest pain athava heart pain prana-thondare maduvatha medical emergency irabahudu, udaharanege heart attack. Idu sariyagutha endu wait madabedi.

Nivu medical helpigagi wait maduvaga:

Ella physical activityanna nillisi, safe mattu comfortable positionalli kulithukolli athava malagikolli.

Kuttige athava edeya sutthalu tight iruva batteyanna loose madi.

Nimma hathira iruvavarige thilisi athava thakshana family member, friend, athava neighborige call madi nimage enaguthide endu thilisi.

Nivu obbare iddare, emergency responders yashasiyagi olage baralu front dooranna unlock madi.

Dayavittu eegale professional medical attention thagedukolli.""",

                'Telugu': """Idhi informational purposes kosam mathrame. Medical advice leda diagnosis kosam professional doctor ni consult avvandi.
Dayachesi ventane emergency medical services ni contact cheyyandi leda nearest emergency room ki vellandi.

Chest pain leda heart pain prana-sankatamaina medical emergency ki sanketham kavachu, udharanaku heart attack. Idhi thagguthundhemo ani wait cheyyakandi.

Meeru medical help kosam wait chesthunnappudu:

Anni physical activities aapesi, safe and comfortable position lo kurchondi leda padukondi.

Meda leda chest chuttu tight ga unna clothings ni loose cheyyandi.

Meeku daggarlo unnavariki cheppandi leda ventane family member, friend, leda neighbor ki call chesi meeku emavuthundho cheppandi.

Meeru ontariga unte, emergency responders aasani ga lopaliki ravadaniki main door unlock chesi unchandi.

Dayachesi ippude professional medical attention teesukondi."""
            }
        else:
            responses = {
                'English': """This is for informational purposes only. For medical advice or diagnosis, consult a professional.
Please contact emergency medical services or go to the nearest emergency room immediately.

Chest pain or heart pain can be a sign of a life-threatening medical emergency, such as a heart attack. Do not wait to see if it passes.

While you are waiting for medical help:

Stop all physical activity and sit or lie down in a safe, comfortable position.

Loosen any tight clothing around your neck or chest.

Inform someone near you or call a family member, friend, or neighbor right away so they know what you are experiencing.

If you are alone, unlock your front door so emergency responders can enter easily.

Please seek professional medical attention right now.""",

                'Hindi': """यह केवल सूचनात्मक उद्देश्यों के लिए है। चिकित्सा सलाह या निदान के लिए, किसी पेशेवर से परामर्श लें।
कृपया तुरंत आपातकालीन चिकित्सा सेवाओं से संपर्क करें या निकटतम आपातकालीन कक्ष में जाएं।

छाती में दर्द या दिल का दर्द दिल के दौरे जैसे जानलेवा चिकित्सा आपातकाल का संकेत हो सकता है। यह देखने के लिए इंतजार न करें कि क्या यह ठीक हो जाता है।

जब आप चिकित्सा सहायता की प्रतीक्षा कर रहे हों:

सभी शारीरिक गतिविधियां बंद कर दें और सुरक्षित, आरामदायक स्थिति में बैठ जाएं या लेट जाएं।

अपने गले या छाती के आस-पास के किसी भी तंग कपड़े को ढीला करें।

अपने आस-पास के किसी व्यक्ति को सूचित करें या तुरंत किसी परिवार के सदस्य, मित्र या पड़ोसी को कॉल करें ताकि वे जान सकें कि आप क्या महसूस कर रहे हैं।

यदि आप अकेले हैं, तो अपना मुख्य दरवाजा खोल दें (अनलॉक करें) ताकि आपातकालीन बचाव दल आसानी से प्रवेश कर सकें।

कृपया अभी पेशेवर चिकित्सा सहायता लें।""",

                'Malayalam': """ഇത് വിവരശേഖരണ ആവശ്യങ്ങൾക്ക് മാത്രമുള്ളതാണ്. വൈദ്യോപദേശത്തിനോ രോഗനിർണ്ണയത്തിനോ ഒരു വിദഗ്ദ്ധ ഡോക്ടറെ സമീപിക്കുക.
ദയവായി ഉടൻ തന്നെ അടിയന്തിര മെഡിക്കൽ സേവനങ്ങളുമായി ബന്ധപ്പെടുക അല്ലെങ്കിൽ തൊട്ടടുത്തുള്ള എമർజൻസി റൂമിൽ പോവുക.

നെഞ്ചുവേദനയോ ഹൃദയവേദനയോ ഹൃദയാഘാതം പോലുള്ള ജീവന് തന്നെ ഭീഷണിയായേക്കാവുന്ന ഒരു മെഡിക്കൽ എമർജൻസിയുടെ ലക്ഷണമാകാം. ഇത് സ്വയം മാറുമോ എന്ന് നോക്കി സമയം കളയരുത്.

നിങ്ങൾ മെഡിക്കൽ സഹായത്തിനായി കാത്തിരിക്കുമ്പോൾ:

എല്ലാവിധ ശാരീരിക അധ്വാനങ്ങളും നിർത്തിവെച്ച് സുരക്ഷിതവും സുഖകരവുമായ രീതിയിൽ ഇരിക്കുകയോ കിടക്കുകയോ ചെയ്യുക.

കഴുത്തിന് ചുറ്റുമുള്ളതോ നെഞ്ചിലെ ഭാഗത്തോ ഉള്ള ഇറുകിയ വസ്ത്രങ്ങൾ അയച്ചിടുക.

നിങ്ങളുടെ അടുപ്പമുള്ള ആരെങ്കിലും ഉണ്ടെങ്കിൽ വിവരമറിയിക്കുക അല്ലെങ്കിൽ ഒരു കുടുംബാംഗത്തെയോ സുഹൃത്തിനെയോ അയൽക്കാരനെയോ ഉടൻ വിളിച്ച് നിങ്ങൾക്ക് എന്ത് സംഭവിക്കുന്നുവെന്ന് അവരെ അറിയിക്കുക.

നിങ്ങൾ തനിച്ചാണെങ്കിൽ, അടിയന്തര രക്ഷാപ്രവർത്തകർക്ക് എളുപ്പത്തിൽ അകത്തുകയറാൻ മുൻവാതിൽ തുറന്നിടുക.

ദയവായി ഇപ്പോൾ തന്നെ അടിയന്തിരമായി ഒരു വിദഗ്ദ്ധ ഡോക്ടറുടെ സഹായം തേടുക.""",

                'Tamil': """இது தகவல் நோக்கங்களுக்காக மட்டுமே. மருத்துவ ஆலோசனை அல்லது நோயறிதலுக்கு, ஒரு நிபுணரை அணுகவும்.
தயவுசெய்து உடனடியாக அவசர மருத்துவ சேவைகளைத் தொடர்பு கொள்ளவும் அல்லது அருகிலுள்ள அவசர சிகிச்சை பிரிவுக்குச் செல்லவும்.

நெஞ்சு வலி அல்லது இதய வலி என்பது மாரடைப்பு போன்ற உயிருக்கு ஆபத்தான மருத்துவ அவசரநிலையின் அறிகுறியாக இருக்கலாம். அதுவாகவே சரியாகிவிடும் என்று காத்திருக்க வேண்டாம்.

நீங்கள் மருத்துவ உதவிக்காக காத்திருக்கும் போது:

அனைத்து உடல் செயல்பாடுகளையும் நிறுத்திவிட்டு, பாதுகாப்பான, வசதியான நிலையில் உட்காரவும் அல்லது படுக்கவும்.

கழுத்து அல்லது நெஞ்சைச் சுற்றி இறுக்கமாக இருக்கும் ஆடைகளைத் தளர்த்தவும்.

உங்களுக்கு அருகில் இருப்பவர்களிடம் தெரிவிக்கவும் அல்லது உடனடியாக ஒரு குடும்ப உறுப்பினர், நண்பர் அல்லது பக்கத்து வீட்டுக்காரரை அழைத்து உங்களுக்கு என்ன நடக்கிறது என்பதை அவர்களுக்குத் தெரியப்படுத்தவும்.

நீங்கள் தனியாக இருந்தால், அவசர உதவி வழங்குபவர்கள் எளிதாக உள்ளே நுழைய உங்கள் முன் கதவைத் திறந்து வைக்கவும்.

தயவுசெய்து இப்போதே தொழில்முறை மருத்துவ உதவியை நாடுங்கள்.""",

                'Kannada': """ಇದು ಮಾಹಿತಿ ಉದ್ದೇಶಗಳಿಗಾಗಿ ಮಾತ್ರ. ವೈದ್ಯಕೀಯ ಸಲಹೆ ಅಥವಾ ರೋಗನಿರ್ಣಯಕ್ಕಾಗಿ, ವೃತ್ತಿಪರರನ್ನು ಸಂಪರ್ಕಿಸಿ.
ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ತುರ್ತು ವೈದ್ಯಕೀಯ ಸೇವೆಗಳನ್ನು ಸಂಪರ್ಕಿಸಿ ಅಥವಾ ಹತ್ತಿರದ ತುರ್ತು ಚಿಕಿತ್ಸಾ ಕೊಠಡಿಗೆ ಹೋಗಿ.

ಎದೆ ನೋವು ಅಥವಾ ಹೃದಯದ ನೋವು ಹೃದಯಾಘಾತದಂತಹ ಪ್ರಾಣಾಪಾಯ ಉಂಟುಮಾಡುವ ತುರ್ತು ವೈದ್ಯಕೀಯ ಸ್ಥಿತಿಯ ಸಂಕೇತವಾಗಿರಬಹುದು. ಅದು ತಾನಾಗಿಯೇ ಗುಣವಾಗುವುದೇ ಎಂದು ಕಾಯಬೇಡಿ.

ನೀವು ವೈದ್ಯಕೀಯ ಸಹಾಯಕ್ಕಾಗಿ ಕಾಯುತ್ತಿರುವಾಗ:

ಎಲ್ಲಾ ದೈಹಿಕ ಚಟುವಟಿಕೆಗಳನ್ನು ನಿಲ್ಲಿಸಿ ಮತ್ತು ಸುರಕ್ಷಿತವಾದ, ಆರಾಮದಾಯಕವಾದ ಸ್ಥಿತಿಯಲ್ಲಿ ಕುಳಿತುಕೊಳ್ಳಿ ಅಥವಾ ಮಲಗಿಕೊಳ್ಳಿ.

ಕುತ್ತಿಗೆ ಅಥವಾ ಎದೆಯ ಸುತ್ತಲಿನ ಬಿಗಿಯಾದ ಬಟ್ಟೆಗಳನ್ನು ಸಡಿಲಗೊಳಿಸಿ.

ನಿಮ್ಮ ಹತ್ತಿರವಿರುವವರಿಗೆ ತಿಳಿಸಿ ಅಥವಾ ತಕ್ಷಣವೇ ಕುಟುಂಬದ ಸದಸ್ಯರು, ಸ್ನೇಹಿತರು ಅಥವಾ ನೆರೆಹೊರೆಯವರಿಗೆ ಕರೆ ಮಾಡಿ ನಿಮಗೆ ಏನಾಗುತ್ತಿದೆ ಎಂದು ತಿಳಿಸಿ.

ನೀವು ಒಬ್ಬರೇ ಇದ್ದರೆ, ತುರ್ತು ರಕ್ಷಕರು ಸುಲಭವಾಗಿ ಒಳಗೆ ಬರಲು ನಿಮ್ಮ ಮುಂಭಾಗದ ಬಾಗಿಲನ್ನು ಅನ್ಲಾಕ್ ಮಾಡಿ.

ದಯವಿಟ್ಟು ಈಗಲೇ ವೃತ್ತಿಪರ ವೈದ್ಯಕೀಯ ಸಹಾಯವನ್ನು ಪಡೆದುಕೊಳ್ಳಿ.""",

                'Telugu': """ఇది సమాచార ప్రయోజనాల కోసం మాత్రమే. వైద్య సలహా లేదా రోగనిర్ధారణ కోసం, నిపుణుడిని సంప్రదించండి.
దయచేసి వెంటనే అత్యవసర వైద్య సేవలను సంప్రదించండి లేదా సమీపంలోని అత్యవసర విభాగానికి వెళ్ళండి.

ఛాతి నొప్పి లేదా గుండె నొప్పి అనేది గుండెపోటు వంటి ప్రాణాంతక వైద్య అత్యవసర పరిస్థితికి సంకేతం కావచ్చు. అది తగ్గుతుందో లేదో అని వేచి ఉండకండి.

మీరు వైద్య సహాయం కోసం ఎదురుచూస్తున్నప్పుడు:

అన్ని శారీరక శ్రమలను నిలిపివేసి, సురักษితమైన, సౌకర్యవంతమైన స్థితిలో కూర్చోండి లేదా పడుకోండి.

మీ మెడ లేదా ఛాతి చుట్టూ ఉన్న గట్టి దుస్తులను సడలించండి.

మీకు సమీపంలో ఉన్నవారికి తెలియజేయండి లేదా వెంటనే కుటుంబ సభ్యుడు, స్నేహితుడు లేదా పొరుగువారికి కాల్ చేసి మీకు ఏమి జరుగుతుందో తెలియజేయండి.

మీరు ఒంటరిగా ఉంటే, అత్యవసర సిబ్బంది సులభంగా లోపలికి రావడానికి మీ ప్రధాన తలుపును అన్‌లాక్ చేయండి.

దయచేసి ఇప్పుడే వృత్తిపరమైన వైద్య సహాయం తీసుకోండి."""
            }
        raw_text = responses.get(language, responses['English'])
        lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        if len(lines) >= 9:
            disclaimer = f"[DISCLAIMER]{lines[0]} {lines[1]}[/DISCLAIMER]"
            explanation = lines[2]
            intro = lines[3]
            
            def bold_first_words(text, num_words=4):
                words = text.split()
                if len(words) > num_words:
                    return f"**{' '.join(words[:num_words])}** {' '.join(words[num_words:])}"
                return f"**{text}**"
            
            bullet1 = f"[BULLET]{bold_first_words(lines[4], 4)}[/BULLET]"
            bullet2 = f"[BULLET]{bold_first_words(lines[5], 4)}[/BULLET]"
            bullet3 = f"[BULLET]{bold_first_words(lines[6], 4)}[/BULLET]"
            bullet4 = f"[BULLET]{bold_first_words(lines[7], 4)}[/BULLET]"
            
            final_cta = lines[8]
            
            formatted_text = f"{disclaimer}\n\n{explanation}\n\n{intro}\n\n{bullet1}\n\n{bullet2}\n\n{bullet3}\n\n{bullet4}\n\n{final_cta}"
            return formatted_text
            
        return raw_text

    def get_serious_medical_response(self, language: str) -> str:
        """Response for serious but not immediately life-threatening conditions"""
        responses = {
            'English': """SERIOUS MEDICAL CONDITION DETECTED

This appears to be a serious health issue that needs professional medical attention.

RECOMMENDED ACTIONS:
• Consult a doctor within 24 hours
• Do not delay in seeking professional medical help
• If symptoms worsen rapidly, call 108 / 102 immediately
• Visit your nearest hospital or clinic for proper examination
• Get appropriate diagnostic tests if recommended
• Do not self-medicate for serious symptoms

While I can provide general information, your symptoms require proper medical examination by a qualified healthcare professional.""",

            'Hindi': """गंभीर चिकित्सा स्थिति का पता चला

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

    def build_enhanced_system_prompt(self, language: str, elaborate: bool, severity: str, use_romanized: bool = False, is_voice: bool = False) -> str:
        """Build comprehensive system prompt for accurate medical responses"""

        # Language instruction: native script always, unless user explicitly asked for romanized.
        if use_romanized:
            romanized_instructions = {
                'Hindi':     ('CRITICAL INSTRUCTION: You MUST reply ONLY in Hinglish — Hindi words written in Roman script '
                              '(English letters). Do NOT use Devanagari script. '
                              'CRITICAL: Your Hinglish response MUST follow the exact structured formats, bullet lists, home care steps, '
                              'warning signs, and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. '
                              'Make it as explanatory, comprehensive, and detailed as an English medical response. '
                              'Example: "Aapko doctor ke paas jaana chahiye. Ye symptoms serious hain. Rest karein." '
                              'Medical terms like fever, tablet, doctor, hospital stay in English.'),
                'Malayalam': ('CRITICAL INSTRUCTION: You MUST reply ONLY in Manglish — Malayalam words written in Roman script '
                              '(English letters). Do NOT use Malayalam script. '
                              'CRITICAL: Your Manglish response MUST follow the exact structured formats, bullet lists, home care steps, '
                              'warning signs, and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. '
                              'Make it as explanatory, comprehensive, and detailed as an English medical response. '
                              'Example: "Ningal doctor ine kaananam. Ee symptoms serious aanu. Rest edukku." '
                              'Medical terms like fever, tablet, doctor, hospital stay in English.'),
                'Tamil':     ('CRITICAL INSTRUCTION: You MUST reply ONLY in Tanglish — Tamil words written in Roman script '
                              '(English letters). Do NOT use Tamil script. '
                              'CRITICAL: Your Tanglish response MUST follow the exact structured formats, bullet lists, home care steps, '
                              'warning signs, and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. '
                              'Make it as explanatory, comprehensive, and detailed as an English medical response. '
                              'Example: "Neenga doctor kita ponga. Indha symptoms serious ah irukku." '
                              'Medical terms like fever, tablet, doctor, hospital stay in English.'),
                'Kannada':   ('CRITICAL INSTRUCTION: You MUST reply ONLY in Kanglish — Kannada words written in Roman script '
                              '(English letters). Do NOT use Kannada script. '
                              'CRITICAL: Your Kanglish response MUST follow the exact structured formats, bullet lists, home care steps, '
                              'warning signs, and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. '
                              'Make it as explanatory, comprehensive, and detailed as an English medical response. '
                              'Example: "Nimma doctor hatra hogbeku. Ee symptoms serious agi kaanutide." '
                              'Medical terms like fever, tablet, doctor, hospital stay in English.'),
                'Telugu':    ('CRITICAL INSTRUCTION: You MUST reply ONLY in Tenglish — Telugu words written in Roman script '
                              '(English letters). Do NOT use Telugu script. '
                              'CRITICAL: Your Tenglish response MUST follow the exact structured formats, bullet lists, home care steps, '
                              'warning signs, and disclaimers specified under the Gravity levels below. Do NOT give a brief or simple answer. '
                              'Make it as explanatory, comprehensive, and detailed as an English medical response. '
                              'Example: "Meeru doctor daggara vellali. Ee symptoms serious ga unnai." '
                              'Medical terms like fever, tablet, doctor, hospital stay in English.'),
                'English':   'You must respond ONLY in English language. Ensure the response is natural, fluent, grammatically correct, and contextually accurate like ChatGPT.',
            }
            language_instruction = romanized_instructions.get(language, romanized_instructions['English'])
        else:
            language_instruction = NATIVE_SCRIPT_LANGUAGE_PROMPTS.get(language, NATIVE_SCRIPT_LANGUAGE_PROMPTS['English'])

        if severity == "general":
            if elaborate:
                word_limit = "400-500 words"
                detail_level = "comprehensive and detailed"
            else:
                if is_voice:
                    word_limit = "100-200 words for simple questions, 200-350 words for complex ones"
                    detail_level = "conversational and clear"
                else:
                    word_limit = "150-300 words"
                    detail_level = "concise yet thorough"
        else:
            word_limit = "300-400 words"
            detail_level = "thorough and informative"

        # Voice-specific instruction block
        if is_voice:
            voice_rules = """

VOICE INPUT RULES — THIS IS A VOICE/SPOKEN QUERY:
- The input was transcribed from speech. Filler words (umm, uhh, like, you know) should be ignored.
- Incomplete or run-on sentences are normal — understand the intent and answer fully.
- Spelling may vary due to transcription — interpret intelligently.
- Mixed language input (e.g. "doctor saab mujhe bukhar hai") is expected — detect and reply in the dominant language.
- Respond in a CONVERSATIONAL tone, as if speaking to the person — not in formal written style.
- Do NOT use markdown headers or heavy bullet formatting. Use natural flowing sentences.
- Keep the response shorter and more spoken-friendly.
- End with ONE clear action step the person should take right now.
- Language detection from voice: if the transcription contains Malayalam words (ningal, vayar, thala, vedana, ente, enikku, rogam, marunnu, njan, novu) → reply in Malayalam script. Tamil words (naan, enakku, vali, kaachal, thalai, vayiru, noy, marundhu) → Tamil script. Hindi words (mujhe, bukhar, dard, pet, sir, dawai, khansi, thakaan, kamzori) → Hindi script. Kannada words (nanage, novu, tale, jvara, hotte, roga, maddu, kashta) → Kannada script. Telugu words (naku, noppi, jwaram, thala, roham, marundu, daggara) → Telugu script."""
        else:
            voice_rules = ""

        system_prompt = f"""You are an expert AI medical assistant trained on clinical medicine, pharmacology, diagnostics, and patient communication across India's diverse linguistic landscape.

LANGUAGE REQUIREMENT — STRICTLY ENFORCED:
{language_instruction}
{voice_rules}



Automatically detect the gravity of every query and respond accordingly:

GRAVITY 1 — GREETING / CHITCHAT
Trigger: "hi", "hello", "how are you", "what can you do"
Response style: Warm, brief, 1–2 sentences. Introduce yourself and invite a health question. Never ask multiple questions.

GRAVITY 2 — GENERAL HEALTH INFO
Trigger: "what is diabetes", "how does the kidney work", "what foods are good for BP"
Response style: Clear, educational, structured. Use this format:
  • What it is (1–2 sentences)
  • Key facts or causes (2–4 bullet points)
  • What a person can do (2–3 actionable tips)
  • When to see a doctor (1 sentence)
Word limit: 200–350 words.

GRAVITY 3 — PERSONAL SYMPTOM QUERY
Trigger: "I have a headache", "my stomach hurts", "I feel dizzy since yesterday"
Response style: Empathetic, direct, specific. Use this format:
  • Acknowledge the symptom (1 sentence — warm, not robotic)
  • Most likely causes given the symptom (2–4 possibilities)
  • What to do RIGHT NOW at home (2–3 steps)
  • Warning signs that mean go to doctor immediately (2–3 red flags)
  • Recommended specialist if needed
Word limit: 250–400 words. Never be vague. Never say only "see a doctor."

GRAVITY 4 — SERIOUS / URGENT SYMPTOMS
Trigger: high fever for days, vomiting blood, severe abdominal pain, breathlessness
Response style: Calm but direct. Lead with urgency, then explain. Format:
  [DISCLAIMER]This is for informational purposes only. For medical advice or diagnosis, consult a professional.[/DISCLAIMER]

  State clearly: "This needs medical attention within 24 hours."
  • Why this is serious (1–2 sentences)
  • Immediate safe steps at home while preparing to go
  • What to tell the doctor
  • Call 108 / 102 if symptoms worsen rapidly
Word limit: 200–300 words.

GRAVITY 5 — CRITICAL / LIFE-THREATENING EMERGENCY
Trigger: chest pain, heart attack signs, stroke, not breathing, seizure, overdose, severe bleeding
Response style: Instant, structured, no preamble. Format EXACTLY as:

  [DISCLAIMER]This is for informational purposes only. For medical advice or diagnosis, consult a professional.[/DISCLAIMER]

  Please contact emergency medical services or go to the nearest emergency room immediately.

  <one sentence explaining why this is life-threatening>. Do not wait to see if it passes.

  While you are waiting for medical help:

  [BULLET]**Stop all physical activity** and sit or lie down in a safe, comfortable position.[/BULLET]
  [BULLET]**Loosen any tight clothing** around your neck or chest.[/BULLET]
  [BULLET]**Inform someone near you** or call a family member, friend, or neighbor right away so they know what you are experiencing.[/BULLET]
  [BULLET]**If you are alone, unlock your front door** so emergency responders can enter easily.[/BULLET]

  Please seek professional medical attention right now.

═══════════════════════════════════════════════
UNIVERSAL RULES — APPLY TO ALL GRAVITY LEVELS
═══════════════════════════════════════════════

ACCURACY:
- Give real, specific, evidence-based medical information every time
- Use cautious language: "this may indicate", "commonly caused by", "could suggest"
- Never fabricate drug names, dosages, or statistics
- Never give definitive diagnoses — offer possibilities and reasoning

TONE:
- Speak like a knowledgeable, caring friend who is also a doctor
- Never robotic, never over-formal, never dismissive
- Reassuring but honest — do not downplay serious symptoms
- If someone is scared, acknowledge it briefly before answering

LANGUAGE FIDELITY:
- If the user writes in Malayalam script → reply entirely in Malayalam script
- If the user writes in Hinglish (romanized Hindi) → reply in clear Hindi Devanagari script UNLESS they explicitly ask for Hinglish
- Same rule for Tamil, Telugu, Kannada — native script always unless explicitly asked for romanized
- Medical terms (doctor, hospital, tablet, fever, oxygen) may remain in English within any language
- NEVER mix scripts randomly — pick one and stay consistent

FORMATTING:
- Use [BULLET]…[/BULLET] markers for all bullet lists. Do NOT output any raw list symbols (such as *, -, or •) outside or inside the [BULLET] tags.
- Use [DISCLAIMER]…[/DISCLAIMER] only for Gravity 4 and Gravity 5 responses
- For voice responses (is_voice=True): no bullet markers, no formatting — flowing conversational sentences only, under 200 words
- Bold key phrases using **text** syntax
- SUGGESTIONS CHIPS (Very Important): At the very end of EVERY response (except for greetings/Gravity 1 and voice responses), you MUST generate exactly 3 relevant, concise follow-up questions that the user might want to ask next based on your response. Wrap these suggestions in a single [SUGGESTIONS]...[/SUGGESTIONS] tag block at the bottom of the response, separating the suggestions with a vertical bar '|'.
  Example format: [SUGGESTIONS]fever causes?|home remedies for fever?|when to see a doctor?[/SUGGESTIONS]
  CRITICAL: The suggestions MUST be in the same language and script that you are responding in. Keep them very short (under 6 words each). Do NOT show suggestions in voice responses (is_voice=True).

BOUNDARIES:
- Never answer non-medical questions (recipes, movies, sports, politics, coding) — redirect politely in 1 sentence
- Never prescribe specific drug dosages — mention drug classes only (e.g., "doctors typically prescribe antihistamines")
- Never claim to replace a doctor — always recommend professional consultation for persistent or serious symptoms
- If asked "are you a real doctor" — say clearly: "I'm an AI medical assistant, not a licensed doctor. Always confirm advice with a qualified healthcare professional."

EMERGENCY OVERRIDE:
- If ANY message contains: chest pain, can't breathe, stroke signs, seizure, overdose, heavy bleeding, unconscious — IMMEDIATELY switch to Gravity 5 format regardless of how casually it's phrased
- "I feel heartpain" = Gravity 5. "my chest feels weird" = Gravity 5. Always err on the side of caution.

OUTPUT LENGTH TARGETS:
- Gravity 1: 1–3 sentences
- Gravity 2: 150–300 words
- Gravity 3: 250–400 words
- Gravity 4: 200–300 words
- Gravity 5: Fixed format — do not extend or shorten
- Voice mode: always under 200 words, no markers

Remember: You are often the first point of medical contact for people in rural India with limited access to doctors. Accuracy, clarity, and compassion are not optional — they are your core function."""

        return system_prompt


    def get_response(self, message: str, language: str = "English", elaborate: bool = False, user_id: str = None, is_voice: bool = False, history: list = None):
        """Generate medical response with streaming"""
        if history is None:
            history = []
        try:
            message = (message or "").strip()
            if not message:
                yield "Please ask a health or medical question."
                return

            if is_voice and language == 'English':
                voice_lang_keywords = {
                    'Malayalam': ['ningal', 'njan', 'vayar', 'thala', 'vedana', 'ente', 'enikku',
                                  'rogam', 'marunnu', 'novu', 'doctor ine', 'asugham', 'shwasam'],
                    'Tamil':     ['naan', 'enakku', 'vali', 'kaachal', 'thalai', 'vayiru', 'noy',
                                  'marundhu', 'doctorkita', 'aaspathiri', 'irumal', 'moochu'],
                    'Hindi':     ['mujhe', 'bukhar', 'dard', 'pet mein', 'sir mein', 'dawai',
                                  'doctorko', 'khansi', 'thakaan', 'kamzori', 'ulti', 'khoon'],
                    'Kannada':   ['nanage', 'tale', 'jvara', 'hotte', 'doctorge', 'roga', 'maddu',
                                  'kashta', 'novu', 'kemmu', 'aushadha'],
                    'Telugu':    ['naku', 'noppi', 'jwaram', 'thala', 'doctorki', 'roham',
                                  'marundu', 'daggara', 'jabbulu', 'ashupathri'],
                }
                msg_lower_v = message.lower()
                for lang_name, keywords in voice_lang_keywords.items():
                    if any(kw in msg_lower_v for kw in keywords):
                        language = lang_name
                        logger.info(f"[get_response] Voice language detected from keywords: {language}")
                        break

            # Determine script preference (native vs. romanized)
            # Romanized output is ONLY triggered when the user explicitly requests it
            # (e.g. "reply in Manglish", "Hinglish lo bolo"). Auto-detection of
            # romanized input no longer forces romanized output — the LLM always
            # replies in native script unless explicitly asked otherwise.
            msg_lower = message.lower()
            explicit_romanized = any(phrase in msg_lower for phrase in [
                "manglish", "tanglish", "hinglish", "kanglish", "tenglish",
                "romanized", "roman letter", "roman script", "english letter", "english script",
                "talk in roman", "reply in roman", "write in roman", "use roman",
                "manglish lo", "tanglish la", "hinglish lo bolo", "kanglish lo", "tenglish lo",
                "speak in roman", "roman letters lo",
            ])

            # Detect if user wrote in native script (used for medical-query passthrough only)
            native_script_ranges = [
                ('\u0d00', '\u0d7f', 'Malayalam'),
                ('\u0b80', '\u0bff', 'Tamil'),
                ('\u0c00', '\u0c7f', 'Telugu'),
                ('\u0c80', '\u0cff', 'Kannada'),
                ('\u0900', '\u097f', 'Hindi'),
            ]
            has_native_script = any(
                any(start <= char <= end for char in message)
                for start, end, _ in native_script_ranges
            )

            # use_romanized: ONLY when user explicitly requests romanized style.
            # Typing romanized (Manglish/Hinglish input) does NOT auto-switch output;
            # the LLM will reply in native script per RULE 2 unless overridden.
            use_romanized = explicit_romanized

            if is_greeting(message):
                # Native script greetings
                greetings = {
                    'English': "Hello! 👋 I'm your medical assistant. Ask me about symptoms, conditions, treatments, or upload medical images for analysis. How can I help?",
                    'Hindi': "नमस्ते! 👋 मैं आपका चिकित्सा सहायक हूं। लक्षण, बीमारी, उपचार के बारे में पूछें या चिकित्सा छवियां अपलोड करें। मैं कैसे मदद कर सकता हूं?",
                    'Kannada': "ನಮಸ್ಕಾರ! 👋 ನಾನು ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ಸಹಾಯಕ. ರೋಗಲಕ್ಷಣಗಳು, ಪರಿಸ್ถಿತಿಗಳು, ಚಿಕಿತ್ಸೆಗಳ ಬಗ್ಗೆ ನನ್ನನ್ನು ಕೇಳಿ ಅಥವಾ ವಿಶ್ಲೇಷಣೆಗಾಗಿ ವೈದ್ಯಕೀಯ ಚಿತ್ರಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
                    'Tamil': "வணக்கம்! 👋 நான் உங்கள் மருத்துவ உதவியாளர். அறிகுறிகள், பாதிப்புகள், சிகிச்சைகள் பற்றி என்னிடம் கேளுங்கள் அல்லது பகுப்பாய்விற்காக மருத்துவப் படங்களை பதிவேற்றவும். நான் உங்களுக்கு எப்படி உதவ முடியும்?",
                    'Telugu': "నమస్కారం! 👋 నేను మీ వైద్య సహాయకుడిని. లక్షణాలు, వ్యాధులు, చికిత్సల గురించి నన్ను అడగండి లేదా విశ్లేషణ కోసం వైద్య చిత్రాలను అప్‌లోడ్ చేయండి. నేను మీకు ఎలా సహాయపడగలను?",
                    'Malayalam': "ನമസ്കാരം! 👋 ഞാൻ നിങ്ങളുടെ മെഡിക്കൽ അസിസ്റ്റന്റാണ്. രോഗലക്ഷണങ്ങൾ, ആരോഗ്യസ്ഥിതികൾ, ചികിത്സകൾ എന്നിവയെക്കുറിച്ച് എന്നോട് ചോദിക്കുക അല്ലെങ്കിൽ പരിശോധനയ്ക്കായി മെഡിക്കൽ ചിത്രങ്ങൾ അപ്‌ಲೋഡ് ചെയ്യുക. ഞാൻ എങ്ങനെയാണ് സഹായിക്കേണ്ടത്?"
                }
                
                # Romanized script greetings
                greetings_romanized = {
                    'English': "Hello! 👋 I'm your medical assistant. Ask me about symptoms, conditions, treatments, or upload medical images for analysis. How can I help?",
                    'Hindi': "Namaste! 👋 Main aapka medical assistant hoon. Mujhe symptoms, bimari, ilaaj ke baare mein poochein ya analysis ke liye medical image upload karein. Main aapki kya madad kar sakta hoon?",
                    'Kannada': "Namaskara! 👋 Naanu nimma medical assistant. Symptoms, conditions, treatments bagge kelabahudu, illa andhre medical images upload madi. Naanu hege help madali?",
                    'Tamil': "Vanakkam! 👋 Naan ungaludaya medical assistant. Symptoms, conditions, treatments pathi ketkalam, illati medical images upload pannunga. Naan eppadi help pannanum?",
                    'Telugu': "Namaskaram! 👋 Nenu mee medical assistant. Symptoms, diseases, treatments gurinchi adagandi leda medical images upload cheyandi. Nenu meeku ela sahayapada galanu?",
                    'Malayalam': "Namaskaram! 👋 Njan ningalude medical assistant aanu. Symptoms, conditions, treatmentsine patti chodikkam, allenkil medical images upload cheyyam. Njan enganeyaanu sahayikkendath?"
                }
                
                greeting_text = greetings_romanized.get(language, greetings_romanized['English']) if use_romanized else greetings.get(language, greetings['English'])
                for chunk in greeting_text.split():
                    yield chunk + ' '
                return

            # If the user selected a regional language, we are more permissive to avoid blocking regional spelling variations.
            # We only block it if it has explicit non-medical keywords and zero medical keywords.
            is_med = True
            if not history:
                if language == 'English':
                    is_med = is_medical_query(message)
                else:
                    msg_lower = message.lower()
                    non_med_matches = sum(1 for kw in NON_MEDICAL_KEYWORDS if kw in msg_lower)
                    med_matches = sum(1 for kw in MEDICAL_KEYWORDS if kw in msg_lower)
                    regional_kws = [
                        # Hindi
                        'bukhar', 'dard', 'zukaam', 'jukham', 'khansi', 'pait', 'pet', 'dawa', 'dawai', 'sar', 'sardard',
                        'ultila', 'ulti', 'kamzori', 'thakan', 'chot', 'khoon', 'aspatal', 'aspataal', 'vaidya',
                        # Kannada
                        'novu', 'tale', 'jvara', 'jwara', 'kemmu', 'hotte', 'tala', 'roga', 'arogya', 'oushadha', 'maddu',
                        'doctorge', 'hospitalge', 'doctarige', 'aushadha', 'talabyatha', 'tale novu', 'hotte novu',
                        # Malayalam
                        'vedana', 'pani', 'chumi', 'vayaru', 'vayar', 'thala', 'rogam', 'asugham', 'sukham', 'raktham',
                        'mootram', 'marunnu', 'marunu', 'aasupathri', 'thalavedana', 'vayarinu', 'shwasam', 'shevasam',
                        # Tamil
                        'vali', 'kaachal', 'irumal', 'vayanru', 'vayiru', 'thalai', 'noy', 'marundhu', 'raththam',
                        'moochu', 'thalaivali', 'vayiressu', 'aaspathiri', 'udambu', 'sali',
                        # Telugu
                        'noppi', 'jwaram', 'daggara', 'dagu', 'pottu', 'thala', 'roham', 'jabbulu', 'raktham', 'marundu',
                        'thalanoppi', 'vontinoppi', 'ashupathri', 'moola'
                    ]
                    has_regional = any(k in msg_lower for k in regional_kws)
                    if non_med_matches > med_matches and med_matches == 0 and not has_regional:
                        is_med = False

            if not is_med:
                non_medical_text = self.get_non_medical_response(language)
                lines = non_medical_text.split('\n')
                for idx, line in enumerate(lines):
                    if line.strip():
                        words = line.split()
                        for w_idx, word in enumerate(words):
                            yield word + (' ' if w_idx < len(words) - 1 else '')
                    if idx < len(lines) - 1:
                        yield '\n'
                return

            severity = classify_severity(message)

            if severity == "critical":
                emergency_text = self.get_critical_emergency_response(language, use_romanized=use_romanized)
                lines = emergency_text.split('\n')
                for idx, line in enumerate(lines):
                    if line.strip():
                        words = line.split()
                        for w_idx, word in enumerate(words):
                            yield word + (' ' if w_idx < len(words) - 1 else '')
                    if idx < len(lines) - 1:
                        yield '\n'
                return

            if severity == "serious":
                serious_text = self.get_serious_medical_response(language)
                lines = serious_text.split('\n')
                for idx, line in enumerate(lines):
                    if line.strip():
                        words = line.split()
                        for w_idx, word in enumerate(words):
                            yield word + (' ' if w_idx < len(words) - 1 else '')
                    if idx < len(lines) - 1:
                        yield '\n'
                yield "\n\n---\n\nGENERAL INFORMATION:\n"

            system_prompt = self.build_enhanced_system_prompt(language, elaborate, severity, use_romanized=use_romanized, is_voice=is_voice)

            last_error = None
            for provider_name in self.priority_order:
                provider = self.providers[provider_name]
                if not provider.available:
                    continue

                try:
                    logger.info(f"⚡ Querying {provider_name}: {message[:60]}...")
                    start_time = time.time()

                    temperature = 0.3 if severity in ["critical", "serious"] else 0.4
                    # Voice responses should be shorter (spoken-friendly), so cap tokens lower
                    max_tokens = 800 if elaborate else (350 if is_voice else 500)

                    response_generator = provider.generate_response(
                        system_prompt=system_prompt,
                        user_message=message,
                        history=history,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        top_p=0.9,
                        stream=True
                    )

                    full_response = ""
                    word_buffer = ""
                    for chunk in response_generator:
                        full_response += chunk
                        
                        if use_romanized:
                            for char in chunk:
                                if char.isspace() or char in '.,;:!?()[]{}<>-"\'':
                                    if word_buffer:
                                        yield transliterate_text(word_buffer, language)
                                        word_buffer = ""
                                    yield char
                                else:
                                    word_buffer += char
                        else:
                            yield chunk

                    if use_romanized and word_buffer:
                        yield transliterate_text(word_buffer, language)

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
                        f"EMERGENCY ALERT: {keyword.title()} detected. "
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
        report.append("EMERGENCY ALERT")
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
        report.append("This is NOT a diagnosis. Consult a doctor for accurate diagnosis.")
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

    # Multi-language and script emergency trigger override
    if any(keyword in message_lower for keyword in CRITICAL_EMERGENCY_KEYWORDS):
        return 'critical'

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
            'English': """CRITICAL MEDICAL EMERGENCY DETECTED!

IMMEDIATE ACTION REQUIRED:

1. CALL EMERGENCY SERVICES NOW: 108 / 102
2. If someone is with you, have them call while you follow these steps
3. Do NOT wait - this requires immediate medical attention
4. Go to the nearest emergency room immediately
5. Do NOT drive yourself - call an ambulance

This is a life-threatening emergency. Professional medical help is needed RIGHT NOW.""",

            'Hindi': """गंभीर चिकित्सा आपात स्थिति!

तत्काल कार्रवाई आवश्यक:

1. अभी आपातकालीन सेवाओं को कॉल करें: 108 / 102
2. यदि कोई साथ है, तो उन्हें कॉल करने दें
3. प्रतीक्षा न करें - तत्काल चिकित्सा ध्यान चाहिए
4. निकटतम आपातकालीन कक्ष में तुरंत जाएं
5. स्वयं ड्राइव न करें - एम्बुलेंस बुलाएं

यह जानलेवा आपात स्थिति है। पेशेवर चिकित्सा सहायता अभी चाहिए।"""
        },
        
        'urgent': {
            'English': """URGENT MEDICAL ATTENTION NEEDED

Your symptoms require prompt medical evaluation.

RECOMMENDED ACTIONS:
- Seek medical care within 24 hours
- Visit your nearest hospital or clinic
- If symptoms worsen rapidly, call 108/102 immediately
- Do not delay in getting professional medical help
- Monitor your symptoms closely

While not immediately life-threatening, this requires professional medical evaluation soon.""",

            'Hindi': """तत्काल चिकित्सा ध्यान आवश्यक

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

    # 2. Explicit selected language (including English)
    if user_selected_language:
        logger.info(f'[get_response_language] User selected: {user_selected_language}')
        return user_selected_language

    # 3. Auto detect
    try:
        native = detect_language(user_message)
        if native:
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
    # detect_language is defined earlier in this same helpers.py file
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
    
    # Voice Transliteration
    'convert_romanized_to_native',
]

def convert_romanized_to_native(text: str, language: str) -> str:
    """
    Translates Romanized regional text (Hinglish/Kanglish etc.) to clean native script.
    Used for crystal clear Text-to-Speech audio synthesis.
    """
    if language == 'English':
        return text

    try:
        # Check if the text already contains native characters
        native_ranges = [
            ('\u0d00', '\u0d7f'),  # Malayalam
            ('\u0b80', '\u0bff'),  # Tamil
            ('\u0c00', '\u0c7f'),  # Telugu
            ('\u0c80', '\u0cff'),  # Kannada
            ('\u0900', '\u097f'),  # Hindi
        ]
        has_native = False
        for start, end in native_ranges:
            if any(start <= char <= end for char in text):
                has_native = True
                break
                
        if has_native:
            # Already has native script, no translation needed
            return text

        # Convert using the fast AI provider
        chatbot = get_chatbot()
        if not chatbot or not chatbot.priority_order:
            return text
            
        provider_name = chatbot.priority_order[0]
        provider = chatbot.providers.get(provider_name)
        if not provider:
            return text
            
        system_prompt = (
            f"You are a translation assistant. Convert the given Romanized {language} text "
            f"into clean, grammatically correct native {language} script. Keep core English medical terms "
            f"like doctor, fever, symptoms, hospital, tablet in English or transliterate them to native script "
            f"phonetically. Do not add any introductory or concluding text, explanations, or notes. "
            f"Output ONLY the translated native script."
        )
        
        response_generator = provider.generate_response(
            system_prompt=system_prompt,
            user_message=text,
            temperature=0.1,
            max_tokens=2048,
            stream=False
        )
        
        translated_text = "".join(list(response_generator)).strip()
        if translated_text:
            logger.info(f"[convert_romanized_to_native] Translated '{text[:40]}' to native script: '{translated_text[:40]}'")
            return translated_text
            
    except Exception as e:
        logger.warning(f"Error converting Romanized text to native script: {e}")
        
    return text

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

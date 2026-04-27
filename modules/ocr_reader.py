import os
import re
from dotenv import load_dotenv

load_dotenv()

# ── Google Cloud Vision (primary) ─────────────────────────────────────────────
VISION_AVAILABLE = False
vision_client = None
try:
    from google.cloud import vision as gcloud_vision
    _key_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'vertex_key.json')
    if os.path.exists(_key_path):
        os.environ.setdefault('GOOGLE_APPLICATION_CREDENTIALS', _key_path)
    vision_client = gcloud_vision.ImageAnnotatorClient()
    VISION_AVAILABLE = True
    print("✅ Google Cloud Vision client initialized")
except Exception as e:
    print(f"❌ Google Cloud Vision unavailable: {e}")

# ── Gemini Vision (fallback) ───────────────────────────────────────────────────
GEMINI_AVAILABLE = False
gemini_client = None
GEMINI_MODEL = os.environ.get("VERTEX_MODEL", "gemini-2.5-flash-lite")
try:
    from google import genai as google_genai
    from google.genai import types as genai_types
    _api_key = os.environ.get("VERTEX_AI_API_KEY")
    if not _api_key:
        raise ValueError("VERTEX_AI_API_KEY not set")
    gemini_client = google_genai.Client(api_key=_api_key)
    GEMINI_AVAILABLE = True
    print(f"✅ Gemini Vision fallback initialized: {GEMINI_MODEL}")
except Exception as e:
    print(f"❌ Gemini Vision unavailable: {e}")


def _get_mime_type(image_path: str) -> str:
    ext = os.path.splitext(image_path)[1].lower()
    return {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.bmp': 'image/bmp',
            '.webp': 'image/webp'}.get(ext, 'image/jpeg')


def _extract_via_cloud_vision(image_path: str) -> str:
    """Use Google Cloud Vision document_text_detection — best for structured medical tables."""
    try:
        with open(image_path, 'rb') as f:
            content = f.read()
        image = gcloud_vision.Image(content=content)
        response = vision_client.document_text_detection(image=image)
        if response.error.message:
            print(f"❌ Cloud Vision error: {response.error.message}")
            return ""
        text = response.full_text_annotation.text
        print(f"✅ Cloud Vision extracted {len(text)} chars")
        return text.strip()
    except Exception as e:
        print(f"❌ Cloud Vision exception: {e}")
        return ""


def _extract_via_gemini(image_path: str) -> str:
    """Use Gemini Vision as fallback — single call, no preprocessing loop."""
    try:
        from google.genai import types as genai_types
        with open(image_path, 'rb') as f:
            image_data = f.read()
        mime_type = _get_mime_type(image_path)
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                genai_types.Part.from_bytes(data=image_data, mime_type=mime_type),
                "Extract all text from this medical report image exactly as it appears. "
                "Include all test names, values, units, reference ranges, patient details, "
                "dates, and lab information. Preserve the structure and layout. "
                "Provide only the raw extracted text, no commentary."
            ],
            config=genai_types.GenerateContentConfig(temperature=0.1, max_output_tokens=4096)
        )
        text = response.text.strip()
        print(f"✅ Gemini Vision extracted {len(text)} chars")
        return text
    except Exception as e:
        print(f"❌ Gemini Vision exception: {e}")
        return ""


def extract_text_from_image(image_path: str) -> str:
    """
    Primary: Google Cloud Vision document_text_detection (accurate, fast, no hallucination).
    Fallback: Gemini Vision (single call only).
    """
    if VISION_AVAILABLE:
        print("🔍 Using Google Cloud Vision OCR...")
        text = _extract_via_cloud_vision(image_path)
        if text and len(text) > 20:
            return text
        print("⚠️  Cloud Vision returned little text, trying Gemini fallback...")

    if GEMINI_AVAILABLE:
        print("🔍 Using Gemini Vision OCR (fallback)...")
        return _extract_via_gemini(image_path)

    print("❌ No OCR backend available")
    return ""


# Legacy aliases kept for backward compatibility
def preprocess_image(image_path: str):
    pass

def preprocess_image_basic(image_path: str):
    pass

def preprocess_image_enhanced(image_path: str):
    return []

def extract_text_from_image_enhanced(image_path: str) -> str:
    return extract_text_from_image(image_path)

def extract_text_from_image_vertex_vision(image_path: str) -> str:
    return extract_text_from_image(image_path)

def validate_medical_text(text: str) -> float:
    if not text or len(text.strip()) < 10:
        return 0.0
    patterns = [
        r'\d+\.?\d*\s*(mg/dL|µg/dL|g/dL|mmol/L|IU/L|U/L|pg/mL|ng/mL)',
        r'(hemoglobin|glucose|cholesterol|triglycerides|hdl|ldl|creatinine)',
        r'(normal|high|low|range|reference)',
        r'\d+\s*-\s*\d+',
    ]
    score = sum(min(len(re.findall(p, text, re.IGNORECASE)) * 0.2, 1.0) for p in patterns)
    return min(score, 1.0)

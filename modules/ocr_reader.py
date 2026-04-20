import cv2
import numpy as np
import os
import re
from typing import List
from PIL import Image
from dotenv import load_dotenv
import base64

# Load environment variables
load_dotenv()

# Google Gemini via API key
try:
    from google import genai as google_genai
    from google.genai import types as genai_types

    VERTEX_MODEL_NAME = os.environ.get("VERTEX_MODEL", "gemini-2.5-flash-lite")
    _api_key = os.environ.get("VERTEX_AI_API_KEY")
    if not _api_key:
        raise ValueError("VERTEX_AI_API_KEY not set")
    vision_client = google_genai.Client(api_key=_api_key)
    VERTEX_AI_AVAILABLE = True
    print(f"✅ Vision client initialized: model={VERTEX_MODEL_NAME}")
except Exception as e:
    VERTEX_AI_AVAILABLE = False
    vision_client = None
    VERTEX_MODEL_NAME = None
    print(f"❌ Vision client initialization failed: {e}")


def preprocess_image_basic(image_path: str) -> np.ndarray:
    """Basic preprocessing for OCR."""
    image = cv2.imread(image_path)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )
    return thresh


def preprocess_image_enhanced(image_path: str) -> List[np.ndarray]:
    """Enhanced preprocessing with multiple techniques optimized for tabular medical reports."""
    image = cv2.imread(image_path)
    preprocessed_images = []

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 1. Basic bilateral filter + adaptive threshold
    blur = cv2.bilateralFilter(gray, 9, 75, 75)
    thresh1 = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )
    preprocessed_images.append(thresh1)

    # 2. Gaussian blur + Otsu threshold
    gaussian = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh2 = cv2.threshold(gaussian, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    preprocessed_images.append(thresh2)

    # 3. Median blur + CLAHE enhancement
    median = cv2.medianBlur(gray, 3)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(median)
    _, thresh3 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    preprocessed_images.append(thresh3)

    # 4. Morphological operations for table structure preservation
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    morph = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel)
    morph = cv2.morphologyEx(morph, cv2.MORPH_OPEN, kernel)
    _, thresh4 = cv2.threshold(morph, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    preprocessed_images.append(thresh4)

    # 5. High contrast for grid lines and text
    high_contrast = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)
    _, thresh5 = cv2.threshold(high_contrast, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    preprocessed_images.append(thresh5)

    # 6. Resize for better OCR on small fonts
    resized_images = []
    for img in preprocessed_images:
        h, w = img.shape
        if w < 1200:
            scale_factor = max(1, int(1200 / w))
            resized = cv2.resize(img, (w * scale_factor, h * scale_factor), interpolation=cv2.INTER_CUBIC)
            resized_images.append(resized)
        else:
            resized_images.append(img)

    return resized_images


def validate_medical_text(text: str) -> float:
    """Validate if extracted text looks like medical data."""
    if not text or len(text.strip()) < 10:
        return 0.0

    medical_indicators = [
        r'\d+\.?\d*\s*(mg/dL|µg/dL|g/dL|mmol/L|IU/L|U/L|pg/mL|ng/mL)',
        r'(hemoglobin|glucose|cholesterol|triglycerides|hdl|ldl|creatinine|bun|alt|ast)',
        r'(normal|high|low|range|reference)',
        r'\d+\s*-\s*\d+',
        r'\d{1,3}\.\d{1,2}',
    ]

    score = 0.0
    for pattern in medical_indicators:
        matches = len(re.findall(pattern, text, re.IGNORECASE))
        if matches > 0:
            score += min(matches * 0.2, 1.0)

    test_count = len(re.findall(
        r'(hemoglobin|glucose|cholesterol|triglycerides|hdl|ldl|creatinine)',
        text, re.IGNORECASE
    ))
    if test_count >= 2:
        score += 0.5

    return min(score, 1.0)


def _get_image_mime_type(image_path: str) -> str:
    """Determine MIME type from file extension."""
    ext = os.path.splitext(image_path)[1].lower()
    return {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
    }.get(ext, 'image/jpeg')


def extract_text_from_image_vertex_vision(image_path: str) -> str:
    """Extract text from image using Gemini Vision via API key."""
    if not VERTEX_AI_AVAILABLE or vision_client is None:
        print("❌ Vision client not available")
        return ""

    try:
        print("🔍 Starting Gemini Vision text detection...")

        with open(image_path, "rb") as f:
            image_data = f.read()

        mime_type = _get_image_mime_type(image_path)

        response = vision_client.models.generate_content(
            model=VERTEX_MODEL_NAME,
            contents=[
                genai_types.Part.from_bytes(data=image_data, mime_type=mime_type),
                "Extract all text from this medical report image exactly as it appears. "
                "Include all test names, values, units, reference ranges, patient details, "
                "dates, and lab information. Preserve the structure and layout as much as possible. "
                "Provide only the raw extracted text, no commentary."
            ],
            config=genai_types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=4096,
            )
        )

        extracted_text = response.text.strip()

        if extracted_text:
            medical_score = validate_medical_text(extracted_text)
            print(f"✅ Vertex AI Vision extraction successful")
            print(f"   Text length: {len(extracted_text)} chars, Medical Score: {medical_score:.2f}")
            return extracted_text
        else:
            print("❌ Vertex AI Vision returned empty text")
            return ""

    except Exception as e:
        print(f"Error in Vertex AI Vision processing: {e}")
        return ""


def extract_text_from_image_enhanced(image_path: str) -> str:
    """Extract text using Vertex AI Vision with preprocessing fallback."""
    if not VERTEX_AI_AVAILABLE:
        return "OCR_UNAVAILABLE: Vertex AI not configured. Check GCP_PROJECT_ID."

    try:
        print("🖼️  Starting Vertex AI Vision processing...")

        # Try direct OCR first — Vision models work best on original images
        print("🔍 Testing direct Vertex AI Vision...")
        direct_text = extract_text_from_image_vertex_vision(image_path)

        if direct_text and len(direct_text) > 50:
            medical_score = validate_medical_text(direct_text)
            print(f"🏆 Direct OCR result: {len(direct_text)} chars, score {medical_score:.2f}")
            return direct_text

        # If direct OCR didn't yield enough, try with OpenCV preprocessing
        print("🔄 Direct OCR insufficient, trying preprocessing...")
        preprocessed_images = preprocess_image_enhanced(image_path)
        print(f"📸 Generated {len(preprocessed_images)} preprocessed images")

        best_result = {
            'text': direct_text or "",
            'medical_score': validate_medical_text(direct_text) if direct_text else 0.0
        }

        for i, preprocessed in enumerate(preprocessed_images):
            print(f"🔍 Testing preprocessing {i+1}...")
            temp_path = f"temp_preprocessed_{i}.png"
            cv2.imwrite(temp_path, preprocessed)

            text = extract_text_from_image_vertex_vision(temp_path)

            if os.path.exists(temp_path):
                os.remove(temp_path)

            if text and len(text) > len(best_result['text']):
                medical_score = validate_medical_text(text)
                best_result = {'text': text, 'medical_score': medical_score}
                print(f"   ✅ Better result: {len(text)} chars, score {medical_score:.2f}")

        print(f"🏆 Best result: {len(best_result['text'])} chars, score {best_result['medical_score']:.2f}")
        return best_result['text']

    except Exception as e:
        print(f"Error in Vertex AI Vision processing: {e}")
        return ""


def extract_text_from_image(image_path: str) -> str:
    """Main OCR function — uses Vertex AI Gemini Vision."""
    try:
        print("🚀 Using Vertex AI Vision for OCR...")
        text = extract_text_from_image_enhanced(image_path)
        if text:
            print("✅ Vertex AI Vision OCR complete")
            return text

        print("❌ Vertex AI Vision failed to extract text")
        return ""

    except Exception as e:
        print(f"Error in main OCR function: {e}")
        return ""


# Legacy function for backward compatibility
def preprocess_image(image_path: str) -> np.ndarray:
    """Legacy preprocessing function."""
    return preprocess_image_basic(image_path)

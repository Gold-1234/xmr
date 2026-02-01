import cv2
import numpy as np
import os
import re
from typing import List, Tuple, Dict
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Google Cloud Vision imports
try:
    from google.cloud import vision
    from google.oauth2 import service_account
    GOOGLE_VISION_AVAILABLE = True
    print("✅ Google Cloud Vision imported successfully")
except ImportError:
    GOOGLE_VISION_AVAILABLE = False
    print("❌ Google Cloud Vision not available - install with: pip install google-cloud-vision")

# Initialize Google Cloud Vision client
google_vision_client = None
if GOOGLE_VISION_AVAILABLE:
    try:
        google_credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if google_credentials_path and os.path.exists(google_credentials_path):
            credentials = service_account.Credentials.from_service_account_file(google_credentials_path)
            google_vision_client = vision.ImageAnnotatorClient(credentials=credentials)
            print("✅ Google Cloud Vision client initialized with service account")
        else:
            GOOGLE_VISION_AVAILABLE = False
            print("❌ GOOGLE_APPLICATION_CREDENTIALS not set or file not found")
    except Exception as e:
        GOOGLE_VISION_AVAILABLE = False
        print(f"❌ Google Cloud Vision client initialization failed: {e}")

def preprocess_image_basic(image_path: str) -> np.ndarray:
    """Basic preprocessing for OCR."""
    image = cv2.imread(image_path)

    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Remove noise
    gray = cv2.bilateralFilter(gray, 9, 75, 75)

    # Adaptive threshold for better contrast
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )

    return thresh

def preprocess_image_enhanced(image_path: str) -> List[np.ndarray]:
    """Enhanced preprocessing with multiple techniques optimized for tabular medical reports."""
    image = cv2.imread(image_path)
    preprocessed_images = []

    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 1. Basic bilateral filter + adaptive threshold (good for clean tables)
    blur = cv2.bilateralFilter(gray, 9, 75, 75)
    thresh1 = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )
    preprocessed_images.append(thresh1)

    # 2. Gaussian blur + Otsu threshold (handles varying contrast)
    gaussian = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh2 = cv2.threshold(gaussian, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    preprocessed_images.append(thresh2)

    # 3. Median blur + CLAHE enhancement (improves local contrast in tables)
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

    # 5. Table-specific: High contrast for grid lines and text
    high_contrast = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)
    _, thresh5 = cv2.threshold(high_contrast, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    preprocessed_images.append(thresh5)

    # 6. Resize all images for better OCR (helps with small fonts in tables)
    resized_images = []
    for img in preprocessed_images:
        h, w = img.shape
        # Only resize if image is small (common for mobile/tablet scans)
        if w < 1200:  # Higher threshold for table detail preservation
            scale_factor = max(1, int(1200 / w))
            new_w = w * scale_factor
            new_h = h * scale_factor
            resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
            resized_images.append(resized)
        else:
            resized_images.append(img)

    return resized_images





def validate_medical_text(text: str) -> float:
    """Validate if extracted text looks like medical data."""
    if not text or len(text.strip()) < 10:
        return 0.0

    # Medical keywords and patterns
    medical_indicators = [
        r'\d+\.?\d*\s*(mg/dL|µg/dL|g/dL|mmol/L|IU/L|U/L|pg/mL|ng/mL)',
        r'(hemoglobin|glucose|cholesterol|triglycerides|hdl|ldl|creatinine|bun|alt|ast)',
        r'(normal|high|low|range|reference)',
        r'\d+\s*-\s*\d+',  # Number ranges
        r'\d{1,3}\.\d{1,2}',  # Decimal numbers
    ]

    score = 0.0
    for pattern in medical_indicators:
        matches = len(re.findall(pattern, text, re.IGNORECASE))
        if matches > 0:
            score += min(matches * 0.2, 1.0)  # Cap at 1.0 per pattern

    # Bonus for having multiple test names
    test_count = len(re.findall(r'(hemoglobin|glucose|cholesterol|triglycerides|hdl|ldl|creatinine)', text, re.IGNORECASE))
    if test_count >= 2:
        score += 0.5

    return min(score, 1.0)  # Cap at 1.0

def extract_text_from_image_google_vision(image_path: str) -> str:
    """Extract text from image using Google Cloud Vision API."""
    if not GOOGLE_VISION_AVAILABLE or google_vision_client is None:
        print("❌ Google Cloud Vision not available")
        return ""

    try:
        print("🔍 Starting Google Cloud Vision text detection...")

        # Read the image file
        with open(image_path, 'rb') as image_file:
            content = image_file.read()

        # Create image object
        image = vision.Image(content=content)

        # Perform text detection
        response = google_vision_client.text_detection(image=image)
        texts = response.text_annotations

        if texts:
            # Extract the full text from the first annotation (contains all text)
            extracted_text = texts[0].description.strip()

            if extracted_text:
                print("✅ Google Cloud Vision extraction successful")
                print(f"   Text length: {len(extracted_text)} chars")

                # Validate that we got meaningful medical text
                medical_score = validate_medical_text(extracted_text)
                print(f"   Medical Score: {medical_score:.2f}")

                return extracted_text
            else:
                print("❌ Google Cloud Vision returned empty text")
                return ""
        else:
            print("❌ No text detected by Google Cloud Vision")
            return ""

    except Exception as e:
        print(f"Error in Google Cloud Vision processing: {e}")
        return ""

def extract_text_from_image_enhanced(image_path: str) -> str:
    """Extract text using Google Cloud Vision with preprocessing optimizations for medical reports."""
    if not GOOGLE_VISION_AVAILABLE:
        return "OCR_UNAVAILABLE: Google Cloud Vision not configured. Check GOOGLE_APPLICATION_CREDENTIALS"

    try:
        print("🖼️  Starting Google Cloud Vision processing...")

        # Try direct OCR first (Google Cloud Vision often works best on original images)
        print("🔍 Testing direct Google Cloud Vision...")
        direct_text = extract_text_from_image_google_vision(image_path)

        if direct_text and len(direct_text) > 50:  # If direct OCR gives substantial text
            medical_score = validate_medical_text(direct_text)
            print("🏆 Direct OCR result:")
            print(f"   Medical Score: {medical_score:.2f}")
            print(f"   Text length: {len(direct_text)} chars")
            return direct_text

        # If direct OCR didn't work well, try with preprocessing
        print("🔄 Direct OCR insufficient, trying preprocessing...")

        preprocessed_images = preprocess_image_enhanced(image_path)
        print(f"📸 Generated {len(preprocessed_images)} preprocessed images")

        best_result = {
            'text': direct_text,
            'medical_score': validate_medical_text(direct_text) if direct_text else 0.0
        }

        # Test preprocessing variations
        for i, preprocessed in enumerate(preprocessed_images):
            print(f"🔍 Testing preprocessing {i+1}...")

            # Save preprocessed image temporarily
            temp_path = f"temp_preprocessed_{i}.png"
            cv2.imwrite(temp_path, preprocessed)

            # Run Google Cloud Vision on preprocessed image
            text = extract_text_from_image_google_vision(temp_path)

            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

            if text and len(text) > len(best_result['text']):
                medical_score = validate_medical_text(text)

                best_result = {
                    'text': text,
                    'medical_score': medical_score,
                    'preprocessing': i
                }

                print(f"   ✅ Better result: {len(text)} chars, medical score {medical_score:.2f}")

        print("🏆 Best result:")
        print(f"   Medical Score: {best_result.get('medical_score', 0.0):.2f}")
        print(f"   Text length: {len(best_result['text'])} chars")

        return best_result['text']

    except Exception as e:
        print(f"Error in Google Cloud Vision processing: {e}")
        return ""

def extract_text_from_image(image_path: str) -> str:
    """Main OCR function - uses Google Cloud Vision exclusively."""
    try:
        print("🚀 Using Google Cloud Vision for OCR...")
        text = extract_text_from_image_enhanced(image_path)
        if text:
            print("✅ Using Google Cloud Vision result")
            return text

        # If Google Cloud Vision fails, return empty string
        print("❌ Google Cloud Vision failed to extract text")
        return ""

    except Exception as e:
        print(f"Error in main OCR function: {e}")
        return ""

# Legacy function for backward compatibility
def preprocess_image(image_path: str) -> np.ndarray:
    """Legacy preprocessing function."""
    return preprocess_image_basic(image_path)

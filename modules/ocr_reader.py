import pytesseract
from PIL import Image
import cv2
import numpy as np
import os

# Check if Tesseract is available
TESSERACT_AVAILABLE = False
try:
    # Try to get tesseract version to check if it's installed
    pytesseract.get_tesseract_version()
    TESSERACT_AVAILABLE = True
except Exception:
    TESSERACT_AVAILABLE = False
    print("Tesseract OCR not available - OCR functionality disabled")

# If using Windows, set this to your Tesseract installation path
# Example: r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def preprocess_image(image_path):
    """Preprocess image for better OCR accuracy."""
    image = cv2.imread(image_path)

    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Remove noise
    gray = cv2.bilateralFilter(gray, 9, 75, 75)

    # Adaptive threshold for better contrast
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 2
    )

    # Resize (helps Tesseract on small fonts)
    h, w = thresh.shape
    thresh = cv2.resize(thresh, (w * 2, h * 2))

    return thresh

def extract_text_from_image(image_path):
    """Extract text from an image using improved OCR preprocessing."""
    if not TESSERACT_AVAILABLE:
        print("Tesseract OCR not available - cannot process images")
        return "OCR_UNAVAILABLE: Tesseract is not installed on this system. Please upload text files instead of images."

    try:
        preprocessed = preprocess_image(image_path)

        # Convert to PIL format
        pil_img = Image.fromarray(preprocessed)

        # OCR config: improves recognition
        custom_config = r'--oem 3 --psm 6'

        text = pytesseract.image_to_string(pil_img, config=custom_config)
        return text.strip()

    except Exception as e:
        print("Error extracting text from image:", e)
        return ""

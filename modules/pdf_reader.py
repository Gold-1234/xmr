import pdfplumber
import fitz  # PyMuPDF
import os
import tempfile
from modules.ocr_reader import extract_text_from_image
import cv2
import numpy as np
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from google import genai as google_genai
from google.genai import types as genai_types

# Load environment variables
load_dotenv()

# Configure Gemini client via API key
try:
    VERTEX_MODEL_NAME = os.environ.get("VERTEX_MODEL", "gemini-2.5-flash-lite")
    _api_key = os.environ.get("VERTEX_AI_API_KEY")
    if not _api_key:
        raise ValueError("VERTEX_AI_API_KEY not set")
    pdf_llm_client = google_genai.Client(api_key=_api_key)
    VERTEX_AI_AVAILABLE = True
    print(f"✅ pdf_reader client initialized: model={VERTEX_MODEL_NAME}")
except Exception as e:
    pdf_llm_client = None
    VERTEX_AI_AVAILABLE = False
    print(f"❌ pdf_reader client initialization failed: {e}")


def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file, including OCR for image-based PDFs."""
    text = ""

    try:
        # Try pdfplumber first for text-based PDFs
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                    print("📄 Extracted text from text-based PDF page")
    except Exception as e:
        print(f"pdfplumber error: {e}")

    # If no text found or limited text, check for images and run OCR
    if not text.strip() or len(text.strip()) < 100:
        print("🔍 Limited text found, checking for images in PDF...")
        ocr_text = extract_text_from_pdf_images(pdf_path)
        if ocr_text:
            text += "\n" + ocr_text
            print(f"🤖 OCR extracted {len(ocr_text)} characters from PDF images")

    # Final fallback: use PyMuPDF text extraction
    if not text.strip():
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                page_text = page.get_text("text")
                if page_text:
                    text += page_text + "\n"
            doc.close()
        except Exception as e:
            print(f"PyMuPDF text extraction error: {e}")

    return text.strip()


def extract_text_from_pdf_images(pdf_path):
    """Extract text from images within a PDF using OCR."""
    ocr_text = ""

    try:
        doc = fitz.open(pdf_path)
        print(f"📖 Processing PDF with {len(doc)} pages")

        for page_num, page in enumerate(doc):
            print(f"📄 Processing page {page_num + 1}")

            # Get images from the page
            image_list = page.get_images(full=True)
            print(f"🖼️ Found {len(image_list)} images on page {page_num + 1}")

            if not image_list:
                # If no images, try to extract text from the page itself
                page_text = page.get_text("text")
                if page_text:
                    ocr_text += page_text + "\n"
                    print(f"📝 Extracted text from page {page_num + 1}")
                continue

            # Process each image on the page
            for img_index, img in enumerate(image_list):
                try:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]

                    # Save image temporarily
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_file:
                        temp_file.write(image_bytes)
                        temp_image_path = temp_file.name

                    try:
                        # Run OCR on the extracted image (now uses OpenAI Vision)
                        image_text = extract_text_from_image(temp_image_path)
                        if image_text:
                            ocr_text += image_text + "\n"
                            print(f"✅ OCR successful on page {page_num + 1}, image {img_index + 1} ({len(image_text)} chars)")
                        else:
                            print(f"❌ No text found in page {page_num + 1}, image {img_index + 1}")

                    finally:
                        # Clean up temp file
                        if os.path.exists(temp_image_path):
                            os.unlink(temp_image_path)

                except Exception as e:
                    print(f"❌ Error processing image {img_index + 1} on page {page_num + 1}: {e}")
                    continue

        doc.close()

    except Exception as e:
        print(f"❌ Error in PDF image extraction: {e}")

    return ocr_text.strip()


def pdf_contains_images(pdf_path):
    """Check if a PDF contains images."""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            if page.get_images(full=True):
                doc.close()
                return True
        doc.close()
        return False
    except Exception as e:
        print(f"Error checking PDF for images: {e}")
        return False


def _extract_page_text(args):
    """Extract text from a single PDF page (runs in thread pool)."""
    pdf_path, page_num = args
    doc = fitz.open(pdf_path)
    page = doc.load_page(page_num)
    page_text = page.get_text("text")

    if not page_text.strip() or len(page_text.strip()) < 50:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_data = pix.tobytes("png")
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(img_data)
            tmp_path = tmp.name
        try:
            ocr_text = extract_text_from_image(tmp_path)
            if ocr_text:
                page_text += "\n" + ocr_text
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    doc.close()
    return page_num, page_text.strip()


def process_pdf_pages_with_llm(pdf_path):
    """Process PDF pages in parallel — extract text concurrently, then analyze concurrently."""
    try:
        doc = fitz.open(pdf_path)
        num_pages = len(doc)
        doc.close()
        print(f"📖 Processing PDF with {num_pages} pages in parallel")

        # Step 1: Extract text from all pages concurrently
        page_texts = {}
        with ThreadPoolExecutor(max_workers=min(num_pages, 4)) as executor:
            futures = {executor.submit(_extract_page_text, (pdf_path, i)): i for i in range(num_pages)}
            for future in as_completed(futures):
                page_num, text = future.result()
                if text:
                    page_texts[page_num] = text
                    print(f"✅ Text extracted from page {page_num + 1} ({len(text)} chars)")

        # Step 2: Analyze all pages concurrently via LLM
        all_pages_data = [None] * num_pages
        pages_with_text = [(pn, pt) for pn, pt in page_texts.items()]

        with ThreadPoolExecutor(max_workers=min(len(pages_with_text), 4)) as executor:
            futures = {
                executor.submit(analyze_pdf_page_with_llm, text, pn + 1): pn
                for pn, text in pages_with_text
            }
            for future in as_completed(futures):
                page_num = futures[future]
                page_data = future.result()
                if page_data:
                    all_pages_data[page_num] = page_data
                    print(f"✅ Page {page_num + 1} analyzed")

        all_pages_data = [p for p in all_pages_data if p is not None]

        # Combine all page data
        combined_result = {
            "patient_name": None,
            "age": None,
            "pages": all_pages_data
        }

        # Extract patient info from first page if available
        if all_pages_data and len(all_pages_data) > 0:
            first_page = all_pages_data[0]
            if 'patient_name' in first_page:
                combined_result["patient_name"] = first_page["patient_name"]
            if 'age' in first_page:
                combined_result["age"] = first_page["age"]

        print(f"🏁 PDF processing complete: {len(all_pages_data)} pages analyzed")
        return combined_result

    except Exception as e:
        print(f"❌ Error in page-by-page PDF processing: {e}")
        return None


def analyze_pdf_page_with_llm(page_text, page_number):
    """Send individual PDF page text to Vertex AI Gemini for page-specific analysis."""
    if not VERTEX_AI_AVAILABLE or pdf_llm_client is None:
        print(f"❌ Vertex AI not available for page {page_number} analysis")
        return None

    try:
        page_prompt = f"""You are a Medical Document Analyzer. Analyze this single page from a medical report.

PAGE {page_number} TEXT:
{page_text}

Extract the following information from this specific page:
1. If this is the first page, extract patient_name and age if present
2. Extract the date from this page (YYYY-MM-DD format)
3. Extract all medical test results found on this page

Return ONLY valid JSON with this exact structure:
{{
  "page_number": {page_number},
  "date": "YYYY-MM-DD or null",
  "patient_name": "Patient Name or null",
  "age": numeric_age_or_null,
  "tests": [
    {{
      "name": "Test Name",
      "value": "test value",
      "unit": "unit or null",
      "is_abnormal": true/false or null
    }}
  ]
}}

Rules:
- Output ONLY JSON, no markdown
- Parse numbers as floats/decimals
- Use null for missing values
- Extract date in YYYY-MM-DD format only
- Only include tests that appear on this specific page"""

        response = pdf_llm_client.models.generate_content(
            model=VERTEX_MODEL_NAME,
            contents=page_prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=1000,
            )
        )

        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        page_data = json.loads(response_text)
        page_data["page_number"] = page_number

        print(f"📊 Page {page_number} LLM analysis complete (Vertex AI)")
        return page_data

    except Exception as e:
        print(f"❌ Error analyzing page {page_number} with Vertex AI: {e}")
        return None

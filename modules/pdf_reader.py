import pdfplumber
import fitz  # PyMuPDF
import os
import tempfile
from modules.ocr_reader import extract_text_from_image
import cv2
import numpy as np
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
gemini_model = genai.GenerativeModel('gemini-2.5-flash-lite')


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
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                        temp_file.write(image_bytes)
                        temp_image_path = temp_file.name

                    try:
                        # Run OCR on the extracted image
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


def process_pdf_pages_with_llm(pdf_path):
    """Process each PDF page individually and send to LLM for page-specific analysis."""
    try:
        doc = fitz.open(pdf_path)
        print(f"📖 Processing PDF with {len(doc)} pages individually")

        all_pages_data = []

        for page_num in range(len(doc)):
            print(f"📄 Processing page {page_num + 1}")

            # Extract text from this specific page
            page = doc.load_page(page_num)

            # Try text extraction first
            page_text = page.get_text("text")

            # If limited text, check for images and OCR
            if not page_text.strip() or len(page_text.strip()) < 50:
                print(f"🔍 Limited text on page {page_num + 1}, checking for images...")
                # Convert page to image for OCR
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scaling for better OCR
                img_data = pix.tobytes("png")

                # Save image temporarily for OCR
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                    temp_file.write(img_data)
                    temp_image_path = temp_file.name

                try:
                    # Run OCR on the page image
                    from modules.ocr_reader import extract_text_from_image
                    ocr_text = extract_text_from_image(temp_image_path)
                    if ocr_text:
                        page_text += "\n" + ocr_text
                        print(f"🤖 OCR extracted {len(ocr_text)} chars from page {page_num + 1}")
                finally:
                    # Clean up temp file
                    if os.path.exists(temp_image_path):
                        os.unlink(temp_image_path)

            if page_text.strip():
                # Send this page's text to LLM for analysis
                page_data = analyze_pdf_page_with_llm(page_text, page_num + 1)
                if page_data:
                    all_pages_data.append(page_data)
                    print(f"✅ Page {page_num + 1} analyzed successfully")
                else:
                    print(f"⚠️ Page {page_num + 1} analysis failed")
            else:
                print(f"⚠️ No text found on page {page_num + 1}")

        doc.close()

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
    """Send individual PDF page text to LLM for page-specific analysis."""
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

        response = gemini_model.generate_content(
            page_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=1000,
            )
        )

        response_text = response.text.strip()

        # Clean JSON
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Parse and validate
        page_data = json.loads(response_text)

        # Ensure page_number is correct
        page_data["page_number"] = page_number

        print(f"📊 Page {page_number} LLM analysis complete")
        return page_data

    except Exception as e:
        print(f"❌ Error analyzing page {page_number} with LLM: {e}")
        return None

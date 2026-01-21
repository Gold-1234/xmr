import pdfplumber
import fitz  # PyMuPDF


def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    text = ""

    try:
        # Try pdfplumber first
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                    print("Inside Plumber")
                    print(text)
    except Exception as e:
        print("pdfplumber error:", e)

    # If no text found, use PyMuPDF as backup
    if not text.strip():
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                text += page.get_text("text") + "\n"
        except Exception as e:
            print("PyMuPDF error:", e)

    return text.strip()

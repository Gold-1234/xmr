import re

def clean_extracted_text(text):
    """Clean up extracted text."""
    text = text.replace('\n', ' ')
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text

from modules.ocr_reader import extract_text_from_image
from modules.pdf_reader import extract_text_from_pdf
from modules.text_cleaner import clean_extracted_text
from modules.analyzer import analyze_report, display_analysis


def analyze_file(file_path):
    """Main orchestrator function."""
    if file_path.lower().endswith(".pdf"):
        file_path = "C:\\Users\\envy\\Downloads\\test report 1.pdf"
        text = extract_text_from_pdf(file_path)
    else:
        text = extract_text_from_image(file_path)

    cleaned_text = clean_extracted_text(text)
    results = analyze_report(cleaned_text)
    return results  

# Flask will call this:
def analyze_report_api(file_path):
    results = analyze_file(file_path)
    
    if not isinstance(results, dict):
        results = {"summary": str(results)}
    return results

if __name__ == "__main__":
    # file_path = input("Enter path to PDF or Image: ").strip()
    file_path = ".pdf"
    

    report_text_content = analyze_file(file_path)
    # Write the report_text_content object into a file in the "outputs" folder

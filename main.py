from modules.ocr_reader import extract_text_from_image
from modules.pdf_reader import extract_text_from_pdf
from modules.text_cleaner import clean_extracted_text
from modules.analyzer import analyze_report_with_date_grouping, display_analysis


def analyze_file(file_path, user_profile=None, fast_mode=False):
    """Main orchestrator function."""
    print(f"🔍 Starting analysis for file: {file_path}")
    print(f"👤 User profile provided: {user_profile is not None}")
    if user_profile:
        print(f"📋 USER PROFILE IN ANALYSIS:")
        print(f"   Name: {user_profile.get('name', 'N/A')}")
        print(f"   Age: {user_profile.get('age', 'N/A')}")
        print(f"   Body Type: {user_profile.get('bodyType', 'N/A')}")
        print(f"   Current Goal: {user_profile.get('currentGoal', 'N/A')}")
        print(f"   Desired Outcome: {user_profile.get('desiredOutcome', 'N/A')}")
        if user_profile.get('previousDiseases'):
            print(f"   Medical History: {user_profile.get('previousDiseases')}")
        print(f"👤 User profile keys: {list(user_profile.keys()) if isinstance(user_profile, dict) else 'Not a dict'}")

    if file_path.lower().endswith(".pdf"):
        text = extract_text_from_pdf(file_path)
    else:
        text = extract_text_from_image(file_path)


    cleaned_text = clean_extracted_text(text)


    results = analyze_report_with_date_grouping(cleaned_text, user_profile, fast_mode)
    return results

# Flask will call this:
def analyze_report_api(file_path, user_profile=None, fast_mode=False):
    results = analyze_file(file_path, user_profile, fast_mode)

    if not isinstance(results, dict):
        results = {"summary": str(results)}
    return results

if __name__ == "__main__":
    # file_path = input("Enter path to PDF or Image: ").strip()
    file_path = ".pdf"
    

    report_text_content = analyze_file(file_path)
    # Write the report_text_content object into a file in the "outputs" folder

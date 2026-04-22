from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import re
import json
import uuid
import hashlib
from datetime import datetime
import base64
from main import analyze_report_api
from dotenv import load_dotenv
from modules.analyzer import extract_dates_from_text_regex
# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Get port from environment or default
port = int(os.environ.get('PORT', 5001))

# Serve uploaded files
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory('uploads', filename)

@app.route('/proxy-image')
def proxy_image():
    """Proxy images from external URLs to avoid CORS issues."""
    image_url = request.args.get('url')
    if not image_url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        # Only allow Cloudinary URLs for security
        if not image_url.startswith('https://res.cloudinary.com/'):
            return jsonify({'error': 'Invalid URL'}), 400

        import requests
        from flask import Response

        response = requests.get(image_url, timeout=10)

        if response.status_code == 200:
            # Create a proper Flask response for binary data
            flask_response = Response(
                response.content,
                status=200,
                mimetype=response.headers.get('content-type', 'image/jpeg')
            )
            flask_response.headers['Cache-Control'] = 'public, max-age=3600'
            flask_response.headers['Access-Control-Allow-Origin'] = '*'
            return flask_response
        else:
            return jsonify({'error': f'Failed to fetch image: {response.status_code}'}), 500

    except Exception as e:
        print(f"Proxy error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/upload', methods=['POST'])
def upload_report():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400

    # Get user profile from request
    user_profile = request.form.get('user_profile')
    if user_profile:
        try:
            user_profile = json.loads(user_profile)
            print(f"📋 USER PROFILE RECEIVED:")
            print(f"   Name: {user_profile.get('name', 'N/A')}")
            print(f"   Age: {user_profile.get('age', 'N/A')}")
            print(f"   Body Type: {user_profile.get('bodyType', 'N/A')}")
            print(f"   Current Goal: {user_profile.get('currentGoal', 'N/A')}")
            print(f"   Desired Outcome: {user_profile.get('desiredOutcome', 'N/A')}")
            if user_profile.get('previousDiseases'):
                print(f"   Medical History: {user_profile.get('previousDiseases')}")
        except Exception as e:
            print(f"❌ Error parsing user profile: {e}")
            user_profile = None
    else:
        print("⚠️  No user profile provided in upload")
        user_profile = None

    try:
        # Always save file locally first for processing
        upload_folder = 'uploads'
        os.makedirs(upload_folder, exist_ok=True)
        secure_name = secure_filename(file.filename)
        local_file_path = os.path.join(upload_folder, secure_name)

        # Save file locally
        file.seek(0)  # Reset file pointer
        file.save(local_file_path)
        print(f"📁 File saved locally: {local_file_path}")

        # Set temp_file_path for analysis (use local file)
        temp_file_path = local_file_path

        file_url = f"http://localhost:{port}/uploads/{secure_name}"
        # Save the URL to a local file
        with open("uploaded_urls.txt", "a") as f:
            f.write(f"{file_url}\n")
        
        file_extension = os.path.splitext(secure_name)[1].lower()

        try:
            # Check if this is a text file
            is_text_file = file.content_type and file.content_type.startswith('text/')

            if is_text_file:
                # For text files, read content directly and analyze with OpenAI
                file.seek(0)  # Reset file pointer
                text_content = file.read().decode('utf-8', errors='ignore')
                print(f"📄 TEXT FILE CONTENT ({len(text_content)} chars):")
                print("=" * 50)
                print(text_content)  # Print complete text
                print("=" * 50)
                # Import analyzer directly for text analysis
                from modules.analyzer import analyze_report
                result = analyze_report(text_content, user_profile)
                print(f"✅ Text file analysis complete: {len(result.get('tests', []))} tests found")
            else:
                # For PDFs, use page-by-page LLM processing
                if file_extension.lower() == '.pdf':
                    print("📄 Processing PDF with page-by-page LLM analysis...")

                    # Use the new page-by-page processing
                    from modules.pdf_reader import process_pdf_pages_with_llm
                    page_result = process_pdf_pages_with_llm(temp_file_path)

                    if page_result:
                        # Convert page result to the format expected by the rest of the system
                        result = convert_page_based_result_to_response(page_result, user_profile)
                        print(f"✅ Page-by-page analysis complete: {len(result.get('tests', []))} tests found")

                        # Generate AI summary for the tests
                        if result.get('tests'):
                            from modules.analyzer import generate_personalized_analysis
                            result['tests'] = generate_personalized_analysis(
                                result['tests'],
                                user_profile,
                                result.get('tests_by_date'),
                                result.get('date_order')
                            )
                            print("✅ AI summary generated for page-based results")
                    else:
                        print("❌ Page-by-page processing failed, falling back to legacy processing")
                        result = analyze_report_api(temp_file_path, user_profile, fast_mode=False)
                        result = convert_legacy_result_to_response(result, user_profile)

                else:
                    # For images, use the OCR pipeline
                    print("🖼️  Processing image with OCR...")

                    # Check if fast mode is requested
                    fast_mode = request.args.get('fast', '').lower() in ['true', '1', 'yes']
                    if fast_mode:
                        print("⚡ FAST MODE ENABLED - Using regex analysis only")
                        result = analyze_report_api(temp_file_path, user_profile, fast_mode)
                        print(f"✅ Fast mode analysis complete: {len(result.get('tests', []))} tests found")
                    else:
                        print("🚀 TWO-PHASE ANALYSIS: Fast analysis first, then detailed LLM analysis with date grouping")
                        # Phase 1: Fast analysis for immediate results
                        try:
                            fast_result = analyze_report_api(temp_file_path, user_profile, fast_mode=True)
                            print(f"✅ Fast analysis complete: {len(fast_result.get('tests', []))} tests found")
                        except Exception as fast_error:
                            print(f"❌ Fast analysis failed: {fast_error}")
                            fast_result = {"patient": {"name": None, "age": None, "gender": None}, "tests": []}

                        # Phase 2: Detailed LLM analysis with date grouping
                        try:
                            detailed_result = analyze_report_api(temp_file_path, user_profile, fast_mode=False)
                            print(f"✅ Detailed analysis complete: {len(detailed_result.get('tests', []))} tests found")

                            # Group tests by date for better organization
                            from modules.analyzer import group_tests_by_date, convert_new_llm_format_to_legacy

                            # First check if we have LLM structured data
                            llm_data = None
                            if hasattr(detailed_result, 'get') and 'xmr_raw_data' in detailed_result:
                                llm_data = detailed_result['xmr_raw_data']
                                print(f"📊 Found LLM structured data for date grouping: {type(llm_data)}")

                            # Convert detailed result back to legacy format if needed
                            if isinstance(detailed_result, list):
                                detailed_result = convert_new_llm_format_to_legacy(detailed_result)

                            # Group tests by date
                            date_grouping = group_tests_by_date("", detailed_result.get('tests', []), llm_data)
                            detailed_result['tests_by_date'] = date_grouping['tests_by_date']
                            detailed_result['date_order'] = date_grouping['date_order']
                            dated_result = detailed_result
                            print("✅ Date grouping applied to results")
                        except Exception as detailed_error:
                            print(f"❌ Detailed analysis failed: {detailed_error}")
                            detailed_result = fast_result  # Fallback to fast result
                            dated_result = detailed_result  # No date grouping if analysis failed

                        # Combine results: use detailed data with date grouping
                        result = {
                            'basic_analysis': fast_result,
                            'detailed_analysis': detailed_result,
                            'patient': dated_result.get('patient', detailed_result.get('patient', fast_result.get('patient'))),
                            'tests': dated_result.get('tests', detailed_result.get('tests', fast_result.get('tests'))),
                            'tests_by_date': dated_result.get('tests_by_date', {}),
                            'date_order': dated_result.get('date_order', []),
                            'analysis_complete': True
                        }
                        print("✅ Combined analysis with date grouping ready")

            # Validate result structure
            if not isinstance(result, dict):
                print(f"❌ Invalid result type: {type(result)}, converting to dict")
                result = {"error": "Invalid analysis result", "tests": []}

            # Add the file URL to the result
            result['fileUrl'] = file_url
            print(f"📤 Returning result with {len(result.get('tests', []))} tests and file URL: {file_url[:50]}...")

            return jsonify(result)
        finally:
            # Clean up temporary file
            if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
                # os.unlink(temp_file_path) # Keep file for local access
                pass

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/download-txt', methods=['POST'])
def download_txt():
    """Generate and return a .txt file with test results."""
    try:
        data = request.get_json()

        if not data or not data.get('tests'):
            return jsonify({'error': 'No test data provided'}), 400

        # Generate the text content
        txt_content = generate_test_results_txt(data)

        # Create a unique filename
        import uuid
        filename = f"medical_report_{uuid.uuid4().hex[:8]}.txt"

        # Save the file temporarily
        temp_path = os.path.join('uploads', filename)
        os.makedirs('uploads', exist_ok=True)

        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(txt_content)

        # Upload to Cloudinary if configured
        txt_url = f"http://localhost:{port}/uploads/{filename}"
        if cloudinary_configured:
            try:
                upload_result = cloudinary.uploader.upload(
                    temp_path,
                    resource_type="raw",
                    folder="medical_reports_txt",
                    public_id=f"report_{uuid.uuid4().hex[:8]}"
                )
                txt_url = upload_result['secure_url']
                print(f"📄 .txt file uploaded to Cloudinary: {txt_url}")

                # Clean up local file after Cloudinary upload
                os.unlink(temp_path)
            except Exception as cloudinary_error:
                print(f"⚠️ Cloudinary upload for .txt failed: {cloudinary_error}")
                # Keep local URL if Cloudinary fails

        return jsonify({
            'success': True,
            'txt_url': txt_url,
            'filename': filename
        })

    except Exception as e:
        print(f"❌ Error generating .txt file: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/extract-pdf-info', methods=['POST'])
def extract_pdf_info():
    """Extract date and report type from PDF using OpenAI OCR."""
    if not OPENAI_AVAILABLE:
        return jsonify({'error': 'OpenAI not available. Check OPENAI_API_KEY'}), 500

    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400

    try:
        # Save uploaded file temporarily
        upload_folder = 'uploads'
        os.makedirs(upload_folder, exist_ok=True)
        secure_name = secure_filename(file.filename)
        local_file_path = os.path.join(upload_folder, secure_name)

        file.seek(0)
        file.save(local_file_path)
        print(f"📄 PDF saved locally: {local_file_path}")

        # Use the page-by-page processing with OpenAI LLM
        from modules.pdf_reader import process_pdf_pages_with_llm
        page_result = process_pdf_pages_with_llm(local_file_path)

        if not page_result:
            return jsonify({'error': 'Failed to process PDF with OpenAI'}), 500

        # Convert the result to a format suitable for the frontend
        extracted_info = {
            'pages': [],
            'dates': [],
            'report_types': [],
            'all_text': ''
        }
        all_dates = []
        all_report_types = []
        full_text = []

        for page_data in page_result.get("pages", []):
            page_text = "" # Reconstruct text if needed, or get from source
            page_dates = [page_data.get("date")] if page_data.get("date") else []
            report_types = extract_report_types(page_text)

            extracted_info['pages'].append({
                'page_number': page_data.get("page_number"),
                'text': page_text,
                'dates': page_dates,
                'report_types': report_types
            })
            all_dates.extend(page_dates)
            all_report_types.extend(report_types)
            full_text.append(page_text)

        extracted_info['dates'] = sorted(list(set(all_dates)), reverse=True)
        extracted_info['report_types'] = list(set(all_report_types))
        extracted_info['all_text'] = "\n".join(full_text)

        print("🏁 PDF processing complete with OpenAI")
        print(f"📅 Total unique dates found: {len(extracted_info['dates'])}")
        print(f"📋 Report types found: {extracted_info['report_types']}")

        # Clean up
        if os.path.exists(local_file_path):
            os.unlink(local_file_path)

        return jsonify(extracted_info)

    except Exception as e:
        print(f"❌ Error in OpenAI PDF processing: {e}")
        return jsonify({'error': str(e)}), 500

def generate_test_results_txt(result):
    """Generate a formatted .txt file with test results."""
    lines = []

    # Header
    lines.append("=" * 60)
    lines.append("MEDICAL TEST RESULTS REPORT")
    lines.append("=" * 60)
    lines.append("")

    # Patient information
    patient = result.get('patient', {})
    if patient.get('name'):
        lines.append(f"Patient Name: {patient['name']}")
    if patient.get('age'):
        lines.append(f"Age: {patient['age']} years")
    lines.append("")

    # Check if we have date-grouped results
    tests_by_date = result.get('tests_by_date', {})
    date_order = result.get('date_order', [])

    if tests_by_date and date_order:
        # Date-grouped format
        lines.append("TEST RESULTS BY DATE:")
        lines.append("-" * 40)
        lines.append("")

        for date in date_order:
            date_tests = tests_by_date.get(date, [])
            if not date_tests:
                continue

            lines.append(f"📅 Report Date: {date}")
            lines.append(f"   Number of Tests: {len(date_tests)}")
            lines.append("")

            for test in date_tests:
                test_name = test.get('test_name', 'Unknown Test')
                value = test.get('value', 'N/A')
                unit = test.get('unit', '')
                interpretation = test.get('interpretation', 'Unknown')
                reference_range = test.get('reference_range', '')

                lines.append(f"   🧪 {test_name}")
                lines.append(f"      Value: {value} {unit}".strip())
                if reference_range:
                    lines.append(f"      Reference Range: {reference_range}")
                lines.append(f"      Interpretation: {interpretation}")

                # Add explanation if available
                if test.get('explanation'):
                    lines.append(f"      Notes: {test.get('explanation')[:100]}...")

                lines.append("")

            lines.append("-" * 40)
            lines.append("")
    else:
        # Fallback to flat list
        tests = result.get('tests', [])
        lines.append(f"TOTAL TESTS: {len(tests)}")
        lines.append("")

        for test in tests:
            test_name = test.get('test_name', 'Unknown Test')
            value = test.get('value', 'N/A')
            unit = test.get('unit', '')
            interpretation = test.get('interpretation', 'Unknown')
            reference_range = test.get('reference_range', '')

            lines.append(f"🧪 {test_name}")
            lines.append(f"   Value: {value} {unit}".strip())
            if reference_range:
                lines.append(f"   Reference Range: {reference_range}")
            lines.append(f"   Interpretation: {interpretation}")

            # Add explanation if available
            if test.get('explanation'):
                lines.append(f"   Notes: {test.get('explanation')[:100]}...")

            lines.append("")

    # Add AI Summary if available
    summary_data = None
    for test in result.get('tests', []):
        if test.get('health_summary'):
            summary_data = test
            break

    if summary_data:
        lines.append("=" * 60)
        lines.append("AI HEALTH SUMMARY")
        lines.append("=" * 60)
        lines.append("")

        if summary_data.get('health_summary'):
            lines.append("🏥 Overall Health Assessment:")
            lines.append(f"{summary_data['health_summary']}")
            lines.append("")

        if summary_data.get('concerning_findings'):
            lines.append("⚠️ Concerning Findings:")
            for finding in summary_data['concerning_findings']:
                lines.append(f"• {finding}")
            lines.append("")

        if summary_data.get('dietary_recommendations'):
            lines.append("🥗 Dietary Recommendations:")
            for rec in summary_data['dietary_recommendations']:
                lines.append(f"• {rec}")
            lines.append("")

        if summary_data.get('lifestyle_recommendations'):
            lines.append("🏃‍♂️ Lifestyle Recommendations:")
            for rec in summary_data['lifestyle_recommendations']:
                lines.append(f"• {rec}")
            lines.append("")

    # Footer
    lines.append("=" * 60)
    lines.append(f"Report Generated: {result.get('analysis_complete', False) and 'Complete' or 'In Progress'}")
    lines.append("Powered by XMR Medical Report Analyzer")
    lines.append("=" * 60)

    return "\n".join(lines)


def convert_page_based_result_to_response(page_result, user_profile=None):
    """Convert page-based processing result to the response format expected by frontend."""
    if not page_result or not page_result.get('pages'):
        return {"patient": {"name": None, "age": None, "gender": None}, "tests": []}

    # Extract patient info
    patient = {
        "name": page_result.get('patient_name'),
        "age": page_result.get('age'),
        "gender": None
    }

    # Group pages by date - pages with same date get combined
    pages_by_date = {}
    all_tests = []

    print(f"📊 Processing {len(page_result.get('pages', []))} pages for date grouping...")

    for page in page_result.get('pages', []):
        page_date = page.get('date')
        page_tests = page.get('tests', [])

        if page_date and page_tests:
            # Convert page tests to our test format
            formatted_tests = []
            for test in page_tests:
                formatted_test = {
                    "test_name": test.get('name', ''),
                    "value": str(test.get('value', '')),
                    "unit": test.get('unit'),
                    "reference_range": None,  # Not provided in page format
                    "interpretation": "Normal" if not test.get('is_abnormal', False) else "Abnormal"
                }
                formatted_tests.append(formatted_test)
                all_tests.append(formatted_test)

            # Group pages by date - combine tests from pages with same date
            if page_date not in pages_by_date:
                pages_by_date[page_date] = []
            pages_by_date[page_date].extend(formatted_tests)

    print(f"📅 Grouped into {len(pages_by_date)} date groups: {list(pages_by_date.keys())}")

    # Sort dates (most recent first)
    date_order = sorted(pages_by_date.keys(), reverse=True)

    # Apply reference ranges and interpretations
    if user_profile:
        from modules.analyzer import get_age_based_reference_ranges, determine_interpretation
        patient_age = user_profile.get('age')

        for test in all_tests:
            if not test.get('reference_range'):
                age_range = get_age_based_reference_ranges(test['test_name'], patient_age)
                if age_range:
                    test['reference_range'] = age_range
                    test['interpretation'] = determine_interpretation(test['value'], age_range, test['test_name'])

    return {
        'patient': patient,
        'tests': all_tests,
        'tests_by_date': pages_by_date,  # Now grouped by date, not by page
        'date_order': date_order,
        'analysis_complete': True,
        'page_raw_data': page_result  # Keep original for debugging
    }


def convert_legacy_result_to_response(legacy_result, user_profile=None):
    """Convert legacy analysis result to the response format expected by frontend."""
    if not legacy_result:
        return {"patient": {"name": None, "age": None, "gender": None}, "tests": []}

    # Ensure we have the expected structure
    result = {
        'patient': legacy_result.get('patient', {"name": None, "age": None, "gender": None}),
        'tests': legacy_result.get('tests', []),
        'tests_by_date': legacy_result.get('tests_by_date', {}),
        'date_order': legacy_result.get('date_order', []),
        'analysis_complete': True
    }

    return result


def extract_report_types(text):
    """Extract report type patterns from text."""
    report_types = []

    # Common medical report type patterns
    report_patterns = [
        r'(blood\s+test|blood\s+report|hematology|cbc|complete\s+blood\s+count)',
        r'(urine\s+test|urine\s+analysis|urinalysis|urine\s+report)',
        r'(biochemistry|liver\s+function|kidney\s+function|electrolyte|metabolic)',
        r'(lipid\s+profile|cholesterol|triglycerides|hdl|ldl)',
        r'(thyroid\s+test|thyroid\s+function|tsh|t3|t4)',
        r'(diabetes|sugar|glucose|hb?aic)',
        r'(culture|sensitivity|antibiotic|microbiology)',
        r'(hormone|endocrine|testosterone|estrogen|cortisol)',
        r'(vitamin|mineral|deficiency|supplement)',
        r'(cancer|tumor|biopsy|histopathology)',
        r'(cardiac|heart|cardiology|troponin|ck-mb)',
        r'(liver\s+function|sgot|sgpt|bilirubin|albumin)',
        r'(kidney\s+function|creatinine|bun|urea)',
        r'(bone|marrow|biopsy|hematology)',
        r'(stool|feces|occult\s+blood)',
        r'(sputum|respiratory|pulmonary)',
        r'(cerebrospinal|csf|neurology)',
    ]

    text_lower = text.lower()
    for pattern in report_patterns:
        if re.search(pattern, text_lower, re.IGNORECASE):
            # Convert pattern to readable name
            if 'blood' in pattern and 'cbc' in pattern:
                report_types.append('Complete Blood Count (CBC)')
            elif 'urine' in pattern:
                report_types.append('Urine Analysis')
            elif 'biochemistry' in pattern or 'liver' in pattern:
                report_types.append('Biochemistry/Liver Function')
            elif 'lipid' in pattern or 'cholesterol' in pattern:
                report_types.append('Lipid Profile')
            elif 'thyroid' in pattern:
                report_types.append('Thyroid Function')
            elif 'diabetes' in pattern or 'glucose' in pattern:
                report_types.append('Diabetes/Sugar Profile')
            elif 'culture' in pattern or 'antibiotic' in pattern:
                report_types.append('Culture & Sensitivity')
            elif 'hormone' in pattern:
                report_types.append('Hormone Profile')
            elif 'vitamin' in pattern:
                report_types.append('Vitamin/Mineral Profile')
            elif 'cancer' in pattern or 'biopsy' in pattern:
                report_types.append('Histopathology')
            elif 'cardiac' in pattern or 'heart' in pattern:
                report_types.append('Cardiac Markers')
            else:
                # Generic fallback
                readable_name = pattern.replace(r'\s+', ' ').replace('|', '/').title()
                report_types.append(readable_name)

    return list(set(report_types))  # Remove duplicates



@app.route('/auth/login', methods=['POST'])
def login():
    """Direct login - create user with email and return user ID."""
    try:
        data = request.get_json()

        if not data or not data.get('email'):
            return jsonify({'error': 'Email is required'}), 400

        email = data['email']
        
        # Generate a unique user ID based on email (deterministic)
        import hashlib
        # Create a UUID from the first 16 bytes of the MD5 hash
        email_hash = hashlib.md5(email.encode()).digest()
        user_id = str(uuid.UUID(bytes=email_hash[:16]))

        # Return user data directly (no OTP needed)
        print(f"✅ User authenticated: {email} -> {user_id}")

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'id': user_id,
                'email': email
            }
        })

    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/voice-chat', methods=['POST'])
def voice_chat():
    """AI voice chat endpoint for discussing medical reports."""
    try:
        data = request.get_json()

        if not data or not data.get('message'):
            return jsonify({'error': 'No message provided'}), 400

        user_message = data['message']
        report_data = data.get('report_data')
        context_type = data.get('context', 'general_health')

        # Check if we have report data
        if report_data and context_type == 'with_report':
            # Original logic for when we have report data
            patient_info = report_data.get('patient', {})
            tests = report_data.get('tests', [])
            health_summary = ""
            concerning_findings = []
            dietary_recommendations = []
            lifestyle_recommendations = []

            # Get summary data from the first test (where LLM stores summary data)
            if tests:
                first_test = tests[0]
                health_summary = first_test.get('health_summary', '')
                concerning_findings = first_test.get('concerning_findings', [])
                dietary_recommendations = first_test.get('dietary_recommendations', [])
                lifestyle_recommendations = first_test.get('lifestyle_recommendations', [])

            # Build comprehensive context for the LLM
            context = f"""
PATIENT INFORMATION:
- Name: {patient_info.get('name', 'Not provided')}
- Age: {patient_info.get('age', 'Not provided')}
- Gender: {patient_info.get('gender', 'Not provided')}

HEALTH SUMMARY:
{health_summary}

CONCERNING FINDINGS:
{chr(10).join(f"- {finding}" for finding in concerning_findings) if concerning_findings else "None identified"}

DIETARY RECOMMENDATIONS:
{chr(10).join(f"- {rec}" for rec in dietary_recommendations) if dietary_recommendations else "None provided"}

LIFESTYLE RECOMMENDATIONS:
{chr(10).join(f"- {rec}" for rec in lifestyle_recommendations) if lifestyle_recommendations else "None provided"}

TEST RESULTS:
"""

            # Add test results
            for test in tests[:20]:  # Limit to first 20 tests to avoid token limits
                context += f"""
- {test.get('test_name', 'Unknown')}: {test.get('value', 'N/A')} {test.get('unit', '')}
  Reference Range: {test.get('reference_range', 'Not provided')}
  Interpretation: {test.get('interpretation', 'Unknown')}
  Explanation: {test.get('explanation', 'Not provided')}
"""

            system_prompt = """You are a knowledgeable and compassionate medical assistant helping patients understand their lab results. You have access to the patient's complete medical report including:

- Patient demographics
- All test results with values, reference ranges, and interpretations
- AI-generated health summary
- Concerning findings that need attention
- Dietary and lifestyle recommendations

Guidelines for responses:
- Be conversational and easy to understand, avoiding complex medical jargon
- Always base your answers on the provided report data
- If something is not in the report, say so honestly
- For concerning results, explain what they mean and suggest consulting healthcare providers
- Be encouraging and supportive
- Keep responses concise but informative (under 200 words when possible)
- If asked about treatment or diagnosis, recommend consulting a doctor

Remember: You are not a substitute for professional medical advice."""

            conversation_prompt = f"""{system_prompt}

REPORT CONTEXT:
{context}

USER QUESTION: {user_message}

Please provide a helpful, conversational response based on the report data above."""
        else:
            # General health advice when no report data is available
            context = """
You are a knowledgeable and compassionate general health assistant. You can provide general health information, wellness tips, and guidance on healthy living, but you cannot analyze specific medical test results or provide personalized medical advice.

Guidelines for responses:
- Be conversational and easy to understand
- Provide general health information and wellness tips
- Always recommend consulting healthcare professionals for specific medical concerns
- Be encouraging and supportive
- Keep responses concise but informative
- If asked about specific symptoms or conditions, suggest seeing a doctor
- Focus on general wellness, nutrition, exercise, and healthy lifestyle habits

Remember: You are not a substitute for professional medical advice."""

            conversation_prompt = f"""{context}

USER QUESTION: {user_message}

Please provide helpful general health information and wellness tips. If the question involves specific medical symptoms, conditions, or test results, politely remind the user to consult with a healthcare professional."""

        # Use Gemini for voice chat
        response_text = ""
        try:
            from google import genai as google_genai
            from google.genai import types as genai_types
            _api_key = os.getenv("VERTEX_AI_API_KEY")
            _model = os.getenv("VERTEX_MODEL", "gemini-2.5-flash-lite")
            chat_client = google_genai.Client(api_key=_api_key)
            response = chat_client.models.generate_content(
                model=_model,
                contents=f"{system_prompt}\n\nREPORT CONTEXT:\n{context}\n\nUSER QUESTION: {user_message}",
                config=genai_types.GenerateContentConfig(temperature=0.7, max_output_tokens=500)
            )
            response_text = response.text.strip()
        except Exception as e:
            print(f"Gemini voice chat failed: {e}")
            response_text = "I'm sorry, I'm having trouble accessing the medical information right now. Please try again or consult with your healthcare provider."

        return jsonify({
            'response': response_text,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        print(f"Voice chat error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f"Starting server on port {port}")
    app.run(debug=True, host='0.0.0.0', port=port, threaded=True)

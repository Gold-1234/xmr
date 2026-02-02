import cloudinary
import cloudinary.uploader
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import re
import json
from datetime import datetime, timedelta
import base64
from main import analyze_report_api

def btoa(s):
    """Base64 encode a string (equivalent to JavaScript btoa)."""
    return base64.b64encode(s.encode('utf-8')).decode('utf-8')
from modules.database import (
    save_medical_report, get_user_reports, get_report_details,
    get_test_trends, delete_report, get_user_stats, supabase_admin, supabase
)
from dotenv import load_dotenv
from modules.analyzer import extract_dates_from_text_regex
# Load environment variables
load_dotenv()
import pytesseract
import shutil

# Google Cloud Vision imports
try:
    from google.cloud import vision
    from google.oauth2 import service_account
    GOOGLE_VISION_AVAILABLE = True
    print("✅ Google Cloud Vision imported successfully")
except ImportError:
    GOOGLE_VISION_AVAILABLE = False
    print("❌ Google Cloud Vision not available - install with: pip install google-cloud-vision")

print("Tesseract binary:", shutil.which("tesseract"))
print("Tesseract version:", pytesseract.get_tesseract_version())

# Configure Cloudinary only if credentials are valid
cloudinary_url = os.getenv('CLOUDINARY_URL')
cloudinary_configured = False

print(f"Cloudinary URL from env: {cloudinary_url}")
print(f"Full env CLOUDINARY_URL: {os.getenv('CLOUDINARY_URL')}")

if cloudinary_url and '<your_api_key>' not in cloudinary_url and '<your_api_secret>' not in cloudinary_url:
    try:
        # Parse the URL manually to ensure correct configuration
        from urllib.parse import urlparse
        parsed = urlparse(cloudinary_url)
        api_key = parsed.username
        api_secret = parsed.password
        cloud_name = parsed.hostname

        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret
        )
        cloudinary_configured = True
        print(f"Cloudinary configured successfully: {cloud_name}")
    except Exception as e:
        print(f"Cloudinary configuration failed: {e}")
        cloudinary_configured = False
else:
    print("Cloudinary URL not valid or contains placeholders")

app = Flask(__name__)
CORS(app)

# Get port from environment or default
port = int(os.environ.get('PORT', 5019))

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

@app.route('/test-db')
def test_db():
    """Test database connection."""
    try:
        # Test with admin client
        response = supabase_admin.table('medical_reports').select('count', count='exact').execute()
        return jsonify({
            'status': 'success',
            'total_reports': response.count,
            'message': 'Database connection working'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/test-users')
def test_users():
    """Test users table."""
    try:
        # Test users table
        response = supabase_admin.table('users').select('count', count='exact').execute()
        return jsonify({
            'status': 'success',
            'total_users': response.count,
            'message': 'Users table accessible'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

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

        # Generate file URL
        if cloudinary_configured:
            try:
                # Determine resource type based on file type
                file_extension = os.path.splitext(secure_name)[1].lower()
                if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                    resource_type = "image"
                elif file_extension == '.pdf':
                    resource_type = "raw"
                else:
                    resource_type = "auto"  # Fallback for other file types

                print(f"📁 Uploading file with extension {file_extension}, using resource_type: {resource_type}")

                # Upload to Cloudinary for permanent storage
                upload_result = cloudinary.uploader.upload(
                    local_file_path,
                    resource_type=resource_type,
                    folder="medical_reports",
                    ocr="adv_ocr"
                )
                file_url = upload_result['secure_url']
                print(f"☁️ File uploaded to Cloudinary: {file_url}")
                print(f"📊 Complete Cloudinary Response:")
                print(json.dumps(upload_result, indent=2, default=str))
            except Exception as cloudinary_error:
                print(f"⚠️ Cloudinary upload failed: {cloudinary_error}")
                # Fallback to local URL
                file_url = f"http://localhost:{port}/uploads/{secure_name}"
        else:
            file_url = f"http://localhost:{port}/uploads/{secure_name}"

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
            # Clean up temporary file if it was created for Cloudinary
            if cloudinary_configured and 'temp_file_path' in locals():
                os.unlink(temp_file_path)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/save-report', methods=['POST'])
def save_report():
    """Save analyzed report to database with Cloudinary upload."""
    data = request.get_json()

    required_fields = ['userId', 'filename', 'fileType', 'fileUrl', 'patient', 'tests']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    try:
        # Check if file exists locally (from initial upload)
        local_file_path = None
        if data['fileUrl'].startswith('http://localhost'):
            # Extract filename from URL
            filename = data['fileUrl'].split('/')[-1]
            local_file_path = os.path.join('uploads', filename)

        # Upload to Cloudinary if configured and file exists
        final_file_url = data['fileUrl']
        if cloudinary_configured and local_file_path and os.path.exists(local_file_path):
            try:
                # Determine resource type based on file type
                file_extension = os.path.splitext(data['filename'])[1].lower()
                if file_extension in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
                    resource_type = "image"
                elif file_extension == '.pdf':
                    resource_type = "raw"
                else:
                    resource_type = "auto"  # Fallback for other file types

                print(f"📁 Uploading file with extension {file_extension}, using resource_type: {resource_type}")

                # Upload file to Cloudinary
                upload_result = cloudinary.uploader.upload(
                    local_file_path,
                    resource_type=resource_type,
                    folder="medical_reports",
                    public_id=f"{data['userId']}_{data['filename']}_{int(os.path.getctime(local_file_path))}"
                )
                final_file_url = upload_result['secure_url']
                print(f"File uploaded to Cloudinary: {final_file_url}")
                print(f"📊 Complete Cloudinary Response (save-report):")
                print(json.dumps(upload_result, indent=2, default=str))

                # Remove local file after successful Cloudinary upload
                os.unlink(local_file_path)

            except Exception as cloudinary_error:
                print(f"Cloudinary upload failed: {cloudinary_error}")
                # Keep local URL if Cloudinary fails

        # Save to database with final file URL
        result = save_medical_report(
            user_id=data['userId'],
            filename=data['filename'],
            file_type=data['fileType'],
            file_url=final_file_url,
            patient_info=data['patient'],
            test_results=data['tests']
        )

        if result['success']:
            return jsonify({'success': True, 'report_id': result['report_id'], 'file_url': final_file_url})
        else:
            return jsonify({'error': result['error']}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reports/<user_id>', methods=['GET'])
def get_reports(user_id):
    """Get user's saved reports."""
    try:
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        reports = get_user_reports(user_id, limit, offset)
        return jsonify({'reports': reports})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/report/<report_id>', methods=['GET'])
def get_report(report_id):
    """Get detailed report information."""
    try:
        report = get_report_details(report_id)
        if report:
            return jsonify(report)
        else:
            return jsonify({'error': 'Report not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/report/<report_id>', methods=['DELETE'])
def delete_user_report(report_id):
    """Delete a user's report."""
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id parameter required'}), 400

    try:
        success = delete_report(report_id, user_id)
        if success:
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Failed to delete report'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/trends/<user_id>/<test_name>', methods=['GET'])
def get_trends(user_id, test_name):
    """Get trend data for a specific test."""
    try:
        trends = get_test_trends(user_id, test_name)
        return jsonify({'trends': trends})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats/<user_id>', methods=['GET'])
def get_stats(user_id):
    """Get user statistics."""
    try:
        stats = get_user_stats(user_id)
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)})

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
    """Extract date and report type from PDF using Google Cloud Vision OCR."""
    if not GOOGLE_VISION_AVAILABLE:
        return jsonify({'error': 'Google Cloud Vision not available. Install with: pip install google-cloud-vision'}), 500

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

        # Initialize Google Cloud Vision client
        google_credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if google_credentials_path and os.path.exists(google_credentials_path):
            credentials = service_account.Credentials.from_service_account_file(google_credentials_path)
            client = vision.ImageAnnotatorClient(credentials=credentials)
            print("✅ Google Cloud Vision client initialized with service account")
        else:
            # Try with API key (less secure but simpler)
            api_key = os.getenv('GOOGLE_VISION_API_KEY')
            if api_key:
                import google.auth.transport.requests
                import google.auth
                # This is a simplified approach - in production, use service account
                client = vision.ImageAnnotatorClient()
                print("✅ Google Cloud Vision client initialized")
            else:
                return jsonify({'error': 'Google Cloud Vision credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_VISION_API_KEY'}), 500

        # Convert PDF pages to images
        import fitz  # PyMuPDF
        doc = fitz.open(local_file_path)
        print(f"📖 Processing PDF with {len(doc)} pages")

        extracted_info = {
            'pages': [],
            'dates': [],
            'report_types': [],
            'all_text': ''
        }

        for page_num in range(len(doc)):
            print(f"📄 Processing page {page_num + 1}")

            # Convert page to image
            page = doc.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scaling for better OCR
            img_data = pix.tobytes("png")

            # Create Vision API image object
            image = vision.Image(content=img_data)

            # Perform text detection
            response = client.text_detection(image=image)
            texts = response.text_annotations

            if texts:
                page_text = texts[0].description
                print(f"✅ OCR successful on page {page_num + 1} ({len(page_text)} chars)")
                print("page_text:::", page_text)
                # Extract dates from this page
                page_dates = extract_dates_from_text_regex(page_text)
                if page_dates:
                    print(f"📅 Found dates on page {page_num + 1}: {page_dates}")

                # Extract report type patterns
                report_types = extract_report_types(page_text)

                extracted_info['pages'].append({
                    'page_number': page_num + 1,
                    'text': page_text,
                    # 'dates': page_dates,
                    'report_types': report_types
                })

                extracted_info['dates'].extend(page_dates)
                extracted_info['report_types'].extend(report_types)
                extracted_info['all_text'] += page_text + '\n'
            else:
                print(f"❌ No text found on page {page_num + 1}")

        doc.close()

        # Remove duplicates and sort
        extracted_info['dates'] = list(set(extracted_info['dates']))
        extracted_info['dates'].sort(reverse=True)  # Most recent first

        extracted_info['report_types'] = list(set(extracted_info['report_types']))

        print("🏁 PDF processing complete")
        print(f"📅 Total unique dates found: {len(extracted_info['dates'])}")
        print(f"📋 Report types found: {extracted_info['report_types']}")

        # Clean up
        if os.path.exists(local_file_path):
            os.unlink(local_file_path)

        return jsonify(extracted_info)

    except Exception as e:
        print(f"❌ Error in Google Cloud Vision processing: {e}")
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

@app.route('/auth/send-otp', methods=['POST'])
def send_otp():
    """Send OTP for authentication - simplified for development."""
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400

        email = data['email']
        password = data['password']

        # For development: Always create/use a test user with proper UUID
        test_user_id = '550e8400-e29b-41d4-a716-446655440000'  # Valid UUID format

        # Hash the password
        password_hash = btoa(password)

        # For development: Always succeed and return test user
        print(f"Development mode: Creating/authenticating user {email}")

        return jsonify({
            'success': True,
            'message': 'OTP generated successfully (dev mode)',
            'userId': test_user_id,
            'otpCode': '123456'  # Always use 123456 for development
        })

    except Exception as e:
        print(f"Send OTP error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/auth/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP for authentication - backend implementation of Supabase function."""
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('otp'):
            return jsonify({'error': 'Email and OTP are required'}), 400

        email = data['email']
        otp = data['otp']

        # Find valid OTP record
        otp_record = supabase_admin.table('otp_codes').select('*').eq('email', email).eq('code', otp).eq('verified', False).order('created_at', desc=True).execute()

        if not otp_record.data or len(otp_record.data) == 0:
            return jsonify({'error': 'Invalid OTP'}), 401

        otp_data = otp_record.data[0]

        # Check expiration
        if datetime.now() > datetime.fromisoformat(otp_data['expires_at']):
            return jsonify({'error': 'OTP has expired'}), 401

        # Mark OTP as verified
        supabase_admin.table('otp_codes').update({'verified': True}).eq('id', otp_data['id']).execute()

        # Get user data
        user_result = supabase_admin.table('users').select('id, email').eq('id', otp_data['user_id']).execute()

        if not user_result.data or len(user_result.data) == 0:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'success': True,
            'user': user_result.data[0]
        })

    except Exception as e:
        print(f"Verify OTP error: {e}")
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

        # Try Gemini first, fallback to OpenAI
        response_text = ""

        if os.getenv('GEMINI_API_KEY'):
            try:
                import google.generativeai as genai
                genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
                gemini_model = genai.GenerativeModel('gemini-2.5-flash-lite')

                response = gemini_model.generate_content(
                    conversation_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,  # More creative for conversation
                        max_output_tokens=500,
                    )
                )
                response_text = response.text.strip()

            except Exception as e:
                print(f"Gemini voice chat failed: {e}")

        # Fallback to OpenAI
        if not response_text and os.getenv('OPENAI_API_KEY'):
            try:
                from openai import OpenAI
                client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"REPORT CONTEXT:\n{context}\n\nUSER QUESTION: {user_message}"}
                    ],
                    temperature=0.7,
                    max_tokens=500
                )
                response_text = response.choices[0].message.content.strip()

            except Exception as e:
                print(f"OpenAI voice chat failed: {e}")
                response_text = "I'm sorry, I'm having trouble accessing the medical information right now. Please try again or consult with your healthcare provider."

        return jsonify({
            'response': response_text,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        print(f"Voice chat error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT',5001 )) 
    print(f"Starting server on port {port}")
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)

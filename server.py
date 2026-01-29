import cloudinary
import cloudinary.uploader
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from main import analyze_report_api
from modules.database import (
    save_medical_report, get_user_reports, get_report_details,
    get_test_trends, delete_report, get_user_stats, supabase_admin
)
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
import pytesseract
import shutil

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

@app.route('/upload', methods=['POST'])
def upload_report():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400

    try:
        if cloudinary_configured:
            # Upload file to Cloudinary
            upload_result = cloudinary.uploader.upload(
                file,
                resource_type="auto",  # Auto-detect file type (image, pdf, etc.)
                folder="medical_reports"  # Organize files in a folder
            )

            file_url = upload_result['secure_url']

            # For analysis, we need to download the file temporarily
            # Since analyze_report_api expects a local file path
            import requests
            import tempfile

            # Download file from Cloudinary temporarily for analysis
            response = requests.get(file_url)
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
                temp_file.write(response.content)
                temp_file_path = temp_file.name
        else:
            # Fallback to local storage if Cloudinary not configured
            upload_folder = 'uploads'
            os.makedirs(upload_folder, exist_ok=True)
            file_path = os.path.join(upload_folder, file.filename)
            file.save(file_path)
            file_url = f"http://localhost:{port}/uploads/{file.filename}"
            temp_file_path = file_path

        try:
            # Check if this is a text file
            is_text_file = file.content_type and file.content_type.startswith('text/')

            if is_text_file:
                # For text files, read content directly and analyze with OpenAI
                file.seek(0)  # Reset file pointer
                text_content = file.read().decode('utf-8', errors='ignore')
                # Import analyzer directly for text analysis
                from modules.analyzer import analyze_report
                result = analyze_report(text_content)
            else:
                # For images/PDFs, use the OCR pipeline
                result = analyze_report_api(temp_file_path)

            # Add the file URL to the result
            result['fileUrl'] = file_url
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
                # Upload file to Cloudinary
                upload_result = cloudinary.uploader.upload(
                    local_file_path,
                    resource_type="auto",
                    folder="medical_reports",
                    public_id=f"{data['userId']}_{data['filename']}_{int(os.path.getctime(local_file_path))}"
                )
                final_file_url = upload_result['secure_url']
                print(f"File uploaded to Cloudinary: {final_file_url}")

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
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5007))  # Default to 5007 for development
    print(f"Starting server on port {port}")
    app.run(debug=False, host='0.0.0.0', port=port)

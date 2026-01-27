from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from main import analyze_report_api  

app = Flask(__name__)
CORS(app)

@app.route('/upload', methods=['POST'])
def upload_report():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file uploaded'}), 400

    upload_folder = 'uploads'
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, file.filename)
    file.save(file_path)

    try:
        result = analyze_report_api(file_path)
        return jsonify({'result': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(debug=False, host='0.0.0.0', port=port)

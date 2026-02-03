import os
import json
import re
from datetime import datetime
from openai import OpenAI
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure APIs
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
gemini_model = genai.GenerativeModel('gemini-2.5-flash-lite')

def extract_medical_data_gemini(text):
    """Use Gemini to extract structured medical data from report text."""
    try:
        # Truncate text if too long to avoid token limits
        if len(text) > 3000:
            text = text[:3000] + "...[TRUNCATED]"

        system_prompt = """You are an advanced Medical Data Architect. Your goal is to transform OCR-extracted text from medical reports into a standardized, valid JSON format for long-term health tracking.

Instructions:

Multiple Entries: Scan the document for multiple test dates. If a PDF contains reports from different dates (e.g., historical comparisons), create a separate object for each date in a list.

Metadata Extraction: For each entry, capture:

patient_name: Full name of the user.
extract one date only from each page
sample_date: The date the sample was collected (Priority: 'Date of Sample'). Use YYYY-MM-DD.

lab_name: The name of the diagnostic center.

Smart Marker Extraction: Create a flat list of data_points. For every marker (e.g., Hemoglobin, Pus Cells, RBCs), extract:

name: Official clinical name.

value: Numerical result (if available) or the text string (e.g., 'HAZY', 'TRACE').

unit: The measurement unit.

is_abnormal: Set to true if the value is outside the lab's 'Normal Range' or marked as abnormal.

Microbiology Focus: If a Culture test is present, include a culture_results object with organism_found and an antibiotic_sensitivity array.

Strict Rules:

Output ONLY JSON.

No preamble or post-text.

Parse numbers as floating-point decimals when possible (e.g., 35.0 instead of '35').
Each test result must align with its header. For example, 'QUANTITY' should always be followed by a volume (ml) and 'COLOUR' by a descriptive color string.
If a field is missing, use null."""

        prompt = system_prompt + """

REPORT TEXT:
""" + text

        response = gemini_model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,  # Low temperature for consistent extraction
                max_output_tokens=1000,
            )
        )

        response_text = response.text.strip()

        # Debug: Log the raw response
        print(f"🤖 Raw Gemini response (first 500 chars): {response_text}...")
        print(f"🤖 Response length: {len(response_text)} chars")

        # Clean the response to get valid JSON
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Try to fix common JSON issues
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as json_err:
            print(f"Initial JSON parsing failed: {json_err}")
            print(f"Response text (first 500 chars): {response_text[:500]}")

            # Try to fix unterminated strings by finding the last complete object
            try:
                # Look for the last complete JSON object by counting braces
                brace_count = 0
                last_valid_pos = -1

                for i, char in enumerate(response_text):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            last_valid_pos = i

                if last_valid_pos > 0:
                    fixed_response = response_text[:last_valid_pos + 1]
                    print(f"Trying to parse truncated JSON (length: {len(fixed_response)}")
                    return json.loads(fixed_response)
                else:
                    raise json_err

            except Exception as fix_err:
                print(f"JSON fixing also failed: {fix_err}")
                raise json_err
    except Exception as e:
        print(f"Gemini extraction failed: {e}")
        # CRITICAL: Always return a valid dict, never None
        return {"patient": {"name": None, "age": None, "gender": None}, "tests": []}



def extract_medical_data_openai(text):
    """Use OpenAI to extract structured medical data from report text."""
    # Truncate text if too long to avoid token limits
    if len(text) > 3000:
        text = text[:3000] + "...[TRUNCATED]"

    prompt = """Extract lab test data from this medical report. Return ONLY valid JSON.

SCHEMA:
{
  "patient": {"name": null, "age": null, "gender": null},
  "tests": [
    {"test_name": "", "value": "", "unit": null, "reference_range": null, "interpretation": "Unknown"}
  ]
}

INSTRUCTIONS:
- Extract patient name, age, gender if present
- Find all test results with names, values, units, reference ranges
- Determine if each result is Low/Normal/High based on reference ranges
- Return valid JSON only, no explanations
- Limit to maximum 20 tests
- Keep test names concise (e.g., "Hemoglobin", not "Hemoglobin (Hb)")

REPORT TEXT:
""" + text

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using GPT-4o-mini for cost efficiency
            messages=[
                {"role": "system", "content": "You are a medical data extraction assistant. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # Low temperature for consistent extraction
            max_tokens=1000
        )

        response_text = response.choices[0].message.content.strip()

        # Clean the response to get valid JSON
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Try to fix common JSON issues
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as json_err:
            print(f"Initial JSON parsing failed: {json_err}")
            print(f"Response text (first 500 chars): {response_text[:500]}")

            # Try to fix unterminated strings by finding the last complete object
            try:
                # Look for the last complete JSON object by counting braces
                brace_count = 0
                last_valid_pos = -1

                for i, char in enumerate(response_text):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            last_valid_pos = i

                if last_valid_pos > 0:
                    fixed_response = response_text[:last_valid_pos + 1]
                    print(f"Trying to parse truncated JSON (length: {len(fixed_response)})")
                    return json.loads(fixed_response)
                else:
                    raise json_err

            except Exception as fix_err:
                print(f"JSON fixing also failed: {fix_err}")
                raise json_err
    except Exception as e:
        print(f"OpenAI extraction failed: {e}")
        raise e

def get_age_based_reference_ranges(test_name, age=None):
    """Get age-based reference ranges for common medical tests."""
    # Handle both string and integer age values
    if age is not None:
        if isinstance(age, str):
            age = int(age) if age.isdigit() else None
        elif isinstance(age, int):
            pass  # Already an integer
        else:
            age = None

    # Common blood test reference ranges (may vary by lab)
    ranges = {
        "HEMOGLOBIN": {
            "male": {"min": 13.5, "max": 17.5, "unit": "g/dL"},
            "female": {"min": 12.0, "max": 15.5, "unit": "g/dL"}
        },
        "GLUCOSE": {
            "fasting": {"min": 70, "max": 100, "unit": "mg/dL"},
            "random": {"min": 70, "max": 140, "unit": "mg/dL"}
        },
        "CHOLESTEROL": {
            "total": {"min": 0, "max": 200, "unit": "mg/dL"}
        },
        "HDL": {
            "male": {"min": 40, "max": 999, "unit": "mg/dL"},
            "female": {"min": 50, "max": 999, "unit": "mg/dL"}
        },
        "LDL": {
            "optimal": {"min": 0, "max": 100, "unit": "mg/dL"},
            "near_optimal": {"min": 100, "max": 129, "unit": "mg/dL"}
        },
        "TRIGLYCERIDES": {
            "normal": {"min": 0, "max": 150, "unit": "mg/dL"},
            "borderline": {"min": 150, "max": 199, "unit": "mg/dL"}
        },
        "CREATININE": {
            "male": {"min": 0.7, "max": 1.2, "unit": "mg/dL"},
            "female": {"min": 0.6, "max": 1.0, "unit": "mg/dL"}
        },
        "BUN": {
            "adult": {"min": 7, "max": 20, "unit": "mg/dL"}
        },
        "ALT": {
            "normal": {"min": 7, "max": 40, "unit": "U/L"}
        },
        "AST": {
            "normal": {"min": 10, "max": 40, "unit": "U/L"}
        },
        "ALBUMIN": {
            "normal": {"min": 3.5, "max": 5.0, "unit": "g/dL"}
        },
        "BILIRUBIN": {
            "total": {"min": 0.3, "max": 1.2, "unit": "mg/dL"}
        },
        "PLATELET COUNT": {
            "normal": {"min": 150000, "max": 450000, "unit": "/µL"}
        },
        "WBC COUNT": {
            "normal": {"min": 4000, "max": 11000, "unit": "/µL"}
        },
        "RBC COUNT": {
            "male": {"min": 4.5, "max": 5.9, "unit": "million/µL"},
            "female": {"min": 4.1, "max": 5.1, "unit": "million/µL"}
        }
    }

    # Normalize test name
    test_upper = test_name.upper().strip()

    if test_upper in ranges:
        test_ranges = ranges[test_upper]

        # Handle gender-specific ranges
        if "male" in test_ranges and "female" in test_ranges:
            # For now, use male ranges as default since we don't have gender info
            # In a real app, we'd use the patient's gender
            return f"{test_ranges['male']['min']}-{test_ranges['male']['max']} {test_ranges['male']['unit']}"
        elif "total" in test_ranges:
            return f"{test_ranges['total']['min']}-{test_ranges['total']['max']} {test_ranges['total']['unit']}"
        elif "normal" in test_ranges:
            return f"{test_ranges['normal']['min']}-{test_ranges['normal']['max']} {test_ranges['normal']['unit']}"
        elif "optimal" in test_ranges:
            return f"{test_ranges['optimal']['min']}-{test_ranges['optimal']['max']} {test_ranges['optimal']['unit']}"
        elif "fasting" in test_ranges:
            return f"{test_ranges['fasting']['min']}-{test_ranges['fasting']['max']} {test_ranges['fasting']['unit']}"

    return None

def determine_interpretation(value_str, reference_range, test_name):
    """Determine if a test result is Low, Normal, or High."""
    if not value_str or not reference_range:
        return "Unknown"

    try:
        # Extract numeric value
        value_match = re.search(r'[\d.]+', value_str.replace(',', ''))
        if not value_match:
            return "Unknown"

        value = float(value_match.group())

        # Parse reference range (e.g., "70-100 mg/dL", "< 200 mg/dL", "> 40 mg/dL")
        range_match = re.search(r'(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)', reference_range)
        if range_match:
            min_val = float(range_match.group(1))
            max_val = float(range_match.group(2))
            if value < min_val:
                return "Low"
            elif value > max_val:
                return "High"
            else:
                return "Normal"

        # Handle "< X" format
        less_match = re.search(r'<\s*(\d+(?:\.\d+)?)', reference_range)
        if less_match:
            max_val = float(less_match.group(1))
            if value < max_val:
                return "Normal"
            else:
                return "High"

        # Handle "> X" format
        greater_match = re.search(r'>\s*(\d+(?:\.\d+)?)', reference_range)
        if greater_match:
            min_val = float(greater_match.group(1))
            if value > min_val:
                return "Normal"
            else:
                return "Low"

    except Exception as e:
        print(f"Error determining interpretation for {test_name}: {e}")
        return "Unknown"

    return "Unknown"

def convert_page_based_to_legacy(page_response):
    """Convert page-based format to legacy patient/tests format."""
    if not isinstance(page_response, dict) or 'pages' not in page_response:
        return page_response

    # Extract patient info
    patient = {
        "name": page_response.get('patient_name'),
        "age": page_response.get('age'),
        "gender": None  # Not provided in page format
    }

    # Collect all tests from all pages
    tests = []
    for page in page_response.get('pages', []):
        for test in page.get('tests', []):
            tests.append({
                "test_name": test.get('name', ''),
                "value": str(test.get('value', '')),
                "unit": test.get('unit'),
                "reference_range": None,  # Not provided in page format
                    "interpretation": "Normal" if not test.get('is_abnormal', False) else "High"
            })

    return {
        "patient": patient,
        "tests": tests,
        # Store original page format for potential future use
        "page_raw_data": page_response
    }

def convert_new_llm_format_to_legacy(llm_response):
    """Convert new XMR array format to legacy patient/tests format."""
    if not isinstance(llm_response, list):
        # If it's already in legacy format, return as-is
        return llm_response

    if not llm_response:
        return {"patient": {"name": None, "age": None, "gender": None}, "tests": []}

    # Take the first entry (most recent date)
    first_entry = llm_response[0]

    # Convert to legacy format
    patient = {
        "name": first_entry.get('patient_name'),
        "age": None,  # Not provided in new format
        "gender": None  # Not provided in new format
    }

    # Convert data_points to tests format
    tests = []
    for data_point in first_entry.get('data_points', []):
        test = {
            "test_name": data_point.get('name', ''),
            "value": str(data_point.get('value', '')),
            "unit": data_point.get('unit'),
            "reference_range": None,  # Not provided in new format
                "interpretation": "Normal" if not data_point.get('is_abnormal', False) else "High"
        }
        tests.append(test)

    return {
        "patient": patient,
        "tests": tests,
        # Store original new format for potential future use
        "xmr_raw_data": llm_response
    }

def extract_medical_data(text, user_profile=None):
    """Extract medical data using page-based Gemini extraction."""
    if os.getenv('GEMINI_API_KEY'):
        try:
            # Use page-based extraction for better date derivation per page
            data = extract_medical_data_page_based(text)
            print(f"Raw LLM response type: {type(data)}")
            if isinstance(data, list):
                print(f"LLM returned array with {len(data)} entries")
            elif isinstance(data, dict):
                print(f"LLM returned dict with keys: {list(data.keys())}")
        except Exception as e:
            print(f"Page-based Gemini extraction failed, falling back to document-level: {e}")
            try:
                data = extract_medical_data_gemini(text)
            except Exception as e2:
                print(f"Document-level extraction also failed: {e2}")
                if os.getenv('OPENAI_API_KEY'):
                    try:
                        data = extract_medical_data_openai(text)
                    except Exception as e3:
                        print(f"OpenAI extraction also failed: {e3}")
                        return {"patient": {"name": None, "age": None, "gender": None}, "tests": []}
                else:
                    return {"patient": {"name": None, "age": None, "gender": None}, "tests": []}
    elif os.getenv('OPENAI_API_KEY'):
        try:
            data = extract_medical_data_openai(text)
        except Exception as e:
            print(f"OpenAI extraction failed: {e}")
            return {"patient": {"name": None, "age": None, "gender": None}, "tests": []}
    else:
        return {"patient": {"name": None, "age": None, "gender": None}, "tests": []}

    # Convert page-based format to legacy format if needed
    data = convert_page_based_to_legacy(data)

    # Get patient age for reference ranges
    patient_age = None
    if user_profile and user_profile.get('age'):
        patient_age = user_profile['age']
    elif data.get('patient', {}).get('age'):
        patient_age = data['patient']['age']

    # Add reference ranges and determine interpretations for tests that don't have them
    for test in data.get('tests', []):
        if not test.get('reference_range'):
            # Try to get age-based reference range
            age_range = get_age_based_reference_ranges(test['test_name'], patient_age)
            if age_range:
                test['reference_range'] = age_range
                print(f"Added age-based reference range for {test['test_name']}: {age_range}")

        # Determine interpretation if not already set or if we now have a reference range
        if test.get('reference_range') and test.get('interpretation') in [None, "Unknown"]:
            interpretation = determine_interpretation(test['value'], test['reference_range'], test['test_name'])
            test['interpretation'] = interpretation
            print(f"Determined interpretation for {test['test_name']}: {interpretation}")

    return data

def generate_test_explanations_gemini(tests):
    """Generate explanations for each test using Gemini."""
    if not tests:
        return tests

    # Create a batch prompt for all tests with context
    test_details = []
    for test in tests:
        test_info = f"{test['test_name']}: value={test['value']} {test.get('unit', '')}, interpretation={test['interpretation']}"
        if test.get('reference_range'):
            test_info += f", reference_range={test['reference_range']}"
        test_details.append(test_info)

    batch_prompt = f"""Provide context-aware explanations for each of these medical tests based on the patient's specific values and interpretations. For each test, explain:

1. What the test measures
2. What the patient's specific result means in context
3. Any health implications of the result

Be specific about the patient's values and whether they are normal, high, or low. Keep each explanation to 2-3 sentences.

Test Results:
{chr(10).join(f"- {detail}" for detail in test_details)}

Format your response as a JSON object where each key is the test name and the value is the explanation:
{{
  "Test Name 1": "Explanation here...",
  "Test Name 2": "Explanation here...",
  ...
}}

Return only the JSON, no markdown formatting."""

    try:
        response = gemini_model.generate_content(
            batch_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,  # Slightly higher temperature for explanations
                max_output_tokens=2000,
            )
        )

        response_text = response.text.strip()

        # Clean the response to get valid JSON
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Parse the JSON response
        explanations = json.loads(response_text)

        # Assign explanations to tests
        for test in tests:
            test_name = test['test_name']
            if test_name in explanations:
                test['explanation'] = explanations[test_name]
            else:
                test['explanation'] = f"This test measures {test_name} levels in the body."

    except Exception as e:
        print(f"Gemini explanations failed: {e}")
        raise e

    return tests

def generate_test_explanations_openai(tests):
    """Generate explanations for each test using OpenAI."""
    if not tests:
        return tests

    # Create a batch prompt for all tests with context
    test_details = []
    for test in tests:
        test_info = f"{test['test_name']}: value={test['value']} {test.get('unit', '')}, interpretation={test['interpretation']}"
        if test.get('reference_range'):
            test_info += f", reference_range={test['reference_range']}"
        test_details.append(test_info)

    batch_prompt = f"""Provide context-aware explanations for each of these medical tests based on the patient's specific values and interpretations. For each test, explain:

1. What the test measures
2. What the patient's specific result means in context
3. Any health implications of the result

Be specific about the patient's values and whether they are normal, high, or low. Keep each explanation to 2-3 sentences.

Test Results:
{chr(10).join(f"- {detail}" for detail in test_details)}

Format your response as a JSON object where each key is the test name and the value is the explanation:
{{
  "Test Name 1": "Explanation here...",
  "Test Name 2": "Explanation here...",
  ...
}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a medical expert providing test explanations. Return only valid JSON."},
                {"role": "user", "content": batch_prompt}
            ],
            temperature=0.3,  # Slightly higher temperature for explanations
            max_tokens=2000
        )

        response_text = response.choices[0].message.content.strip()

        # Clean the response to get valid JSON
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Parse the JSON response
        explanations = json.loads(response_text)

        # Assign explanations to tests
        for test in tests:
            test_name = test['test_name']
            if test_name in explanations:
                test['explanation'] = explanations[test_name]
            else:
                test['explanation'] = f"This test measures {test_name} levels in the body."

    except Exception as e:
        print(f"OpenAI explanations failed: {e}")
        raise e

    return tests

def generate_personalized_analysis(tests, user_profile=None, tests_by_date=None, date_order=None):
    """Generate personalized analysis with test explanations and health recommendations using single LLM call."""
    if not tests:
        return tests

    print(f"DEBUG: Starting personalized analysis for {len(tests)} tests")
    print(f"DEBUG: User profile provided: {user_profile is not None}")
    if user_profile:
        print(f"DEBUG: User profile keys: {list(user_profile.keys())}")
    print(f"DEBUG: Date grouping provided: {tests_by_date is not None and date_order is not None}")

    # Create comprehensive prompt with user profile and test data
    test_details = []
    for test in tests:
        test_info = f"{test['test_name']}: value={test['value']} {test.get('unit', '')}, interpretation={test['interpretation']}"
        if test.get('reference_range'):
            test_info += f", reference_range={test['reference_range']}"
        test_details.append(test_info)

    # Build user profile context
    profile_context = ""
    if user_profile:
        profile_parts = []
        if user_profile.get('name'):
            profile_parts.append(f"Name: {user_profile['name']}")
        if user_profile.get('age'):
            profile_parts.append(f"Age: {user_profile['age']} years")
        if user_profile.get('bodyType'):
            profile_parts.append(f"Body Type: {user_profile['bodyType']}")
        if user_profile.get('currentGoal'):
            profile_parts.append(f"Health Goal: {user_profile['currentGoal']}")
        if user_profile.get('previousDiseases'):
            profile_parts.append(f"Medical History: {user_profile['previousDiseases']}")
        if user_profile.get('desiredOutcome'):
            profile_parts.append(f"Desired Outcome: {user_profile['desiredOutcome']}")

        if profile_parts:
            profile_context = f"\n\nPATIENT PROFILE:\n{chr(10).join(profile_parts)}"

    # Include date grouping information if available
    date_context = ""
    if tests_by_date and date_order:
        date_context = f"\n\nTEST RESULTS ORGANIZED BY DATE:\n"
        for date in date_order:
            date_tests = tests_by_date.get(date, [])
            if date_tests:
                date_context += f"📅 {date} ({len(date_tests)} tests):\n"
                for test in date_tests[:3]:  # Show first 3 tests per date
                    date_context += f"  - {test['test_name']}: {test['value']} {test.get('unit', '')} ({test['interpretation']})\n"
                if len(date_tests) > 3:
                    date_context += f"  - ... and {len(date_tests) - 3} more tests\n"
                date_context += "\n"

    comprehensive_prompt = f"""You are a medical expert analyzing a patient's lab results across multiple dates. Provide personalized analysis and recommendations.

{profile_context}

{date_context}

MEDICAL TEST RESULTS:
{chr(10).join(f"- {detail}" for detail in test_details)}

TASK: Analyze these results and provide:
1. Individual test explanations (personalized to the patient)
2. Overall health summary with key findings, including trends across dates if multiple dates are present
3. Specific dietary recommendations
4. Lifestyle modification suggestions
5. Any concerning abnormalities that need immediate attention

INSTRUCTIONS:
- Refer to the patient by name if available, otherwise use "you" or "the patient"
- Make explanations specific to their profile (age, body type, goals, medical history)
- If multiple dates are present, analyze trends and changes over time
- Be direct about any concerning results that require medical attention
- Provide actionable, personalized recommendations
- Keep dietary suggestions realistic and sustainable
- Focus on preventive care and health optimization

FORMAT YOUR RESPONSE AS JSON:
{{
  "test_explanations": {{
    "Test Name 1": "Personalized explanation for this specific patient...",
    "Test Name 2": "Another personalized explanation..."
  }},
  "health_summary": "Overall assessment highlighting key findings, patterns, and date-based trends...",
  "concerning_findings": ["List any critical issues requiring immediate attention"],
  "dietary_recommendations": ["Specific, actionable dietary suggestions"],
  "lifestyle_recommendations": ["Personalized lifestyle modification suggestions"]
}}

Return only the JSON, no markdown formatting."""

    try:
        # Try Gemini first
        if os.getenv('GEMINI_API_KEY'):
            response = gemini_model.generate_content(
                comprehensive_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.4,  # Moderate temperature for personalized analysis
                    max_output_tokens=3000,
                )
            )

            response_text = response.text.strip()

            # Clean the response to get valid JSON
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            # Parse the comprehensive analysis
            print(f"DEBUG: Gemini response text length: {len(response_text)}")
            print(f"DEBUG: Gemini response starts with: {response_text[:200]}...")

            analysis = json.loads(response_text)
            print(f"DEBUG: Parsed analysis keys: {list(analysis.keys())}")

            # Assign explanations to tests
            explanations = analysis.get('test_explanations', {})
            print(f"DEBUG: Found {len(explanations)} test explanations")

            for test in tests:
                test_name = test['test_name']
                if test_name in explanations:
                    test['explanation'] = explanations[test_name]
                    print(f"DEBUG: Set explanation for {test_name}")
                else:
                    test['explanation'] = f"This test measures {test_name} levels in your body."

            # Add summary and recommendations to the first test or create a summary field
            if tests:
                tests[0]['health_summary'] = analysis.get('health_summary', '')
                tests[0]['concerning_findings'] = analysis.get('concerning_findings', [])
                tests[0]['dietary_recommendations'] = analysis.get('dietary_recommendations', [])
                tests[0]['lifestyle_recommendations'] = analysis.get('lifestyle_recommendations', [])

                print(f"DEBUG: Added summary: {bool(tests[0].get('health_summary'))}")
                print(f"DEBUG: Added concerning findings: {len(tests[0].get('concerning_findings', []))}")
                print(f"DEBUG: Added dietary recs: {len(tests[0].get('dietary_recommendations', []))}")
                print(f"DEBUG: Added lifestyle recs: {len(tests[0].get('lifestyle_recommendations', []))}")

            return tests

    except Exception as e:
        print(f"Gemini personalized analysis failed: {e}")

    # Fallback to OpenAI
    try:
        if os.getenv('OPENAI_API_KEY'):
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a medical expert providing personalized health analysis. Return only valid JSON."},
                    {"role": "user", "content": comprehensive_prompt}
                ],
                temperature=0.4,  # Moderate temperature for personalized analysis
                max_tokens=3000
            )

            response_text = response.choices[0].message.content.strip()

            # Clean the response to get valid JSON
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            # Parse the comprehensive analysis
            analysis = json.loads(response_text)

            # Assign explanations to tests
            explanations = analysis.get('test_explanations', {})
            for test in tests:
                test_name = test['test_name']
                if test_name in explanations:
                    test['explanation'] = explanations[test_name]
                else:
                    test['explanation'] = f"This test measures {test_name} levels in your body."

            # Add summary and recommendations to the first test
            if tests:
                tests[0]['health_summary'] = analysis.get('health_summary', '')
                tests[0]['concerning_findings'] = analysis.get('concerning_findings', [])
                tests[0]['dietary_recommendations'] = analysis.get('dietary_recommendations', [])
                tests[0]['lifestyle_recommendations'] = analysis.get('lifestyle_recommendations', [])

            return tests

    except Exception as e:
        print(f"OpenAI personalized analysis also failed: {e}")

    # Final fallback: use basic explanations
    for test in tests:
        test['explanation'] = f"This test measures {test['test_name']} levels in your body."
        if not test.get('health_summary'):
            test['health_summary'] = "Your test results show various health markers. Consult with your healthcare provider for personalized interpretation."
            test['concerning_findings'] = []
            test['dietary_recommendations'] = ["Maintain a balanced diet rich in fruits, vegetables, and whole grains."]
            test['lifestyle_recommendations'] = ["Regular exercise and adequate sleep are important for health."]

    return tests

def generate_test_explanations(tests):
    """Generate test explanations using Gemini primary, OpenAI fallback."""
    if not tests:
        return tests

    if os.getenv('GEMINI_API_KEY'):
        try:
            return generate_test_explanations_gemini(tests)
        except Exception as e:
            print(f"Gemini explanations failed, falling back to OpenAI: {e}")

    if os.getenv('OPENAI_API_KEY'):
        try:
            return generate_test_explanations_openai(tests)
        except Exception as e:
            print(f"OpenAI explanations also failed: {e}")

    # Final fallback: assign generic explanations
    for test in tests:
        test['explanation'] = f"This test measures {test['test_name']} levels in the body."

    return tests

def analyze_report(text, user_profile=None, fast_mode=False):
    """Analyze the extracted text using Gemini primary, OpenAI fallback with personalized insights."""
    # TEMPORARY: Skip LLM calls for testing PDF processing
    # print("🚫 LLM calls commented out for PDF testing - using fast analysis only")
    # return analyze_report_fast(text)

    # Original code (commented out for testing):
    if fast_mode:
        print("⚡ Fast analysis mode - skipping LLM processing...")
        return analyze_report_fast(text)
    
    print("🤖 Creating a report for you...")

    # Extract structured data
    structured_data = extract_medical_data(text)
    print(f"📊 Extracted structured data: {json.dumps(structured_data, indent=2)}")
    
    # Generate personalized explanations and recommendations
    if structured_data['tests']:
        structured_data['tests'] = generate_personalized_analysis(structured_data['tests'], user_profile)
    
    print("✅ Report creation complete")
    return structured_data

def analyze_report_fast(text):
    """Fast analysis using regex patterns instead of LLM."""
    import re

    print("🔍 Performing fast regex-based analysis...")

    # Extract patient info
    patient = {"name": None, "age": None, "gender": None}

    # Name patterns
    name_match = re.search(r'Name\s*[:\-]\s*([A-Za-z\s\.]+)', text, re.IGNORECASE)
    if name_match:
        patient["name"] = name_match.group(1).strip()

    # Age patterns
    age_match = re.search(r'Age\s*[:\-]\s*(\d+)', text, re.IGNORECASE)
    if age_match:
        patient["age"] = int(age_match.group(1))

    # Gender patterns
    gender_match = re.search(r'Gender\s*[:\-]\s*([A-Za-z]+)', text, re.IGNORECASE)
    if gender_match:
        patient["gender"] = gender_match.group(1).strip()

    # Extract tests using regex patterns
    tests = []

    # Common medical test patterns
    test_patterns = [
        # (test_name, value_pattern, unit_pattern, range_pattern)
        ('Hemoglobin', r'Hemoglobin[^0-9]*([0-9]+\.?[0-9]*)', r'g/dL', r'(\d+\.?\d*\s*-\s*\d+\.?\d*)'),
        ('RBC Count', r'RBC[^0-9]*([0-9]+\.?[0-9]*)', r'mill/mm3', r'(\d+\.?\d*\s*-\s*\d+\.?\d*)'),
        ('WBC Count', r'WBC[^0-9]*([0-9]+\.?[0-9]*)', r'thou/mm3', r'(\d+\.?\d*\s*-\s*\d+\.?\d*)'),
        ('Platelet Count', r'Platelet[^0-9]*([0-9]+\.?[0-9]*)', r'thou/mm3', r'(\d+\.?\d*\s*-\s*\d+\.?\d*)'),
        ('Glucose', r'Glucose[^0-9]*([0-9]+\.?[0-9]*)', r'mg/dL', r'(\d+\.?\d*\s*-\s*\d+\.?\d*)'),
        ('Cholesterol', r'Cholesterol[^0-9]*([0-9]+\.?[0-9]*)', r'mg/dL', r'(\d+\.?\d*\s*-\s*\d+\.?\d*)'),
    ]

    for test_name, value_pattern, unit, range_pattern in test_patterns:
        value_match = re.search(value_pattern, text, re.IGNORECASE)
        if value_match:
            value = value_match.group(1)

            # Find reference range
            range_match = re.search(range_pattern, text[value_match.end():value_match.end()+50], re.IGNORECASE)
            reference_range = range_match.group(1) if range_match else None

            # Determine interpretation (basic)
            interpretation = "Unknown"
            if reference_range:
                try:
                    min_val, max_val = map(float, reference_range.split('-'))
                    val_float = float(value)
                    if val_float < min_val:
                        interpretation = "Low"
                    elif val_float > max_val:
                        interpretation = "High"
                    else:
                        interpretation = "Normal"
                except:
                    pass

            tests.append({
                "test_name": test_name,
                "value": value,
                "unit": unit,
                "reference_range": reference_range,
                "interpretation": interpretation,
                "explanation": f"This test measures {test_name.lower()} levels in your blood."
            })

    # Add basic summary
    health_summary = f"Found {len(tests)} test results. "
    if tests:
        abnormal_count = sum(1 for t in tests if t['interpretation'] in ['High', 'Low'])
        if abnormal_count > 0:
            health_summary += f"{abnormal_count} results are outside normal ranges."
        else:
            health_summary += "All results appear to be within normal ranges."

    # Add to first test for display
    if tests:
        tests[0]['health_summary'] = health_summary
        tests[0]['concerning_findings'] = []
        tests[0]['dietary_recommendations'] = ["Maintain a balanced diet"]
        tests[0]['lifestyle_recommendations'] = ["Regular exercise is recommended"]

    print(f"✅ Fast analysis complete - found {len(tests)} tests")
    return {"patient": patient, "tests": tests}

def extract_dates_from_text_llm(text):
    """Extract dates from medical report text using LLM for better accuracy."""
    if not text or len(text.strip()) < 10:
        return []

    prompt = f"""Extract all dates from this medical report text. Return ONLY a JSON array of date strings in YYYY-MM-DD format.

Common date formats in medical reports:
- DD/MM/YYYY or DD-MM-YYYY (e.g., 15/01/2024, 15-01-2024)
- MM/DD/YYYY (e.g., 01/15/2024)
- DD Month YYYY (e.g., 15 Jan 2024, 15 January 2024)
- Month DD, YYYY (e.g., Jan 15, 2024, January 15, 2024)
- YYYY-MM-DD (e.g., 2024-01-15)

Instructions:
- Find ALL dates mentioned in the report
- Convert them to YYYY-MM-DD format
- Remove duplicates
- Sort by most recent first
- Return only valid dates (not future dates beyond 2030 or before 1950)
- Return as JSON array: ["2024-01-15", "2024-01-10", "2023-12-01"]

Report text:
{text[:2000]}...[TRUNCATED IF LONGER]

Return ONLY the JSON array, no explanations."""

    try:
        # Try Gemini first
        if os.getenv('GEMINI_API_KEY'):
            response = gemini_model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,  # Low temperature for consistent extraction
                    max_output_tokens=500,
                )
            )

            response_text = response.text.strip()

            # Clean the response
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            # Parse the JSON
            dates = json.loads(response_text)

            if isinstance(dates, list) and all(isinstance(d, str) for d in dates):
                # Validate dates
                valid_dates = []
                for date_str in dates:
                    try:
                        # Validate date format and range
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                        if 1950 <= date_obj.year <= 2030:
                            valid_dates.append(date_str)
                    except ValueError:
                        continue

                # Remove duplicates and sort
                unique_dates = list(set(valid_dates))
                unique_dates.sort(reverse=True)

                print(f"🤖 LLM extracted {len(unique_dates)} dates: {unique_dates}")
                return unique_dates

    except Exception as e:
        print(f"LLM date extraction failed: {e}")

    # Fallback to regex extraction
    print("🔄 Falling back to regex date extraction")
    return extract_dates_from_text_regex(text)


def extract_dates_from_text_regex(text):
    """Fallback regex-based date extraction."""
    dates = []

    # Common date patterns in medical reports
    date_patterns = [
        # DD/MM/YYYY or DD-MM-YYYY
        r'\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b',
        # MM/DD/YYYY
        r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b',
        # DD Month YYYY (e.g., 15 Jan 2024)
        r'\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b',
        # Month DD, YYYY (e.g., Jan 15, 2024)
        r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b',
        # YYYY-MM-DD
        r'\b(\d{4})-(\d{1,2})-(\d{1,2})\b',
    ]

    month_names = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }

    for pattern in date_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            try:
                if len(match) == 3:
                    if pattern == date_patterns[0] or pattern == date_patterns[1]:  # DD/MM/YYYY or DD-MM-YYYY
                        day, month, year = map(int, match)
                    elif pattern == date_patterns[2]:  # DD Month YYYY
                        day = int(match[0])
                        month = month_names[match[1].lower()[:3]]
                        year = int(match[2])
                    elif pattern == date_patterns[3]:  # Month DD, YYYY
                        month = month_names[match[0].lower()[:3]]
                        day = int(match[1])
                        year = int(match[2])
                    elif pattern == date_patterns[4]:  # YYYY-MM-DD
                        year, month, day = map(int, match)

                    # Validate date
                    if 1 <= month <= 12 and 1 <= day <= 31 and 1950 <= year <= 2030:
                        # Create standardized date string
                        date_obj = datetime(year, month, day)
                        date_str = date_obj.strftime('%Y-%m-%d')
                        dates.append(date_str)

            except (ValueError, KeyError):
                continue

    # Remove duplicates and sort
    unique_dates = list(set(dates))
    unique_dates.sort(reverse=True)  # Most recent first

    return unique_dates


def extract_dates_from_text(text):
    """Main date extraction function - uses LLM primary, regex fallback."""
    return extract_dates_from_text_llm(text)


def group_tests_by_date(text, tests, llm_data=None):
    """Group tests by their associated dates from the report text, LLM structured data, or page-based data."""
    if not tests:
        return {"tests_by_date": {}, "date_order": []}

    # First, try to use page-based LLM data if available
    if llm_data and isinstance(llm_data, dict) and 'pages' in llm_data:
        print("📄 Using page-based date grouping...")
        tests_by_date = {}

        for page in llm_data.get('pages', []):
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
                        "interpretation": "Normal" if not test.get('is_abnormal', False) else "High"
                    }
                    formatted_tests.append(formatted_test)

                if formatted_tests:
                    tests_by_date[page_date] = formatted_tests

        if tests_by_date:
            # Sort dates (most recent first)
            date_order = sorted(tests_by_date.keys(), reverse=True)
            print(f"📊 Page-grouped tests by date: {dict((k, len(v)) for k, v in tests_by_date.items())}")
            return {
                "tests_by_date": tests_by_date,
                "date_order": date_order
            }

    # Second, try to use XMR structured LLM data if available
    if llm_data and isinstance(llm_data, list) and len(llm_data) > 0:
        print("📅 Using XMR-structured date grouping...")
        tests_by_date = {}

        for entry in llm_data:
            sample_date = entry.get('sample_date')
            if sample_date:
                # Convert data_points to test format
                entry_tests = []
                for data_point in entry.get('data_points', []):
                    test = {
                        "test_name": data_point.get('name', ''),
                        "value": str(data_point.get('value', '')),
                        "unit": data_point.get('unit'),
                        "reference_range": None,  # Not provided in LLM format
                        "interpretation": "Normal" if not data_point.get('is_abnormal', False) else "High"
                    }
                    entry_tests.append(test)

                if entry_tests:
                    tests_by_date[sample_date] = entry_tests

        if tests_by_date:
            # Sort dates (most recent first)
            date_order = sorted(tests_by_date.keys(), reverse=True)
            print(f"📊 XMR-grouped tests by date: {dict((k, len(v)) for k, v in tests_by_date.items())}")
            return {
                "tests_by_date": tests_by_date,
                "date_order": date_order
            }

    # Fallback to text-based date extraction
    print("📅 Falling back to text-based date grouping...")
    dates = extract_dates_from_text(text)

    if not dates:
        # No dates found, put all tests under a default date
        return {
            "tests_by_date": {"latest": tests},
            "date_order": ["latest"]
        }

    # Initialize date groups
    tests_by_date = {date: [] for date in dates}
    tests_by_date["unassigned"] = []

    # For each test, find the most recent date that appears before it in the text
    text_lower = text.lower()

    for test in tests:
        test_name_lower = test['test_name'].lower()
        test_positions = []

        # Find all occurrences of this test name in the text
        for match in re.finditer(re.escape(test_name_lower), text_lower):
            test_positions.append(match.start())

        if test_positions:
            # Find the most recent date that appears before this test
            assigned_date = None
            for pos in test_positions:
                for date in dates:
                    date_pos = text_lower.find(date)
                    if date_pos != -1 and date_pos < pos:
                        if assigned_date is None or date > assigned_date:
                            assigned_date = date
                        break

            if assigned_date:
                tests_by_date[assigned_date].append(test)
            else:
                tests_by_date["unassigned"].append(test)
        else:
            tests_by_date["unassigned"].append(test)

    # Remove empty date groups and unassigned if it's the only group
    tests_by_date = {k: v for k, v in tests_by_date.items() if v}

    # If only unassigned remains, use "latest" instead
    if list(tests_by_date.keys()) == ["unassigned"]:
        tests_by_date = {"latest": tests_by_date["unassigned"]}

    # Sort dates (most recent first)
    date_order = sorted(tests_by_date.keys(), reverse=True)

    print(f"📊 Text-grouped tests by date: {dict((k, len(v)) for k, v in tests_by_date.items())}")

    return {
        "tests_by_date": tests_by_date,
        "date_order": date_order
    }


def analyze_report_with_date_grouping(text, user_profile=None, fast_mode=False):
    """Analyze report and group tests by date."""
    # Get basic analysis
    if fast_mode:
        print("⚡ Fast analysis mode - skipping LLM processing...")
        results = analyze_report_fast(text)
    else:
        print("🤖 Creating dated report for you...")
        results = analyze_report(text, user_profile, fast_mode=False)

    # Group tests by date
    date_grouping = group_tests_by_date(text, results.get('tests', []))

    # Merge date grouping into results
    results['tests_by_date'] = date_grouping['tests_by_date']
    results['date_order'] = date_grouping['date_order']

    print("✅ Date grouping complete")
    return results


def display_analysis(results):
    """Pretty-print the analyzed report."""
    print("\n========= MEDICAL REPORT ANALYSIS =========\n")

    if results.get('patient'):
        patient = results['patient']
        if patient.get('name'):
            print(f"Patient: {patient['name']}")
        if patient.get('age'):
            print(f"Age: {patient['age']}")
        if patient.get('gender'):
            print(f"Gender: {patient['gender']}")
        print()

    # Show date-grouped results if available
    if results.get('tests_by_date'):
        print("📅 Tests Grouped by Date:\n")
        for date in results.get('date_order', []):
            tests = results['tests_by_date'][date]
            if tests:
                print(f"📆 {date}:")
                for test in tests:
                    print(f"  🧪 {test['test_name']}: {test['value']} {test.get('unit', '')} ({test['interpretation']})")
                print()
    elif results.get('tests'):
        # Fallback to regular display
        for test in results['tests']:
            print(f"🧪 {test['test_name']}: {test['value']} {test.get('unit', '')}")
            if test.get('reference_range'):
                print(f"Reference Range: {test['reference_range']}")
            print(f"Interpretation: {test['interpretation']}")
            if test.get('explanation'):
                print(f"Explanation: {test['explanation']}")
            print()

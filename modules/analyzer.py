import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure OpenAI API
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def extract_medical_data(text):
    """Use OpenAI to extract structured medical data from report text."""
    prompt = """You are an information extraction system.

Extract lab test data from the following medical report text.
Return ONLY valid JSON matching this schema.

Schema:
{
  "patient": {
    "name": string | null,
    "age": number | null,
    "gender": string | null
  },
  "tests": [
    {
      "test_name": string,
      "value": string,
      "unit": string | null,
      "reference_range": string | null,
      "interpretation": "Low" | "Normal" | "High" | "Unknown"
    }
  ]
}

Rules:
- Do not add explanations
- Do not hallucinate missing values
- If unsure, use null

Medical Report Text:
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

        return json.loads(response_text)
    except Exception as e:
        print(f"Error extracting medical data: {e}")
        return {
            "patient": {"name": None, "age": None, "gender": None},
            "tests": []
        }

def generate_test_explanations(tests):
    """Generate explanations for each test using OpenAI in a single batch request."""
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
        print(f"Error generating batch explanations: {e}")
        # Fallback: assign generic explanations
        for test in tests:
            test['explanation'] = f"This test measures {test['test_name']} levels in the body."

    return tests

def analyze_report(text):
    """Analyze the extracted text using OpenAI."""
    # Extract structured data
    structured_data = extract_medical_data(text)

    # Generate explanations for each test
    if structured_data['tests']:
        structured_data['tests'] = generate_test_explanations(structured_data['tests'])

    return structured_data

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

    if results.get('tests'):
        for test in results['tests']:
            print(f"🧪 {test['test_name']}: {test['value']} {test.get('unit', '')}")
            if test.get('reference_range'):
                print(f"Reference Range: {test['reference_range']}")
            print(f"Interpretation: {test['interpretation']}")
            if test.get('explanation'):
                print(f"Explanation: {test['explanation']}")
            print()

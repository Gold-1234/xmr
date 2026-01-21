import re

# Reference ranges and interpretation database
reference_ranges = {
    "Hemoglobin": {"unit": "g/dL", "normal_low": 12.0, "normal_high": 16.0,
                   "meaning": "Hemoglobin carries oxygen in red blood cells.",
                   "causes": "Low levels may indicate anemia, poor diet, or blood loss.",
                   "correction": "Increase iron intake through foods like spinach, or consult a doctor."},
    "Glucose": {"unit": "mg/dL", "normal_low": 70, "normal_high": 140,
                "meaning": "Glucose is the body’s main source of energy.",
                "causes": "High levels may indicate diabetes or high sugar intake.",
                "correction": "Reduce sugar intake and maintain regular exercise."},
    "Cholesterol": {"unit": "mg/dL", "normal_low": 0, "normal_high": 200,
                    "meaning": "Cholesterol is essential for hormone production but harmful in excess.",
                    "causes": "High levels may result from fatty diet or lack of exercise.",
                    "correction": "Avoid fried foods, increase fiber, and exercise regularly."}
}

def analyze_report(text):
    """Analyze the extracted text and find test deviations + interpretations."""
    results = []
    for test, ref in reference_ranges.items():
        pattern = rf"{test}[:\-\s]*([0-9]+\.?[0-9]*)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = float(match.group(1))
            deviation_info = ""

            if value < ref["normal_low"]:
                deviation = ref["normal_low"] - value
                deviation_info = f"↓ Low by {deviation:.2f} {ref['unit']} (below normal)"
            elif value > ref["normal_high"]:
                deviation = value - ref["normal_high"]
                deviation_info = f"↑ High by {deviation:.2f} {ref['unit']} (above normal)"
            else:
                deviation_info = "✅ Within normal range"

            results.append({
                "test": test,
                "value": f"{value} {ref['unit']}",
                "deviation": deviation_info,
                "meaning": ref["meaning"],
                "causes": ref["causes"],
                "correction": ref["correction"]
            })
    return results

def display_analysis(results):
    """Pretty-print the analyzed report."""
    print("\n========= MEDICAL REPORT ANALYSIS =========\n")
    for r in results:
        print(f"🧪 {r['test']}: {r['value']}")
        print(f"➡ Deviation: {r['deviation']}")
        print(f"📖 Meaning: {r['meaning']}")
        print(f"⚠️ Possible Causes: {r['causes']}")
        print(f"💊 Suggested Correction: {r['correction']}\n")

"""
Test suite for Vertex AI migration fixes.
Covers: imports, module init, OCR pipeline, analyzer pipeline, fallback paths.
"""
import os
import sys
import traceback

# ── colour helpers ──────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"

def ok(msg):   print(f"  {GREEN}✅ PASS{RESET}  {msg}")
def fail(msg): print(f"  {RED}❌ FAIL{RESET}  {msg}")
def warn(msg): print(f"  {YELLOW}⚠️  WARN{RESET}  {msg}")
def section(msg): print(f"\n{'='*60}\n{msg}\n{'='*60}")


# ── 1. IMPORT TESTS ─────────────────────────────────────────────────────────
section("1. Import Tests")

try:
    import modules.ocr_reader as ocr
    ok("modules.ocr_reader imported")
except Exception as e:
    fail(f"modules.ocr_reader import failed: {e}")
    traceback.print_exc()

try:
    import modules.analyzer as analyzer
    ok("modules.analyzer imported")
except Exception as e:
    fail(f"modules.analyzer import failed: {e}")
    traceback.print_exc()

try:
    from modules.analyzer import (
        extract_medical_data_gemini,
        extract_medical_data,
        generate_personalized_analysis,
        generate_test_explanations,
        analyze_report,
        analyze_report_fast,
        analyze_report_with_date_grouping,
        _parse_llm_json,
    )
    ok("All analyzer functions importable")
except Exception as e:
    fail(f"Function import failed: {e}")

try:
    from modules.ocr_reader import (
        extract_text_from_image,
        extract_text_from_image_vertex_vision,
        extract_text_from_image_enhanced,
        validate_medical_text,
    )
    ok("All ocr_reader functions importable")
except Exception as e:
    fail(f"OCR function import failed: {e}")

# ── 2. REMOVED DEPENDENCY CHECKS ────────────────────────────────────────────
section("2. Removed Dependencies (should NOT exist)")

# These should no longer be importable from our modules
import importlib, ast

for module_name, attr in [
    ("modules.analyzer", "extract_medical_data_openai"),
    ("modules.analyzer", "generate_test_explanations_openai"),
    ("modules.analyzer", "extract_medical_data_vertex_claude"),
    ("modules.analyzer", "vertex_model"),  # old vertexai SDK model
    ("modules.analyzer", "client"),        # OpenAI client
]:
    mod = sys.modules.get(module_name)
    if mod and hasattr(mod, attr):
        fail(f"modules.analyzer still has '{attr}' (should be removed)")
    else:
        ok(f"modules.analyzer.{attr} correctly removed")

for attr in ["openai_client", "OPENAI_AVAILABLE"]:
    mod = sys.modules.get("modules.ocr_reader")
    if mod and hasattr(mod, attr):
        fail(f"modules.ocr_reader still has '{attr}' (should be removed)")
    else:
        ok(f"modules.ocr_reader.{attr} correctly removed")

# ── 3. VERTEX AI SETUP CHECK ────────────────────────────────────────────────
section("3. Vertex AI Setup")

mod_a = sys.modules.get("modules.analyzer")
mod_o = sys.modules.get("modules.ocr_reader")

if mod_a:
    if mod_a.VERTEX_AI_AVAILABLE:
        ok(f"analyzer.VERTEX_AI_AVAILABLE=True  (model: {mod_a.VERTEX_MODEL_NAME})")
    else:
        warn("analyzer.VERTEX_AI_AVAILABLE=False — check VERTEX_AI_API_KEY")

    if mod_a.gemini_client is not None:
        ok(f"analyzer.gemini_client is ready ({type(mod_a.gemini_client).__name__})")
    else:
        warn("analyzer.gemini_client is None — client init failed")

if mod_o:
    if mod_o.VERTEX_AI_AVAILABLE:
        ok(f"ocr_reader.VERTEX_AI_AVAILABLE=True  (model: {mod_o.VERTEX_MODEL_NAME})")
    else:
        warn("ocr_reader.VERTEX_AI_AVAILABLE=False — check VERTEX_AI_API_KEY")

api_key = os.environ.get("VERTEX_AI_API_KEY", "NOT SET")
if api_key == "NOT SET":
    warn("VERTEX_AI_API_KEY not set in environment")
else:
    ok(f"VERTEX_AI_API_KEY={api_key[:10]}...")

# ── 4. _parse_llm_json HELPER ────────────────────────────────────────────────
section("4. _parse_llm_json Helper")

cases = [
    ('plain JSON',        '{"patient": {"name": "John"}, "tests": []}'),
    ('json fenced',       '```json\n{"patient": null, "tests": []}\n```'),
    ('plain fenced',      '```\n{"patient": null, "tests": []}\n```'),
    ('truncated braces',  '{"patient": {"name": "A"}, "tests": [{"test_name": "Hb"}]}  extra'),
]

for label, raw in cases:
    try:
        result = _parse_llm_json(raw)
        ok(f"Parsed {label}: keys={list(result.keys())}")
    except Exception as e:
        fail(f"Failed to parse {label}: {e}")

# ── 5. FAST ANALYSIS (no LLM) ────────────────────────────────────────────────
section("5. Fast Analysis (regex, no LLM)")

sample_report = """
Patient Name: John Doe
Age: 45
Gender: Male
Date: 15/01/2024

Hemoglobin: 13.2 g/dL  Reference Range: 13.5 - 17.5
Glucose: 112 mg/dL      Reference Range: 70 - 100
Cholesterol: 185 mg/dL  Reference Range: 0 - 200
WBC Count: 7500 thou/mm3
Platelet Count: 210 thou/mm3
"""

try:
    result = analyze_report_fast(sample_report)
    assert isinstance(result, dict), "Expected dict"
    assert "patient" in result, "Missing 'patient' key"
    assert "tests" in result, "Missing 'tests' key"
    found = len(result["tests"])
    ok(f"Fast analysis returned {found} tests from sample report")
    for t in result["tests"]:
        ok(f"  {t['test_name']}: {t['value']} {t.get('unit','')} — {t['interpretation']}")
except Exception as e:
    fail(f"Fast analysis failed: {e}")
    traceback.print_exc()

# ── 6. DETERMINE INTERPRETATION ──────────────────────────────────────────────
section("6. Interpretation Logic")

from modules.analyzer import determine_interpretation

cases = [
    ("Hemoglobin", "13.2", "13.5-17.5 g/dL", "Low"),
    ("Glucose",    "112",  "70-100 mg/dL",    "High"),
    ("Glucose",    "85",   "70-100 mg/dL",    "Normal"),
    ("TSH",        "3.0",  "< 4.5 mIU/L",     "Normal"),
    ("ALT",        "55",   "> 40 U/L",         "Normal"),
]

for test, val, ref, expected in cases:
    result = determine_interpretation(val, ref, test)
    if result == expected:
        ok(f"{test} {val} vs '{ref}' → {result}")
    else:
        fail(f"{test} {val} vs '{ref}' → got '{result}', expected '{expected}'")

# ── 7. DATE EXTRACTION ───────────────────────────────────────────────────────
section("7. Regex Date Extraction")

from modules.analyzer import extract_dates_from_text_regex

texts = [
    ("DD/MM/YYYY",      "Report dated 15/01/2024",           "2024-01-15"),
    ("Month DD YYYY",   "Collected on Jan 15 2024",          "2024-01-15"),
    ("YYYY-MM-DD",      "Sample date: 2024-01-15",           "2024-01-15"),
    ("DD Month YYYY",   "Date of sample: 15 January 2024",   "2024-01-15"),
]

for label, text, expected in texts:
    dates = extract_dates_from_text_regex(text)
    if expected in dates:
        ok(f"{label}: found {expected}")
    else:
        fail(f"{label}: expected {expected}, got {dates}")

# ── 8. OCR — validate_medical_text ──────────────────────────────────────────
section("8. OCR validate_medical_text Scorer")

medical_text    = "Hemoglobin: 13.2 g/dL  Glucose: 112 mg/dL  Range: 70-100"
non_medical     = "Hello world, how are you today? The weather is nice."
empty_text      = ""

score_medical   = validate_medical_text(medical_text)
score_non       = validate_medical_text(non_medical)
score_empty     = validate_medical_text(empty_text)

if score_medical > 0.5:
    ok(f"Medical text scored {score_medical:.2f} (>0.5)")
else:
    fail(f"Medical text scored too low: {score_medical:.2f}")

if score_non < score_medical:
    ok(f"Non-medical text scored lower ({score_non:.2f} < {score_medical:.2f})")
else:
    fail(f"Non-medical text should score lower than medical text")

if score_empty == 0.0:
    ok(f"Empty text scored 0.0")
else:
    fail(f"Empty text scored {score_empty:.2f}, expected 0.0")

# ── 9. OCR — test image path (live call if project is real) ─────────────────
section("9. OCR on test_report.png")

test_image = "uploads/test_report.png"
if not os.path.exists(test_image):
    warn(f"Test image not found at {test_image} — skipping live OCR test")
else:
    gcp_project = os.environ.get("GCP_PROJECT_ID", "")
    if gcp_project == "dummy" or not gcp_project:
        warn("Skipping live OCR call — GCP_PROJECT_ID is not a real project")
        warn("Update GCP_PROJECT_ID in .env and re-run to test live OCR")
    else:
        try:
            text = extract_text_from_image(test_image)
            if text and len(text) > 20:
                score = validate_medical_text(text)
                ok(f"OCR returned {len(text)} chars, medical score={score:.2f}")
                ok(f"  Preview: {text[:120].replace(chr(10),' ')}...")
            else:
                fail(f"OCR returned too little text: '{text}'")
        except Exception as e:
            fail(f"OCR call failed: {e}")
            traceback.print_exc()

# ── 10. FULL PIPELINE — fast mode (no LLM) ───────────────────────────────────
section("10. Full Pipeline — fast mode (no LLM needed)")

try:
    from main import analyze_file
    gcp_project = os.environ.get("GCP_PROJECT_ID", "")
    test_image = "uploads/test_report.png"
    if not os.path.exists(test_image):
        warn(f"Test image not found at {test_image}, skipping")
    else:
        result = analyze_file(test_image, fast_mode=True)
        assert isinstance(result, dict)
        assert "patient" in result
        assert "tests" in result
        assert "tests_by_date" in result
        ok(f"analyze_file(fast_mode=True) returned {len(result['tests'])} tests")
        ok(f"Date groups: {list(result['tests_by_date'].keys())}")
except Exception as e:
    fail(f"Full pipeline (fast mode) failed: {e}")
    traceback.print_exc()

# ── 11. FULL PIPELINE — LLM mode ─────────────────────────────────────────────
section("11. Full Pipeline — LLM mode (requires real GCP_PROJECT_ID)")

gcp_project = os.environ.get("GCP_PROJECT_ID", "")
if gcp_project == "dummy" or not gcp_project:
    warn("Skipping LLM pipeline test — set a real GCP_PROJECT_ID in .env to run this")
else:
    try:
        from main import analyze_file
        test_image = "uploads/test_report.png"
        if not os.path.exists(test_image):
            warn(f"Test image not found at {test_image}, skipping")
        else:
            result = analyze_file(test_image, fast_mode=False)
            assert isinstance(result, dict)
            assert "tests" in result
            ok(f"analyze_file(fast_mode=False) returned {len(result['tests'])} tests")
            if result["tests"]:
                t = result["tests"][0]
                ok(f"First test: {t.get('test_name')} = {t.get('value')} {t.get('unit','')}")
                if t.get("explanation"):
                    ok(f"Explanation present: {t['explanation'][:80]}...")
                if t.get("health_summary"):
                    ok(f"Health summary present: {t['health_summary'][:80]}...")
    except Exception as e:
        fail(f"LLM pipeline failed: {e}")
        traceback.print_exc()

# ── SUMMARY ──────────────────────────────────────────────────────────────────
section("Summary")
print("Tests complete. Items marked ⚠️  WARN need GCP_PROJECT_ID set to a real project.")
print("Once GCP_PROJECT_ID is set, re-run to test live Vertex AI calls.")

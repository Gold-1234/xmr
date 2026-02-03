import os
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Try to initialize Supabase clients, but fall back to local storage if keys are invalid
SUPABASE_AVAILABLE = False
try:
    from supabase import create_client, Client

    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    # Only initialize if we have valid-looking keys
    if SUPABASE_URL and SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY:
        try:
            # Test the connection by trying to create clients and make a test call
            supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

            # Test the connection by making a simple query
            test_response = supabase_admin.table('medical_reports').select('count', count='exact').limit(1).execute()
            SUPABASE_AVAILABLE = True
            print("Supabase connection tested successfully")
        except Exception as e:
            print(f"Supabase connection test failed: {e}, using local storage")
            SUPABASE_AVAILABLE = False
    else:
        print("Supabase credentials not found, using local storage")
        SUPABASE_AVAILABLE = False
except ImportError:
    print("Supabase library not available, using local storage")
    SUPABASE_AVAILABLE = False
except Exception as e:
    print(f"Supabase initialization failed: {e}, using local storage")
    SUPABASE_AVAILABLE = False

# Local storage fallback
LOCAL_STORAGE_FILE = 'local_reports.json'

def load_local_reports() -> Dict[str, List[Dict]]:
    """Load reports from local JSON file."""
    try:
        if os.path.exists(LOCAL_STORAGE_FILE):
            with open(LOCAL_STORAGE_FILE, 'r') as f:
                return json.load(f)
        return {}
    except Exception as e:
        print(f"Error loading local reports: {e}")
        return {}

def save_local_reports(reports: Dict[str, List[Dict]]):
    """Save reports to local JSON file."""
    try:
        with open(LOCAL_STORAGE_FILE, 'w') as f:
            json.dump(reports, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving local reports: {e}")

def normalize_interpretation(interpretation: str) -> str:
    """Normalize interpretation values to match database constraints."""
    if not interpretation:
        return "Unknown"

    # Convert common variations to database-allowed values
    interpretation_lower = interpretation.lower().strip()

    if interpretation_lower in ['abnormal', 'abnormal results', 'outside range']:
        return "High"  # Default abnormal results to High
    elif interpretation_lower in ['normal', 'within range', 'normal range']:
        return "Normal"
    elif interpretation_lower in ['low', 'below range', 'below normal']:
        return "Low"
    elif interpretation_lower in ['high', 'above range', 'above normal']:
        return "High"
    elif interpretation_lower == 'unknown':
        return "Unknown"
    else:
        # For any other value, default to Unknown
        return "Unknown"

def save_medical_report(user_id: str, filename: str, file_type: str, file_url: str,
                       patient_info: dict, test_results: list) -> dict:
    """Save a medical report with test results to Supabase or local storage."""
    try:
        print(f"Saving medical report for user: {user_id}")
        print(f"Report data: filename={filename}, file_url={file_url}")

        # Generate a unique ID for the report
        report_id = str(uuid.uuid4())

        # Create report data
        report_data = {
            'id': report_id,
            'user_id': user_id,
            'filename': filename,
            'file_type': file_type,
            'file_url': file_url,
            'extracted_tests': [test['test_name'] for test in test_results],
            'patient_name': patient_info.get('name'),
            'patient_age': patient_info.get('age'),
            'patient_gender': patient_info.get('gender'),
            'created_at': datetime.now().isoformat()
        }

        if SUPABASE_AVAILABLE:
            # Save to Supabase
            print(f"Inserting report data to Supabase: {report_data}")
            report_response = supabase_admin.table('medical_reports').insert(report_data).execute()
            print(f"Report response: {report_response}")
            report_id = report_response.data[0]['id']
            print(f"Report saved with ID: {report_id}")

            # Then save individual test results
            test_results_data = []
            for test in test_results:
                # Normalize interpretation to match database constraints
                normalized_interpretation = normalize_interpretation(test.get('interpretation', 'Unknown'))

                test_result = {
                    'report_id': report_id,
                    'test_name': test['test_name'],
                    'value': test['value'],
                    'unit': test.get('unit'),
                    'reference_range': test.get('reference_range'),
                    'interpretation': normalized_interpretation,
                    'explanation': test.get('explanation')
                }
                test_results_data.append(test_result)

            print(f"Saving {len(test_results_data)} test results")
            if test_results_data:
                test_response = supabase_admin.table('test_results').insert(test_results_data).execute()
                print(f"Test results response: {test_response}")
        else:
            # Save to local storage
            print("Supabase not available, saving to local storage")
            reports = load_local_reports()
            if user_id not in reports:
                reports[user_id] = []

            # Add test results to the report
            report_data['test_results'] = test_results
            reports[user_id].append(report_data)
            save_local_reports(reports)

        print("Medical report saved successfully")
        return {'success': True, 'report_id': report_id}

    except Exception as e:
        print(f"Error saving medical report: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}

def get_user_reports(user_id: str, limit: int = 50, offset: int = 0) -> list:
    """Get user's saved reports from Supabase or local storage."""
    try:
        print(f"Fetching reports for user: {user_id}")

        if SUPABASE_AVAILABLE:
            # Try with admin client first to bypass RLS
            print("Trying with admin client...")
            admin_response = supabase_admin.table('medical_reports')\
                .select('*')\
                .eq('user_id', user_id)\
                .order('created_at', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()

            print(f"Admin client found {len(admin_response.data)} reports")

            # Try with regular client (subject to RLS)
            print("Trying with regular client...")
            response = supabase.table('medical_reports')\
                .select('*')\
                .eq('user_id', user_id)\
                .order('created_at', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()

            print(f"Regular client found {len(response.data)} reports")

            # For demo purposes, return admin results (bypasses RLS)
            # In production, you would need proper authentication and RLS policies
            return admin_response.data
        else:
            # Use local storage
            print("Using local storage")
            reports = load_local_reports()
            user_reports = reports.get(user_id, [])
            # Sort by created_at descending
            user_reports.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            # Apply pagination
            paginated_reports = user_reports[offset:offset + limit]
            print(f"Local storage found {len(paginated_reports)} reports")
            return paginated_reports
    except Exception as e:
        print(f"Error getting user reports: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_report_details(report_id: str) -> dict:
    """Get detailed report information including test results from Supabase or local storage."""
    try:
        print(f"Getting report details for ID: {report_id}")

        if SUPABASE_AVAILABLE:
            # Get report info (use admin client to bypass RLS)
            report_response = supabase_admin.table('medical_reports')\
                .select('*')\
                .eq('id', report_id)\
                .execute()

            if not report_response.data:
                print(f"No report found with ID: {report_id}")
                return None

            report = report_response.data[0]
            print(f"Found report: {report['filename']}")

            # Get test results (use admin client to bypass RLS)
            tests_response = supabase_admin.table('test_results')\
                .select('*')\
                .eq('report_id', report_id)\
                .order('test_name')\
                .execute()

            report['test_results'] = tests_response.data
            print(f"Found {len(tests_response.data)} test results")
        else:
            # Use local storage
            reports = load_local_reports()
            report = None
            for user_reports in reports.values():
                for user_report in user_reports:
                    if user_report.get('id') == report_id:
                        report = user_report
                        break
                if report:
                    break

            if not report:
                print(f"No report found with ID: {report_id}")
                return None

            print(f"Found report: {report['filename']}")
            print(f"Found {len(report.get('test_results', []))} test results")

        return report

    except Exception as e:
        print(f"Error getting report details: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_test_trends(user_id: str, test_name: str) -> list:
    """Get trend data for a specific test across all user's reports from Supabase or local storage."""
    try:
        if SUPABASE_AVAILABLE:
            # Get all test results for this test from user's reports (use admin client to bypass RLS)
            response = supabase_admin.table('test_results')\
                .select('test_results.*, medical_reports.created_at as report_date')\
                .eq('test_name', test_name)\
                .join('medical_reports', 'test_results.report_id', 'medical_reports.id')\
                .eq('medical_reports.user_id', user_id)\
                .order('medical_reports.created_at', desc=False)\
                .execute()

            return response.data
        else:
            # Use local storage
            reports = load_local_reports()
            user_reports = reports.get(user_id, [])
            trends = []

            for report in user_reports:
                report_date = report.get('created_at')
                for test in report.get('test_results', []):
                    if test.get('test_name') == test_name:
                        trends.append({
                            'value': test.get('value'),
                            'unit': test.get('unit'),
                            'interpretation': test.get('interpretation'),
                            'report_date': report_date
                        })

            # Sort by date ascending
            trends.sort(key=lambda x: x.get('report_date', ''))
            return trends
    except Exception as e:
        print(f"Error getting test trends: {e}")
        return []

def delete_report(report_id: str, user_id: str) -> bool:
    """Delete a medical report and all its test results from Supabase or local storage."""
    try:
        if SUPABASE_AVAILABLE:
            # This will cascade delete test results due to foreign key constraint
            # Use admin client to bypass RLS for deletion
            supabase_admin.table('medical_reports')\
                .delete()\
                .eq('id', report_id)\
                .eq('user_id', user_id)\
                .execute()
        else:
            # Delete from local storage
            reports = load_local_reports()
            user_reports = reports.get(user_id, [])
            # Remove the report with the matching ID
            updated_reports = [r for r in user_reports if r.get('id') != report_id]
            if len(updated_reports) != len(user_reports):
                reports[user_id] = updated_reports
                save_local_reports(reports)
                return True

        return True
    except Exception as e:
        print(f"Error deleting report: {e}")
        return False

def get_user_stats(user_id: str) -> dict:
    """Get user statistics for dashboard from Supabase or local storage."""
    try:
        if SUPABASE_AVAILABLE:
            # Count total reports (use admin client to bypass RLS)
            reports_response = supabase_admin.table('medical_reports')\
                .select('id', count='exact')\
                .eq('user_id', user_id)\
                .execute()

            # Count total test results (use admin client to bypass RLS)
            tests_response = supabase_admin.table('test_results')\
                .select('id', count='exact')\
                .join('medical_reports', 'test_results.report_id', 'medical_reports.id')\
                .eq('medical_reports.user_id', user_id)\
                .execute()

            # Get recent test interpretations (use admin client to bypass RLS)
            recent_tests = supabase_admin.table('test_results')\
                .select('interpretation')\
                .join('medical_reports', 'test_results.report_id', 'medical_reports.id')\
                .eq('medical_reports.user_id', user_id)\
                .order('test_results.created_at', desc=True)\
                .limit(10)\
                .execute()

            high_count = sum(1 for test in recent_tests.data if test['interpretation'] == 'High')
            normal_count = sum(1 for test in recent_tests.data if test['interpretation'] == 'Normal')
            low_count = sum(1 for test in recent_tests.data if test['interpretation'] == 'Low')

            return {
                'total_reports': reports_response.count,
                'total_tests': tests_response.count,
                'recent_high': high_count,
                'recent_normal': normal_count,
                'recent_low': low_count
            }
        else:
            # Use local storage
            reports = load_local_reports()
            user_reports = reports.get(user_id, [])

            total_reports = len(user_reports)
            total_tests = sum(len(report.get('test_results', [])) for report in user_reports)

            # Get recent test interpretations (last 10 tests)
            recent_tests = []
            for report in sorted(user_reports, key=lambda x: x.get('created_at', ''), reverse=True):
                for test in report.get('test_results', []):
                    recent_tests.append(test.get('interpretation'))
                    if len(recent_tests) >= 10:
                        break
                if len(recent_tests) >= 10:
                    break

            high_count = recent_tests.count('High')
            normal_count = recent_tests.count('Normal')
            low_count = recent_tests.count('Low')

            return {
                'total_reports': total_reports,
                'total_tests': total_tests,
                'recent_high': high_count,
                'recent_normal': normal_count,
                'recent_low': low_count
            }
    except Exception as e:
        print(f"Error getting user stats: {e}")
        return {
            'total_reports': 0,
            'total_tests': 0,
            'recent_high': 0,
            'recent_normal': 0,
            'recent_low': 0
        }

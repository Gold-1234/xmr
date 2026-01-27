import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

print(f"SUPABASE_URL: {SUPABASE_URL}")
print(f"SUPABASE_ANON_KEY exists: {bool(SUPABASE_ANON_KEY)}")
print(f"SUPABASE_SERVICE_ROLE_KEY exists: {bool(SUPABASE_SERVICE_ROLE_KEY)}")

# Initialize Supabase clients
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def test_db_connection():
    """Test database connection and fetch reports for test user."""
    user_id = "4f6aedf0-2ecd-4ff8-bbd7-ef08743a8f23"

    print(f"\n=== Testing Database Connection ===")
    print(f"Target User ID: {user_id}")

    try:
        # Test basic connection - try to get all tables (admin only)
        print(f"\n--- Testing Admin Connection ---")
        # This will fail if tables don't exist, but will show if connection works
        response = supabase_admin.table('medical_reports').select('count', count='exact').execute()
        print(f"Medical reports table exists. Total records: {response.count}")

        # Try to fetch reports for the test user
        print(f"\n--- Fetching Reports for User ---")
        response = supabase_admin.table('medical_reports')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()

        reports = response.data
        print(f"Found {len(reports)} reports for user {user_id}")

        if reports:
            print(f"\n--- Report Details ---")
            for i, report in enumerate(reports, 1):
                print(f"Report {i}:")
                print(f"  ID: {report['id']}")
                print(f"  Filename: {report['filename']}")
                print(f"  File URL: {report['file_url']}")
                print(f"  Patient: {report.get('patient_name', 'N/A')} ({report.get('patient_age', 'N/A')}, {report.get('patient_gender', 'N/A')})")
                print(f"  Tests: {len(report.get('extracted_tests', []))} extracted")
                print(f"  Created: {report['created_at']}")
                print()

        # Try to fetch test results
        if reports:
            print(f"\n--- Test Results for First Report ---")
            first_report_id = reports[0]['id']
            test_response = supabase_admin.table('test_results')\
                .select('*')\
                .eq('report_id', first_report_id)\
                .execute()

            tests = test_response.data
            print(f"Found {len(tests)} test results for report {first_report_id}")
            if tests:
                for test in tests[:3]:  # Show first 3 tests
                    print(f"  {test['test_name']}: {test['value']} {test.get('unit', '')} ({test['interpretation']})")

    except Exception as e:
        print(f"Database error: {e}")
        print("This likely means the tables don't exist in Supabase yet.")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_db_connection()
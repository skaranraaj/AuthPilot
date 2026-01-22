import requests
import sys
import json
from datetime import datetime

class AuthPilotAPITester:
    def __init__(self, base_url="https://authcycle.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_seed_data(self):
        """Test seeding demo data"""
        success, response = self.run_test(
            "Seed Demo Data",
            "POST",
            "seed",
            200
        )
        return success

    def test_login(self):
        """Test demo login"""
        success, response = self.run_test(
            "Demo Login",
            "POST",
            "auth/login",
            200,
            data={"email": "demo@authpilot.com", "password": "demo123"}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_get_me(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success:
            print(f"   Stats: {response}")
        return success

    def test_get_cases(self):
        """Test getting cases"""
        success, response = self.run_test(
            "Get Cases",
            "GET",
            "cases",
            200
        )
        
        if success:
            print(f"   Found {len(response)} cases")
            return response
        return []

    def test_get_policies(self):
        """Test getting policies"""
        success, response = self.run_test(
            "Get Policies",
            "GET",
            "policies",
            200
        )
        
        if success:
            print(f"   Found {len(response)} policies")
        return success

    def test_get_templates(self):
        """Test getting templates"""
        success, response = self.run_test(
            "Get Templates",
            "GET",
            "templates",
            200
        )
        
        if success:
            print(f"   Found {len(response)} templates")
        return success

    def test_analytics_summary(self):
        """Test analytics summary"""
        success, response = self.run_test(
            "Analytics Summary",
            "GET",
            "analytics/summary",
            200
        )
        
        if success:
            print(f"   Analytics: {response}")
        return success

    def test_analytics_denial_types(self):
        """Test analytics denial types"""
        success, response = self.run_test(
            "Analytics Denial Types",
            "GET",
            "analytics/denial-types",
            200
        )
        return success

    def test_case_operations(self, cases):
        """Test case-specific operations"""
        if not cases:
            print("⚠️  No cases available for testing case operations")
            return False
        
        case_id = cases[0]['id']
        print(f"\n🔍 Testing case operations with case: {case_id}")
        
        # Test get specific case
        success, _ = self.run_test(
            "Get Specific Case",
            "GET",
            f"cases/{case_id}",
            200
        )
        
        if not success:
            return False
        
        # Test get case documents
        success, _ = self.run_test(
            "Get Case Documents",
            "GET",
            f"cases/{case_id}/documents",
            200
        )
        
        return success

    def test_create_case(self):
        """Test creating a new case"""
        case_data = {
            "payer": "Test Insurance",
            "state": "CA",
            "cpt_codes": ["99213"],
            "icd10_codes": ["Z00.00"],
            "request_type": "Appeal",
            "due_date": "2024-12-31",
            "patient_name": "Test Patient",
            "patient_dob": "1990-01-01",
            "patient_mrn": "TEST123"
        }
        
        success, response = self.run_test(
            "Create New Case",
            "POST",
            "cases",
            200,
            data=case_data
        )
        
        if success:
            return response.get('id')
        return None

    def run_all_tests(self):
        """Run comprehensive API tests"""
        print("🚀 Starting AuthPilot API Tests")
        print("=" * 50)
        
        # Test 1: Seed data (this should create demo user and sample data)
        print("\n📊 SEEDING DEMO DATA")
        if not self.test_seed_data():
            print("❌ Seeding failed - this might be expected if data already exists")
        
        # Test 2: Authentication
        print("\n🔐 AUTHENTICATION TESTS")
        if not self.test_login():
            print("❌ Login failed - cannot proceed with authenticated tests")
            return False
        
        if not self.test_get_me():
            print("❌ Get user info failed")
            return False
        
        # Test 3: Dashboard and Stats
        print("\n📈 DASHBOARD TESTS")
        self.test_dashboard_stats()
        
        # Test 4: Core Data Retrieval
        print("\n📋 DATA RETRIEVAL TESTS")
        cases = self.test_get_cases()
        self.test_get_policies()
        self.test_get_templates()
        
        # Test 5: Analytics
        print("\n📊 ANALYTICS TESTS")
        self.test_analytics_summary()
        self.test_analytics_denial_types()
        
        # Test 6: Case Operations
        print("\n📁 CASE OPERATIONS TESTS")
        if cases:
            self.test_case_operations(cases)
        
        # Test 7: Create new case
        print("\n➕ CREATE OPERATIONS TESTS")
        new_case_id = self.test_create_case()
        if new_case_id:
            print(f"   Created case: {new_case_id}")
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_run - self.tests_passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   - {result['test']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = AuthPilotAPITester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        # Save detailed results
        with open('/app/test_reports/backend_api_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0,
                'results': tester.test_results
            }, f, indent=2)
        
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
#!/usr/bin/env python3

import requests
import sys
import json
import io
from datetime import datetime
from pathlib import Path

class ObsidianAPITester:
    def __init__(self, base_url="https://data-vault-ai.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        req_headers = {'Content-Type': 'application/json'}
        if self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=30)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for multipart/form-data
                    req_headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, data=data, headers=req_headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=req_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=30)

            success = response.status_code == expected_status
            result = {
                'name': name,
                'method': method,
                'endpoint': endpoint,
                'expected_status': expected_status,
                'actual_status': response.status_code,
                'success': success,
                'response_data': None,
                'error': None
            }

            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result['response_data'] = response.json()
                except:
                    result['response_data'] = response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    result['error'] = error_data
                    print(f"   Error: {error_data}")
                except:
                    result['error'] = response.text
                    print(f"   Error: {response.text}")

            self.test_results.append(result)
            return success, result.get('response_data', {})

        except Exception as e:
            print(f"❌ Failed - Exception: {str(e)}")
            self.test_results.append({
                'name': name,
                'method': method,
                'endpoint': endpoint,
                'expected_status': expected_status,
                'actual_status': 'Exception',
                'success': False,
                'response_data': None,
                'error': str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test basic API health"""
        success, _ = self.run_test("Health Check", "GET", "", 200)
        return success

    def test_register_user(self, username, email, password):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={"username": username, "email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user = response['user']
            print(f"   Registered user: {self.user['username']} (role: {self.user['role']})")
            return True
        return False

    def test_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user = response['user']
            print(f"   Logged in as: {self.user['username']} (role: {self.user['role']})")
            return True
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        return success

    def test_get_me(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_file_upload(self):
        """Test file upload with a sample PDF"""
        # Create a small test PDF-like file
        test_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\nTest PDF content for RAG system"
        files = {'file': ('test_document.pdf', test_content, 'application/pdf')}
        
        success, response = self.run_test(
            "File Upload",
            "POST",
            "documents/upload",
            200,
            files=files
        )
        if success and 'id' in response:
            print(f"   Uploaded document ID: {response['id']}, chunks: {response.get('total_chunks', 0)}")
            return response['id']
        return None

    def test_list_documents(self):
        """Test listing documents"""
        success, response = self.run_test(
            "List Documents",
            "GET",
            "documents",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} documents")
        return success

    def test_query_system(self):
        """Test the RAG query system"""
        success, response = self.run_test(
            "Query RAG System",
            "POST",
            "query",
            200,
            data={"query": "What information is available in the uploaded documents?", "top_k": 5}
        )
        if success:
            print(f"   Answer: {response.get('answer', '')[:100]}...")
            print(f"   Citations: {len(response.get('citations', []))}")
            return response.get('query_id')
        return None

    def test_query_history(self):
        """Test query history"""
        success, response = self.run_test(
            "Query History",
            "GET",
            "query/history",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} queries in history")
        return success

    def test_analytics_stats(self):
        """Test analytics dashboard stats"""
        success, response = self.run_test(
            "Analytics Stats",
            "GET",
            "analytics/stats",
            200
        )
        if success:
            stats = response
            print(f"   Documents: {stats.get('total_documents', 0)}")
            print(f"   Chunks: {stats.get('total_chunks', 0)}")
            print(f"   Queries: {stats.get('total_queries', 0)}")
            print(f"   Users: {stats.get('total_users', 0)}")
        return success

    def test_admin_audit_logs(self):
        """Test admin audit logs (admin only)"""
        if self.user and self.user.get('role') != 'admin':
            print("   Skipping admin test - not admin user")
            return True
        
        success, response = self.run_test(
            "Admin Audit Logs",
            "GET",
            "admin/audit-logs",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} audit log entries")
        return success

    def test_admin_rebuild_index(self):
        """Test admin rebuild index (admin only)"""
        if self.user and self.user.get('role') != 'admin':
            print("   Skipping admin test - not admin user")
            return True
        
        success, response = self.run_test(
            "Admin Rebuild Index",
            "POST",
            "admin/rebuild-index",
            200
        )
        if success:
            print(f"   Index rebuild result: {response.get('message', 'Success')}")
        return success

    def test_admin_users(self):
        """Test admin users list (admin only)"""
        if self.user and self.user.get('role') != 'admin':
            print("   Skipping admin test - not admin user")
            return True
        
        success, response = self.run_test(
            "Admin Users List",
            "GET",
            "admin/users",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} users")
        return success

    def test_delete_document(self, doc_id):
        """Test document deletion"""
        if not doc_id:
            print("   Skipping delete test - no document ID")
            return True
        
        success, response = self.run_test(
            "Delete Document",
            "DELETE",
            f"documents/{doc_id}",
            200
        )
        return success

def main():
    print("🚀 Starting Project Obsidian API Tests")
    print("=" * 50)
    
    tester = ObsidianAPITester()
    
    # Test sequence
    doc_id = None
    
    # 1. Health check
    if not tester.test_health_check():
        print("❌ Health check failed, stopping tests")
        return 1
    
    # 2. Test with existing admin user
    if not tester.test_login("admin@obsidian.sec", "admin123"):
        print("❌ Admin login failed, stopping tests")
        return 1
    
    # 3. Test invalid login
    tester.test_invalid_login()
    
    # 4. Test current user info
    tester.test_get_me()
    
    # 5. Test file operations
    doc_id = tester.test_file_upload()
    tester.test_list_documents()
    
    # 6. Test query system
    tester.test_query_system()
    tester.test_query_history()
    
    # 7. Test analytics
    tester.test_analytics_stats()
    
    # 8. Test admin functions
    tester.test_admin_audit_logs()
    tester.test_admin_rebuild_index()
    tester.test_admin_users()
    
    # 9. Clean up - delete test document
    if doc_id:
        tester.test_delete_document(doc_id)
    
    # Print results
    print(f"\n📊 Test Results:")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    # Save detailed results
    results_file = "/app/test_reports/backend_test_results.json"
    Path("/app/test_reports").mkdir(exist_ok=True)
    with open(results_file, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': tester.tests_passed/tester.tests_run*100 if tester.tests_run > 0 else 0,
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    print(f"Detailed results saved to: {results_file}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
import os
import sys
import unittest
from unittest.mock import patch
from flask import Flask

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from backend.routes.docmanage import delete_doc

class TestSoftDelete(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.testing = True
        self.mock_doc_store = {
            "doc1": {
                "id": "doc1",
                "audioFilename": "file1.mp3",
                "deleted": False,
                "owner": "user1"
            }
        }
        os.makedirs("test_results", exist_ok=True)

    @patch("backend.routes.docmanage.doc_store", new_callable=lambda: {})
    @patch("backend.routes.docmanage.save_doc_store")
    @patch("backend.routes.docmanage.check_blob_exists", return_value=True)
    @patch("backend.routes.docmanage.move_file", return_value=True)
    @patch("backend.services.firebase_service.auth.verify_id_token")
    def test_soft_delete_success(self, mock_verify, mock_move, mock_check, mock_save, mock_doc_store):
        mock_verify.return_value = {"uid": "user1"}
        mock_doc_store.update(self.mock_doc_store)
        
        with self.app.test_request_context('/api/docs/doc1', method='DELETE', 
                                       headers={"Authorization": "Bearer mock_token"}):
            response = delete_doc("doc1")
            
            with open("test_results/unittest_results.txt", "w") as f:
                f.write("=== UNITTEST SOFT DELETE TESTS ===\n")
                f.write("1. Success Test:\n")
                f.write(f"  Status: {'PASS' if response[1] == 200 else 'FAIL'}\n")
                f.write(f"  Document Deleted: {mock_doc_store['doc1']['deleted']}\n")
            
            self.assertEqual(response[1], 200)
            self.assertTrue(mock_doc_store["doc1"]["deleted"])

    @patch("backend.routes.docmanage.doc_store", new_callable=lambda: {})
    @patch("backend.services.firebase_service.auth.verify_id_token")
    def test_soft_delete_not_found(self, mock_verify, mock_doc_store):
        mock_verify.return_value = {"uid": "user1"}
        mock_doc_store.update(self.mock_doc_store)
        
        with self.app.test_request_context('/api/docs/doc2', method='DELETE',
                                       headers={"Authorization": "Bearer mock_token"}):
            response = delete_doc("doc2")
            
            with open("test_results/unittest_results.txt", "a") as f:
                f.write("\n2. Not Found Test:\n")
                f.write(f"  Status: {'PASS' if response[1] == 404 else 'FAIL'}\n")
                f.write("  Document 'doc2' not found\n")
            
            self.assertEqual(response[1], 404)

if __name__ == "__main__":
    unittest.main()
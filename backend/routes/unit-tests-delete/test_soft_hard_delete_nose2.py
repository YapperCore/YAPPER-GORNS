import os
import sys
import unittest
from unittest.mock import patch
from flask import Flask

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from backend.routes.docmanage import delete_doc
from backend.routes.trash_route import perm_delete_files

class TestSoftHardDelete(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.testing = True
        self.test_results = []
        os.makedirs("test_results", exist_ok=True)

    def record_result(self, test_name, status_code, success, details):
        self.test_results.append(
            f"{test_name}: {'PASS' if success else 'FAIL'}\n"
            f"Status Code: {status_code}\n"
            f"Details: {details}\n"
        )

    @patch("backend.routes.docmanage.doc_store", new_callable=lambda: {
        "doc1": {
            "id": "doc1",
            "audioFilename": "file1.mp3",
            "deleted": False,
            "owner": "user1"
        }
    })
    @patch("backend.routes.docmanage.save_doc_store")
    @patch("backend.routes.docmanage.check_blob_exists", return_value=True)
    @patch("backend.routes.docmanage.move_file", return_value=True)
    @patch("backend.services.firebase_service.auth.verify_id_token")
    def test_soft_delete(self, mock_verify, mock_move, mock_check, mock_save, mock_doc_store):
        mock_verify.return_value = {"uid": "user1"}
        
        with self.app.test_request_context('/api/docs/doc1', method='DELETE',
                                         headers={"Authorization": "Bearer mock_token"}):
            response = delete_doc("doc1")
            success = response[1] == 200 and mock_doc_store["doc1"]["deleted"]
            self.record_result(
                "Soft Delete",
                response[1],
                success,
                f"Document marked deleted: {mock_doc_store['doc1']['deleted']}"
            )
            self.assertEqual(response[1], 200)

    @patch("backend.routes.trash_route.doc_store", new_callable=lambda: {
        "doc1": {
            "id": "doc1",
            "audioFilename": "file1.mp3", 
            "deleted": True,
            "owner": "user1"
        }
    })
    @patch("backend.routes.trash_route.save_doc_store")
    @patch("backend.routes.trash_route.delete_file", return_value=True)
    @patch("backend.services.firebase_service.auth.verify_id_token")
    def test_hard_delete(self, mock_verify, mock_delete, mock_save, mock_doc_store):
        mock_verify.return_value = {"uid": "user1"}
        
        with self.app.test_request_context('/api/trash/file1.mp3', method='DELETE',
                                         headers={"Authorization": "Bearer mock_token"}):
            response = perm_delete_files("file1.mp3")
            success = response[1] == 200 and "doc1" not in mock_doc_store
            self.record_result(
                "Hard Delete",
                response[1],
                success,
                f"Document removed: {'doc1' not in mock_doc_store}"
            )
            self.assertEqual(response[1], 200)

    def tearDown(self):
        with open("test_results/nose2_results.txt", "w") as f:
            f.write("=== NOSE2 TEST RESULTS ===\n\n")
            f.write("\n".join(self.test_results))

if __name__ == "__main__":
    unittest.main()
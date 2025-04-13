import unittest
from unittest.mock import patch, MagicMock
from flask import Flask
from routes.docmanage import delete_doc

class TestSoftDelete(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.client = self.app.test_client()
        self.mock_doc_store = {
            "doc1": {
                "id": "doc1",
                "audioFilename": "file1.mp3",
                "deleted": False,
                "owner": "user1"
            }
        }

    @patch("routes.docmanage.doc_store", new_callable=lambda: {})
    @patch("routes.docmanage.save_doc_store")
    @patch("routes.docmanage.check_blob_exists", return_value=True)
    @patch("routes.docmanage.move_file", return_value=True)
    def test_soft_delete_success(self, mock_move_file, mock_check_blob_exists, mock_save_doc_store, mock_doc_store):
        mock_doc_store.update(self.mock_doc_store)
        with self.app.test_request_context('/api/docs/doc1', method='DELETE', headers={"uid": "user1"}):
            response = delete_doc("doc1")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(mock_doc_store["doc1"]["deleted"])
            self.assertTrue(mock_doc_store["doc1"]["audioTrashed"])

            # Write result to a txt file
            with open("test_soft_delete_success.txt", "w") as f:
                f.write(f"Test Soft Delete Success:\n")
                f.write(f"Response Status Code: {response.status_code}\n")
                f.write(f"Document 'doc1' deleted: {mock_doc_store['doc1']['deleted']}\n")

    @patch("routes.docmanage.doc_store", new_callable=lambda: {})
    def test_soft_delete_not_found(self, mock_doc_store):
        mock_doc_store.update(self.mock_doc_store)
        with self.app.test_request_context('/api/docs/doc2', method='DELETE', headers={"uid": "user1"}):
            response = delete_doc("doc2")
            self.assertEqual(response.status_code, 404)

            # Write result to a txt file
            with open("test_soft_delete_not_found.txt", "w") as f:
                f.write(f"Test Soft Delete Not Found:\n")
                f.write(f"Response Status Code: {response.status_code}\n")
                f.write(f"Document 'doc2' not found in mock_doc_store.\n")

if __name__ == "__main__":
    unittest.main()

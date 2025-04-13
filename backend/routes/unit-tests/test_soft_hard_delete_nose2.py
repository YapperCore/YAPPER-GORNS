from unittest import TestCase
from unittest.mock import patch
from routes.docmanage import delete_doc
from routes.trash_route import perm_delete_files

class TestSoftHardDelete(TestCase):
    @patch("routes.docmanage.doc_store", new_callable=lambda: {})
    @patch("routes.docmanage.save_doc_store")
    @patch("routes.docmanage.check_blob_exists", return_value=True)
    @patch("routes.docmanage.move_file", return_value=True)
    def test_soft_delete(self, mock_move_file, mock_check_blob_exists, mock_save_doc_store, mock_doc_store):
        mock_doc_store.update({
            "doc1": {
                "id": "doc1",
                "audioFilename": "file1.mp3",
                "deleted": False,
                "owner": "user1"
            }
        })
        with patch("flask.request") as mock_request:
            mock_request.uid = "user1"
            response = delete_doc("doc1")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(mock_doc_store["doc1"]["deleted"])

            # Write result to a txt file
            with open("test_soft_delete.txt", "w") as f:
                f.write(f"Test Soft Delete:\n")
                f.write(f"Response Status Code: {response.status_code}\n")
                f.write(f"Document 'doc1' deleted: {mock_doc_store['doc1']['deleted']}\n")

    @patch("routes.trash_route.doc_store", new_callable=lambda: {})
    @patch("routes.trash_route.save_doc_store")
    @patch("routes.trash_route.delete_file", return_value=True)
    def test_hard_delete(self, mock_delete_file, mock_save_doc_store, mock_doc_store):
        mock_doc_store.update({
            "doc1": {
                "id": "doc1",
                "audioFilename": "file1.mp3",
                "deleted": True,
                "owner": "user1"
            }
        })
        with patch("flask.request") as mock_request:
            mock_request.uid = "user1"
            response = perm_delete_files("file1.mp3")
            self.assertEqual(response.status_code, 200)
            self.assertNotIn("doc1", mock_doc_store)

            # Write result to a txt file
            with open("test_hard_delete.txt", "w") as f:
                f.write(f"Test Hard Delete:\n")
                f.write(f"Response Status Code: {response.status_code}\n")
                f.write(f"Document 'doc1' removed: {'doc1' not in mock_doc_store}\n")

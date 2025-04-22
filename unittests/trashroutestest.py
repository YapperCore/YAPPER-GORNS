import unittest
from unittest.mock import patch, MagicMock, mock_open
from flask import Flask
from backend.routes.trash_route import (
    get_trash_files,
    get_upload_files,
    restore_file,
    perm_delete_files,
    mark_doc_audio_trashed
)

class TestFileOperations(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    @patch("your_module.os.listdir", return_value=["file1.wav", "file2.wav"])
    def test_get_trash_files_success(self, mock_listdir):
        resp, status = get_trash_files()
        self.assertEqual(status, 200)
        self.assertEqual(resp.json["files"], ["file1.wav", "file2.wav"])

    @patch("your_module.os.listdir", side_effect=Exception("Disk error"))
    def test_get_trash_files_failure(self, mock_listdir):
        resp, status = get_trash_files()
        self.assertEqual(status, 500)
        self.assertIn("error", resp.json)

    @patch("your_module.os.listdir", return_value=["upload1.wav"])
    def test_get_upload_files_success(self, mock_listdir):
        resp, status = get_upload_files()
        self.assertEqual(status, 200)
        self.assertEqual(resp.json["files"], ["upload1.wav"])

    @patch("your_module.os.listdir", side_effect=Exception("Disk error"))
    def test_get_upload_files_failure(self, mock_listdir):
        resp, status = get_upload_files()
        self.assertEqual(status, 500)
        self.assertIn("error", resp.json)

    @patch("your_module.os.rename")
    @patch("your_module.os.path.exists", return_value=True)
    @patch("your_module.save_doc_store")
    @patch("your_module.doc_store", {
        "doc1": {"audioFilename": "test.wav", "deleted": True, "audioTrashed": True}
    })
    def test_restore_file_success(self, mock_exists, mock_rename, mock_save):
        resp, status = restore_file("test.wav")
        self.assertEqual(status, 200)
        self.assertEqual(resp.json["message"], "File restored")

    @patch("your_module.os.path.exists", return_value=False)
    def test_restore_file_not_found(self, mock_exists):
        resp, status = restore_file("nonexistent.wav")
        self.assertEqual(status, 404)
        self.assertEqual(resp.json["message"], "File not found in trash")

    @patch("your_module.os.remove")
    @patch("your_module.os.path.exists", return_value=True)
    @patch("your_module.save_doc_store")
    @patch("your_module.doc_store", {
        "doc1": {"audioFilename": "to_delete.wav"},
        "doc2": {"audioFilename": "keep.wav"}
    })
    def test_perm_delete_file_success(self, mock_exists, mock_remove, mock_save):
        resp, status = perm_delete_files("to_delete.wav")
        self.assertEqual(status, 200)
        self.assertEqual(resp.json["message"], "File permanently deleted")

    @patch("your_module.os.remove", side_effect=Exception("Permission denied"))
    @patch("your_module.os.path.exists", return_value=True)
    @patch("your_module.doc_store", {"doc1": {"audioFilename": "bad.wav"}})
    def test_perm_delete_file_failure(self, mock_exists, mock_remove):
        resp, status = perm_delete_files("bad.wav")
        self.assertEqual(status, 500)
        self.assertIn("error", resp.json)

    @patch("your_module.os.path.exists", return_value=False)
    def test_perm_delete_file_not_found(self, mock_exists):
        resp, status = perm_delete_files("missing.wav")
        self.assertEqual(status, 404)
        self.assertEqual(resp.json["message"], "File not found in trash")

    @patch("your_module.save_doc_store")
    @patch("your_module.doc_store", {
        "doc1": {"audioFilename": "abc.wav", "audioTrashed": False},
        "doc2": {"audioFilename": "other.wav", "audioTrashed": False}
    })
    def test_mark_doc_audio_trashed(self, mock_save):
        mark_doc_audio_trashed("abc.wav", True)
        self.assertTrue(mock_save.called)

    @patch("your_module.save_doc_store")
    @patch("your_module.doc_store", {
        "doc1": {"audioFilename": "not_matched.wav", "audioTrashed": False}
    })
    def test_mark_doc_audio_trashed_no_change(self, mock_save):
        mark_doc_audio_trashed("no_match.wav", True)
        self.assertFalse(mock_save.called)

if __name__ == '__main__':
    unittest.main()
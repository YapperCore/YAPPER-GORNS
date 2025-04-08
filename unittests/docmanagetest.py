import unittest
from backend.routes.docmanage import add_document, get_document, update_document, delete_document

class TestDocManage(unittest.TestCase):

    def test_add_document(self):
        # Test that add_document returns a valid document id (assumed integer)
        doc_id = add_document("Sample content")
        self.assertIsNotNone(doc_id)
        self.assertIsInstance(doc_id, int)

    def test_get_document(self):
        # Test that a newly added document can be retrieved correctly
        content = "Test document content"
        doc_id = add_document(content)
        retrieved = get_document(doc_id)
        self.assertEqual(retrieved, content)

        # Test that getting a non-existing document returns None
        self.assertIsNone(get_document(-1))

    def test_update_document(self):
        # Test that updating an existing document works
        original = "Original content"
        updated = "Updated content"
        doc_id = add_document(original)
        result = update_document(doc_id, updated)
        self.assertTrue(result)
        self.assertEqual(get_document(doc_id), updated)

        # Test that updating a non-existing document returns False
        self.assertFalse(update_document(-1, "No content"))

    def test_delete_document(self):
        # Test that deleting an existing document works
        content = "Content to delete"
        doc_id = add_document(content)
        result = delete_document(doc_id)
        self.assertTrue(result)
        self.assertIsNone(get_document(doc_id))

        # Test that deleting a non-existing document returns False
        self.assertFalse(delete_document(-1))

if __name__ == '__main__':
    # run unittest with python <nameofscript>test.py >> testoutput.txt
    unittest.main()

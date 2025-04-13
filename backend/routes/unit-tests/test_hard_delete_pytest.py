import pytest
from unittest.mock import patch
from routes.trash_route import perm_delete_files

@pytest.fixture
def mock_doc_store():
    return {
        "doc1": {
            "id": "doc1",
            "audioFilename": "file1.mp3",
            "deleted": True,
            "owner": "user1"
        }
    }

@patch("routes.trash_route.doc_store", new_callable=lambda: {})
@patch("routes.trash_route.save_doc_store")
@patch("routes.trash_route.delete_file", return_value=True)
def test_hard_delete_success(mock_delete_file, mock_save_doc_store, mock_doc_store, mock_doc_store_fixture):
    mock_doc_store.update(mock_doc_store_fixture)
    with patch("flask.request") as mock_request:
        mock_request.uid = "user1"
        response = perm_delete_files("file1.mp3")
        assert response.status_code == 200
        assert "doc1" not in mock_doc_store

        # Write result to a txt file
        with open("test_hard_delete_success.txt", "w") as f:
            f.write(f"Test Hard Delete Success:\n")
            f.write(f"Response Status Code: {response.status_code}\n")
            f.write(f"Document 'doc1' removed: {'doc1' not in mock_doc_store}\n")

@patch("routes.trash_route.doc_store", new_callable=lambda: {})
def test_hard_delete_not_found(mock_doc_store, mock_doc_store_fixture):
    mock_doc_store.update(mock_doc_store_fixture)
    with patch("flask.request") as mock_request:
        mock_request.uid = "user1"
        response = perm_delete_files("file2.mp3")
        assert response.status_code == 500

        # Write result to a txt file
        with open("test_hard_delete_not_found.txt", "w") as f:
            f.write(f"Test Hard Delete Not Found:\n")
            f.write(f"Response Status Code: {response.status_code}\n")
            f.write(f"Document 'doc2' not found in mock_doc_store.\n")

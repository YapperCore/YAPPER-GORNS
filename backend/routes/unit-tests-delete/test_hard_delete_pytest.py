import os
import sys
import pytest
from unittest.mock import patch
from flask import Flask

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

from backend.routes.trash_route import perm_delete_files

# Ensure the test_results directory exists at module level
os.makedirs("test_results", exist_ok=True)

@pytest.fixture
def app():
    app = Flask(__name__)
    app.testing = True
    return app

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

def write_test_result(content):
    """Helper function to write test results with error handling"""
    try:
        with open("test_results/pytest_results.txt", "w") as f:
            f.write(content)
        print("Successfully wrote to test_results/pytest_results.txt")
    except Exception as e:
        print(f"Error writing to file: {str(e)}")

@patch("backend.routes.trash_route.doc_store", new_callable=lambda: {})
@patch("backend.routes.trash_route.save_doc_store")
@patch("backend.routes.trash_route.delete_file", return_value=True)
@patch("backend.services.firebase_service.auth.verify_id_token")
def test_hard_delete_success(mock_verify, mock_delete, mock_save, mock_route_doc_store, app, mock_doc_store):
    mock_verify.return_value = {"uid": "user1"}
    mock_route_doc_store.update(mock_doc_store)
    
    with app.test_request_context('/api/trash/file1.mp3', method='DELETE',
                               headers={"Authorization": "Bearer mock_token"}):
        response = perm_delete_files("file1.mp3")
        
        # Prepare the content to write
        result_content = (
            "=== PYTEST HARD DELETE TEST ===\n"
            f"Status: {'SUCCESS' if response[1] == 200 else 'FAILED'}\n"
            f"Status Code: {response[1]}\n"
            f"Document Removed: {'doc1' not in mock_route_doc_store}\n"
            f"Current Working Directory: {os.getcwd()}\n"
            f"Absolute Path: {os.path.abspath('test_results/pytest_results.txt')}\n"
        )
        
        # Write the results
        write_test_result(result_content)
        
        # Verify the file was written
        if os.path.exists("test_results/pytest_results.txt"):
            print("File exists at:", os.path.abspath("test_results/pytest_results.txt"))
        else:
            print("File was not created!")
        
        assert response[1] == 200
        assert "doc1" not in mock_route_doc_store
#!/usr/bin/env python
"""
Utility script to check if Replicate API key is working
"""

import os
import sys
import json
import replicate
from pathlib import Path


def check_api_key(api_key=None):
    """Test if the provided Replicate API key is valid"""

    if not api_key:
        # Try to get from environment
        api_key = os.environ.get("REPLICATE_API_TOKEN")
        if not api_key:
            # Try to get from default key file
            secure_dir = os.path.join(os.getcwd(), "secure_storage")
            default_key_path = os.path.join(secure_dir, "default_replicate_key.json")
            if os.path.exists(default_key_path):
                try:
                    with open(default_key_path, "r") as f:
                        data = json.load(f)
                        api_key = data.get("api_key")
                except Exception as e:
                    print(f"Error reading default key file: {e}")

    if not api_key:
        print("No API key found in environment or default file.")
        return False

    # Mask the key for display
    masked_key = f"{api_key[:5]}...{api_key[-5:]}"
    print(f"Testing Replicate API key: {masked_key}")

    # Set the key in environment
    os.environ["REPLICATE_API_TOKEN"] = api_key

    # Try a simple API call
    try:
        # Get available models (this is a lightweight API call)
        models = replicate.models.list()
        print("API key is valid! Successfully connected to Replicate.")
        return True
    except Exception as e:
        print(f"Error testing API key: {e}")
        return False


if __name__ == "__main__":
    print("Checking Replicate API key...")

    # Check if a key was provided as argument
    if len(sys.argv) > 1:
        api_key = sys.argv[1]
        print("Using API key from command line argument")
    else:
        api_key = None

    if check_api_key(api_key):
        print("API key check successful!")
        sys.exit(0)
    else:
        print("API key check failed!")
        sys.exit(1)

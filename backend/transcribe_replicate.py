# backend/transcribe_replicate.py
import os
import logging
import json
import time
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

def get_replicate_api_key(user_id):
    secure_dir = os.path.join(os.getcwd(), 'secure_storage')
    key_path = os.path.join(secure_dir, f"{user_id}_replicate_key.json")
    if not os.path.exists(key_path):
        logger.error(f"Replicate API key file not found for user {user_id}")
        return None
    try:
        with open(key_path, 'r') as f:
            data = json.load(f)
            return data.get('api_key')
    except Exception as e:
        logger.error(f"Error reading Replicate API key: {e}")
        return None

def transcribe_audio_with_replicate(audio_path, user_id, prompt=None):
    try:
        api_key = get_replicate_api_key(user_id)
        if not api_key:
            logger.error("No Replicate API key found")
            return "Error: No Replicate API key found. Please check your settings."
        
        if not os.path.exists(audio_path):
            logger.error(f"Audio file not found: {audio_path}")
            return "Error: Audio file not found"
        
        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json"
        }
        
        file_upload_url = upload_file_to_replicate(audio_path, api_key)
        if not file_upload_url:
            return "Error: Failed to upload audio file to Replicate"
        
        api_url = "https://api.replicate.com/v1/predictions"
        
        if not prompt or prompt.strip() == "":
            prompt = "Please transcribe this audio file. Provide only the transcription text without any additional comments."
        
        data = {
            "version": "0ca8160f7aaf85703a6aac282d6c79aa64d3541b239fa4c5c1688b10cb1faef1",
            "input": {
                "audio": file_upload_url,
                "prompt": prompt,
                "generate_audio": False
            }
        }
        
        logger.info(f"Sending request to Replicate API with prompt: {prompt}")
        response = requests.post(api_url, json=data, headers=headers)
        
        if response.status_code != 201:
            logger.error(f"Replicate API error: {response.text}")
            return f"Error: Replicate API returned status code {response.status_code}: {response.text}"
        
        prediction = response.json()
        prediction_id = prediction.get("id")
        
        if not prediction_id:
            logger.error("No prediction ID in response")
            return "Error: No prediction ID in response"
        
        status_url = f"https://api.replicate.com/v1/predictions/{prediction_id}"
        max_attempts = 120
        attempts = 0
        
        logger.info(f"Polling prediction status: {prediction_id}")
        while attempts < max_attempts:
            status_response = requests.get(status_url, headers=headers)
            
            if status_response.status_code != 200:
                logger.error(f"Status check error: {status_response.text}")
                return f"Error: Status check failed with code {status_response.status_code}"
            
            status_data = status_response.json()
            status = status_data.get("status")
            
            if status == "succeeded":
                output = status_data.get("output", {})
                transcription = output.get("text", "")
                logger.info(f"Transcription completed successfully: {len(transcription)} chars")
                return transcription
            
            elif status == "failed":
                error = status_data.get("error", "Unknown error")
                logger.error(f"Prediction failed: {error}")
                return f"Error: Transcription failed - {error}"
            
            elif status == "canceled":
                logger.error("Prediction was canceled")
                return "Error: Transcription was canceled"
            
            time.sleep(5)
            attempts += 1
        
        return "Error: Transcription timed out"
    
    except Exception as e:
        logger.error(f"Error during Replicate transcription: {e}")
        return f"Error: {str(e)}"

def upload_file_to_replicate(file_path, api_key):
    try:
        headers = {
            "Authorization": f"Token {api_key}"
        }
        
        logger.info(f"Getting upload URL for file: {file_path}")
        upload_response = requests.post(
            "https://api.replicate.com/v1/uploads",
            headers=headers
        )
        
        if upload_response.status_code != 201:
            logger.error(f"Failed to get upload URL: {upload_response.text}")
            return None
        
        upload_data = upload_response.json()
        upload_url = upload_data.get("upload_url")
        get_url = upload_data.get("serving_url")
        
        if not upload_url or not get_url:
            logger.error("Missing upload_url or serving_url in response")
            return None
        
        logger.info(f"Uploading file to: {upload_url}")
        with open(file_path, "rb") as f:
            file_data = f.read()
            upload_result = requests.put(
                upload_url,
                data=file_data,
                headers={"Content-Type": "application/octet-stream"}
            )
            
        if upload_result.status_code not in [200, 201]:
            logger.error(f"Failed to upload file: {upload_result.text}")
            return None
        
        logger.info(f"File uploaded successfully, serving URL: {get_url}")
        return get_url
    
    except Exception as e:
        logger.error(f"Error uploading file to Replicate: {e}")
        return None

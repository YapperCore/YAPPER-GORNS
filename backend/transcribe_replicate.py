# backend/transcribe_replicate.py

import os
import logging
import json
import time
import base64
import requests
import replicate
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
        # Get API key
        api_key = get_replicate_api_key(user_id)
        if not api_key:
            logger.error("No Replicate API key found")
            return "Error: No Replicate API key found. Please check your settings."
        
        if not os.path.exists(audio_path):
            logger.error(f"Audio file not found: {audio_path}")
            return "Error: Audio file not found"
        
        # Set environment variable for replicate client
        os.environ["REPLICATE_API_TOKEN"] = api_key
        
        # Default prompt if none is provided
        if not prompt or prompt.strip() == "":
            prompt = "Please transcribe this audio accurately. You are a speech-to-text transcription model."
        else:
            # Ensure the prompt includes speech-to-text context
            if "speech" not in prompt.lower() and "transcri" not in prompt.lower():
                prompt = f"{prompt} You are a speech-to-text transcription model."
        
        logger.info(f"Beginning transcription with Replicate API for file: {audio_path} with prompt: {prompt}")
        logger.info(f"Contacting Replicate API. This may take a moment if the model needs to warm up...")
        
        # Open the file for reading in binary mode
        with open(audio_path, "rb") as file_obj:
            try:
                # Set up input for the model with ALL required parameters according to schema
                input_data = {
                    "audio": file_obj,
                    "prompt": prompt,
                    "system_prompt": "You are a professional transcription model. Your task is to accurately transcribe the provided audio content.",
                    "voice_type": "Chelsie",  # Required parameter with valid enum value
                    "generate_audio": False,  # We only want text output
                    "use_audio_in_video": False
                }
                
                # Use predictions.create instead of run for better control
                logger.info("Creating prediction with Replicate API...")
                prediction = replicate.predictions.create(
                    version="0ca8160f7aaf85703a6aac282d6c79aa64d3541b239fa4c5c1688b10cb1faef1",
                    input=input_data
                )
                
                logger.info(f"Prediction created with ID: {prediction.id}")
                
                # Poll for completion
                max_attempts = 120  # 10 minutes with 5-second intervals
                attempts = 0
                processing_start = time.time()
                
                logger.info("Waiting for Replicate API to process the audio file...")
                while attempts < max_attempts:
                    # Reload prediction to get latest status
                    prediction.reload()
                    status = prediction.status
                    
                    logger.info(f"Prediction status: {status} (attempt {attempts+1}/{max_attempts})")
                    
                    if status == "succeeded":
                        processing_time = time.time() - processing_start
                        logger.info(f"Transcription completed in {processing_time:.2f} seconds")
                        
                        output = prediction.output
                        if isinstance(output, dict) and 'text' in output:
                            transcription = output['text']
                            logger.info(f"Transcription completed successfully: {len(transcription)} chars")
                            return transcription
                        else:
                            logger.error(f"Unexpected output format: {output}")
                            return f"Error: Unexpected output format: {output}"
                    
                    elif status == "failed":
                        error = prediction.error or "Unknown error"
                        logger.error(f"Prediction failed: {error}")
                        return f"Error: Transcription failed - {error}"
                    
                    elif status == "canceled":
                        logger.error("Prediction was canceled")
                        return "Error: Transcription was canceled"
                    
                    # Sleep before checking again
                    time.sleep(5)
                    attempts += 1
                
                return "Error: Transcription timed out after 10 minutes"
                
            except Exception as e:
                logger.error(f"Error during Replicate API run: {e}")
                return f"Error: {str(e)}"
    
    except Exception as e:
        logger.error(f"Error during Replicate transcription: {e}")
        return f"Error: {str(e)}"

def alternative_transcribe_with_replicate(audio_path, user_id, prompt=None):
    """Alternative implementation using predictions.create and polling with improved logging"""
    try:
        # Get API key
        api_key = get_replicate_api_key(user_id)
        if not api_key:
            logger.error("No Replicate API key found")
            return "Error: No Replicate API key found. Please check your settings."
        
        if not os.path.exists(audio_path):
            logger.error(f"Audio file not found: {audio_path}")
            return "Error: Audio file not found"
        
        # Set environment variable for replicate client
        os.environ["REPLICATE_API_TOKEN"] = api_key
        
        # Default prompt if none is provided
        if not prompt or prompt.strip() == "":
            prompt = "Please transcribe this audio accurately. You are a speech-to-text transcription model."
        else:
            # Ensure the prompt includes speech-to-text context
            if "speech" not in prompt.lower() and "transcri" not in prompt.lower():
                prompt = f"{prompt} You are a speech-to-text transcription model."
        
        logger.info(f"Beginning transcription with Replicate API (alternative method) for file: {audio_path}")
        logger.info(f"Contacting Replicate API. This may take a moment if the model needs to warm up...")
        
        # Convert file to base64 or upload via direct file upload
        with open(audio_path, "rb") as f:
            file_content = f.read()
            file_size = len(file_content)
            logger.info(f"Audio file size: {file_size / (1024 * 1024):.2f} MB")
            
            # For larger files, use the file upload API
            try:
                logger.info("Uploading audio file to Replicate...")
                start_time = time.time()
                
                # Create prediction with the file and ALL required parameters
                prediction = replicate.predictions.create(
                    version="0ca8160f7aaf85703a6aac282d6c79aa64d3541b239fa4c5c1688b10cb1faef1",
                    input={
                        "audio": f,
                        "prompt": prompt,
                        "system_prompt": "You are a professional transcription model. Your task is to accurately transcribe the provided audio content.",
                        "voice_type": "Chelsie",  # Required parameter
                        "generate_audio": False,
                        "use_audio_in_video": False
                    }
                )
                
                upload_time = time.time() - start_time
                logger.info(f"File uploaded to Replicate in {upload_time:.2f} seconds")
                logger.info(f"Prediction created with ID: {prediction.id}")
                
                # Poll for completion
                max_attempts = 120  # 10 minutes with 5-second intervals
                attempts = 0
                processing_start = time.time()
                
                logger.info("Waiting for Replicate API to process the audio file...")
                while attempts < max_attempts:
                    prediction.reload()
                    status = prediction.status
                    
                    if status == "succeeded":
                        processing_time = time.time() - processing_start
                        logger.info(f"Transcription completed in {processing_time:.2f} seconds")
                        
                        output = prediction.output
                        if isinstance(output, dict) and 'text' in output:
                            transcription = output['text']
                            logger.info(f"Transcription completed successfully: {len(transcription)} chars")
                            return transcription
                        else:
                            logger.error(f"Unexpected output format: {output}")
                            return f"Error: Unexpected output format: {output}"
                    
                    elif status == "failed":
                        error = prediction.error or "Unknown error"
                        logger.error(f"Prediction failed: {error}")
                        return f"Error: Transcription failed - {error}"
                    
                    elif status == "canceled":
                        logger.error("Prediction was canceled")
                        return "Error: Transcription was canceled"
                    
                    elif status == "processing":
                        if attempts % 4 == 0:  # Log every 20 seconds
                            elapsed = time.time() - processing_start
                            logger.info(f"Still processing... (elapsed: {elapsed:.2f}s)")
                    
                    time.sleep(5)
                    attempts += 1
                
                return "Error: Transcription timed out after 10 minutes"
                
            except Exception as e:
                logger.error(f"Error during prediction creation/polling: {e}")
                return f"Error: {str(e)}"
    
    except Exception as e:
        logger.error(f"Error during alternative Replicate transcription: {e}")
        return f"Error: {str(e)}"

# backend/transcribe_replicate.py
import os
import logging
import json
import time
import base64
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
            prompt = "Please transcribe this audio file accurately. Provide only the transcription text."
        
        logger.info(f"Beginning transcription with Replicate API for file: {audio_path} with prompt: {prompt}")
        
        # Open the file for reading in binary mode
        with open(audio_path, "rb") as file_obj:
            try:
                # Set up input for the model
                input_data = {
                    "audio": file_obj,
                    "prompt": prompt,
                    "system_prompt": "You are Qwen, a virtual human developed by the Qwen Team, Alibaba Group, capable of perceiving auditory and visual inputs, as well as generating text and speech.",
                    "voice_type": "Chelsie",
                    "generate_audio": False,
                    "use_audio_in_video": False
                }
                
                # Run the model
                output = replicate.run(
                    "lucataco/qwen2.5-omni-7b:0ca8160f7aaf85703a6aac282d6c79aa64d3541b239fa4c5c1688b10cb1faef1",
                    input=input_data
                )
                
                # The output should be a dictionary with a 'text' key
                if isinstance(output, dict) and 'text' in output:
                    transcription = output['text']
                    logger.info(f"Transcription completed successfully: {len(transcription)} chars")
                    return transcription
                else:
                    logger.error(f"Unexpected output format from Replicate API: {output}")
                    return f"Error: Unexpected output format from Replicate API: {output}"
                    
            except Exception as e:
                logger.error(f"Error during Replicate API run: {e}")
                return f"Error: {str(e)}"
    
    except Exception as e:
        logger.error(f"Error during Replicate transcription: {e}")
        return f"Error: {str(e)}"

def alternative_transcribe_with_replicate(audio_path, user_id, prompt=None):
    """Alternative implementation using predictions.create and polling"""
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
            prompt = "Please transcribe this audio file accurately. Provide only the transcription text."
        
        logger.info(f"Beginning transcription with Replicate API (alternative method) for file: {audio_path}")
        
        # Convert file to base64 (for smaller files)
        with open(audio_path, "rb") as f:
            file_content = f.read()
            if len(file_content) > 10 * 1024 * 1024:  # 10MB limit for demonstration
                logger.error("File too large for base64 encoding method")
                return "Error: File too large for this transcription method"
                
            encoded_content = base64.b64encode(file_content).decode('utf-8')
            data_uri = f"data:audio/wav;base64,{encoded_content}"
            
            try:
                # Create prediction
                prediction = replicate.predictions.create(
                    version="0ca8160f7aaf85703a6aac282d6c79aa64d3541b239fa4c5c1688b10cb1faef1",
                    input={
                        "audio": data_uri,
                        "prompt": prompt,
                        "system_prompt": "You are Qwen, a virtual human developed by the Qwen Team, Alibaba Group, capable of perceiving auditory and visual inputs, as well as generating text and speech.",
                        "voice_type": "Chelsie",
                        "generate_audio": False,
                        "use_audio_in_video": False
                    }
                )
                
                logger.info(f"Prediction created with ID: {prediction.id}")
                
                # Poll for completion
                max_attempts = 120
                attempts = 0
                
                while attempts < max_attempts:
                    prediction.reload()
                    status = prediction.status
                    
                    if status == "succeeded":
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
                    
                    time.sleep(5)
                    attempts += 1
                
                return "Error: Transcription timed out"
                
            except Exception as e:
                logger.error(f"Error during prediction creation/polling: {e}")
                return f"Error: {str(e)}"
    
    except Exception as e:
        logger.error(f"Error during alternative Replicate transcription: {e}")
        return f"Error: {str(e)}"

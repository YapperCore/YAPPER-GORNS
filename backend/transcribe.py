# backend/transcribe.py
import os
import logging
import torch
import whisper
import platform
import requests
import json
import re
from pathlib import Path
import time
import tempfile

logger = logging.getLogger(__name__)

# Check for CUDA availability
CUDA_AVAILABLE = torch.cuda.is_available()
if CUDA_AVAILABLE:
    logger.info(f"CUDA is available! Using GPU: {torch.cuda.get_device_name(0)}")
else:
    logger.info("CUDA not available. Using CPU for transcription.")

# Default model size if not specified
WHISPER_MODEL = "small"

def normalize_path(file_path):
    """
    Normalize file path and handle platform-specific issues
    
    Args:
        file_path: Path to audio file
        
    Returns:
        str: Normalized file path
    """
    abs_path = os.path.abspath(file_path)
    path_obj = Path(abs_path)
    
    if not path_obj.exists():
        parent_dir = path_obj.parent
        if parent_dir.exists():
            # Try case-insensitive matching on platforms that are case-sensitive
            for existing_file in parent_dir.iterdir():
                if existing_file.name.lower() == path_obj.name.lower():
                    return str(existing_file)
        raise FileNotFoundError(f"File not found at path: {abs_path}")
    
    return str(path_obj)

def transcribe_audio(audio_path, model_name=WHISPER_MODEL):
    """
    Transcribe audio file using Whisper model
    
    Args:
        audio_path: Path to audio file
        model_name: Whisper model size to use
        
    Returns:
        str: Transcribed text
    """
    try:
        safe_path = normalize_path(audio_path)
        logger.info(f"Loading Whisper model: {model_name}")
        model = whisper.load_model(model_name, device="cuda" if CUDA_AVAILABLE else "cpu")
        logger.info(f"Model loaded successfully on {'GPU' if CUDA_AVAILABLE else 'CPU'}")
        logger.info(f"Processing audio file: {safe_path}")
        result = model.transcribe(safe_path)
        text = result.get("text", "")
        logger.info("Transcription complete")
        return text.strip()
    except FileNotFoundError as e:
        logger.error(f"File not found error: {e}")
        raise
    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        raise

def chunked_transcribe_audio(audio_path, model_name=WHISPER_MODEL, chunk_size=30):
    """
    Transcribe audio file in chunks for better memory management
    
    Args:
        audio_path: Path to audio file
        model_name: Whisper model size to use
        chunk_size: Size of audio chunks in seconds
        
    Yields:
        tuple: (chunk_index, total_chunks, transcribed_text)
    """
    try:
        safe_path = normalize_path(audio_path)
        logger.info(f"Loading Whisper model: {model_name} for chunked transcription")
        model = whisper.load_model(model_name, device="cuda" if CUDA_AVAILABLE else "cpu")
        logger.info(f"Model loaded successfully on {'GPU' if CUDA_AVAILABLE else 'CPU'}")
        logger.info(f"Loading audio file: {safe_path}")
        
        audio = whisper.load_audio(safe_path)
        audio_duration = len(audio) / whisper.audio.SAMPLE_RATE
        total_chunks = max(1, int(audio_duration / chunk_size))
        
        logger.info(f"Audio duration: {audio_duration:.2f}s, total chunks: {total_chunks}")
        
        for i in range(total_chunks):
            start_sample = i * chunk_size * whisper.audio.SAMPLE_RATE
            end_sample = min(len(audio), (i + 1) * chunk_size * whisper.audio.SAMPLE_RATE)
            chunk = audio[int(start_sample) : int(end_sample)]
            
            logger.info(f"Processing chunk {i+1}/{total_chunks}")
            result = model.transcribe(chunk)
            text = result.get("text", "").strip()
            
            logger.info(f"Chunk {i+1}/{total_chunks} processed: {len(text)} chars")
            yield i + 1, total_chunks, text
            
    except FileNotFoundError as e:
        logger.error(f"Error during chunked transcription - file not found: {e}")
        yield 0, 1, f"Error transcribing audio: File not found - {str(e)}"
        
    except Exception as e:
        logger.error(f"Error during chunked transcription: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        yield 0, 1, f"Error transcribing audio: {str(e)}"

def transcribe_with_replicate(file_path, api_key, prompt="transcribe", model_size="medium"):
    """
    Transcribe audio using Replicate API
    
    Args:
        file_path: Path to audio file
        api_key: Replicate API key
        prompt: Optional prompt to guide transcription (defaults to "transcribe")
        model_size: Whisper model size to use on Replicate
        
    Returns:
        str: Transcribed text
    """
    safe_path = normalize_path(file_path)
    logger.info(f"Transcribing with Replicate API: {safe_path}")
    
    # Ensure API key is properly set for the environment
    os.environ["REPLICATE_API_TOKEN"] = api_key
    logger.info(f"Using API key: {api_key[:5]}..." if api_key else "No API key provided")
    
    try:
        import replicate
        
        # Read the file directly
        with open(safe_path, 'rb') as file:
            audio_data = file.read()
            
        # Create a temporary file with the correct extension
        ext = os.path.splitext(safe_path)[1]
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        temp_file.write(audio_data)
        temp_file.close()
        
        logger.info(f"Created temporary file for upload: {temp_file.name}")
        
        # Use the file path directly for Replicate to upload
        audio_source = open(temp_file.name, "rb")
        
        # Set default prompt to "transcribe" if empty
        final_prompt = prompt.strip() if prompt and prompt.strip() else "transcribe"
        
        # Prepare input parameters - always set language to "english"
        input_params = {
            "audio": audio_source,
            "model": model_size,
            "language": "english",
            "prompt": final_prompt
        }
        
        logger.info(f"Sending request to Replicate API with model: {model_size}, prompt: '{final_prompt}'")
        
        # Call the Replicate API
        output = replicate.run(
            "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
            input=input_params
        )
        
        # Log the output type and format
        logger.info(f"Received output from Replicate: {type(output)}")
        
        # Extract the text based on format
        if isinstance(output, dict) and "text" in output:
            logger.info("Output has 'text' key - extracting directly")
            transcription = output["text"]
        elif isinstance(output, str):
            logger.info("Output is a string - using directly")
            transcription = output
        elif isinstance(output, list) and len(output) > 0:
            logger.info(f"Output is a list with {len(output)} items")
            if all(isinstance(item, dict) and "text" in item for item in output):
                transcription = " ".join([chunk["text"] for chunk in output])
            else:
                transcription = " ".join([str(item) for item in output])
        else:
            logger.warning(f"Unknown output format: {str(output)[:100]}...")
            transcription = str(output)
        
        # Clean up the temporary file
        try:
            if os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
        except Exception as cleanup_err:
            logger.warning(f"Failed to clean up temp file: {cleanup_err}")
            
        logger.info(f"Extracted transcription (excerpt): {transcription[:100]}...")
        return transcription.strip()
            
    except ImportError:
        logger.error("Replicate package not installed. Run 'pip install replicate'")
        raise Exception("Replicate package not installed. Run 'pip install replicate'")
        
    except Exception as e:
        logger.error(f"Error in transcribe_with_replicate: {e}")
        import traceback
        logger.error(f"Full error traceback: {traceback.format_exc()}")
        raise Exception(f"Failed to transcribe with Replicate: {str(e)}")

def transcribe_file(file_path, use_replicate=False, api_key=None, prompt="", model_size="medium"):
    """
    Transcribe a file using either local Whisper or Replicate API
    
    Args:
        file_path: Path to audio file
        use_replicate: Whether to use Replicate API
        api_key: Replicate API key (only used if use_replicate is True)
        prompt: Optional prompt for Replicate API
        model_size: Model size to use
        
    Returns:
        str: Transcribed text
    """
    if use_replicate:
        if not api_key:
            api_key = os.environ.get("REPLICATE_API_TOKEN", "")
            if not api_key:
                raise ValueError("API key required for Replicate transcription")
        
        return transcribe_with_replicate(file_path, api_key, prompt, model_size)
    else:
        return transcribe_audio(file_path, model_size)

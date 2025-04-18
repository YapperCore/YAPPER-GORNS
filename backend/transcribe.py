# backend/transcribe.py
import os
import logging
import torch
import whisper
import platform
import re
from pathlib import Path
from firebase_admin import firestore
import json
from transcribe_replicate import transcribe_audio_with_replicate

logger = logging.getLogger(__name__)

# Check for CUDA availability
CUDA_AVAILABLE = torch.cuda.is_available()
if CUDA_AVAILABLE:
    logger.info(f"CUDA is available! Using GPU: {torch.cuda.get_device_name(0)}")
else:
    logger.info("CUDA not available. Using CPU for transcription.")

WHISPER_MODEL = "small"  # can be tiny, base, small, medium, or large

def get_user_transcription_config(user_id):
    """Get the user's transcription configuration from Firestore"""
    try:
        # Get reference to Firestore
        db = firestore.client()
        
        # Get user settings document
        user_settings_ref = db.collection('user_settings').document(user_id)
        user_settings = user_settings_ref.get()
        
        if user_settings.exists:
            settings_data = user_settings.to_dict()
            transcription_config = settings_data.get('transcriptionConfig', {})
            
            # Set defaults if missing
            if not transcription_config:
                transcription_config = {
                    "mode": "local-cpu",
                    "cpuThreads": 1,
                    "gpuDevice": 0,
                    "whisperModel": "small"
                }
            
            return transcription_config
        else:
            # Return default settings if no document exists
            return {
                "mode": "local-cpu",
                "cpuThreads": 1,
                "gpuDevice": 0,
                "whisperModel": "small"
            }
            
    except Exception as e:
        logger.error(f"Error fetching user transcription config: {e}")
        # Return defaults in case of error
        return {
            "mode": "local-cpu",
            "cpuThreads": 1,
            "gpuDevice": 0,
            "whisperModel": "small"
        }

def normalize_path(file_path):
    """Normalize path for cross-platform compatibility"""
    # Convert to absolute path
    abs_path = os.path.abspath(file_path)
    
    # Convert to proper Path object for platform-independence
    path_obj = Path(abs_path)
    
    # Ensure the file exists
    if not path_obj.exists():
        # Try to find the file by checking if the filename exists in the directory
        parent_dir = path_obj.parent
        if parent_dir.exists():
            # Check if the file exists with any casing
            for existing_file in parent_dir.iterdir():
                if existing_file.name.lower() == path_obj.name.lower():
                    return str(existing_file)
        
        raise FileNotFoundError(f"File not found at path: {abs_path}")
    
    return str(path_obj)

def transcribe_audio(audio_path, user_id=None, prompt=None):
    """
    Transcribe the entire audio file using the selected backend
    
    Args:
        audio_path: Path to the audio file
        user_id: User ID for configuration
        prompt: Optional text prompt to guide the transcription
    """
    try:
        # Normalize the path before using
        safe_path = normalize_path(audio_path)
        
        # Get user transcription config
        config = get_user_transcription_config(user_id) if user_id else {
            "mode": "local-cpu",
            "cpuThreads": 1,
            "gpuDevice": 0,
            "whisperModel": "small"
        }
        
        model_name = config.get("whisperModel", WHISPER_MODEL)
        
        # Select transcription backend based on user settings
        if config.get("mode") == "replicate":
            logger.info("Using Replicate API for transcription")
            return transcribe_audio_with_replicate(safe_path, user_id, prompt)
        
        elif config.get("mode") == "local-gpu" and CUDA_AVAILABLE:
            # Use local GPU
            gpu_device = config.get("gpuDevice", 0)
            logger.info(f"Using local GPU (device {gpu_device}) for transcription with model: {model_name}")
            
            # Set CUDA device
            if torch.cuda.device_count() > gpu_device:
                torch.cuda.set_device(gpu_device)
            
            # Load model
            model = whisper.load_model(model_name, device="cuda")
            
        else:
            # Use local CPU (default fallback)
            cpu_threads = config.get("cpuThreads", 1)
            logger.info(f"Using local CPU ({cpu_threads} threads) for transcription with model: {model_name}")
            
            # Set number of threads
            if hasattr(torch, 'set_num_threads'):
                torch.set_num_threads(cpu_threads)
            
            # Load model
            model = whisper.load_model(model_name, device="cpu")
        
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
def chunked_transcribe_audio(audio_path, user_id=None, prompt=None, chunk_size=30):
    try:
        safe_path = normalize_path(audio_path)
        config = get_user_transcription_config(user_id) if user_id else {
            "mode": "local-cpu",
            "cpuThreads": 1,
            "gpuDevice": 0,
            "whisperModel": "small"
        }
        
        model_name = config.get("whisperModel", WHISPER_MODEL)
        
        if config.get("mode") == "replicate":
            logger.info("Using Replicate API for transcription (full file)")
            full_text = transcribe_audio_with_replicate(safe_path, user_id, prompt)
            
            if full_text and not full_text.startswith("Error:"):
                logger.info("Replicate transcription completed successfully")
                yield 1, 1, full_text
            else:
                error_msg = full_text if full_text else "Unknown error during transcription"
                logger.error(f"Replicate transcription error: {error_msg}")
                yield 0, 1, error_msg
            return
            
        if config.get("mode") == "local-gpu" and CUDA_AVAILABLE:
            # Use local GPU
            gpu_device = config.get("gpuDevice", 0)
            logger.info(f"Using local GPU (device {gpu_device}) for chunked transcription with model: {model_name}")
            
            # Set CUDA device
            if torch.cuda.device_count() > gpu_device:
                torch.cuda.set_device(gpu_device)
            
            # Load model
            model = whisper.load_model(model_name, device="cuda")
            
        else:
            # Use local CPU (default fallback)
            cpu_threads = config.get("cpuThreads", 1)
            logger.info(f"Using local CPU ({cpu_threads} threads) for chunked transcription with model: {model_name}")
            
            # Set number of threads
            if hasattr(torch, 'set_num_threads'):
                torch.set_num_threads(cpu_threads)
            
            # Load model
            model = whisper.load_model(model_name, device="cpu")
        
        # Load audio and get info
        logger.info(f"Loading audio file: {safe_path}")
        audio = whisper.load_audio(safe_path)
        audio_duration = len(audio) / whisper.audio.SAMPLE_RATE
        total_chunks = max(1, int(audio_duration / chunk_size))
        
        logger.info(f"Audio duration: {audio_duration:.2f}s, total chunks: {total_chunks}")
        
        for i in range(total_chunks):
            start_sample = i * chunk_size * whisper.audio.SAMPLE_RATE
            end_sample = min(len(audio), (i + 1) * chunk_size * whisper.audio.SAMPLE_RATE)
            
            # Extract chunk
            chunk = audio[int(start_sample):int(end_sample)]
            
            # Process chunk
            logger.info(f"Processing chunk {i+1}/{total_chunks}")
            result = model.transcribe(chunk)
            text = result.get("text", "").strip()
            
            logger.info(f"Chunk {i+1}/{total_chunks} processed: {len(text)} chars")
            
            # Important: Yield exactly 3 values for compatibility
            yield i+1, total_chunks, text
            
    except FileNotFoundError as e:
        logger.error(f"Error during chunked transcription - file not found: {e}")
        yield 0, 1, f"Error transcribing audio: File not found - {str(e)}"
    except Exception as e:
        logger.error(f"Error during chunked transcription: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        yield 0, 1, f"Error transcribing audio: {str(e)}"

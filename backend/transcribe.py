# backend/transcribe.py
import os
import logging
import torch
import whisper

logger = logging.getLogger(__name__)

# Check for CUDA availability
CUDA_AVAILABLE = torch.cuda.is_available()
if CUDA_AVAILABLE:
    logger.info(f"CUDA is available! Using GPU: {torch.cuda.get_device_name(0)}")
else:
    logger.info("CUDA not available. Using CPU for transcription.")

WHISPER_MODEL = "small"  # can be tiny, base, small, medium, or large

def transcribe_audio(audio_path, model_name=WHISPER_MODEL):
    """
    Transcribe the entire audio file using Whisper in one go.
    """
    logger.info(f"Loading Whisper model: {model_name}")
    model = whisper.load_model(model_name, device="cuda" if CUDA_AVAILABLE else "cpu")
    logger.info(f"Model loaded successfully on {'GPU' if CUDA_AVAILABLE else 'CPU'}")

    logger.info(f"Processing audio file: {audio_path}")
    result = model.transcribe(audio_path)
    text = result.get("text", "")
    logger.info("Transcription complete")
    return text.strip()

def chunked_transcribe_audio(audio_path, model_name=WHISPER_MODEL, chunk_size=30):
    """
    Transcribe audio in chunks and yield partial results.
    
    Args:
        audio_path (str): Path to the audio file
        model_name (str): Whisper model to use
        chunk_size (int): Chunk size in seconds
        
    Yields:
        Tuple[int, int, str]: Chunk index, total chunks, and transcription text
    """
    logger.info(f"Loading Whisper model: {model_name} for chunked transcription")
    model = whisper.load_model(model_name, device="cuda" if CUDA_AVAILABLE else "cpu")
    logger.info(f"Model loaded successfully on {'GPU' if CUDA_AVAILABLE else 'CPU'}")
    
    # Load audio and get info
    try:
        audio = whisper.load_audio(audio_path)
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
            yield i, total_chunks, text
            
    except Exception as e:
        logger.error(f"Error during chunked transcription: {e}")
        yield 0, 1, f"Error transcribing audio: {e}"

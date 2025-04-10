import os
import math
import tempfile
import whisper
from pydub import AudioSegment

# Choose Whisper model size
WHISPER_MODEL = "base"  # Options: tiny, base, small, medium, large

def chunked_transcribe_audio(audio_path, chunk_sec=30, model_name=WHISPER_MODEL):
    """
    Transcribe audio using OpenAI's Whisper model with chunking for incremental results.
    Returns a generator that yields (chunk_index, total_chunks, transcription_text)
    """
    # Load the Whisper model (this is cached, so repeated calls are fast)
    print(f"Loading Whisper model: {model_name}")
    model = whisper.load_model(model_name)
    print("Model loaded successfully")
    
    # Load audio
    print(f"Loading audio file: {audio_path}")
    audio = AudioSegment.from_file(audio_path)
    print(f"Audio loaded: {len(audio)/1000:.2f} seconds")
    
    # Calculate chunking
    total_duration_sec = len(audio) / 1000  # pydub uses milliseconds
    num_chunks = math.ceil(total_duration_sec / chunk_sec)
    print(f"Splitting into {num_chunks} chunks of {chunk_sec} seconds each")
    
    # Process chunks and yield results incrementally
    with tempfile.TemporaryDirectory() as temp_dir:
        for i in range(num_chunks):
            # Extract time slice
            start_ms = i * chunk_sec * 1000
            end_ms = min((i+1) * chunk_sec * 1000, len(audio))
            
            chunk = audio[start_ms:end_ms]
            if len(chunk) == 0:
                continue
                
            # Save chunk to temporary file
            chunk_path = os.path.join(temp_dir, f"chunk_{i}.wav")
            chunk.export(chunk_path, format="wav")
            
            print(f"Transcribing chunk {i+1}/{num_chunks}")
            try:
                # Transcribe with Whisper
                result = model.transcribe(chunk_path)
                text = result["text"].strip()
                
                print(f"Chunk {i+1} transcription complete")
                yield (i+1, num_chunks, text)
            except Exception as e:
                print(f"Error transcribing chunk {i+1}: {e}")
                yield (i+1, num_chunks, "")

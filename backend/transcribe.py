import whisper

WHISPER_MODEL = "small"  # can be tiny, base, small, medium, or large

def transcribe_audio(audio_path, model_name=WHISPER_MODEL):
    """
    Transcribe the entire audio file using Whisper in one go.
    """
    print(f"Loading Whisper model: {model_name}")
    model = whisper.load_model(model_name)
    print("Model loaded successfully")

    print(f"Loading audio file: {audio_path}")
    result = model.transcribe(audio_path)
    text = result.get("text", "")
    print("Transcription complete")
    return text.strip()


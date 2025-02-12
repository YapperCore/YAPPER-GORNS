import torch
import torchaudio
from transformers import Speech2TextProcessor, Speech2TextForConditionalGeneration
import torchaudio.transforms as transforms
import os

def transcribe_audio(audio_path, model_name="facebook/s2t-small-librispeech-asr"):
    """
    Transcribe an audio file (MP3, WAV, or FLAC) into text using the Speech2Text model.

    Parameters:
    - audio_path (str): Path to the audio file.
    - model_name (str): Hugging Face model identifier.

    Returns:
    - transcription (str): The transcribed text.
    """
    # Load the processor and model
    processor = Speech2TextProcessor.from_pretrained(model_name)
    model = Speech2TextForConditionalGeneration.from_pretrained(model_name)

    # Convert MP3 to WAV if needed
    if audio_path.lower().endswith(".mp3"):
        print("Converting MP3 to WAV...")
        wav_path = audio_path.replace(".mp3", ".wav")
        torchaudio.backend.sox_io_backend.info(audio_path)  # Check file info
        torchaudio.backend.sox_io_backend.save(wav_path, *torchaudio.backend.sox_io_backend.load(audio_path))
        audio_path = wav_path

    # Load the audio file
    speech, sample_rate = torchaudio.load(audio_path)

    # Convert to mono if necessary
    if speech.shape[0] > 1:
        speech = torch.mean(speech, dim=0, keepdim=True)

    # Resample to 16000 Hz if needed
    target_sample_rate = 16000
    if sample_rate != target_sample_rate:
        resampler = transforms.Resample(orig_freq=sample_rate, new_freq=target_sample_rate)
        speech = resampler(speech)
        sample_rate = target_sample_rate

    # Remove channel dimension for processing
    speech = speech.squeeze().numpy()

    # Process the audio
    inputs = processor(speech, sampling_rate=sample_rate, return_tensors="pt")

    # Generate transcription
    with torch.no_grad():
        generated_ids = model.generate(inputs["input_features"])

    # Decode the generated tokens to text
    transcription = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

    return transcription
if __name__ == "__main__":
    # Path to your audio file
    audio_file = "INPUT_AUDIO_TEST/08. Live & Learn.mp3"
    # if the audio file is mp3, IT NEEDS TO BE CONVERTED TO .WAV

    # Perform transcription
    text = transcribe_audio(audio_file)

    # Output the transcription
    print("Transcription:")
    print(text)


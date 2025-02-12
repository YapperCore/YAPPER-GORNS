import torch
from transformers import Speech2TextProcessor, Speech2TextForConditionalGeneration
import torchaudio
import pyaudio

def transcribe_audio(audio_path, model_name="facebook/s2t-small-librispeech-asr"):
    """
    Transcribe audio to text using the Speech2Text model.

    Parameters:
    - audio_path (str): Path to the audio file (.wav or .flac).
    - model_name (str): Hugging Face model identifier.

    Returns:
    - transcription (str): The transcribed text.
    """
    # Load the processor and model
    processor = Speech2TextProcessor.from_pretrained(model_name)
    model = Speech2TextForConditionalGeneration.from_pretrained(model_name)

    # Load the audio file
    speech, sample_rate = torchaudio.load(audio_path)

    # Convert to mono by averaging channels if necessary
    if speech.shape[0] > 1:
        speech = torch.mean(speech, dim=0, keepdim=True)

    # Resample to 16000 Hz if needed
    target_sample_rate = 16000
    if sample_rate != target_sample_rate:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=target_sample_rate)
        speech = resampler(speech)
        sample_rate = target_sample_rate

    # Remove channel dimension for processing
    speech = speech.squeeze().numpy()

    # Process the audio
    inputs = processor(speech, sampling_rate=sample_rate, return_tensors="pt")

    # Generate transcription
    with torch.no_grad():
        generated_ids = model.generate(inputs["input_features"], attention_mask=inputs["attention_mask"])

    # Decode the generated tokens to text
    transcription = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

    return transcription

def transcrible_audio_pyaudio(audio_path : str) -> str:
    transcrition : str = 'UNABLE TO TRANSCRIBE'
    return transcrition

if __name__ == "__main__":
    # Path to your audio file
    audio_file = "harvard.wav"  # Replace with your audio file path 

    # Perform transcription
    text = transcribe_audio(audio_file)

    # Output the transcription
    print("Transcription:")
    print(text)


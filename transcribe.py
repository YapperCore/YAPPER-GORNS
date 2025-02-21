import torch
import torchaudio
from transformers import Speech2TextProcessor, Speech2TextForConditionalGeneration
import torchaudio.transforms as transforms
import os
import sys


def calc_word_error_rate(S : int,D : int, I : int, N: int)->float:
    """
    S = Number of substitutions (wrong words)
	D = Number of deletions (missing words)
	I = Number of insertions (extra words)
	N = Total number of words in the expected transcription
    """
    return ((S+D+I) / N)*100

def transcribe_audio(audio_path, output_dir, model_name="facebook/s2t-small-librispeech-asr"):
    """
    Transcribe an audio file (MP3, WAV, or FLAC) into text using the Speech2Text model.

    Parameters:
    - audio_path (str): Path to the audio file.
    - output_dir (str): Directory where the transcription text file will be saved.
    - model_name (str): Hugging Face model identifier.

    Returns:
    - transcription (str): The transcribed text.
    """
    # Load the processor and model
    processor = Speech2TextProcessor.from_pretrained(model_name)
    model = Speech2TextForConditionalGeneration.from_pretrained(model_name)

    # Load the audio file
    try:
        speech, sample_rate = torchaudio.load(audio_path)
    except Exception as e:
        print(f"Error loading audio file {audio_path}: {e}")
        return

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

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Define output file path
    output_file_path = os.path.join(output_dir, os.path.basename(audio_path) + ".txt")

    # Save transcription to a text file
    with open(output_file_path, "w") as f:
        f.write(transcription)

    print(f"Transcription saved to {output_file_path}")

    return transcription

if __name__ == "__main__":
    # Ensure the correct number of arguments are provided
    if len(sys.argv) != 3:
        print("Usage: python3 transcribe.py <audio_file_path> <output_directory>")
        sys.exit(1)

    # Get CLI arguments
    audio_file_path = sys.argv[1]
    output_directory = sys.argv[2]

    # Perform transcription
    transcribe_audio(audio_file_path, output_directory)

# python3 transcribe.py <audio_file_path> <output_directory>
# python3 transcribe.py "INPUT_AUDIO_TEST/test_file_1.wav" "OUTPUT_TEST"
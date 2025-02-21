import torch
import torchaudio
import math
import os
from transformers import Speech2TextProcessor, Speech2TextForConditionalGeneration
import platform


# Change the audio backend to sox_io if on mac
torchaudio.set_audio_backend("soundfile")
if platform.system() == "Darwin":
    torchaudio.set_audio_backend("sox_io")


LOCAL_MODEL_PATH = os.path.join(os.getcwd(), "s2t-small-librispeech-asr")

def chunked_transcribe_audio(audio_path, chunk_sec=5, model_path=LOCAL_MODEL_PATH):
    processor = Speech2TextProcessor.from_pretrained(model_path)
    model = Speech2TextForConditionalGeneration.from_pretrained(model_path)
    
    speech, sr = torchaudio.load(audio_path)

    if speech.shape[0] > 1:
        speech = torch.mean(speech, dim=0, keepdim=True)

    target_sr = 16000
    if sr != target_sr:
        resampler = torchaudio.transforms.Resample(sr, target_sr)
        speech = resampler(speech)
        sr = target_sr

    signal = speech.squeeze()
    total_len_sec = signal.shape[0] / sr
    num_chunks = math.ceil(total_len_sec / chunk_sec)

    for i in range(num_chunks):
        start = int(i * chunk_sec * sr)
        end = int((i + 1) * chunk_sec * sr)
        audio_chunk = signal[start:end]
        if audio_chunk.shape[0] == 0:
            break

        inputs = processor(audio_chunk.numpy(), sampling_rate=sr, return_tensors="pt")
        with torch.no_grad():
            generated_ids = model.generate(inputs["input_features"], attention_mask=inputs["attention_mask"])
        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        yield (i + 1, num_chunks, text)


def chunked_transcribe_audio_with_error_rate(audio_path, reference_text, chunk_sec=5, model_path="LOCAL_MODEL_PATH"):
    """
    Transcribes an audio file in chunks and calculates the Word Error Rate (WER).
    
    Parameters:
    - audio_path (str): Path to the audio file.
    - reference_text (str): The ground truth transcript for comparison.
    - chunk_sec (int): Length of each chunk in seconds.
    - model_path (str): Path to the pre-trained model.

    Returns:
    - transcription (str): The full transcribed text.
    - error_rate (float): The computed Word Error Rate (WER).
    
    - further debug code, discuss and go over code with team members during 
    in-class team time
    """
    processor = Speech2TextProcessor.from_pretrained(model_path)
    model = Speech2TextForConditionalGeneration.from_pretrained(model_path)
    
    speech, sr = torchaudio.load(audio_path)

    # Convert stereo to mono if needed
    if speech.shape[0] > 1:
        speech = torch.mean(speech, dim=0, keepdim=True)

    # Resample to 16kHz if needed
    target_sr = 16000
    if sr != target_sr:
        resampler = torchaudio.transforms.Resample(sr, target_sr)
        speech = resampler(speech)
        sr = target_sr

    signal = speech.squeeze()
    total_len_sec = signal.shape[0] / sr
    num_chunks = math.ceil(total_len_sec / chunk_sec)

    transcribed_text = []

    for i in range(num_chunks):
        start = int(i * chunk_sec * sr)
        end = int((i + 1) * chunk_sec * sr)
        audio_chunk = signal[start:end]
        if audio_chunk.shape[0] == 0:
            break

        inputs = processor(audio_chunk.numpy(), sampling_rate=sr, return_tensors="pt")
        with torch.no_grad():
            generated_ids = model.generate(inputs["input_features"], attention_mask=inputs["attention_mask"])
        text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        transcribed_text.append(text)

    # Join the transcribed chunks
    full_transcription = " ".join(transcribed_text)

    # Compute Word Error Rate (WER)
    error_rate = wer(reference_text, full_transcription)

    return full_transcription, error_rate

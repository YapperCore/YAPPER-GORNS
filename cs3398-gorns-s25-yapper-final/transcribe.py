import torch
import torchaudio
import os
import sys
from transformers import Speech2TextProcessor, Speech2TextForConditionalGeneration

def transcribe_audio(audio_path, output_dir, model_name="facebook/s2t-small-librispeech-asr"):
    processor = Speech2TextProcessor.from_pretrained(model_name)
    model = Speech2TextForConditionalGeneration.from_pretrained(model_name)
    try:
        speech, sr = torchaudio.load(audio_path)
    except Exception as e:
        print(f"Error loading audio {audio_path}: {e}")
        return
    if speech.shape[0] > 1:
        speech = torch.mean(speech, dim=0, keepdim=True)
    if sr != 16000:
        resampler = torchaudio.transforms.Resample(sr, 16000)
        speech = resampler(speech)
        sr = 16000

    speech = speech.squeeze().numpy()
    inputs = processor(speech, sampling_rate=sr, return_tensors="pt")
    with torch.no_grad():
        gen_ids = model.generate(inputs["input_features"])
    transcription = processor.batch_decode(gen_ids, skip_special_tokens=True)[0]

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, os.path.basename(audio_path)+".txt")
    with open(out_path, "w") as f:
        f.write(transcription)
    print(f"Transcription saved to {out_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 transcribe.py <audio_file> <output_dir>")
        sys.exit(1)
    transcribe_audio(sys.argv[1], sys.argv[2])

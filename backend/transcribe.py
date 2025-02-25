import os
import math
import torch
import torchaudio
from transformers import Speech2TextProcessor, Speech2TextForConditionalGeneration

# We can force sox_io
torchaudio.set_audio_backend("sox_io")
if os.name == 'posix':
    # Possibly for mac
    try:
        import platform
        if platform.system() == "Darwin":
            torchaudio.set_audio_backend("sox_io")
    except:
        pass

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
        yield (i+1, num_chunks, text)

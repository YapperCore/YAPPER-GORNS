import unittest
from unittest.mock import patch, MagicMock, mock_open
import torch
import math
from backend.transcribe import chunked_transcribe_audio, set_best_audio_backend

class TestTranscription(unittest.TestCase):

    @patch("torchaudio.set_audio_backend")
    @patch("torchaudio.list_audio_backends", return_value=["sox_io", "soundfile"])
    def test_set_best_audio_backend(self, mock_list, mock_set):
        set_best_audio_backend()
        mock_set.assert_called_with("sox_io")

    @patch("your_script.Speech2TextProcessor.from_pretrained")
    @patch("your_script.Speech2TextForConditionalGeneration.from_pretrained")
    @patch("torchaudio.load")
    def test_chunked_transcribe_audio_single_chunk(self, mock_load, mock_model_class, mock_processor_class):
        dummy_audio = torch.randn(1, 16000 * 5)  # 5 seconds mono audio
        mock_load.return_value = (dummy_audio, 16000)

        mock_processor = MagicMock()
        mock_processor.return_tensors = "pt"
        mock_processor_class.return_value = mock_processor

        mock_model = MagicMock()
        mock_model.generate.return_value = torch.tensor([[1, 2, 3]])
        mock_model_class.return_value = mock_model

        mock_processor.batch_decode.return_value = ["transcription"]

        mock_processor.__call__.return_value = {
            "input_features": torch.tensor([[0.1] * 100]),
            "attention_mask": torch.ones(1, 100)
        }

        results = list(chunked_transcribe_audio("dummy_path.wav", chunk_sec=5))

        self.assertEqual(len(results), 1)
        chunk_idx, total_chunks, transcription = results[0]
        self.assertEqual(chunk_idx, 1)
        self.assertEqual(total_chunks, 1)
        self.assertEqual(transcription, "transcription")

    @patch("your_script.Speech2TextProcessor.from_pretrained")
    @patch("your_script.Speech2TextForConditionalGeneration.from_pretrained")
    @patch("torchaudio.load")
    def test_chunked_transcribe_audio_multiple_chunks(self, mock_load, mock_model_class, mock_processor_class):
        dummy_audio = torch.randn(1, 16000 * 12)  # 12 seconds
        mock_load.return_value = (dummy_audio, 16000)

        mock_processor = MagicMock()
        mock_processor_class.return_value = mock_processor

        mock_model = MagicMock()
        mock_model.generate.return_value = torch.tensor([[1, 2, 3]])
        mock_model_class.return_value = mock_model

        mock_processor.batch_decode.return_value = ["transcription"] * 3
        mock_processor.__call__.return_value = {
            "input_features": torch.tensor([[0.1] * 100]),
            "attention_mask": torch.ones(1, 100)
        }

        results = list(chunked_transcribe_audio("dummy_path.wav", chunk_sec=5))
        self.assertEqual(len(results), 3)
        for i, result in enumerate(results):
            self.assertEqual(result[0], i + 1)
            self.assertEqual(result[1], 3)
            self.assertEqual(result[2], "transcription")

if __name__ == '__main__':

    # run unittest with python <nameofscript>test.py >> testoutput.txt
    unittest.main()
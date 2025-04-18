import unittest
from unittest.mock import patch, MagicMock
import torch
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))
import math
import whisper
from backend.transcribe import chunked_transcribe_audio
#import xmlrunner
class TestTranscription(unittest.TestCase):

    @patch("whisper.load_model")
    @patch("whisper.load_audio")
    def test_chunked_transcribe_audio_single_chunk(self, mock_load_audio, mock_load_model):
        # Prepare dummy audio for 5 seconds (sample rate inferred from whisper.audio.SAMPLE_RATE)
        sample_rate = whisper.audio.SAMPLE_RATE
        dummy_audio = torch.randn(sample_rate * 5).numpy()
        mock_load_audio.return_value = dummy_audio

        # Configure the mock model
        mock_model = MagicMock()
        mock_model.transcribe.return_value = {"text": "transcription"}
        mock_load_model.return_value = mock_model

        results = list(chunked_transcribe_audio("dummy_path.wav", chunk_size=5))
        # Expecting one chunk
        self.assertEqual(len(results), 1)
        chunk_idx, total_chunks, transcription = results[0]
        self.assertEqual(chunk_idx, 1)
        self.assertEqual(total_chunks, 1)
        self.assertEqual(transcription, "transcription")

    @patch("whisper.load_model")
    @patch("whisper.load_audio")
    def test_chunked_transcribe_audio_multiple_chunks(self, mock_load_audio, mock_load_model):
        # Prepare dummy audio for 33 seconds
        sample_rate = whisper.audio.SAMPLE_RATE
        dummy_audio = torch.randn(sample_rate * 33).numpy()
        mock_load_audio.return_value = dummy_audio

        # Configure the mock model to return different transcriptions per chunk
        def side_effect(chunk_input):
            return {"text": "transcription"}
        mock_model = MagicMock()
        mock_model.transcribe.side_effect = side_effect
        mock_load_model.return_value = mock_model

        # Test with a chunk size of 10 seconds
        chunk_size = 10
        results = list(chunked_transcribe_audio("dummy_path.wav", chunk_size=chunk_size))
        # Expecting 4 chunks (33 sec audio with chunk_size=10 results in ceil(33/10) = 4)
        self.assertEqual(len(results), 4)
        for i, result in enumerate(results):
            self.assertEqual(result[0], i + 1)
            self.assertEqual(result[1], 4)
            self.assertEqual(result[2], "transcription")

    @unittest.skipUnless(torch.cuda.is_available(), "CUDA not available, skipping test")
    def test_cuda_available(self):
        import torch
        self.assertTrue(torch.cuda.is_available())
        # for Michael, will skip because VM does not have CUDA available
if __name__ == '__main__':
    unittest.main()
#    with open('test-reports/transcription-test-report.xml', 'wb') as output:
#        unittest.main(testRunner=xmlrunner.XMLTestRunner(output=output), exit=False)
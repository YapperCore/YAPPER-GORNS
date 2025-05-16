// This is just for documentation purposes to show how the integration works
// The actual implementation is in the transcriptionService.ts file

/**
 * When the user selects Replicate as their transcription method in settings,
 * the following flow happens:
 * 
 * 1. User uploads an audio file
 * 2. Frontend sends file to /upload-audio endpoint with transcription_prompt if available
 * 3. Backend creates a document and checks if mode is 'replicate' in user settings
 * 4. If prompt is required but not provided, backend sets doc.awaiting_prompt = true
 * 5. Frontend detects this and shows prompt input field
 * 6. User enters prompt and clicks Start Transcription
 * 7. Frontend calls /api/transcribe/{docId} with the prompt
 * 8. Backend uses Replicate API to transcribe
 * 9. Socket.io sends real-time updates as the transcription progresses
 * 
 * The Replicate API parameters are:
 * - audio: The audio file
 * - prompt: User-provided guidance for transcription
 * - model: "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c"
 */

// Sample of how Replicate API is called from backend
async function transcribeWithReplicate(audioUrl, prompt) {
  const replicateApiKey = process.env.REPLICATE_API_TOKEN || user.replicateApiKey;
  
  // Set API key for this request
  process.env.REPLICATE_API_TOKEN = replicateApiKey;
  
  const input = {
    audio: audioUrl,
    prompt: prompt || "Please transcribe this audio accurately. You are a transcription model.",
    system_prompt: "You are a professional transcription model. Your task is to accurately transcribe the provided audio content.",
    voice_type: "Chelsie",
    generate_audio: false,
    use_audio_in_video: false
  };

  try {
    // Make API call to Replicate
    const output = await replicate.run(
      "vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c",
      { input }
    );
    
    return output.text;
  } catch (error) {
    console.error("Replicate API error:", error);
    throw error;
  }
}

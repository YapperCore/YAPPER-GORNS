// src/services/transcriptionService.ts
interface TranscriptionConfig {
  mode: string;
  replicateApiKey?: string;
  cpuThreads?: number;
  gpuDevice?: number;
  whisperModel?: string;
  defaultPrompt?: string;
}

interface TranscriptionResult {
  success: boolean;
  message: string;
  docId?: string;
  error?: string;
}

export async function transcribeAudio(
  audioFile: File,
  docId: string = "",
  prompt: string = "",
  token: string,
  config: TranscriptionConfig
): Promise<TranscriptionResult> {
  try {
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    // Use default API key if not provided
    if (config.mode === 'replicate' && !config.replicateApiKey) {
      formData.append('default_replicate_api', 'true');
    }
    
    // Add transcription prompt if provided
    if (prompt) {
      formData.append('transcription_prompt', prompt);
    }
    
    // Add any existing document ID if we're updating
    if (docId) {
      formData.append('doc_id', docId);
    }
    
    // Upload the audio file
    const uploadResponse = await fetch('/upload-audio', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(errorData.error || 'Upload failed');
    }
    
    const uploadData = await uploadResponse.json();
    
    // Check if we're using Replicate and need a separate prompt submission
    if (config.mode === 'replicate' && (!prompt || uploadData.requires_prompt)) {
      return {
        success: true,
        message: 'File uploaded. Provide a prompt to begin transcription.',
        docId: uploadData.doc_id
      };
    }
    
    // If the transcription is starting automatically
    if (uploadData.doc_id) {
      return {
        success: true,
        message: uploadData.message || 'Transcription started successfully',
        docId: uploadData.doc_id
      };
    }
    
    return {
      success: true,
      message: uploadData.message || 'File uploaded successfully'
    };
    
  } catch (error) {
    console.error('Transcription error:', error);
    return {
      success: false,
      message: 'Transcription failed',
      error: (error as Error).message
    };
  }
}

export async function submitTranscriptionPrompt(
  docId: string,
  prompt: string,
  token: string
): Promise<TranscriptionResult> {
  try {
    const response = await fetch(`/api/transcribe/${docId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ 
        transcription_prompt: prompt,
        use_default_api: !prompt 
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to start transcription');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      message: data.message || 'Transcription started successfully',
      docId: docId
    };
    
  } catch (error) {
    console.error('Error submitting transcription prompt:', error);
    return {
      success: false,
      message: 'Failed to start transcription',
      error: (error as Error).message
    };
  }
}

export async function getUserSettings(token: string): Promise<TranscriptionConfig | null> {
  try {
    const response = await fetch('/api/user-settings', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user settings');
    }
    
    const data = await response.json();
    
    // If no API key is set, use the default
    if (data.transcriptionConfig && data.transcriptionConfig.mode === 'replicate' && !data.transcriptionConfig.replicateApiKey) {
      data.transcriptionConfig.replicateApiKey = 'default';
    }
    
    return data.transcriptionConfig || {
      mode: 'local-cpu',
      cpuThreads: 1,
      whisperModel: 'small'
    };
    
  } catch (error) {
    console.error('Error fetching user settings:', error);
    return null;
  }
}

export async function testReplicateApiKey(apiKey: string, token: string): Promise<{success: boolean, message: string}> {
  try {
    const response = await fetch('/api/test-replicate-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ 
        apiKey: apiKey || 'r8_P18zK076s92g3ZuY4pcb1THRAzmnFpE3j70Vf',
        use_default: !apiKey
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'API key test failed'
      };
    }
    
    return {
      success: true,
      message: data.message || 'API key is valid'
    };
    
  } catch (error) {
    console.error('Error testing Replicate API key:', error);
    return {
      success: false,
      message: `Error testing API key: ${(error as Error).message}`
    };
  }
}

export async function restartTranscription(
  docId: string,
  prompt: string = "",
  token: string
): Promise<TranscriptionResult> {
  try {
    const response = await fetch(`/api/transcribe/${docId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ 
        transcription_prompt: prompt,
        restart: true,
        use_default_api: !prompt
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to restart transcription');
    }
    
    const data = await response.json();
    
    return {
      success: true,
      message: data.message || 'Transcription restarted successfully',
      docId: docId
    };
    
  } catch (error) {
    console.error('Error restarting transcription:', error);
    return {
      success: false,
      message: 'Failed to restart transcription',
      error: (error as Error).message
    };
  }
}

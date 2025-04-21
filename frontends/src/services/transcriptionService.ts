interface TranscriptionConfig {
  mode: string;
  replicateApiKey?: string;
  cpuThreads?: number;
  gpuDevice?: number;
  whisperModel?: string;
}

interface TranscriptionResult {
  success: boolean;
  message: string;
  docId?: string;
  error?: string;
}

export async function transcribeAudio(
  audioFile: File,
  docId: string,
  prompt: string = "",
  token: string,
  config: TranscriptionConfig
): Promise<TranscriptionResult> {
  try {
    const formData = new FormData();
    formData.append('audio', audioFile);
    
    // Add transcription prompt if using Replicate
    if (config.mode === 'replicate' && prompt) {
      formData.append('transcription_prompt', prompt);
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
    
    // If using Replicate and we need a prompt but don't have one yet
    if (uploadData.requires_prompt) {
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
    // This endpoint initiates transcription with Replicate if that's the selected mode
    const response = await fetch(`/api/transcribe/${docId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ transcription_prompt: prompt })
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

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Toast } from 'primereact/toast';
import { RadioButton } from 'primereact/radiobutton';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Password } from 'primereact/password';
import { Slider } from 'primereact/slider';
import { Dialog } from 'primereact/dialog';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Divider } from 'primereact/divider';
import { Card } from 'primereact/card';
import { Message } from 'primereact/message';
import { TabView, TabPanel } from 'primereact/tabview';
import { ToggleButton } from 'primereact/togglebutton';
import { getSocket } from '@/lib/socket-client';
import '@/styles/Settings.css';

interface SystemInfo {
  cpuInfo: string;
  gpuInfo: string;
  gpuCount: number;
  cpuThreads: number;
  platform?: string;
  isWSL?: boolean;
  pythonVersion?: string;
}

interface TranscriptionConfig {
  mode: string;
  replicateApiKey?: string;
  cpuThreads: number;
  gpuDevice: number;
  whisperModel: string;
  defaultPrompt?: string;
}

export default function Settings() {
  const { currentUser } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    cpuInfo: 'Loading...',
    gpuInfo: 'Loading...',
    gpuCount: 0,
    cpuThreads: 1
  });
  
  const [transcriptionConfig, setTranscriptionConfig] = useState<TranscriptionConfig>({
    mode: 'local-cpu',
    replicateApiKey: '',
    cpuThreads: 1,
    gpuDevice: 0,
    whisperModel: 'small',
    defaultPrompt: ''
  });
  
  const [showApiKeyDialog, setShowApiKeyDialog] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [apiKeyTesting, setApiKeyTesting] = useState<boolean>(false);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [apiVerified, setApiVerified] = useState<boolean>(false);
  const [apiUsername, setApiUsername] = useState<string>('');
  const [apiError, setApiError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  const toast = useRef<Toast>(null);
  
  // Check socket connection
  useEffect(() => {
    try {
      const socket = getSocket();
      setSocketConnected(socket.connected);
      
      const handleConnect = () => setSocketConnected(true);
      const handleDisconnect = () => setSocketConnected(false);
      
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      
      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
      };
    } catch (error) {
      console.error("Error checking socket connection:", error);
      setSocketConnected(false);
    }
  }, []);
  
  // Fetch system information and current settings
  useEffect(() => {
    if (!currentUser) return;

    async function fetchData() {
      setLoading(true);
      try {
        const token = await currentUser.getIdToken();
        
        // Fetch system info
        const sysInfoRes = await fetch('/api/system-info', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (sysInfoRes.ok) {
          const sysInfo = await sysInfoRes.json();
          setSystemInfo(sysInfo);
        }
        
        // Fetch user settings
        const settingsRes = await fetch('/api/user-settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.transcriptionConfig) {
            const config = settings.transcriptionConfig;
            setTranscriptionConfig(prev => ({
              ...prev,
              ...config,
              // Set default threads if not provided
              cpuThreads: config.cpuThreads || 1,
              // Don't overwrite API key if it's empty in the response for security
              replicateApiKey: config.replicateApiKey || prev.replicateApiKey,
              defaultPrompt: config.defaultPrompt || ''
            }));
            
            // If Replicate mode is selected and we have an API key, verify it
            if (config.mode === 'replicate' && config.replicateApiKey) {
              testApiKey(config.replicateApiKey, true);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching settings data:", error);
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load settings data',
          life: 3000
        });
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [currentUser]);
  
  const handleSaveSettings = async () => {
    if (!currentUser) return;
    
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/user-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transcriptionConfig
        })
      });
      
      if (res.ok) {
        setSaveSuccess(true);
        toast.current?.show({
          severity: 'success',
          summary: 'Settings Saved',
          detail: 'Your transcription settings have been updated successfully',
          life: 3000
        });
        
        // Hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
        
        // If Replicate is selected, test the API key
        if (transcriptionConfig.mode === 'replicate' && transcriptionConfig.replicateApiKey) {
          testApiKey(transcriptionConfig.replicateApiKey);
        }
      } else {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save settings',
          life: 3000
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save settings: ' + (error as Error).message,
        life: 3000
      });
    }
  };
  
  const testApiKey = async (apiKey: string, silent = false) => {
    if (!currentUser || !apiKey) return;
    
    try {
      setApiKeyTesting(true);
      setApiVerified(false);
      setApiError('');
      
      const token = await currentUser.getIdToken();
      const testResponse = await fetch('/api/test-replicate-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ apiKey })
      });
      
      const testResult = await testResponse.json();
      
      if (testResult.success) {
        setApiVerified(true);
        if (testResult.username) {
          setApiUsername(testResult.username);
        }
        
        if (!silent) {
          toast.current?.show({
            severity: 'success',
            summary: 'Replicate API Key Verified',
            detail: testResult.message || 'Your Replicate API key is valid and working correctly',
            life: 5000
          });
        }
      } else {
        setApiVerified(false);
        setApiError(testResult.message || 'API key validation failed');
        
        if (!silent) {
          toast.current?.show({
            severity: 'error',
            summary: 'API Key Validation Failed',
            detail: testResult.message || 'Could not verify Replicate API key',
            life: 5000
          });
        }
      }
    } catch (error) {
      console.error("Error testing Replicate API:", error);
      setApiVerified(false);
      setApiError(`Error testing API key: ${(error as Error).message}`);
      
      if (!silent) {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: `Failed to test Replicate API key: ${(error as Error).message}`,
          life: 5000
        });
      }
    } finally {
      setApiKeyTesting(false);
    }
  };
  
  const handleModeChange = (mode: string) => {
    setTranscriptionConfig(prev => ({
      ...prev,
      mode
    }));
    
    if (mode === 'replicate' && !transcriptionConfig.replicateApiKey) {
      setShowApiKeyDialog(true);
    }
  };
  
  const handleApiKeySubmit = () => {
    setShowApiKeyDialog(false);
    
    if (transcriptionConfig.replicateApiKey) {
      testApiKey(transcriptionConfig.replicateApiKey);
    }
  };
  
  const ModelSizeDescription = ({ size }: { size: string }) => {
    const descriptions: Record<string, { desc: string, specs: string, recommended: string }> = {
      tiny: {
        desc: 'Fastest, least accurate model with minimal system requirements',
        specs: '~1GB RAM, ~75MB download',
        recommended: 'Quick drafts, simple transcriptions'
      },
      base: {
        desc: 'Fast model with improved accuracy over tiny',
        specs: '~1GB RAM, ~150MB download',
        recommended: 'Everyday transcription for clear audio'
      },
      small: {
        desc: 'Good balance between speed and accuracy',
        specs: '~2GB RAM, ~500MB download',
        recommended: 'Most general purpose transcription'
      },
      medium: {
        desc: 'Very accurate but slower than smaller models',
        specs: '~5GB RAM, ~1.5GB download',
        recommended: 'High-quality transcriptions with challenging audio'
      },
      large: {
        desc: 'Most accurate model, significantly slower than others',
        specs: '~10GB RAM, ~3GB download',
        recommended: 'When maximum accuracy is critical'
      }
    };
    
    const info = descriptions[size] || { 
      desc: 'Model information not available', 
      specs: 'Unknown requirements',
      recommended: 'General use'
    };
    
    return (
      <div className="model-size-info">
        <p>{info.desc}</p>
        <p><strong>Requirements:</strong> {info.specs}</p>
        <p><strong>Recommended for:</strong> {info.recommended}</p>
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="settings-loading">
        <ProgressSpinner />
        <p>Loading settings...</p>
      </div>
    );
  }
  
  return (
    <div className="settings-container">
      <Toast ref={toast} position="top-right" />
      
      <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
        <TabPanel header="Transcription Settings">
          <div className="p-grid settings-grid">
            <div className="card connection-status-card">
              <h3>Connection Status</h3>
              <div className="status-items">
                <div className="status-item">
                  <span className="status-label">Socket.IO:</span>
                  <span className={`status-badge ${socketConnected ? 'connected' : 'disconnected'}`}>
                    {socketConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                {transcriptionConfig.mode === 'replicate' && (
                  <div className="status-item">
                    <span className="status-label">Replicate API:</span>
                    <span className={`status-badge ${apiVerified ? 'connected' : apiKeyTesting ? 'testing' : 'disconnected'}`}>
                      {apiKeyTesting ? 'Testing...' : (apiVerified ? 'Verified' : 'Not Verified')}
                    </span>
                    {apiVerified && apiUsername && (
                      <span className="api-username">({apiUsername})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="system-info-container card">
              <h3>System Information</h3>
              <div className="p-grid">
                <div className="p-col-6">
                  <div className="info-item">
                    <strong>CPU:</strong> {systemInfo.cpuInfo}
                  </div>
                  <div className="info-item">
                    <strong>CPU Threads:</strong> {systemInfo.cpuThreads}
                  </div>
                </div>
                <div className="p-col-6">
                  <div className="info-item">
                    <strong>GPU:</strong> {systemInfo.gpuInfo}
                  </div>
                  <div className="info-item">
                    <strong>GPU Count:</strong> {systemInfo.gpuCount}
                  </div>
                </div>
              </div>
              
              {showAdvanced && (
                <div className="advanced-system-info">
                  <Divider />
                  <div className="info-item">
                    <strong>Platform:</strong> {systemInfo.platform} {systemInfo.isWSL ? '(WSL)' : ''}
                  </div>
                  <div className="info-item">
                    <strong>Python Version:</strong> {systemInfo.pythonVersion}
                  </div>
                </div>
              )}
              
              <Button 
                label={showAdvanced ? "Hide Advanced Info" : "Show Advanced Info"}
                link
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="p-button-sm"
              />
            </div>
      
            <div className="card">
              <h3>Transcription Method</h3>
              <div className="field-radiobutton">
                <RadioButton 
                  inputId="mode1" 
                  name="mode" 
                  value="local-cpu" 
                  onChange={() => handleModeChange('local-cpu')} 
                  checked={transcriptionConfig.mode === 'local-cpu'} 
                />
                <label htmlFor="mode1">Run Whisper locally on CPU</label>
              </div>
              
              <div className="field-radiobutton">
                <RadioButton 
                  inputId="mode2" 
                  name="mode" 
                  value="local-gpu" 
                  onChange={() => handleModeChange('local-gpu')} 
                  checked={transcriptionConfig.mode === 'local-gpu'} 
                  disabled={systemInfo.gpuCount === 0}
                />
                <label htmlFor="mode2">
                  Run Whisper locally on GPU 
                  {systemInfo.gpuCount === 0 && <span className="option-disabled"> (No GPU detected)</span>}
                </label>
              </div>
              
              <div className="field-radiobutton">
                <RadioButton 
                  inputId="mode3" 
                  name="mode" 
                  value="replicate" 
                  onChange={() => handleModeChange('replicate')} 
                  checked={transcriptionConfig.mode === 'replicate'} 
                />
                <label htmlFor="mode3">Use Replicate API (Cloud-based)</label>
              </div>
              
              {transcriptionConfig.mode === 'replicate' && (
                <div className="replicate-info">
                  <Message severity="info" text="Replicate provides cloud-based transcription using OpenAI's Whisper models. No local GPU required." />
                </div>
              )}
            </div>
            
            {transcriptionConfig.mode === 'local-cpu' && (
              <div className="card">
                <h3>CPU Settings</h3>
                <div className="slider-container">
                  <label>CPU Threads: {transcriptionConfig.cpuThreads}</label>
                  <Slider 
                    value={transcriptionConfig.cpuThreads} 
                    onChange={(e) => setTranscriptionConfig(prev => ({...prev, cpuThreads: e.value as number}))} 
                    min={1} 
                    max={systemInfo.cpuThreads} 
                    className="p-mb-3" 
                  />
                </div>
              </div>
            )}
            
            {transcriptionConfig.mode === 'local-gpu' && systemInfo.gpuCount > 0 && (
              <div className="card">
                <h3>GPU Settings</h3>
                <div className="field">
                  <label>GPU Device:</label>
                  <div className="radio-group">
                    {Array.from({length: systemInfo.gpuCount}).map((_, idx) => (
                      <div key={idx} className="field-radiobutton">
                        <RadioButton 
                          inputId={`gpu${idx}`} 
                          name="gpuDevice" 
                          value={idx} 
                          onChange={() => setTranscriptionConfig(prev => ({...prev, gpuDevice: idx}))} 
                          checked={transcriptionConfig.gpuDevice === idx} 
                        />
                        <label htmlFor={`gpu${idx}`}>GPU {idx}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {transcriptionConfig.mode === 'replicate' && (
              <div className="card">
                <h3>Replicate API Settings</h3>
                <div className="field">
                  <label>API Key:</label>
                  <div className="p-inputgroup">
                    <Password 
                      value={transcriptionConfig.replicateApiKey} 
                      onChange={(e) => setTranscriptionConfig(prev => ({...prev, replicateApiKey: e.target.value}))}
                      feedback={false}
                      toggleMask
                      className="api-key-input"
                      placeholder="Enter your Replicate API key"
                      disabled={apiKeyTesting}
                    />
                    <Button 
                      icon="pi pi-key" 
                      onClick={() => setShowApiKeyDialog(true)}
                      className="p-button-info"
                      disabled={apiKeyTesting}
                    />
                    <Button 
                      icon={apiKeyTesting ? "pi pi-spin pi-spinner" : (apiVerified ? "pi pi-check" : "pi pi-check-circle")}
                      onClick={() => testApiKey(transcriptionConfig.replicateApiKey || '')}
                      className={apiVerified ? "p-button-success" : "p-button-primary"}
                      disabled={!transcriptionConfig.replicateApiKey || apiKeyTesting}
                      tooltip="Test API Key"
                    />
                  </div>
                  
                  {apiVerified ? (
                    <Message severity="success" text={`API key verified ${apiUsername ? `for user ${apiUsername}` : ''}`} />
                  ) : apiError ? (
                    <Message severity="error" text={apiError} />
                  ) : (
                    <small className="p-text-secondary">
                      Your API key is stored securely and used only for transcription requests. It typically starts with "r8_" and looks like r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.
                      <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer" className="ml-2">
                        Get from Replicate
                      </a>
                    </small>
                  )}
                </div>
                
                <div className="field mt-4">
                  <label>Default Transcription Prompt (Optional):</label>
                  <InputText
                    value={transcriptionConfig.defaultPrompt}
                    onChange={(e) => setTranscriptionConfig(prev => ({...prev, defaultPrompt: e.target.value}))}
                    placeholder="Enter a default prompt to guide Replicate transcriptions"
                    className="w-full"
                  />
                  <small className="p-text-secondary">
                    A good prompt can improve transcription accuracy for domain-specific content, accents, or technical terminology.
                  </small>
                </div>
              </div>
            )}
            
            <div className="card">
              <h3>Whisper Model Size</h3>
              <div className="radio-group">
                {['tiny', 'base', 'small', 'medium', 'large'].map(size => (
                  <div key={size} className="field-radiobutton">
                    <RadioButton 
                      inputId={`model-${size}`} 
                      name="whisperModel" 
                      value={size} 
                      onChange={() => setTranscriptionConfig(prev => ({...prev, whisperModel: size}))} 
                      checked={transcriptionConfig.whisperModel === size} 
                    />
                    <label htmlFor={`model-${size}`}>{size.charAt(0).toUpperCase() + size.slice(1)}</label>
                  </div>
                ))}
              </div>
              
              {transcriptionConfig.whisperModel && (
                <ModelSizeDescription size={transcriptionConfig.whisperModel} />
              )}
            </div>
            
            <div className="save-button-container">
              <Button 
                label="Save Configuration" 
                icon="pi pi-save" 
                onClick={handleSaveSettings} 
                className="p-button-primary save-button"
                loading={apiKeyTesting}
              />
              {saveSuccess && <span className="save-success">✓ Settings saved successfully!</span>}
            </div>
          </div>
        </TabPanel>
        
        <TabPanel header="Help & Documentation">
          <div className="help-container">
            <Card title="Transcription Settings Help" className="documentation-card">
              <h4>Transcription Methods</h4>
              <ul>
                <li>
                  <strong>Local CPU</strong>: Transcribes audio using your computer's processor. Good for most users but may be slower for longer files.
                </li>
                <li>
                  <strong>Local GPU</strong>: Uses your graphics card to accelerate transcription. Much faster than CPU but requires a compatible NVIDIA GPU.
                </li>
                <li>
                  <strong>Replicate API</strong>: Cloud-based transcription using OpenAI's Whisper models. No local GPU required, works on any device but requires an internet connection and API key.
                </li>
              </ul>
              
              <h4>Model Sizes</h4>
              <p>
                Whisper models come in different sizes, with larger models offering better accuracy but requiring more time and system resources:
              </p>
              <ul>
                <li><strong>Tiny</strong>: Fastest but least accurate</li>
                <li><strong>Base</strong>: Good balance for simple content</li>
                <li><strong>Small</strong>: Recommended default for most uses</li>
                <li><strong>Medium</strong>: High accuracy, good for challenging audio</li>
                <li><strong>Large</strong>: Highest accuracy, requires significant resources</li>
              </ul>
              
              <h4>Replicate API</h4>
              <p>
                To use the Replicate cloud-based transcription:
              </p>
              <ol>
                <li>Create a free account at <a href="https://replicate.com/signup" target="_blank" rel="noreferrer">replicate.com</a></li>
                <li>Get your API key from <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer">your account page</a></li>
                <li>Enter the key in the settings and click "Test API Key"</li>
                <li>Save your configuration</li>
              </ol>
              
              <p>
                Replicate provides free credits for new accounts, and their usage-based pricing is reasonable for occasional transcription.
              </p>
              
              <h4>Transcription Prompts</h4>
              <p>
                When using Replicate API, you can provide optional prompts to guide the transcription. Good prompts include:
              </p>
              <ul>
                <li>Domain knowledge: "This is a medical lecture about cardiology with technical terms"</li>
                <li>Accent information: "The speaker has a Scottish accent"</li>
                <li>Content structure: "This is a podcast interview with two speakers"</li>
              </ul>
            </Card>
            
            <Card title="Troubleshooting" className="documentation-card">
              <h4>Connection Issues</h4>
              <ul>
                <li>If Socket.IO shows as disconnected, real-time updates won't work. Try refreshing the page.</li>
                <li>For persistent connection issues, ensure both frontend and backend are running.</li>
              </ul>
              
              <h4>Replicate API Problems</h4>
              <ul>
                <li>If your API key fails verification, check that you've copied it correctly.</li>
                <li>API keys start with "r8_" and should not include any spaces.</li>
                <li>If transcription fails, check your account's API token status and credits.</li>
              </ul>
              
              <h4>Local Transcription Issues</h4>
              <ul>
                <li>If GPU transcription fails, make sure you have an NVIDIA GPU with CUDA support.</li>
                <li>For memory errors, try a smaller model size or reduce CPU threads.</li>
                <li>Very long audio files may fail with larger models due to memory constraints.</li>
              </ul>
            </Card>
          </div>
        </TabPanel>
      </TabView>
      
      <Dialog 
        header="Enter Replicate API Key" 
        visible={showApiKeyDialog} 
        style={{ width: '450px' }} 
        onHide={() => setShowApiKeyDialog(false)}
        footer={
          <div>
            <Button label="Cancel" icon="pi pi-times" onClick={() => setShowApiKeyDialog(false)} className="p-button-text" />
            <Button 
              label="Save" 
              icon="pi pi-check" 
              onClick={handleApiKeySubmit}
              loading={apiKeyTesting}
            />
          </div>
        }
      >
        <div className="field">
          <label htmlFor="apiKey">API Key:</label>
          <Password 
            id="apiKey"
            value={transcriptionConfig.replicateApiKey} 
            onChange={(e) => setTranscriptionConfig(prev => ({...prev, replicateApiKey: e.target.value}))}
            feedback={false}
            toggleMask
            className="w-full"
            placeholder="Enter your Replicate API key"
          />
          <small className="p-text-secondary">
            You can find your API key in your Replicate account settings at <a href="https://replicate.com/account/api-tokens" target="_blank" rel="noreferrer">replicate.com/account/api-tokens</a>.
            <br />It starts with "r8_" and looks like r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
          </small>
          
          <Divider />
          
          <div className="replicate-info">
            <h4>Don't have a Replicate account?</h4>
            <p>
              Replicate provides cloud-based AI models and offers free credits for new accounts.
              <br />
              <a href="https://replicate.com/signup" target="_blank" rel="noreferrer" className="p-button p-button-text p-button-sm mt-2">
                <i className="pi pi-external-link mr-1"></i> Create an account
              </a>
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

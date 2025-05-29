"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Toast } from "primereact/toast";
import { RadioButton } from "primereact/radiobutton";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Password } from "primereact/password";
import { Slider } from "primereact/slider";
import { Dialog } from "primereact/dialog";

interface SystemInfo {
  cpuInfo: string;
  gpuInfo: string;
  gpuCount: number;
  cpuThreads: number;
}

interface TranscriptionConfig {
  mode: string;
  replicateApiKey: string;
  cpuThreads: number;
  gpuDevice: number;
  whisperModel: string;
}

export default function Settings() {
  const { currentUser } = useAuth();
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    cpuInfo: "Loading...",
    gpuInfo: "Loading...",
    gpuCount: 0,
    cpuThreads: 1,
  });

  const [transcriptionConfig, setTranscriptionConfig] =
    useState<TranscriptionConfig>({
      mode: "local-cpu",
      replicateApiKey: "",
      cpuThreads: 1,
      gpuDevice: 0,
      whisperModel: "small",
    });

  const [showApiKeyDialog, setShowApiKeyDialog] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [apiKeyTesting, setApiKeyTesting] = useState<boolean>(false);
  const toast = useRef<Toast>(null);

  // Fetch system information and current settings
  useEffect(() => {
    async function fetchData() {
      if (!currentUser) return;

      try {
        const token = await currentUser.getIdToken();

        // Fetch system info
        const sysInfoRes = await fetch("/api/system-info", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (sysInfoRes.ok) {
          const sysInfo = await sysInfoRes.json();
          setSystemInfo(sysInfo);
        }

        // Fetch user settings
        const settingsRes = await fetch("/api/user-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.transcriptionConfig) {
            setTranscriptionConfig((prev) => ({
              ...prev,
              ...settings.transcriptionConfig,
              // Set default threads if not provided
              cpuThreads: settings.transcriptionConfig.cpuThreads || 1,
              // Don't overwrite API key if it's empty in the response for security
              replicateApiKey:
                settings.transcriptionConfig.replicateApiKey ||
                prev.replicateApiKey,
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching settings data:", error);
      }
    }

    fetchData();
  }, [currentUser]);

  const handleSaveSettings = async () => {
    if (!currentUser) return;

    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/user-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcriptionConfig,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        toast.current?.show({
          severity: "success",
          summary: "Settings Saved",
          detail: "Your transcription settings have been updated successfully",
          life: 3000,
        });

        // Hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);

        // If Replicate is selected, test the API key
        if (
          transcriptionConfig.mode === "replicate" &&
          transcriptionConfig.replicateApiKey
        ) {
          testReplicateApiKey(transcriptionConfig.replicateApiKey);
        }
      } else {
        toast.current?.show({
          severity: "error",
          summary: "Error",
          detail: "Failed to save settings",
          life: 3000,
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to save settings: " + (error as Error).message,
        life: 3000,
      });
    }
  };

  const testReplicateApiKey = async (apiKey: string) => {
    if (!currentUser || !apiKey) return;

    try {
      setApiKeyTesting(true);

      const token = await currentUser.getIdToken();
      const testResponse = await fetch("/api/test-replicate-api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey }),
      });

      if (testResponse.ok) {
        const testResult = await testResponse.json();

        if (testResult.success) {
          toast.current?.show({
            severity: "success",
            summary: "Replicate API Key Verified",
            detail: "Your Replicate API key is valid and working correctly",
            life: 5000,
          });
        } else {
          toast.current?.show({
            severity: "error",
            summary: "API Key Validation Failed",
            detail: testResult.message || "Could not verify Replicate API key",
            life: 5000,
          });
        }
      } else {
        toast.current?.show({
          severity: "error",
          summary: "API Test Failed",
          detail: "Failed to test Replicate API key. Please try again.",
          life: 5000,
        });
      }
    } catch (error) {
      console.error("Error testing Replicate API:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to test Replicate API key: " + (error as Error).message,
        life: 5000,
      });
    } finally {
      setApiKeyTesting(false);
    }
  };

  const handleModeChange = (mode: string) => {
    setTranscriptionConfig((prev) => ({
      ...prev,
      mode,
    }));

    if (mode === "replicate" && !transcriptionConfig.replicateApiKey) {
      setShowApiKeyDialog(true);
    }
  };

  const handleApiKeySubmit = () => {
    setShowApiKeyDialog(false);
    if (transcriptionConfig.replicateApiKey) {
      testReplicateApiKey(transcriptionConfig.replicateApiKey);
    }
  };

  const renderSystemInfo = () => {
    return (
      <div className="system-info-container">
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
      </div>
    );
  };

  return (
    <div className="settings-container">
      <Toast ref={toast} position="top-right" />

      <h2>Transcription Settings</h2>
      {renderSystemInfo()}

      <div className="card">
        <h3>Transcription Method</h3>
        <div className="field-radiobutton">
          <RadioButton
            inputId="mode1"
            name="mode"
            value="local-cpu"
            onChange={() => handleModeChange("local-cpu")}
            checked={transcriptionConfig.mode === "local-cpu"}
          />
          <label htmlFor="mode1">Run Whisper locally on CPU</label>
        </div>

        <div className="field-radiobutton">
          <RadioButton
            inputId="mode2"
            name="mode"
            value="local-gpu"
            onChange={() => handleModeChange("local-gpu")}
            checked={transcriptionConfig.mode === "local-gpu"}
            disabled={systemInfo.gpuCount === 0}
          />
          <label htmlFor="mode2">
            Run Whisper locally on GPU
            {systemInfo.gpuCount === 0 && (
              <span className="option-disabled"> (No GPU detected)</span>
            )}
          </label>
        </div>

        <div className="field-radiobutton">
          <RadioButton
            inputId="mode3"
            name="mode"
            value="replicate"
            onChange={() => handleModeChange("replicate")}
            checked={transcriptionConfig.mode === "replicate"}
          />
          <label htmlFor="mode3">Use Replicate API (Cloud-based)</label>
        </div>
      </div>

      {transcriptionConfig.mode === "local-cpu" && (
        <div className="card">
          <h3>CPU Settings</h3>
          <div className="slider-container">
            <label>CPU Threads: {transcriptionConfig.cpuThreads}</label>
            <Slider
              value={transcriptionConfig.cpuThreads}
              onChange={(e) =>
                setTranscriptionConfig((prev) => ({
                  ...prev,
                  cpuThreads: e.value as number,
                }))
              }
              min={1}
              max={systemInfo.cpuThreads}
              className="p-mb-3"
            />
          </div>
        </div>
      )}

      {transcriptionConfig.mode === "local-gpu" && systemInfo.gpuCount > 0 && (
        <div className="card">
          <h3>GPU Settings</h3>
          <div className="field">
            <label>GPU Device:</label>
            <div className="radio-group">
              {Array.from({ length: systemInfo.gpuCount }).map((_, idx) => (
                <div key={idx} className="field-radiobutton">
                  <RadioButton
                    inputId={`gpu${idx}`}
                    name="gpuDevice"
                    value={idx}
                    onChange={() =>
                      setTranscriptionConfig((prev) => ({
                        ...prev,
                        gpuDevice: idx,
                      }))
                    }
                    checked={transcriptionConfig.gpuDevice === idx}
                  />
                  <label htmlFor={`gpu${idx}`}>GPU {idx}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {transcriptionConfig.mode === "replicate" && (
        <div className="card">
          <h3>Replicate API Settings</h3>
          <div className="field">
            <label>API Key:</label>
            <div className="p-inputgroup">
              <Password
                value={transcriptionConfig.replicateApiKey}
                onChange={(e) =>
                  setTranscriptionConfig((prev) => ({
                    ...prev,
                    replicateApiKey: e.target.value,
                  }))
                }
                feedback={false}
                toggleMask
                className="api-key-input"
                placeholder="Enter your Replicate API key"
              />
              <Button
                icon="pi pi-key"
                onClick={() => setShowApiKeyDialog(true)}
                className="p-button-info"
                disabled={apiKeyTesting}
              />
              <Button
                icon="pi pi-check-circle"
                onClick={() =>
                  testReplicateApiKey(transcriptionConfig.replicateApiKey)
                }
                className="p-button-success"
                disabled={!transcriptionConfig.replicateApiKey || apiKeyTesting}
                tooltip="Test API Key"
              />
            </div>
            <small className="p-text-secondary">
              Your API key is stored securely and used only for transcription
              requests. It typically starts with "r8_" and looks like
              r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            </small>
          </div>
        </div>
      )}

      <div className="card">
        <h3>Whisper Model Size</h3>
        <div className="radio-group">
          {["tiny", "base", "small", "medium", "large"].map((size) => (
            <div key={size} className="field-radiobutton">
              <RadioButton
                inputId={`model-${size}`}
                name="whisperModel"
                value={size}
                onChange={() =>
                  setTranscriptionConfig((prev) => ({
                    ...prev,
                    whisperModel: size,
                  }))
                }
                checked={transcriptionConfig.whisperModel === size}
              />
              <label htmlFor={`model-${size}`}>
                {size.charAt(0).toUpperCase() + size.slice(1)}
              </label>
            </div>
          ))}
        </div>
        <small className="p-text-secondary">
          Larger models are more accurate but slower and use more memory. For
          Replicate API, the "medium" model is recommended.
        </small>
      </div>

      <div className="save-button-container">
        <Button
          label="Save Configuration"
          icon="pi pi-save"
          onClick={handleSaveSettings}
          className="p-button-primary save-button"
          loading={apiKeyTesting}
        />
        {saveSuccess && (
          <span className="save-success">✓ Settings saved successfully!</span>
        )}
      </div>

      <Dialog
        header="Enter Replicate API Key"
        visible={showApiKeyDialog}
        style={{ width: "450px" }}
        onHide={() => setShowApiKeyDialog(false)}
        footer={
          <div>
            <Button
              label="Cancel"
              icon="pi pi-times"
              onClick={() => setShowApiKeyDialog(false)}
              className="p-button-text"
            />
            <Button
              label="Save"
              icon="pi pi-check"
              onClick={handleApiKeySubmit}
            />
          </div>
        }
      >
        <div className="field">
          <label htmlFor="apiKey">API Key:</label>
          <Password
            id="apiKey"
            value={transcriptionConfig.replicateApiKey}
            onChange={(e) =>
              setTranscriptionConfig((prev) => ({
                ...prev,
                replicateApiKey: e.target.value,
              }))
            }
            feedback={false}
            toggleMask
            className="w-full"
            placeholder="Enter your Replicate API key"
          />
          <small className="p-text-secondary">
            You can find your API key in your Replicate account settings at{" "}
            <a
              href="https://replicate.com/account/api-tokens"
              target="_blank"
              rel="noreferrer"
            >
              replicate.com/account/api-tokens
            </a>
            . It starts with "r8_" and looks like
            r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
          </small>
        </div>
      </Dialog>
    </div>
  );
}

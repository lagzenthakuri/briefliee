import { useState } from 'react';
import { Platform } from 'react-native';

interface UseSpeechToTextReturn {
  transcribe: (audioUri: string) => Promise<string | null>;
  isTranscribing: boolean;
  error: string | null;
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcribe = async (audioUri: string): Promise<string | null> => {
    try {
      setIsTranscribing(true);
      setError(null);
      console.log("Starting transcription for:", audioUri);

      let fileBlob: Blob;

      if (Platform.OS === "web") {
        // On web, fetch blob directly
        const resp = await fetch(audioUri);
        fileBlob = await resp.blob();
      } else {
        // On native, use fetch to get blob from local file URI
        const resp = await fetch(audioUri);
        fileBlob = await resp.blob();
      }

      // --- Step 1: Upload to AssemblyAI ---
      console.log("Uploading audio to AssemblyAI...");
      const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
        method: "POST",
        headers: {
          Authorization: "03befe2d1c0e4886a6444f09fcda4f2b",
          "Transfer-Encoding": "chunked",
        },
        body: fileBlob,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error("Upload failed: " + errText);
      }

      const uploadData = await uploadRes.json();
      console.log("Upload successful:", uploadData);
      const audioUrl = uploadData.upload_url;

      // --- Step 2: Request transcription ---
      console.log("Sending transcription request...");
      const response = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: {
          Authorization: "03befe2d1c0e4886a6444f09fcda4f2b",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Transcription API error:", errorText);
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("Transcription started:", data);

      // 🔄 Poll until transcription completes
      let transcriptData = data;
      while (transcriptData.status !== "completed" && transcriptData.status !== "error") {
        await new Promise((r) => setTimeout(r, 3000)); // wait 3s
        const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${data.id}`, {
          headers: { Authorization:  `03befe2d1c0e4886a6444f09fcda4f2b` },
        });
        transcriptData = await pollRes.json();
        console.log("Polling status:", transcriptData.status);
      }

      if (transcriptData.status === "error") {
        throw new Error("Transcription failed: " + transcriptData.error);
      }

      setIsTranscribing(false);
      return transcriptData.text;
    } catch (err) {
      console.error("Transcription error:", err);
      setError(err instanceof Error ? err.message : "Transcription failed");
      setIsTranscribing(false);
      return null;
    }
  };

  return {
    transcribe,
    isTranscribing,
    error,
  };
}

import { useState, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';

interface UseAudioRecordingReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  recording: Audio.Recording | null;
  isRecording: boolean;
  checkPermissions: () => Promise<boolean>;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        // Check if mediaDevices is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices not supported in this browser');
        }

        // Check if we're on HTTPS or localhost
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          throw new Error('Microphone access requires HTTPS or localhost');
        }

        console.log('Requesting microphone access...');
        
        // Web implementation using MediaRecorder with better error handling
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
        
        // Check if MediaRecorder is supported
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          console.warn('audio/webm not supported, falling back to default');
        }
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined
        });
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
        };

        mediaRecorder.start(1000); // Collect data every second
        setIsRecording(true);
        console.log('Web recording started successfully');
      } else {
        // Mobile implementation using expo-av
        console.log('Requesting permissions...');
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Audio recording permission is required');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        console.log('Starting recording...');
        const { recording } = await Audio.Recording.createAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        });
        
        setRecording(recording);
        setIsRecording(true);
        console.log('Recording started');
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to start recording';
      
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (err.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage = 'Audio recording not supported in this browser.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Microphone is already in use by another application.';
        } else {
          errorMessage = err.message;
        }
      }
      
      if (Platform.OS === 'web') {
        Alert.alert('Recording Error', errorMessage);
      }
      
      throw new Error(errorMessage);
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        // Web implementation
        if (!mediaRecorderRef.current) {
          console.error('No media recorder found');
          return null;
        }

        return new Promise((resolve) => {
          const mediaRecorder = mediaRecorderRef.current!;
          
          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Stop all tracks
            const stream = mediaRecorder.stream;
            stream.getTracks().forEach(track => track.stop());
            
            setIsRecording(false);
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            
            console.log('Web recording stopped, URL:', audioUrl);
            resolve(audioUrl);
          };

          mediaRecorder.stop();
        });
      } else {
        // Mobile implementation
        if (!recording) {
          console.error('No recording found');
          return null;
        }

        console.log('Stopping recording...');
        await recording.stopAndUnloadAsync();
        
        // Disable recording mode after stopping
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });

        const uri = recording.getURI();
        console.log('Recording stopped and stored at', uri);
        
        setRecording(null);
        setIsRecording(false);
        
        return uri;
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
      setIsRecording(false);
      return null;
    }
  };

  const checkPermissions = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        // Check if mediaDevices is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.log('Media devices not supported');
          return false;
        }

        // Check if we're on HTTPS or localhost
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          console.log('HTTPS required for microphone access');
          return false;
        }

        // Try to get permission without actually starting recording
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop the stream immediately
          stream.getTracks().forEach(track => track.stop());
          console.log('Microphone permission granted');
          return true;
        } catch (err) {
          console.log('Microphone permission denied or not available:', err);
          return false;
        }
      } else {
        // Mobile implementation
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  };

  return {
    startRecording,
    stopRecording,
    recording,
    isRecording,
    checkPermissions,
  };
}
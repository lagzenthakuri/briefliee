import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mic, Square, RefreshCw, Volume2 } from 'lucide-react-native';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useSummary } from '@/hooks/useSummary';

export default function VoiceRecorderScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [summary, setSummary] = useState('');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const { startRecording, stopRecording, checkPermissions } = useAudioRecording();
  const { transcribe, isTranscribing } = useSpeechToText();
  const { generateSummary, isGeneratingSummary } = useSummary();

  useEffect(() => {
    if (isRecording) {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      // Stop animations and timer
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    if (transcribedText || summary) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [transcribedText, summary, fadeAnim]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      console.log('Checking permissions...');
      
      // Check permissions first
      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required', 
          'Microphone access is required to record audio. Please allow microphone access in your browser settings and try again.',
          [
            { text: 'OK' },
            { 
              text: 'Retry', 
              onPress: () => handleStartRecording() 
            }
          ]
        );
        return;
      }
      
      console.log('Starting recording...');
      await startRecording();
      setIsRecording(true);
      setRecordingDuration(0);
      setTranscribedText('');
      setSummary('');
      fadeAnim.setValue(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording. Please check permissions.';
      Alert.alert('Recording Error', errorMessage);
    }
  };

  const handleStopRecording = async () => {
    try {
      console.log('Stopping recording...');
      setIsRecording(false);
      
      const audioUri = await stopRecording();
      if (!audioUri) {
        Alert.alert('Error', 'No audio recorded');
        return;
      }

      console.log('Audio URI:', audioUri);
      
      // Transcribe audio
      const text = await transcribe(audioUri);
      if (!text) {
        Alert.alert('Error', 'Failed to transcribe audio');
        return;
      }
      
      setTranscribedText(text);
      console.log('Transcribed text:', text);
      
      // Generate summary
      const summaryText = await generateSummary(text);
      setSummary(summaryText);
      console.log('Summary:', summaryText);
      
    } catch (error) {
      console.error('Error processing recording:', error);
      Alert.alert('Error', 'Failed to process recording');
    }
  };

  const handleReset = () => {
    setTranscribedText('');
    setSummary('');
    setRecordingDuration(0);
    fadeAnim.setValue(0);
  };

  const isProcessing = isTranscribing || isGeneratingSummary;

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Voice Recorder</Text>
            <Text style={styles.subtitle}>
              Record, transcribe, and summarize
            </Text>
          </View>

          <View style={styles.recordSection}>
            {isRecording && (
              <View style={styles.timerContainer}>
                <View style={styles.recordingIndicator} />
                <Text style={styles.timer}>{formatDuration(recordingDuration)}</Text>
              </View>
            )}

            <Animated.View
              style={[
                styles.recordButtonContainer,
                isRecording && {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  isRecording && styles.recordButtonActive,
                ]}
                onPress={isRecording ? handleStopRecording : handleStartRecording}
                disabled={isProcessing}
              >
                {isRecording ? (
                  <Square size={32} color="#fff" fill="#fff" />
                ) : (
                  <Mic size={40} color="#fff" />
                )}
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.recordHint}>
              {isRecording ? 'Tap to stop' : 'Tap to record'}
            </Text>
          </View>

          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#0984e3" />
              <Text style={styles.processingText}>
                {isTranscribing ? 'Transcribing audio...' : 'Generating summary...'}
              </Text>
            </View>
          )}

          {transcribedText && !isProcessing && (
            <Animated.View style={[styles.resultCard, { opacity: fadeAnim }]}>
              <View style={styles.cardHeader}>
                <Volume2 size={20} color="#0984e3" />
                <Text style={styles.cardTitle}>Transcription</Text>
              </View>
              <Text style={styles.transcriptionText}>{transcribedText}</Text>
            </Animated.View>
          )}

          {summary && !isProcessing && (
            <Animated.View style={[styles.resultCard, { opacity: fadeAnim }]}>
              <View style={styles.cardHeader}>
                <RefreshCw size={20} color="#0984e3" />
                <Text style={styles.cardTitle}>Summary</Text>
              </View>
              <Text style={styles.summaryText}>{summary}</Text>
            </Animated.View>
          )}

          {(transcribedText || summary) && !isProcessing && (
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <RefreshCw size={20} color="#fff" />
              <Text style={styles.resetButtonText}>New Recording</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
  },
  recordSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4757',
    marginRight: 10,
  },
  timer: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  recordButtonContainer: {
    marginBottom: 20,
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0984e3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: '#ff4757',
  },
  recordHint: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 10,
  },
  processingContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  processingText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 15,
  },
  resultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  transcriptionText: {
    fontSize: 15,
    color: '#e0e0e0',
    lineHeight: 24,
  },
  summaryText: {
    fontSize: 15,
    color: '#e0e0e0',
    lineHeight: 24,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0984e3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
    alignSelf: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
});
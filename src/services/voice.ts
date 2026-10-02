export type SpeechRecognitionState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface SpeechRecognitionHandlerOptions {
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: SpeechRecognitionState) => void;
}

export class VoiceController {
  private recognition: any = null;
  private isSpeaking = false;
  private isSupported = false;
  private state: SpeechRecognitionState = 'idle';
  private onStateChange?: (state: SpeechRecognitionState) => void;

  constructor(options?: SpeechRecognitionHandlerOptions) {
    this.onStateChange = options?.onStateChange;

    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.isSupported = true;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          this.setState('listening');
        };

        this.recognition.onresult = (event: any) => {
          const transcript = event.results[0]?.[0]?.transcript || '';
          this.setState('thinking');
          if (options?.onResult) options.onResult(transcript);
        };

        this.recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          this.setState('error');
          if (options?.onError) options.onError(event.error);
          setTimeout(() => this.setState('idle'), 2000);
        };

        this.recognition.onend = () => {
          if (this.state === 'listening') {
            this.setState('idle');
          }
        };
      }
    }
  }

  get supported(): boolean {
    return this.isSupported;
  }

  getState(): SpeechRecognitionState {
    return this.state;
  }

  private setState(newState: SpeechRecognitionState) {
    this.state = newState;
    if (this.onStateChange) this.onStateChange(newState);
  }

  startListening() {
    if (!this.isSupported || !this.recognition) {
      this.setState('error');
      setTimeout(() => this.setState('idle'), 1500);
      return;
    }
    try {
      this.recognition.start();
    } catch (e) {
      // If already started, restart
      try {
        this.recognition.stop();
        this.recognition.start();
      } catch {
        this.setState('idle');
      }
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.setState('idle');
  }

  speak(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      this.setState('speaking');

      utterance.onend = () => {
        this.setState('idle');
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        this.setState('idle');
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      this.setState('idle');
      if (onEnd) onEnd();
    }
  }

  stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.setState('idle');
  }
}

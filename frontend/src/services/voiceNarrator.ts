/**
 * src/services/voiceNarrator.ts
 *
 * 100% Client-Side AI Voice Narration Engine powered by Web Speech API.
 * Speaks step-by-step code execution explanations synchronized with playback.
 * Provides guaranteed immediate cancellation on stop/pause/mute.
 */

class VoiceNarrator {
  private synth: SpeechSynthesis | null = null;
  private isMuted: boolean = false;
  private voices: SpeechSynthesisVoice[] = [];
  private pendingTimeout: any = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private isStopped: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  /**
   * Convert code syntax tokens into natural English pronunciation
   */
  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/\[\d+\]/g, (m) => ` at index ${m.slice(1, -1)}`)
      .replace(/===?/g, ' is equal to ')
      .replace(/!==?/g, ' is not equal to ')
      .replace(/<=/g, ' is less than or equal to ')
      .replace(/>=/g, ' is greater than or equal to ')
      .replace(/\+\+/g, ' incremented ')
      .replace(/--/g, ' decremented ')
      .replace(/&&/g, ' and ')
      .replace(/\|\|/g, ' or ')
      .replace(/->/g, ' points to ')
      .replace(/nullptr|NULL/g, 'null pointer')
      .replace(/cout\s*<<\s*/g, 'print ')
      .replace(/<<\s*endl/g, '')
      .replace(/printf\s*\(/g, 'print ')
      .replace(/System\.out\.print(?:ln)?\s*\(/g, 'print ')
      .replace(/console\.log\s*\(/g, 'print ')
      .replace(/[{}();]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public speak(text: string, speedMs: number = 500, onEnd?: () => void): void {
    // If muted, stopped, or no speech engine, immediately finish without speaking
    if (this.isMuted || !this.synth || !text) {
      if (onEnd) onEnd();
      return;
    }

    try {
      // Clear any pending speak timeout immediately
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout);
        this.pendingTimeout = null;
      }

      // Detach existing utterance handlers so cancel doesn't trigger spurious callbacks
      if (this.activeUtterance) {
        this.activeUtterance.onend = null;
        this.activeUtterance.onerror = null;
        this.activeUtterance = null;
      }

      // Hard cancel any ongoing browser speech
      this.synth.cancel();
      if (this.synth.paused) {
        this.synth.resume();
      }

      this.isStopped = false;

      const spokenText = this.cleanTextForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(spokenText || text);
      utterance.volume = 1.0;

      // Map playback speed ms (250ms - 1000ms) to speech rate (0.8 - 1.8)
      let rate = 1.0;
      if (speedMs <= 100) rate = 1.7;
      else if (speedMs <= 250) rate = 1.35;
      else if (speedMs >= 1000) rate = 0.85;

      utterance.rate = rate;
      utterance.pitch = 1.0;

      this.activeUtterance = utterance;

      let calledEnd = false;
      const safeEnd = (completedNormally: boolean) => {
        if (!calledEnd) {
          calledEnd = true;
          this.activeUtterance = null;
          // CRITICAL: Only call onEnd if finished naturally and NOT stopped or muted
          if (completedNormally && !this.isStopped && !this.isMuted) {
            if (onEnd) onEnd();
          }
        }
      };

      utterance.onend = () => {
        safeEnd(true);
      };

      utterance.onerror = (e: any) => {
        // Canceled or interrupted means user stopped or navigated; NEVER invoke onEnd
        if (e.error === 'canceled' || e.error === 'interrupted' || this.isStopped) {
          safeEnd(false);
          return;
        }
        console.warn('SpeechSynthesis error:', e.error || e);
        safeEnd(false);
      };

      // Select high quality English voice
      if (this.voices.length === 0) {
        this.loadVoices();
      }
      const englishVoice =
        this.voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') ||
              v.name.includes('Natural') ||
              v.name.includes('Samantha') ||
              v.name.includes('Microsoft') ||
              v.default)
        ) || this.voices.find((v) => v.lang.startsWith('en'));

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      // Small delay to let browser audio subsystem reset cleanly
      this.pendingTimeout = setTimeout(() => {
        this.pendingTimeout = null;
        if (this.isStopped || this.isMuted || !this.synth) {
          safeEnd(false);
          return;
        }
        if (this.synth.paused) {
          this.synth.resume();
        }
        this.synth.speak(utterance);
      }, 40);
    } catch (err) {
      console.warn('Voice narration failed:', err);
      if (onEnd) onEnd();
    }
  }

  public stop(): void {
    this.isStopped = true;

    // Clear any queued speak invocation
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    // Detach callbacks so browser cancel event doesn't trigger onEnd
    if (this.activeUtterance) {
      this.activeUtterance.onend = null;
      this.activeUtterance.onerror = null;
      this.activeUtterance = null;
    }

    if (this.synth) {
      try {
        this.synth.cancel();
        if (this.synth.paused) {
          this.synth.resume();
        }
        this.synth.cancel();
      } catch {
        // ignore
      }
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const voiceNarrator = new VoiceNarrator();



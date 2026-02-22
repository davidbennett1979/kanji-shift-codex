import type { SimulationEvent } from '../core/model/Types';

export class SfxManager {
  private context?: AudioContext;
  private enabled = true;

  playEvents(events: SimulationEvent[]): void {
    if (!this.enabled) {
      return;
    }
    for (const event of events) {
      switch (event.type) {
        case 'move':
          this.beep(280, 0.02, 'triangle', 0.02);
          break;
        case 'blocked':
          this.beep(170, 0.04, 'square', 0.02);
          break;
        case 'fusion':
          this.beep(420, 0.03, 'sine', 0.03);
          this.beep(620, 0.05, 'triangle', 0.02, 0.035);
          break;
        case 'rule-change':
          this.beep(500, 0.02, 'sine', 0.018);
          this.beep(560, 0.03, 'sine', 0.014, 0.02);
          break;
        case 'win':
          this.beep(523, 0.07, 'triangle', 0.03);
          this.beep(659, 0.08, 'triangle', 0.03, 0.07);
          this.beep(784, 0.11, 'triangle', 0.025, 0.15);
          break;
        case 'undo':
          this.beep(240, 0.03, 'sine', 0.02);
          break;
        case 'restart':
          this.beep(220, 0.05, 'triangle', 0.03);
          break;
        default:
          break;
      }
    }
  }

  private getContext(): AudioContext | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }
    if (!this.context) {
      const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.enabled = false;
        return undefined;
      }
      this.context = new Ctor();
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  private beep(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0): void {
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.value = 0;
    osc.connect(amp);
    amp.connect(ctx.destination);

    const start = ctx.currentTime + delay;
    const end = start + duration;
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.start(start);
    osc.stop(end + 0.01);
  }
}

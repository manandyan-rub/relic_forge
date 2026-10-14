import { base } from '$app/paths';
import type { FlightRisk, WeatherCondition } from './types';

export const SOUND_NAMES = [
	'archaeopteryx-fight',
	'azure-swift-fight',
	'woodpecker-fight',
	'woodpecker-burst',
	'eagle-burst',
	'azure-swift-burst',
	'dragon-fight',
	'dragon-archaeopteryx-fight',
	'dragon-azure-swift-fight',
	'dragon-woodpecker-fight',
	'eagle-fight',
	'air-current',
	'bonus-start',
	'button-click',
	'crash',
	'crystal-pickup',
	'encounter-warning',
	'feather-pickup',
	'golden-feather-pickup',
	'landing',
	'option-select',
	'predator-pass',
	'rain-loop',
	'result-big-win',
	'result-loss',
	'result-outstanding',
	'result-return',
	'result-win',
	'ridge-dragon-call',
	'snow-loop',
	'storm-loop',
	'thunder',
	'unavailable',
	'wind',
	'win-count-loop',
	'win-count-finish',
] as const;
export type SoundName = (typeof SOUND_NAMES)[number] | 'wing-loop';
export const soundUrl = (name: SoundName) => `${base || '.'}/audio/${name}.mp3`;
export const weatherSound = (weather: WeatherCondition): SoundName =>
	weather === 'rain'
		? 'rain-loop'
		: weather === 'storm'
			? 'storm-loop'
			: weather === 'snow'
				? 'snow-loop'
				: 'wind';
export function resultSound(payout: number, cost: number): SoundName {
	const ratio = payout / cost;
	return payout === 0
		? 'result-loss'
		: ratio <= 1
			? 'result-return'
			: ratio >= 50
				? 'result-outstanding'
				: ratio >= 10
					? 'result-big-win'
					: 'result-win';
}

// Audio only follows presentation. It never selects or modifies a round outcome.
export class FlightAudio {
	private context?: AudioContext;
	private buffers = new Map<SoundName, Promise<AudioBuffer>>();
	private voices = new Map<string, { source: AudioScheduledSourceNode; gain: GainNode }>();
	private requests = new Map<string, number>();
	private sequence = 0;
	private muted = false;
	private hidden = false;
	private disposed = false;
	private ambience?: SoundName;
	private ambiencePlaying?: SoundName;
	private wingsEnabled = false;
	private wingsPlaying = false;
	private wingCycleSeconds = 0.8;
	setWingLoop(enabled: boolean, cycleSeconds = 0.8) {
		if (
			Number.isFinite(cycleSeconds) &&
			cycleSeconds > 0 &&
			cycleSeconds !== this.wingCycleSeconds
		) {
			this.wingCycleSeconds = cycleSeconds;
			this.stop('wings');
			this.wingsPlaying = false;
		}
		this.wingsEnabled = enabled;
		this.syncWings();
	}
	private syncWings() {
		if (!this.wingsEnabled) {
			this.stop('wings');
			this.wingsPlaying = false;
			return;
		}
		if (
			!this.context ||
			this.context.state !== 'running' ||
			this.muted ||
			this.hidden ||
			this.disposed ||
			this.wingsPlaying
		)
			return;
		this.wingsPlaying = true;
		void this.play('wing-loop', 0.1, 'wings', true);
	}

	unlock() {
		if (this.disposed || this.muted || this.hidden) return;
		try {
			if (!this.context) {
				this.context = new AudioContext();
				for (const name of SOUND_NAMES) void this.load(name).catch(() => {});
			}
			void this.context
				.resume()
				.then(() => {
					this.syncAmbience();
					this.syncWings();
				})
				.catch(() => {});
		} catch {
			/* Audio is optional on unsupported browsers. */
		}
	}
	setMuted(muted: boolean) {
		this.muted = muted;
		if (muted) this.stopAll();
		else if (this.context) this.unlock();
	}
	setHidden(hidden: boolean) {
		this.hidden = hidden;
		if (hidden) this.stopAll();
		else {
			this.syncAmbience();
			this.syncWings();
		}
	}
	setWeather(weather: WeatherCondition) {
		if (weather !== 'storm') this.stop('thunder');
		this.ambience = weatherSound(weather);
		this.syncAmbience();
	}
	private syncAmbience() {
		if (
			!this.context ||
			this.context.state !== 'running' ||
			this.muted ||
			this.hidden ||
			this.disposed
		)
			return;
		if (this.ambience === this.ambiencePlaying) return;
		this.stop('ambience');
		this.ambiencePlaying = this.ambience;
		if (this.ambience) void this.play(this.ambience, 0.12, 'ambience', true);
	}
	private load(name: SoundName) {
		let buffer = this.buffers.get(name);
		if (!buffer) {
			const context = this.context!;
			buffer = fetch(soundUrl(name))
				.then((response) => {
					if (!response.ok) throw new Error('Audio unavailable');
					return response.arrayBuffer();
				})
				.then((bytes) => context.decodeAudioData(bytes));
			this.buffers.set(name, buffer);
			void buffer.catch(() => this.buffers.delete(name));
		}
		return buffer;
	}
	async play(name: SoundName, volume = 0.4, channel: string = name, loop = false) {
		const context = this.context;
		if (!context || context.state !== 'running' || this.muted || this.hidden || this.disposed)
			return;
		this.stop(channel);
		const request = ++this.sequence;
		this.requests.set(channel, request);
		const requestedAt = Date.now();
		try {
			let buffer = await this.load(name);
			if (this.requests.get(channel) !== request || this.muted || this.hidden || this.disposed)
				return;
			// Do not replay stale event cues after a slow network response.
			if (!loop && Date.now() - requestedAt > 1200) return;
			if (loop && name !== 'wing-loop') {
				// Overlap the head and tail to soften short ambience loop seams.
				const fade = Math.min(Math.floor(buffer.sampleRate * 0.08), Math.floor(buffer.length / 4));
				const smooth = context.createBuffer(
					buffer.numberOfChannels,
					buffer.length - fade,
					buffer.sampleRate,
				);
				for (let c = 0; c < buffer.numberOfChannels; c++) {
					const input = buffer.getChannelData(c),
						output = smooth.getChannelData(c);
					output.set(input.subarray(fade));
					for (let i = 0; i < fade; i++) {
						const mix = i / fade,
							end = output.length - fade + i;
						output[end] = output[end] * (1 - mix) + input[i] * mix;
					}
				}
				buffer = smooth;
			}
			const source = context.createBufferSource(),
				gain = context.createGain();
			source.buffer = buffer;
			source.loop = loop;
			if (name === 'wing-loop')
				source.playbackRate.value = buffer.length / buffer.sampleRate / this.wingCycleSeconds;
			gain.gain.setValueAtTime(0, context.currentTime);
			gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.015);
			source.connect(gain).connect(context.destination);
			this.voices.set(channel, { source, gain });
			source.onended = () => {
				source.disconnect();
				gain.disconnect();
				if (this.voices.get(channel)?.source === source) this.voices.delete(channel);
			};
			source.start();
		} catch {
			if (channel === 'wings' && this.requests.get(channel) === request) this.wingsPlaying = false;
			if (channel === 'ambience' && this.requests.get(channel) === request)
				this.ambiencePlaying = undefined;
		}
	}
	// Mobile game's short synthesized shot, registered in the existing effect
	// lifecycle so mute, tab hiding, cancellation and unmount stop it too.
	shot(risk: FlightRisk, playbackSpeed = 1) {
		const context = this.context;
		if (!context || context.state !== 'running' || this.muted || this.hidden || this.disposed)
			return;
		this.stop('hunter-shot');
		const source = context.createOscillator(),
			gain = context.createGain();
		const duration = 0.1 / Math.max(1, playbackSpeed);
		source.type = risk === 'danger' ? 'sawtooth' : 'triangle';
		source.frequency.setValueAtTime(risk === 'safe' ? 220 : 180, context.currentTime);
		source.frequency.exponentialRampToValueAtTime(45, context.currentTime + duration * 0.9);
		gain.gain.setValueAtTime(0.07, context.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
		source.connect(gain).connect(context.destination);
		this.voices.set('hunter-shot', { source, gain });
		source.onended = () => {
			source.disconnect();
			gain.disconnect();
			if (this.voices.get('hunter-shot')?.source === source) this.voices.delete('hunter-shot');
		};
		source.start();
		source.stop(context.currentTime + duration + 0.01);
	}
	stop(channel: string) {
		this.requests.delete(channel);
		const voice = this.voices.get(channel);
		if (voice && this.context) {
			voice.gain.gain.cancelScheduledValues(this.context.currentTime);
			voice.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
			voice.source.stop(this.context.currentTime + 0.06);
			this.voices.delete(channel);
		}
	}
	stopEffects() {
		for (const channel of new Set([...this.requests.keys(), ...this.voices.keys()]))
			if (channel !== 'ambience') this.stop(channel);
	}
	private stopAll() {
		for (const channel of new Set([...this.requests.keys(), ...this.voices.keys()]))
			this.stop(channel);
		this.ambiencePlaying = undefined;
		this.wingsPlaying = false;
	}
	dispose() {
		this.disposed = true;
		this.stopAll();
		void this.context?.close().catch(() => {});
		this.buffers.clear();
	}
}

import type { World } from './types';

/**
 * Small synthesized cue set (no sample files): wooden reel stops, a music-box
 * win arpeggio, a bell for Scatters, a shimmer for Wild expansion and a soft
 * UI tick. Everything routes through one bus with a gentle low-pass "room" so
 * cues sit under the supplied recordings instead of sounding like raw beeps.
 */
export function createSfx(context: AudioContext) {
	const bus = context.createGain();
	bus.gain.value = 0.9;
	const tone = context.createBiquadFilter();
	tone.type = 'lowpass';
	tone.frequency.value = 7200;
	// Short synthetic room so tones bloom slightly instead of clicking off.
	const room = context.createConvolver();
	room.buffer = impulse(context, 0.9, 3.2);
	const wet = context.createGain();
	wet.gain.value = 0.22;
	bus.connect(tone);
	tone.connect(context.destination);
	tone.connect(room);
	room.connect(wet);
	wet.connect(context.destination);

	let noise: AudioBuffer | undefined;
	let muted = false;
	const now = () => context.currentTime + 0.005;
	const live = () => !muted && context.state === 'running';

	function noiseBuffer() {
		if (noise) return noise;
		noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.5), context.sampleRate);
		const data = noise.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		return noise;
	}

	function voice(freq: number, start: number, length: number, gain: number, type: OscillatorType = 'sine', target: AudioNode = bus) {
		const osc = context.createOscillator();
		const amp = context.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, start);
		amp.gain.setValueAtTime(0.0001, start);
		amp.gain.exponentialRampToValueAtTime(gain, start + 0.006);
		amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
		osc.connect(amp);
		amp.connect(target);
		osc.start(start);
		osc.stop(start + length + 0.02);
		osc.onended = () => { osc.disconnect(); amp.disconnect(); };
	}

	/** Music-box pluck: fundamental + soft octave/twelfth partials. */
	function pluck(freq: number, start: number, gain = 0.06, length = 0.9) {
		voice(freq, start, length, gain, 'triangle');
		voice(freq * 2, start, length * 0.55, gain * 0.35);
		voice(freq * 3, start, length * 0.3, gain * 0.12);
	}

	function knock(start: number, pitch: number, gain: number) {
		const src = context.createBufferSource();
		src.buffer = noiseBuffer();
		const band = context.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.value = pitch * 6;
		band.Q.value = 2.2;
		const amp = context.createGain();
		amp.gain.setValueAtTime(gain, start);
		amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
		src.connect(band);
		band.connect(amp);
		amp.connect(bus);
		src.start(start, Math.random() * 0.3, 0.09);
		src.onended = () => { src.disconnect(); band.disconnect(); amp.disconnect(); };
		// Low wooden body under the click.
		const body = context.createOscillator();
		const bodyAmp = context.createGain();
		body.type = 'sine';
		body.frequency.setValueAtTime(pitch * 1.6, start);
		body.frequency.exponentialRampToValueAtTime(pitch, start + 0.08);
		bodyAmp.gain.setValueAtTime(gain * 0.9, start);
		bodyAmp.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
		body.connect(bodyAmp);
		bodyAmp.connect(bus);
		body.start(start);
		body.stop(start + 0.14);
		body.onended = () => { body.disconnect(); bodyAmp.disconnect(); };
	}

	// Bloom: warm major pentatonic. Blight: darker minor with a flat second.
	const scales: Record<World, number[]> = {
		BLOOM: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51],
		BLIGHT: [440.0, 466.16, 523.25, 587.33, 659.25, 698.46, 880.0, 932.33],
	};

	return {
		setMuted(value: boolean) { muted = value; },
		click() {
			if (!live()) return;
			knock(now(), 420, 0.05);
		},
		reelStop(world: World, reel: number, quiet = false) {
			if (!live()) return;
			knock(now(), (world === 'BLOOM' ? 120 : 92) + reel * 6, quiet ? 0.08 : 0.16);
		},
		scatter(world: World, count: number) {
			if (!live()) return;
			const base = world === 'BLOOM' ? 1046.5 : 880;
			const start = now();
			const step = [1, 1.25, 1.5][Math.min(2, Math.max(0, count - 1))];
			pluck(base * step, start, 0.07, 1.4);
			voice(base * step * 2.01, start + 0.02, 1.1, 0.025);
		},
		anticipation(world: World) {
			if (!live()) return;
			const start = now();
			const root = world === 'BLOOM' ? 261.63 : 220;
			voice(root, start, 1.1, 0.05, 'triangle');
			voice(root * 1.5, start + 0.12, 0.95, 0.035, 'triangle');
		},
		win(world: World, multiplier: number) {
			if (!live()) return;
			const notes = scales[world];
			const count = multiplier >= 10 ? 7 : multiplier >= 3 ? 5 : multiplier >= 1 ? 4 : 3;
			const start = now();
			for (let i = 0; i < count; i++) pluck(notes[i % notes.length], start + i * 0.075, 0.05 + i * 0.004, 0.8);
		},
		wild(world: World) {
			if (!live()) return;
			const start = now();
			const src = context.createBufferSource();
			src.buffer = noiseBuffer();
			const band = context.createBiquadFilter();
			band.type = 'bandpass';
			band.Q.value = 6;
			band.frequency.setValueAtTime(500, start);
			band.frequency.exponentialRampToValueAtTime(5200, start + 0.45);
			const amp = context.createGain();
			amp.gain.setValueAtTime(0.0001, start);
			amp.gain.exponentialRampToValueAtTime(0.12, start + 0.12);
			amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
			src.connect(band);
			band.connect(amp);
			amp.connect(bus);
			src.start(start, 0, 0.5);
			src.onended = () => { src.disconnect(); band.disconnect(); amp.disconnect(); };
			const notes = scales[world];
			[0, 2, 4, 5].forEach((n, i) => pluck(notes[n] * 0.5, start + 0.1 + i * 0.06, 0.04, 0.7));
		},
		dispose() { muted = true; bus.disconnect(); wet.disconnect(); },
	};
}

function impulse(context: AudioContext, seconds: number, decay: number) {
	const length = Math.floor(context.sampleRate * seconds);
	const buffer = context.createBuffer(2, length, context.sampleRate);
	for (let channel = 0; channel < 2; channel++) {
		const data = buffer.getChannelData(channel);
		for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
	}
	return buffer;
}

export type Sfx = ReturnType<typeof createSfx>;

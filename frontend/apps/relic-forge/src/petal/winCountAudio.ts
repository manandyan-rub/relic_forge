type CountCue = 'loop' | 'finish';

/** The same two count sounds used by Fluppy Flight, on the game's audio context. */
export function createWinCountAudio(context: AudioContext) {
	const buffers = new Map<CountCue, Promise<AudioBuffer>>();
	let voice: AudioBufferSourceNode | undefined;
	let voiceGain: GainNode | undefined;
	let generation = 0;
	let muted = false;
	let disposed = false;

	function load(cue: CountCue) {
		let pending = buffers.get(cue);
		if (!pending) {
			pending = fetch(`./audio/win-count-${cue}.mp3`)
				.then((response) => {
					if (!response.ok) throw new Error('Win count audio unavailable');
					return response.arrayBuffer();
				})
				.then((bytes) => context.decodeAudioData(bytes))
				.then((buffer) => {
					if (cue !== 'loop') return buffer;
					// Match FlightAudio's short overlap at the loop seam.
					const fade = Math.min(Math.floor(buffer.sampleRate * 0.08), Math.floor(buffer.length / 4));
					const smooth = context.createBuffer(buffer.numberOfChannels, buffer.length - fade, buffer.sampleRate);
					for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
						const input = buffer.getChannelData(channel);
						const output = smooth.getChannelData(channel);
						output.set(input.subarray(fade));
						for (let index = 0; index < fade; index++) {
							const mix = index / fade;
							const end = output.length - fade + index;
							output[end] = output[end] * (1 - mix) + input[index] * mix;
						}
					}
					return smooth;
				});
			buffers.set(cue, pending);
			void pending.catch(() => {
				if (buffers.get(cue) === pending) buffers.delete(cue);
			});
		}
		return pending;
	}

	function stop() {
		generation++;
		const previous = voice;
		const gain = voiceGain;
		voice = undefined;
		voiceGain = undefined;
		if (!previous || !gain) return;
		gain.gain.cancelScheduledValues(context.currentTime);
		gain.gain.setTargetAtTime(0, context.currentTime, 0.015);
		try { previous.stop(context.currentTime + 0.06); } catch { /* Already ended. */ }
	}

	function play(cue: CountCue) {
		if (disposed || muted) return;
		stop();
		const request = generation;
		const requestedAt = Date.now();
		void load(cue).then((buffer) => {
			if (disposed || muted || request !== generation || context.state !== 'running') return;
			if (cue === 'finish' && Date.now() - requestedAt > 1200) return;
			const source = context.createBufferSource();
			const gain = context.createGain();
			source.buffer = buffer;
			source.loop = cue === 'loop';
			gain.gain.setValueAtTime(0, context.currentTime);
			gain.gain.linearRampToValueAtTime(0.35, context.currentTime + 0.015);
			source.connect(gain).connect(context.destination);
			voice = source;
			voiceGain = gain;
			source.onended = () => {
				source.disconnect();
				gain.disconnect();
				if (voice === source) { voice = undefined; voiceGain = undefined; }
			};
			source.start();
		}).catch(() => {});
	}

	return {
		preload() {
			if (disposed) return;
			void load('loop').catch(() => {});
			void load('finish').catch(() => {});
		},
		unlock() { if (!disposed && !muted) void context.resume().catch(() => {}); },
		start() { play('loop'); },
		finish() { play('finish'); },
		setMuted(value: boolean) { muted = value; if (muted) stop(); },
		stop,
		dispose() { disposed = true; stop(); buffers.clear(); },
	};
}

/** The final user-edited Bloom walking recording, shared by both worlds without audio edits. */
export function createBloomWalkingAudio(context: AudioContext) {
	let buffer: Promise<AudioBuffer> | undefined;
	let voice: AudioBufferSourceNode | undefined;
	let generation = 0;
	let disposed = false;
	function load() {
		if (!buffer) {
			const pending = fetch('./audio/bloom-walking.wav?v=final-1')
				.then(response => { if (!response.ok) throw new Error('Walking sound unavailable'); return response.arrayBuffer(); })
				.then(bytes => context.decodeAudioData(bytes));
			buffer = pending;
			void pending.catch(() => { if (buffer === pending) buffer = undefined; });
		}
		return buffer;
	}
	function stop() { generation++; voice?.stop(); voice = undefined; }
	return {
		preload() { if (!disposed) void load().catch(() => {}); },
		start() {
			if (disposed) return;
			stop(); const request = generation;
			void Promise.all([load(), context.resume()]).then(([decoded]) => {
				if (disposed || request !== generation || context.state !== 'running') return;
				const source = context.createBufferSource();
				source.buffer = decoded; source.loop = true; source.playbackRate.value = 0.9;
				source.connect(context.destination); voice = source;
				source.onended = () => { source.disconnect(); if (voice === source) voice = undefined; };
				source.start();
			}).catch(() => {});
		},
		stop,
		dispose() { disposed = true; stop(); buffer = undefined; },
	};
}

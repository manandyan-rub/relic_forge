/** Plays only the supplied three-second free-spin award sound. */
export function createFreeSpinsAwardAudio(context: AudioContext) {
	let buffer: Promise<AudioBuffer> | undefined;
	let voice: AudioBufferSourceNode | undefined;
	let generation = 0;
	let disposed = false;

	function load() {
		let pending = buffer;
		if (!pending) {
			pending = fetch('./audio/free-spins-award.wav?v=1')
				.then((response) => {
					if (!response.ok) throw new Error('Game sound unavailable');
					return response.arrayBuffer();
				})
				.then((bytes) => context.decodeAudioData(bytes));
			buffer = pending;
			const request = pending;
			void pending.catch(() => { if (buffer === request) buffer = undefined; });
		}
		return pending;
	}

	function stop() {
		generation++;
		voice?.stop();
		voice = undefined;
	}

	function play() {
			if (disposed) return;
			stop();
			const request = generation;
			void Promise.all([load(), context.resume()]).then(([decoded]) => {
				if (disposed || request !== generation || context.state !== 'running') return;
				const source = context.createBufferSource();
				source.buffer = decoded;
				source.loop = false;
				source.connect(context.destination);
				voice = source;
				source.onended = () => {
					source.disconnect();
					if (voice === source) voice = undefined;
				};
				source.start();
			}).catch(() => {});
	}

	return {
		preload() { if (!disposed) void load().catch(() => {}); },
		play,
		stop,
		dispose() { disposed = true; stop(); buffer = undefined; },
	};
}

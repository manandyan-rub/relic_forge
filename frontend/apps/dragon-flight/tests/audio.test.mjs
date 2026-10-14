import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test, mock } from 'node:test';
import { loadTypescript } from './typescript.mjs';
const { FlightAudio, SOUND_NAMES, resultSound, weatherSound, soundUrl } = await loadTypescript(
	new URL('../src/game-world/audio.ts', import.meta.url),
	{ base: '/dragon-flight' },
);
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('all registered runtime sounds exist and use deployment-safe URLs', () => {
	assert.equal(new Set(SOUND_NAMES).size, SOUND_NAMES.length);
	for (const name of [...SOUND_NAMES, 'wing-loop']) {
		assert.equal(soundUrl(name), `/dragon-flight/audio/${name}.mp3`);
		const bytes = fs.readFileSync(new URL(`../static/audio/${name}.mp3`, import.meta.url));
		assert(bytes.length > 100);
		assert(bytes.toString('ascii', 0, 3) === 'ID3' || bytes[0] === 0xff, 'Invalid MP3 header');
	}
});
test('result cues use full entry cost and never celebrate a net loss', () => {
	assert.equal(resultSound(0, 50), 'result-loss');
	assert.equal(resultSound(20, 50), 'result-return');
	assert.equal(resultSound(50, 50), 'result-return');
	assert.equal(resultSound(80, 50), 'result-win');
	assert.equal(resultSound(600, 50), 'result-big-win');
	assert.equal(resultSound(3600, 50), 'result-outstanding');
	assert.deepEqual(['clear', 'fog', 'rain', 'storm', 'snow'].map(weatherSound), [
		'wind',
		'wind',
		'rain-loop',
		'storm-loop',
		'snow-loop',
	]);
});

function fakeAudio() {
	const sources = [];
	let contexts = 0,
		closed = false;
	const buffer = () => ({
		sampleRate: 100,
		length: 100,
		numberOfChannels: 1,
		getChannelData: () => new Float32Array(100),
	});
	const previous = globalThis.AudioContext;
	globalThis.AudioContext = class {
		state = 'running';
		currentTime = 0;
		destination = {};
		constructor() {
			contexts++;
		}
		resume() {
			return Promise.resolve();
		}
		close() {
			closed = true;
			return Promise.resolve();
		}
		decodeAudioData() {
			return Promise.resolve(buffer());
		}
		createBuffer() {
			return buffer();
		}
		createGain() {
			return {
				gain: {
					setValueAtTime() {},
					linearRampToValueAtTime() {},
					exponentialRampToValueAtTime() {},
					cancelScheduledValues() {},
					setTargetAtTime() {},
				},
				connect() {
					return this;
				},
				disconnect() {},
			};
		}
		createBufferSource() {
			const source = {
				playbackRate: { value: 1 },
				started: false,
				stopped: false,
				stops: [],
				loop: false,
				connect() {
					return this;
				},
				disconnect() {},
				start() {
					this.started = true;
				},
				stop(time) {
					this.stops.push(time);
					this.stopped = true;
				},
			};
			sources.push(source);
			return source;
		}
		createOscillator() {
			const source = this.createBufferSource();
			source.frequency = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
			return source;
		}
	};
	const fetch = mock.method(globalThis, 'fetch', async () => ({
		ok: true,
		arrayBuffer: async () => new ArrayBuffer(4),
	}));
	return {
		sources,
		get contexts() {
			return contexts;
		},
		get closed() {
			return closed;
		},
		restore() {
			fetch.mock.restore();
			if (previous) globalThis.AudioContext = previous;
			else delete globalThis.AudioContext;
		},
	};
}
test('mobile shot sounds obey mute and cancellation and do not fetch new assets', async () => {
	const fake = fakeAudio();
	const audio = new FlightAudio();
	try {
		audio.shot('safe');
		assert.equal(fake.sources.length, 0);
		audio.unlock();
		await flush();
		audio.shot('safe', 2);
		const shot = fake.sources.at(-1);
		assert.equal(shot.started, true);
		assert.equal(shot.stops[0], 0.060000000000000005);
		audio.stopEffects();
		assert.equal(shot.stopped, true);
		assert.equal(shot.stops.length, 2);
		audio.setMuted(true);
		const count = fake.sources.length;
		audio.shot('danger');
		assert.equal(fake.sources.length, count);
	} finally {
		audio.dispose();
		fake.restore();
	}
});
test('gesture unlock, single ambience, mute and disposal control playback', async () => {
	const fake = fakeAudio();
	const audio = new FlightAudio();
	try {
		audio.setWeather('clear');
		audio.setMuted(false);
		await audio.play('button-click');
		assert.equal(fake.contexts, 0);
		audio.unlock();
		await flush();
		assert.equal(fake.sources.filter((s) => s.loop && !s.stopped).length, 1);
		audio.setWeather('rain');
		await flush();
		assert.equal(fake.sources.filter((s) => s.loop && !s.stopped).length, 1);
		await audio.play('button-click', 0.2, 'ui');
		await audio.play('option-select', 0.2, 'ui');
		assert.equal(fake.sources.filter((s) => !s.loop && !s.stopped).length, 1);
		audio.setMuted(true);
		assert(fake.sources.every((s) => s.stopped));
		const count = fake.sources.length;
		await audio.play('crash');
		assert.equal(fake.sources.length, count);
		audio.setMuted(false);
		await flush();
		audio.setHidden(true);
		assert(fake.sources.every((s) => s.stopped));
		audio.setHidden(false);
		await flush();
		assert.equal(fake.sources.filter((s) => s.loop && !s.stopped).length, 1);
		audio.dispose();
		assert(fake.closed);
		assert(fake.sources.every((s) => s.stopped));
		audio.unlock();
		assert.equal(fake.contexts, 1);
	} finally {
		audio.dispose();
		fake.restore();
	}
});
test('cancelled pending effects never start after decoding', async () => {
	const fake = fakeAudio();
	const audio = new FlightAudio();
	try {
		audio.unlock();
		const pending = audio.play('crystal-pickup');
		audio.stopEffects();
		await pending;
		await flush();
		assert.equal(fake.sources.length, 0);
	} finally {
		audio.dispose();
		fake.restore();
	}
});

test('wing loop matches the bird cycle and stops after flight', async () => {
	const fake = fakeAudio();
	const audio = new FlightAudio();
	try {
		audio.setWingLoop(true, 0.8);
		audio.unlock();
		await flush();
		assert.equal(fake.sources.filter((s) => !s.stopped).length, 1);
		assert.equal(fake.sources.at(-1).playbackRate.value, 1 / 0.8);
		audio.setWingLoop(true, 1);
		await flush();
		assert.equal(fake.sources.filter((s) => !s.stopped).length, 1);
		assert.equal(fake.sources.at(-1).playbackRate.value, 1);
		audio.setHidden(true);
		assert(fake.sources.every((s) => s.stopped));
		audio.setHidden(false);
		await flush();
		assert.equal(fake.sources.filter((s) => !s.stopped).length, 1);
		audio.setWingLoop(false);
		assert(fake.sources.every((s) => s.stopped));
	} finally {
		audio.dispose();
		fake.restore();
	}
});

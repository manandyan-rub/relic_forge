// Full-resolution screenshots of the running dev server through headless Chrome/Edge (CDP).
// node scripts/qa-shot.mjs <outDir> <name:WxH[:script]>...
// Each optional script is evaluated in the page before the capture (awaited).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';

const origin = process.env.APP_ORIGIN ?? 'http://localhost:3006';
const query = process.env.QA_QUERY ?? '?demo=true';
const [outDir, ...jobs] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), 'petal-shot-'));
const browser = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
try {
	let target;
	for (let i = 0; i < 100 && !target; i++) {
		try {
			const [port] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/);
			target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
		} catch {}
		await delay(100);
	}
	socket = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((r) => socket.once('open', r));
	let id = 0;
	const pending = new Map();
	const errors = [];
	socket.on('message', (data) => {
		const m = JSON.parse(data);
		if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); }
		else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
		else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
	});
	const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
	const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
	await Promise.all([send('Page.enable'), send('Runtime.enable')]);
	for (const job of jobs) {
		const [name, size, ...rest] = job.split(/:(?![\/])/);
		const raw = rest.join(':');
		// '@file.js' loads the page script from disk (avoids shell quoting limits).
		const script = raw.startsWith('@') ? readFileSync(raw.slice(1), 'utf8') : raw;
		const [width, height] = size.split('x').map(Number);
		await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
		await send('Page.navigate', { url: origin + '/' + query });
		for (let i = 0; i < 100; i++) { if (await ev("document.querySelector('.petal-world')?.dataset.busy==='false'").catch(() => false)) break; await delay(100); }
		await ev('document.fonts.ready');
		await delay(500);
		if (script) console.log(name, 'script ->', JSON.stringify(await ev(script)));
		const metrics = await ev('({scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight})');
		const { data } = await send('Page.captureScreenshot', { format: 'png' });
		writeFileSync(join(outDir, `${name}.png`), Buffer.from(data, 'base64'));
		console.log(name, JSON.stringify(metrics));
	}
	if (errors.length) console.log('PAGE ERRORS:', errors.join('\n'));
} finally {
	socket?.close();
	browser.kill();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, stat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pruneRelease } from '../scripts/prune-release.mjs';

async function fixture(t, html = '<html><body>Ready</body></html>') {
	const root = await mkdtemp(join(tmpdir(), 'lucky-flight-release-'));
	t.after(async () => {
		assert.equal(dirname(resolve(root)), resolve(tmpdir()));
		assert.ok(basename(root).startsWith('lucky-flight-release-'));
		await rm(root, { recursive: true, force: true });
	});
	for (const directory of ['build/fonts', 'build/bursts', 'static/bursts']) {
		await mkdir(join(root, directory), { recursive: true });
	}
	await writeFile(join(root, 'build/index.html'), html);
	await writeFile(join(root, 'build/bursts/eagle.webm'), 'saved video');
	await writeFile(join(root, 'build/fonts/google-sans-400.ttf'), 'old font');
	await writeFile(join(root, 'build/fonts/interface.woff2'), 'active font');
	await writeFile(join(root, 'static/bursts/eagle.webm'), 'source video');
	return root;
}

test('release pruning removes generated dormant assets and keeps source originals', async (t) => {
	const root = await fixture(t);
	assert.deepEqual(await pruneRelease(root), { files: 2, bytes: 19 });
	await assert.rejects(stat(join(root, 'build/bursts/eagle.webm')), { code: 'ENOENT' });
	assert.equal(await readFile(join(root, 'static/bursts/eagle.webm'), 'utf8'), 'source video');
	assert.equal(await readFile(join(root, 'build/fonts/interface.woff2'), 'utf8'), 'active font');
	assert.deepEqual(await pruneRelease(root), { files: 0, bytes: 0 });
});

for (const reference of [
	'"./bursts/eagle.webm"',
	'"./bursts/eagle%2ewebm"',
	'"./fonts/google-sans-400.ttf"',
]) {
	test(`release pruning fails before any deletion for runtime reference ${reference}`, async (t) => {
		const root = await fixture(t);
		await writeFile(join(root, 'build/app.js'), `const asset = ${reference};`);
		await assert.rejects(pruneRelease(root), /no files pruned/);
		assert.equal((await stat(join(root, 'build/bursts/eagle.webm'))).size, 11);
		assert.equal((await stat(join(root, 'build/fonts/google-sans-400.ttf'))).size, 8);
	});
}

test('release pruning refuses an incomplete output directory', async (t) => {
	const root = await fixture(t);
	await rm(join(root, 'build/index.html'));
	await assert.rejects(pruneRelease(root), /completed build\/index.html/);
	assert.equal((await stat(join(root, 'build/bursts/eagle.webm'))).size, 11);
});

test('release pruning refuses a linked directory instead of touching original assets', async (t) => {
	const root = await fixture(t);
	await symlink(join(root, 'static'), join(root, 'build/originals'), 'junction');
	await assert.rejects(pruneRelease(root), /symbolic link/);
	assert.equal((await stat(join(root, 'build/bursts/eagle.webm'))).size, 11);
	assert.equal(await readFile(join(root, 'static/bursts/eagle.webm'), 'utf8'), 'source video');
});

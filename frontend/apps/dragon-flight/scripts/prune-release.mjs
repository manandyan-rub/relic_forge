import { readdir, readFile, realpath, lstat, unlink } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json']);
const OLD_FONT = /(?:^|\/)fonts\/google-sans-(?:400|500|600|700)\.ttf$/i;

function pathKey(value) {
	return process.platform === 'win32' ? value.toLowerCase() : value;
}

function assertInside(path, root) {
	const child = relative(root, path);
	if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
		throw new Error(`Release cleanup target is outside build: ${path}`);
	}
}

async function listBuildFiles(directory, root) {
	const result = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = resolve(directory, entry.name);
		assertInside(path, root);
		// Do not follow links into the source art or any directory outside build.
		if (entry.isSymbolicLink()) throw new Error(`Release cleanup refuses symbolic link: ${path}`);
		if (entry.isDirectory()) result.push(...(await listBuildFiles(path, root)));
		else if (entry.isFile()) result.push(path);
	}
	return result;
}

// Only generated deployment copies are removed. Original files in static/ remain.
export async function pruneRelease(appDirectory = APP_DIRECTORY) {
	const appRoot = await realpath(appDirectory);
	const expectedBuild = resolve(appRoot, 'build');
	const buildRoot = await realpath(expectedBuild);
	assertInside(buildRoot, appRoot);
	if (pathKey(buildRoot) !== pathKey(expectedBuild)) {
		throw new Error('Release cleanup refuses a redirected build directory');
	}
	const files = await listBuildFiles(buildRoot, buildRoot);
	if (!files.includes(resolve(buildRoot, 'index.html'))) {
		throw new Error('Release cleanup requires a completed build/index.html');
	}
	const candidates = files.filter((path) => {
		const name = relative(buildRoot, path).split(sep).join('/');
		return extname(path).toLowerCase() === '.webm' || OLD_FONT.test(name);
	});
	// Check the complete output before deleting anything. Fail closed if a future
	// component starts using the saved clips or legacy font files again.
	for (const path of files) {
		if (!RUNTIME_TEXT.has(extname(path).toLowerCase())) continue;
		const content = (await readFile(path, 'utf8'))
			.replace(/\\(?:u002e|x2e)|%2e/gi, '.')
			.toLowerCase();
		if (content.includes('.webm') || /google-sans-(?:400|500|600|700)\.ttf/.test(content)) {
			throw new Error(
				`Dormant asset is referenced by ${relative(buildRoot, path)}; no files pruned`,
			);
		}
	}
	let bytes = 0;
	for (const path of candidates) {
		assertInside(path, buildRoot);
		const target = await realpath(path);
		assertInside(target, buildRoot);
		if (pathKey(target) !== pathKey(path)) {
			throw new Error(`Release cleanup refuses redirected file: ${path}`);
		}
		const stat = await lstat(path);
		if (!stat.isFile() || stat.isSymbolicLink()) {
			throw new Error(`Release cleanup refuses non-file: ${path}`);
		}
		await unlink(path);
		bytes += stat.size;
	}
	return { files: candidates.length, bytes };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	try {
		const result = await pruneRelease();
		console.log(
			`Release cleanup: excluded ${result.files} dormant assets (${(result.bytes / 2 ** 20).toFixed(2)} MiB); source originals retained.`,
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}

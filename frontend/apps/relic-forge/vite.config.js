import config from 'config-vite';

/**
 * The shared state package ships SDK sample bet-mode/rule metadata that points at
 * external test hosts. The Last Petal never uses that metadata, and Engine requires a
 * build of static files with no external references, so it is replaced with empty data.
 */
const SAMPLE_META = '\0last-petal-empty-sdk-meta';
const stripSdkSampleMeta = {
	name: 'last-petal-strip-sdk-sample-meta',
	enforce: 'pre',
	resolveId(id, importer) {
		if (id === './constants' && importer && /[\\/]state-shared[\\/]src[\\/]stateMeta\.svelte\.ts$/.test(importer)) return SAMPLE_META;
		return null;
	},
	load(id) {
		if (id === SAMPLE_META) return 'export const DEFAULT_BET_MODE_META = {};\nexport const DEFAULT_GAME_RULE_META = {};\n';
		return null;
	},
};

const base = config();
export default { ...base, plugins: [stripSdkSampleMeta, ...(base.plugins ?? [])] };

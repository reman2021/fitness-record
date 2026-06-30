import { Notice, TFile, Vault } from 'obsidian';
import YAML from 'yaml';
import { createDefaultData, DEFAULT_COLUMNS, DEFAULT_HEATMAP_DAYS, HEATMAP_DAY_OPTIONS, type FitnessData, type HeatmapDays } from './types';

const DATA_BLOCK_START = '```fitness-record';
const DATA_BLOCK_END = '```';

export async function loadFitnessData(vault: Vault, path: string): Promise<{ file: TFile; data: FitnessData }> {
	const file = await ensureDataFile(vault, path);
	const text = await vault.read(file);
	const data = parseData(text);
	return { file, data };
}

export async function saveFitnessData(vault: Vault, file: TFile, data: FitnessData): Promise<void> {
	const next = renderDataFile(data);
	await vault.modify(file, next);
}

async function ensureDataFile(vault: Vault, path: string): Promise<TFile> {
	const normalized = normalizePath(path);
	const existing = vault.getAbstractFileByPath(normalized);
	if (existing instanceof TFile) return existing;

	const data = createDefaultData();
	await vault.create(normalized, renderDataFile(data));
	const created = vault.getAbstractFileByPath(normalized);
	if (created instanceof TFile) return created;
	throw new Error(`Failed to create data file: ${normalized}`);
}

function normalizePath(path: string): string {
	const trimmed = path.trim() || 'fitness-record.md';
	return trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`;
}

function parseData(text: string): FitnessData {
	const start = text.indexOf(DATA_BLOCK_START);
	if (start < 0) return createDefaultData();
	const contentStart = start + DATA_BLOCK_START.length;
	const end = text.indexOf(DATA_BLOCK_END, contentStart);
	if (end < 0) return createDefaultData();
	const yamlText = text.slice(contentStart, end).trim();
	try {
		const parsed = YAML.parse(yamlText) as Partial<FitnessData> | null;
		return normalizeData(parsed);
	} catch (error) {
		new Notice('健身记录数据解析失败，已使用默认数据。请检查 fitness-record 数据块。');
		console.error(error);
		return createDefaultData();
	}
}

function normalizeData(input: Partial<FitnessData> | null): FitnessData {
	const defaults = createDefaultData();
	if (!input) return defaults;
	const sections = Array.isArray(input.sections) ? input.sections : defaults.sections;
	normalizeActionMuscles(sections);
	return {
		schemaVersion: Number(input.schemaVersion ?? 1),
		sections,
		columns: Array.isArray(input.columns) && input.columns.length > 0 ? input.columns : DEFAULT_COLUMNS.map((column) => ({ ...column })),
		records: Array.isArray(input.records) ? input.records : [],
		ui: {
			leftCollapsed: Boolean(input.ui?.leftCollapsed ?? false),
			rightCollapsed: Boolean(input.ui?.rightCollapsed ?? false),
			heatmapDays: normalizeHeatmapDays(input.ui?.heatmapDays),
		},
	};
}

function normalizeActionMuscles(sections: FitnessData['sections']): void {
	for (const section of sections) {
		for (const action of section.actions ?? []) {
			if (action.id === 'push-up' && !action.muscles.includes('serratus-anterior')) {
				action.muscles = [...action.muscles, 'serratus-anterior'];
			}
		}
	}
}

function normalizeHeatmapDays(value: unknown): HeatmapDays {
	if (value === 'all') return 'all';
	const days = Number(value);
	return HEATMAP_DAY_OPTIONS.includes(days as HeatmapDays) ? days as HeatmapDays : DEFAULT_HEATMAP_DAYS;
}

function renderDataFile(data: FitnessData): string {
	return [
		'# 健身记录',
		'',
		'该文件由 Fitness Record 插件维护。可以手动编辑下方数据块，但请保持 YAML 格式有效。',
		'',
		DATA_BLOCK_START,
		YAML.stringify(data).trimEnd(),
		DATA_BLOCK_END,
		'',
	].join('\n');
}

import { ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { loadFitnessData, saveFitnessData } from './data';
import { ActionModal, ColumnModal, TextPromptModal } from './modals';
import { MUSCLES, type CellValue, type FitnessAction, type FitnessColumn, type FitnessData, type FitnessRecord, type FitnessSection } from './types';
import type FitnessRecordPlugin from './main';

export const FITNESS_VIEW_TYPE = 'fitness-record-view';

export class FitnessView extends ItemView {
	private data: FitnessData | null = null;
	private file: TFile | null = null;
	private saveTimer: number | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: FitnessRecordPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return FITNESS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.plugin.settings.viewTitle || '健身记录';
	}

	getIcon(): string {
		return 'dumbbell';
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		try {
			const { file, data } = await loadFitnessData(this.app.vault, this.plugin.settings.dataFile);
			this.file = file;
			this.data = data;
			this.render();
		} catch (error) {
			new Notice('健身记录加载失败');
			console.error(error);
		}
	}

	async addRecord(): Promise<void> {
		if (!this.data) return;
		this.data.records.push(createRecord(this.data.columns));
		await this.persistAndRender();
	}

	private render(): void {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass('fitness-record-view');
		if (!this.data) {
			root.createDiv({ cls: 'fr-empty', text: '正在加载健身记录...' });
			return;
		}
		this.renderActionSidebar(root, this.data);
		this.renderMainTable(root, this.data);
		this.renderHeatmap(root, this.data);
	}

	private renderActionSidebar(root: HTMLElement, data: FitnessData): void {
		const sidebar = root.createDiv({ cls: `fr-sidebar ${data.ui.leftCollapsed ? 'fr-collapsed' : ''}` });
		const header = sidebar.createDiv({ cls: 'fr-sidebar-header' });
		header.createDiv({ cls: 'fr-sidebar-title', text: '动作库' });
		const toggle = header.createEl('button', { text: data.ui.leftCollapsed ? '展开' : '收起' });
		toggle.addEventListener('click', () => {
			data.ui.leftCollapsed = !data.ui.leftCollapsed;
			void this.persistAndRender();
		});
		const body = sidebar.createDiv({ cls: 'fr-sidebar-body' });

		for (const section of data.sections) {
			const sectionEl = body.createDiv({ cls: 'fr-section' });
			const sectionHeader = sectionEl.createDiv({ cls: 'fr-section-header' });
			const name = sectionHeader.createDiv({ cls: 'fr-section-name', text: `${section.collapsed ? '▸' : '▾'} ${section.name}` });
			name.addEventListener('click', () => {
				section.collapsed = !section.collapsed;
				void this.persistAndRender();
			});
			const add = sectionHeader.createEl('button', { text: '+' });
			add.addEventListener('click', () => this.openActionModal(section));

			if (!section.collapsed) {
				const actionList = sectionEl.createDiv({ cls: 'fr-action-list' });
				if (section.actions.length === 0) actionList.createDiv({ cls: 'fr-empty', text: '暂无动作' });
				for (const action of section.actions) {
					const tag = actionList.createEl('button', { cls: 'fr-tag fr-clickable', text: action.name });
					tag.addEventListener('click', () => this.openActionModal(section, action));
				}
			}
		}

		const addSection = body.createEl('button', { text: '添加板块' });
		addSection.addEventListener('click', () => {
			new TextPromptModal(this.app, '添加板块', '板块名称', async (value) => {
				data.sections.push({
					id: createId(value),
					name: value,
					collapsed: false,
					actions: [],
				});
				await this.persistAndRender();
			}).open();
		});
	}

	private renderMainTable(root: HTMLElement, data: FitnessData): void {
		const main = root.createDiv({ cls: 'fr-main' });
		const header = main.createDiv({ cls: 'fr-main-header' });
		header.createDiv({ cls: 'fr-main-title', text: this.plugin.settings.viewTitle || '健身记录' });
		const actions = header.createDiv({ cls: 'fr-pill-list' });
		const addRow = actions.createEl('button', { text: '新增行' });
		addRow.addEventListener('click', () => void this.addRecord());
		const addColumn = actions.createEl('button', { text: '新增列' });
		addColumn.addEventListener('click', () => this.openColumnModal());

		const wrap = main.createDiv({ cls: 'fr-table-wrap' });
		const table = wrap.createEl('table', { cls: 'fr-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: '' });
		for (const column of data.columns) {
			const th = headerRow.createEl('th');
			const button = th.createEl('button', { text: column.title });
			button.addEventListener('click', () => this.openColumnModal(column));
		}

		const tbody = table.createEl('tbody');
		const records = getSortedRecords(data);
		for (const record of records) {
			const tr = tbody.createEl('tr');
			const actionCell = tr.createEl('td', { cls: 'fr-row-actions' });
			const deleteButton = actionCell.createEl('button', { text: '删除' });
			deleteButton.addEventListener('click', async () => {
				data.records = data.records.filter((item) => item.id !== record.id);
				await this.persistAndRender();
			});
			for (const column of data.columns) {
				const td = tr.createEl('td');
				if (column.wrap) td.addClass('fr-wrap');
				this.renderCell(td, data, record, column);
			}
		}
	}

	private renderCell(td: HTMLElement, data: FitnessData, record: FitnessRecord, column: FitnessColumn): void {
		const value = record.cells[column.id];
		if (column.id === 'section') {
			const select = td.createEl('select', { cls: 'fr-cell-select' });
			select.createEl('option', { value: '', text: '选择板块' });
			for (const section of data.sections) select.createEl('option', { value: section.name, text: section.name });
			select.value = typeof value === 'string' ? value : '';
			select.addEventListener('change', async () => {
				record.cells[column.id] = select.value;
				record.cells.actions = [];
				await this.persistAndRender();
			});
			return;
		}

		if (column.id === 'actions') {
			const select = td.createEl('select', { cls: 'fr-cell-select' });
			select.createEl('option', { value: '', text: '添加动作' });
			const sectionName = record.cells.section;
			const section = data.sections.find((item) => item.name === sectionName);
			for (const action of section?.actions ?? getAllActions(data)) select.createEl('option', { value: action.name, text: action.name });
			select.addEventListener('change', async () => {
				if (!select.value) return;
				const current = Array.isArray(record.cells[column.id]) ? record.cells[column.id] as string[] : [];
				if (!current.includes(select.value)) record.cells[column.id] = [...current, select.value];
				await this.persistAndRender();
			});
			const pills = td.createDiv({ cls: 'fr-pill-list' });
			for (const actionName of Array.isArray(value) ? value : []) {
				const pill = pills.createEl('button', { cls: 'fr-tag fr-clickable', text: `× ${actionName}` });
				pill.addEventListener('click', async () => {
					record.cells[column.id] = (record.cells[column.id] as string[]).filter((item) => item !== actionName);
					await this.persistAndRender();
				});
			}
			return;
		}

		if (column.type === 'checkbox') {
			const input = td.createEl('input', { type: 'checkbox' });
			input.checked = Boolean(value);
			input.addEventListener('change', async () => {
				record.cells[column.id] = input.checked;
				await this.persist();
			});
			return;
		}

		if (column.type === 'text') {
			const input = td.createEl('textarea', { cls: 'fr-cell-textarea' });
			input.value = typeof value === 'string' ? value : '';
			input.addEventListener('change', async () => {
				record.cells[column.id] = input.value;
				await this.persist();
			});
			return;
		}

		const input = td.createEl('input', { cls: 'fr-cell-input' });
		input.type = column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'text';
		input.value = stringifyCell(value);
		input.addEventListener('change', async () => {
			record.cells[column.id] = column.type === 'number' ? Number(input.value || 0) : input.value;
			await this.persist();
		});
		if (column.suffix) td.createSpan({ cls: 'fr-suffix', text: ` ${column.suffix}` });
	}

	private renderHeatmap(root: HTMLElement, data: FitnessData): void {
		const sidebar = root.createDiv({ cls: `fr-sidebar fr-right ${data.ui.rightCollapsed ? 'fr-collapsed' : ''}` });
		const header = sidebar.createDiv({ cls: 'fr-sidebar-header' });
		header.createDiv({ cls: 'fr-sidebar-title', text: '肌肉热力' });
		const toggle = header.createEl('button', { text: data.ui.rightCollapsed ? '展开' : '收起' });
		toggle.addEventListener('click', () => {
			data.ui.rightCollapsed = !data.ui.rightCollapsed;
			void this.persistAndRender();
		});
		const body = sidebar.createDiv({ cls: 'fr-sidebar-body' });
		const counts = computeMuscleCounts(data);
		const max = Math.max(1, ...Array.from(counts.values()));
		const heatmap = body.createDiv({ cls: 'fr-heatmap' });
		this.renderBodyMap(heatmap, '正面', 'front', counts, max);
		this.renderBodyMap(heatmap, '背面', 'back', counts, max);
	}

	private renderBodyMap(parent: HTMLElement, title: string, group: 'front' | 'back', counts: Map<string, number>, max: number): void {
		const map = parent.createDiv({ cls: 'fr-body-map' });
		map.createDiv({ cls: 'fr-body-title', text: title });
		const grid = map.createDiv({ cls: 'fr-muscle-grid' });
		for (const muscle of MUSCLES.filter((item) => item.group === group || item.group === 'both')) {
			const count = counts.get(muscle.id) ?? 0;
			const intensity = count / max;
			const alpha = count === 0 ? 0.08 : 0.2 + intensity * 0.65;
			const item = grid.createDiv({ cls: 'fr-muscle', text: `${muscle.name}${count ? ` ${count}` : ''}` });
			item.style.background = `rgba(234, 88, 12, ${alpha})`;
		}
	}

	private openActionModal(section: FitnessSection, action?: FitnessAction): void {
		if (!this.data) return;
		new ActionModal(this.app, section, async (payload) => {
			if (action) {
				action.name = payload.name;
				action.muscles = payload.muscles;
				action.description = payload.description;
			} else {
				section.actions.push({
					id: createId(payload.name),
					...payload,
				});
			}
			await this.persistAndRender();
		}, action).open();
	}

	private openColumnModal(column?: FitnessColumn): void {
		if (!this.data) return;
		const data = this.data;
		new ColumnModal(this.app, async (payload) => {
			if (column) {
				Object.assign(column, payload);
			} else {
				const id = createId(payload.title);
				data.columns.push({ id, ...payload });
				for (const record of data.records) record.cells[id] = defaultValueForColumn(payload.type);
			}
			await this.persistAndRender();
		}, column ? async () => {
			if (column.locked) {
				new Notice('默认列不能删除');
				return;
			}
			data.columns = data.columns.filter((item) => item.id !== column.id);
			for (const record of data.records) delete record.cells[column.id];
			await this.persistAndRender();
		} : undefined, column).open();
	}

	private async persistAndRender(): Promise<void> {
		await this.persist();
		this.render();
	}

	private async persist(): Promise<void> {
		if (!this.file || !this.data) return;
		if (this.saveTimer) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(async () => {
			try {
				if (this.file && this.data) await saveFitnessData(this.app.vault, this.file, this.data);
			} catch (error) {
				new Notice('健身记录保存失败');
				console.error(error);
			}
		}, 120);
	}
}

function createRecord(columns: FitnessColumn[]): FitnessRecord {
	const cells: Record<string, CellValue> = {};
	for (const column of columns) cells[column.id] = defaultValueForColumn(column.type, column.id);
	return {
		id: createId('record'),
		cells,
	};
}

function defaultValueForColumn(type: FitnessColumn['type'], id = ''): CellValue {
	if (id === 'date' || type === 'date') return new Date().toISOString().slice(0, 10);
	if (type === 'checkbox') return false;
	if (type === 'number') return null;
	if (type === 'multi-tag') return [];
	return '';
}

function createId(seed: string): string {
	const base = seed.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') || 'item';
	return `${base}-${Date.now().toString(36)}`;
}

function getAllActions(data: FitnessData): FitnessAction[] {
	return data.sections.flatMap((section) => section.actions);
}

function stringifyCell(value: CellValue): string {
	if (value === null || value === undefined) return '';
	if (Array.isArray(value)) return value.join(', ');
	return String(value);
}

function computeMuscleCounts(data: FitnessData): Map<string, number> {
	const actionMap = new Map<string, FitnessAction>();
	for (const action of getAllActions(data)) actionMap.set(action.name, action);
	const counts = new Map<string, number>();
	for (const record of data.records) {
		const actions = record.cells.actions;
		if (!Array.isArray(actions)) continue;
		for (const actionName of actions) {
			const action = actionMap.get(actionName);
			if (!action) continue;
			for (const muscle of action.muscles) counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
		}
	}
	return counts;
}

function getSortedRecords(data: FitnessData): FitnessRecord[] {
	const sortedColumn = data.columns.find((column) => column.sort !== 'none' && (column.type === 'date' || column.type === 'number'));
	if (!sortedColumn) return data.records;
	return [...data.records].sort((a, b) => {
		const av = a.cells[sortedColumn.id];
		const bv = b.cells[sortedColumn.id];
		const left = typeof av === 'number' ? av : String(av ?? '');
		const right = typeof bv === 'number' ? bv : String(bv ?? '');
		if (left === right) return 0;
		const result = left > right ? 1 : -1;
		return sortedColumn.sort === 'asc' ? result : -result;
	});
}

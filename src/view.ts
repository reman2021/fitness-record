import { ItemView, Notice, setIcon, TFile, WorkspaceLeaf } from 'obsidian';
import { loadFitnessData, saveFitnessData } from './data';
import { DEFAULT_ACTION_ICON, getActionIconFolder, renderActionIcon } from './icons';
import { ActionLibraryModal, ActionModal, ColumnModal, WorkoutRecordModal, type SaveWorkoutPayload } from './modals';
import { HEATMAP_DAY_OPTIONS, MUSCLES, type CellValue, type FitnessAction, type FitnessColumn, type FitnessData, type FitnessRecord, type FitnessSection, type HeatmapDays, type WorkoutEntry } from './types';
import type FitnessRecordPlugin from './main';
import bodyBackSvg from '../人体背面.svg';
import bodyFrontSvg from '../人体正面.svg';

export const FITNESS_VIEW_TYPE = 'fitness-record-view';

export class FitnessView extends ItemView {
	private data: FitnessData | null = null;
	private file: TFile | null = null;
	private saveTimer: number | null = null;
	private rightPinned = localStorage.getItem('fitness-record-heatmap-pinned') !== 'false';
	private rightSidebarWidth = readStoredSidebarWidth();
	private tableFilter = '';
	private searchComposing = false;
	private actionIconFolder: string;

	constructor(leaf: WorkspaceLeaf, private plugin: FitnessRecordPlugin) {
		super(leaf);
		this.actionIconFolder = getActionIconFolder(plugin.manifest.dir, plugin.manifest.id);
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
		this.openWorkoutModal();
	}

	private render(): void {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass('fitness-record-view');
		if (!this.data) {
			root.createDiv({ cls: 'fr-empty', text: '正在加载健身记录...' });
			return;
		}
		this.renderMainTimeline(root, this.data);
		this.renderHeatmap(root, this.data);
	}

	private renderMainTimeline(root: HTMLElement, data: FitnessData): void {
		const main = root.createDiv({ cls: 'fr-main' });
		main.addEventListener('click', (event) => {
			const target = event.target as HTMLElement;
			if (target.closest('button, input, select, textarea, a')) return;
			void this.collapseUnpinnedSidebars();
		});
		const header = main.createDiv({ cls: 'fr-main-header' });
		const titleWrap = header.createDiv({ cls: 'fr-title-block' });
		titleWrap.createDiv({ cls: 'fr-main-title', text: this.plugin.settings.viewTitle || '健身记录' });
		titleWrap.createDiv({ cls: 'fr-main-subtitle', text: buildMonthlySummary(data) });
		const actions = header.createDiv({ cls: 'fr-table-tools' });
		const search = actions.createEl('input', {
			cls: 'fr-table-search',
			attr: {
				type: 'search',
				placeholder: '搜索记录',
				value: this.tableFilter,
				'aria-label': '搜索记录',
			},
		});
		const applySearchFilter = () => {
			this.tableFilter = search.value;
			const cursor = search.selectionStart ?? this.tableFilter.length;
			this.render();
			window.setTimeout(() => {
				const nextSearch = this.containerEl.querySelector<HTMLInputElement>('.fr-table-search');
				nextSearch?.focus();
				nextSearch?.setSelectionRange(cursor, cursor);
			}, 0);
		};
		search.addEventListener('compositionstart', () => {
			this.searchComposing = true;
		});
		search.addEventListener('compositionend', () => {
			this.searchComposing = false;
			applySearchFilter();
		});
		search.addEventListener('input', (event) => {
			if (this.searchComposing || (event as InputEvent).isComposing) return;
			applySearchFilter();
		});
		const libraryButton = actions.createEl('button', { text: '动作库' });
		libraryButton.addEventListener('click', () => this.openActionLibrary());
		const addRow = actions.createEl('button', { cls: 'fr-primary-button', text: '+ 添加一条新记录' });
		addRow.addEventListener('click', () => this.openWorkoutModal());

		const wrap = main.createDiv({ cls: 'fr-timeline-wrap' });
		const records = getSortedRecords(data).filter((record) => recordMatchesFilter(record, data, this.tableFilter));
		if (records.length === 0) {
			wrap.createDiv({ cls: 'fr-timeline-empty', text: this.tableFilter.trim() ? '没有匹配的记录' : '点击上方按钮添加第一条训练记录' });
			return;
		}
		for (const group of groupRecordsByDate(records)) {
			const groupHeader = wrap.createDiv({ cls: 'fr-day-header' });
			const dateLabel = groupHeader.createDiv({ cls: 'fr-day-title' });
			dateLabel.createSpan({ cls: 'fr-day-main', text: formatDateLabel(group.date) });
			dateLabel.createSpan({ cls: 'fr-day-week', text: formatWeekday(group.date) });
			const dayWeight = getLatestWeight(group.records);
			if (dayWeight !== null) dateLabel.createSpan({ cls: 'fr-day-weight', text: `体重${dayWeight}kg` });
			groupHeader.createDiv({ cls: 'fr-day-total', text: `${group.records.length} 条 · ${sumEntries(group.records)} 个动作` });

			const card = wrap.createDiv({ cls: 'fr-record-card' });
			for (const record of group.records) this.renderRecordItem(card, data, record);
		}
	}

	private renderRecordItem(parent: HTMLElement, data: FitnessData, record: FitnessRecord): void {
		const actions = getWorkoutEntries(record);
		if (actions.length === 0) {
			this.renderActionRecordItem(parent, data, record, null);
			return;
		}
		for (const entry of actions) this.renderActionRecordItem(parent, data, record, entry);
	}

	private renderActionRecordItem(parent: HTMLElement, data: FitnessData, record: FitnessRecord, entry: WorkoutEntry | null): void {
		const item = parent.createDiv({ cls: 'fr-record-item' });
		const icon = item.createDiv({ cls: 'fr-record-icon' });
		renderActionIcon(this.app, icon, this.actionIconFolder, entry ? getActionIcon(data, entry.action) : DEFAULT_ACTION_ICON);
		const content = item.createDiv({ cls: 'fr-record-content' });
		const top = content.createDiv({ cls: 'fr-record-top' });
		const titleLine = top.createDiv({ cls: 'fr-record-title-line' });
		titleLine.createSpan({ cls: 'fr-record-section', text: entry?.action ?? String(record.cells.section || '训练') });
		titleLine.createSpan({ cls: 'fr-record-count', text: cleanSectionName(record.cells.section) });
		const meta = content.createDiv({ cls: 'fr-record-action' });
		meta.createSpan({ cls: 'fr-record-action-meta', text: entry ? formatEntry(entry) : '未填写动作' });
		const notes = String(record.cells.notes ?? '').trim();
		if (notes) content.createDiv({ cls: 'fr-record-notes', text: notes });
		const side = item.createDiv({ cls: 'fr-record-side' });
		const edit = side.createEl('button', { attr: { 'aria-label': '编辑记录', title: '编辑记录' } });
		setIcon(edit, 'pencil');
		edit.addEventListener('click', () => this.openWorkoutModal(record));
		const remove = side.createEl('button', { attr: { 'aria-label': '删除记录', title: '删除记录' } });
		setIcon(remove, 'trash-2');
		remove.addEventListener('click', async () => {
			if (entry && getWorkoutEntries(record).length > 1) {
				record.cells.actions = getWorkoutEntries(record).filter((itemEntry) => itemEntry.action !== entry.action);
			} else {
				data.records = data.records.filter((itemRecord) => itemRecord.id !== record.id);
			}
			await this.persistAndRender();
		});
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
		if (this.rightPinned) data.ui.rightCollapsed = false;
		const sidebarState = this.rightPinned ? 'fr-pinned' : data.ui.rightCollapsed ? 'fr-collapsed' : 'fr-expanded';
		const sidebar = root.createDiv({ cls: `fr-sidebar fr-right ${sidebarState}` });
		this.applyHeatmapSidebarWidth(sidebar);
		sidebar.createDiv({ cls: 'fr-sidebar-slim-indicator' });
		sidebar.createDiv({ cls: 'fr-sidebar-resize-handle', attr: { 'aria-label': '调整热力图侧边栏宽度' } });
		const header = sidebar.createDiv({ cls: 'fr-sidebar-header' });
		header.createDiv({ cls: 'fr-sidebar-title', text: '肌肉热力' });
		this.renderPinButton(header);
		this.renderHeatmapRange(sidebar, data);
		const body = sidebar.createDiv({ cls: 'fr-sidebar-body' });
		this.renderHeatmapBody(body, data);
		this.setupHeatmapSidebarBehavior(sidebar);
	}

	private renderHeatmapBody(body: HTMLElement, data: FitnessData): void {
		body.empty();
		const counts = computeMuscleCounts(data, data.ui.heatmapDays);
		const max = Math.max(1, ...Array.from(counts.values()));
		const heatmap = body.createDiv({ cls: 'fr-heatmap' });
		this.renderCardioHeat(heatmap, counts, max);
		const maps = heatmap.createDiv({ cls: 'fr-heatmap-maps' });
		this.renderBodyMap(maps, '正面', 'front', counts, max);
		this.renderBodyMap(maps, '背面', 'back', counts, max);
		this.renderWeightChart(heatmap, data);
	}

	private renderHeatmapRange(parent: HTMLElement, data: FitnessData): void {
		const range = parent.createDiv({ cls: 'fr-heatmap-range' });
		for (const days of HEATMAP_DAY_OPTIONS) {
			const button = range.createEl('button', {
				cls: `fr-heatmap-range-btn ${data.ui.heatmapDays === days ? 'is-active' : ''}`,
				text: days === 'all' ? '全部' : `${days}天`,
				attr: {
					'aria-pressed': String(data.ui.heatmapDays === days),
					'data-days': String(days),
				},
			});
			button.addEventListener('click', async () => {
				if (data.ui.heatmapDays === days) return;
				data.ui.heatmapDays = days;
				for (const item of Array.from(range.querySelectorAll<HTMLButtonElement>('.fr-heatmap-range-btn'))) {
					const active = item.dataset.days === String(days);
					item.toggleClass('is-active', active);
					item.setAttribute('aria-pressed', String(active));
				}
				const body = parent.querySelector<HTMLElement>('.fr-sidebar-body');
				if (body) this.renderHeatmapBody(body, data);
				await this.persist();
			});
		}
	}

	private renderCardioHeat(parent: HTMLElement, counts: Map<string, number>, max: number): void {
		const count = counts.get('cardio') ?? 0;
		const intensity = count / max;
		const alpha = count === 0 ? 0.08 : 0.2 + intensity * 0.65;
		const card = parent.createDiv({ cls: 'fr-cardio-heat' });
		card.style.setProperty('--fr-cardio-alpha', String(alpha));
		const icons = card.createDiv({ cls: 'fr-cardio-icons' });
		const heart = icons.createSpan({ cls: 'fr-cardio-icon' });
		setIcon(heart, 'heart-pulse');
		const lungs = icons.createSpan({ cls: 'fr-cardio-icon' });
		setIcon(lungs, 'lungs');
		const text = card.createDiv({ cls: 'fr-cardio-text' });
		text.createDiv({ cls: 'fr-cardio-title', text: '心肺耐力' });
		text.createDiv({ cls: 'fr-cardio-count', text: `${count} 次` });
	}

	private renderBodyMap(parent: HTMLElement, title: string, group: 'front' | 'back', counts: Map<string, number>, max: number): void {
		const map = parent.createDiv({ cls: 'fr-body-map' });
		map.createDiv({ cls: 'fr-body-title', text: title });
		const figure = map.createDiv({ cls: `fr-body-figure fr-body-${group}` });
		const visibleMuscles = MUSCLES.filter((item) => item.id !== 'cardio' && (item.group === group || item.group === 'both'));
		figure.innerHTML = group === 'front' ? bodyFrontSvg : bodyBackSvg;
		const svg = figure.querySelector<SVGSVGElement>('svg');
		if (svg) {
			svg.classList.add('fr-body-svg');
			svg.setAttribute('aria-label', `${title}肌肉热力图`);
			svg.setAttribute('role', 'img');
			resetSvgMuscleRegions(svg);
		}
		const regionStats = buildSvgRegionStats(visibleMuscles, group, counts, max);
		for (const muscle of visibleMuscles) {
			for (const regionId of muscle.svgRegionIds[group] ?? []) {
				const item = findSvgMuscleRegion(figure, regionId);
				if (!item) continue;
				const stat = regionStats.get(regionId);
				const count = stat?.count ?? 0;
				item.classList.add('fr-muscle-region');
				item.classList.toggle('is-empty', count === 0);
				item.setAttribute('data-count', String(count));
				const tooltip = formatMuscleRegionTooltip(stat?.names ?? [muscle.name], count);
				item.setAttribute('aria-label', tooltip.replace(/\n/g, '; '));
				item.style.setProperty('--fr-muscle-alpha', String(stat?.alpha ?? 0));
				item.style.setProperty('fill', count === 0 ? 'transparent' : `color-mix(in srgb, var(--fr-heat) calc(var(--fr-muscle-alpha) * 82%), transparent)`);
				item.style.setProperty('opacity', '1');
				item.style.setProperty('stroke', count === 0 ? 'transparent' : 'color-mix(in srgb, var(--fr-heat) 34%, var(--fr-border))');
				const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
				titleEl.textContent = tooltip;
				item.prepend(titleEl);
			}
		}
		const legend = map.createDiv({ cls: 'fr-muscle-legend' });
		for (const muscle of visibleMuscles) {
			const count = counts.get(muscle.id) ?? 0;
			legend.createDiv({ cls: 'fr-muscle-key', text: `${muscle.name}${count ? ` ${count}` : ''}` });
		}
	}

	private renderWeightChart(parent: HTMLElement, data: FitnessData): void {
		const series = computeWeightSeries(data, data.ui.heatmapDays);
		const card = parent.createDiv({ cls: 'fr-weight-chart' });
		const header = card.createDiv({ cls: 'fr-weight-chart-header' });
		header.createDiv({ cls: 'fr-weight-chart-title', text: '体重变化' });
		const latest = series[series.length - 1];
		header.createDiv({ cls: 'fr-weight-chart-current', text: latest ? `${latest.weight}kg` : '暂无数据' });
		if (series.length === 0) {
			card.createDiv({ cls: 'fr-weight-chart-empty', text: '当前时间范围内没有体重记录' });
			return;
		}

		const width = 320;
		const height = 150;
		const pad = { top: 18, right: 18, bottom: 28, left: 36 };
		const plotWidth = width - pad.left - pad.right;
		const plotHeight = height - pad.top - pad.bottom;
		const weights = series.map((item) => item.weight);
		const rawMin = Math.min(...weights);
		const rawMax = Math.max(...weights);
		const span = Math.max(1, rawMax - rawMin);
		const min = rawMin - span * 0.12;
		const max = rawMax + span * 0.12;
		const xFor = (index: number) => pad.left + (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth);
		const yFor = (weight: number) => pad.top + ((max - weight) / (max - min)) * plotHeight;
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'fr-weight-chart-svg');
		svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
		svg.setAttribute('role', 'img');
		svg.setAttribute('aria-label', '体重变化折线图');

		const axis = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		axis.setAttribute('class', 'fr-weight-chart-axis');
		axis.setAttribute('d', `M${pad.left} ${pad.top}V${height - pad.bottom}H${width - pad.right}`);
		svg.appendChild(axis);

		for (const ratio of [0, 0.5, 1]) {
			const y = pad.top + ratio * plotHeight;
			const grid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			grid.setAttribute('class', 'fr-weight-chart-grid');
			grid.setAttribute('x1', String(pad.left));
			grid.setAttribute('x2', String(width - pad.right));
			grid.setAttribute('y1', String(y));
			grid.setAttribute('y2', String(y));
			svg.appendChild(grid);
		}

		if (series.length > 1) {
			const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
			polyline.setAttribute('class', 'fr-weight-chart-line');
			polyline.setAttribute('points', series.map((item, index) => `${xFor(index)},${yFor(item.weight)}`).join(' '));
			svg.appendChild(polyline);
		}

		series.forEach((item, index) => {
			const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			dot.setAttribute('class', 'fr-weight-chart-dot');
			dot.setAttribute('cx', String(xFor(index)));
			dot.setAttribute('cy', String(yFor(item.weight)));
			dot.setAttribute('r', index === series.length - 1 ? '3.8' : '3');
			const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
			title.textContent = `${item.date}: ${item.weight}kg`;
			dot.appendChild(title);
			svg.appendChild(dot);
		});

		const plot = card.createDiv({ cls: 'fr-weight-chart-plot' });
		plot.appendChild(svg);
		plot.createSpan({ cls: 'fr-weight-chart-label fr-weight-chart-label-max', text: `${rawMax}kg` });
		plot.createSpan({ cls: 'fr-weight-chart-label fr-weight-chart-label-min', text: `${rawMin}kg` });
		plot.createSpan({ cls: 'fr-weight-chart-date-label fr-weight-chart-date-label-start', text: formatShortDate(series[0].date) });
		plot.createSpan({ cls: 'fr-weight-chart-date-label fr-weight-chart-date-label-end', text: formatShortDate(series[series.length - 1].date) });
	}

	private renderPinButton(header: HTMLElement): void {
		const pinned = this.rightPinned;
		const button = header.createEl('button', {
			cls: `fr-sidebar-pin ${pinned ? 'is-pinned' : ''}`,
			attr: {
				'aria-label': pinned ? '取消固定侧边栏' : '固定侧边栏',
				title: pinned ? '取消固定侧边栏' : '固定侧边栏',
				'aria-pressed': String(pinned),
			},
		});
		setIcon(button, pinned ? 'pin' : 'pin-off');
		button.addEventListener('click', async () => {
			const sidebar = button.closest<HTMLElement>('.fr-sidebar.fr-right');
			if (!sidebar || !this.data) return;
			this.rightPinned = !this.rightPinned;
			localStorage.setItem('fitness-record-heatmap-pinned', String(this.rightPinned));
			this.data.ui.rightCollapsed = !this.rightPinned;
			this.applyHeatmapSidebarState(sidebar);
			this.updatePinButton(button);
			await this.persist();
		});
	}

	private async collapseUnpinnedSidebars(): Promise<void> {
		if (!this.data) return;
		if (this.rightPinned || this.data.ui.rightCollapsed) return;
		this.data.ui.rightCollapsed = true;
		const sidebar = this.containerEl.querySelector<HTMLElement>('.fr-sidebar.fr-right');
		if (sidebar) this.applyHeatmapSidebarState(sidebar);
		await this.persist();
	}

	private setupHeatmapSidebarBehavior(sidebar: HTMLElement): void {
		const handle = sidebar.querySelector<HTMLElement>('.fr-sidebar-resize-handle');
		handle?.addEventListener('pointerdown', (event) => {
			if (!this.data || sidebar.hasClass('fr-collapsed')) return;
			event.preventDefault();
			event.stopPropagation();
			const pointerId = event.pointerId;
			const updateWidth = (clientX: number) => {
				this.rightSidebarWidth = clampSidebarWidth(window.innerWidth - clientX);
				this.applyHeatmapSidebarWidth(sidebar);
			};
			const move = (moveEvent: PointerEvent) => {
				if (moveEvent.pointerId !== pointerId) return;
				updateWidth(moveEvent.clientX);
			};
			const end = (upEvent: PointerEvent) => {
				if (upEvent.pointerId !== pointerId) return;
				document.removeEventListener('pointermove', move);
				document.removeEventListener('pointerup', end);
				document.removeEventListener('pointercancel', end);
				localStorage.setItem('fitness-record-heatmap-width', String(this.rightSidebarWidth));
			};
			handle.setPointerCapture?.(pointerId);
			document.addEventListener('pointermove', move);
			document.addEventListener('pointerup', end);
			document.addEventListener('pointercancel', end);
		});
		sidebar.addEventListener('mousedown', (event) => {
			if (!this.data || this.rightPinned || !sidebar.hasClass('fr-collapsed')) return;
			event.preventDefault();
			event.stopPropagation();
			this.data.ui.rightCollapsed = false;
			this.applyHeatmapSidebarState(sidebar);
			void this.persist();
		}, true);
	}

	private applyHeatmapSidebarState(sidebar: HTMLElement): void {
		if (!this.data) return;
		sidebar.toggleClass('fr-pinned', this.rightPinned);
		sidebar.toggleClass('fr-expanded', !this.rightPinned && !this.data.ui.rightCollapsed);
		sidebar.toggleClass('fr-collapsed', !this.rightPinned && this.data.ui.rightCollapsed);
		this.applyHeatmapSidebarWidth(sidebar);
	}

	private applyHeatmapSidebarWidth(sidebar: HTMLElement): void {
		const width = sidebar.hasClass('fr-collapsed') ? 15 : this.rightSidebarWidth;
		sidebar.style.setProperty('--fr-right-sidebar-width', `${width}px`);
	}

	private updatePinButton(button: HTMLElement): void {
		button.toggleClass('is-pinned', this.rightPinned);
		button.setAttribute('aria-label', this.rightPinned ? '取消固定侧边栏' : '固定侧边栏');
		button.setAttribute('title', this.rightPinned ? '取消固定侧边栏' : '固定侧边栏');
		button.setAttribute('aria-pressed', String(this.rightPinned));
		button.empty();
		setIcon(button, this.rightPinned ? 'pin' : 'pin-off');
	}

	private openActionLibrary(): void {
		if (!this.data) return;
		new ActionLibraryModal(this.app, this.data.sections, this.actionIconFolder, async () => {
			await this.persistAndRender();
		}).open();
	}

	private openWorkoutModal(record?: FitnessRecord): void {
		if (!this.data) return;
		const initial = record ? {
			date: String(record.cells.date ?? new Date().toISOString().slice(0, 10)),
			section: String(record.cells.section ?? ''),
			actions: getWorkoutEntries(record),
			weight: typeof record.cells.weight === 'number' ? record.cells.weight : null,
			notes: String(record.cells.notes ?? ''),
		} : {
			weight: getLatestWeight(this.data.records),
		};
		new WorkoutRecordModal(this.app, this.data.sections, this.actionIconFolder, async (payload) => {
			if (record) {
				applyWorkoutPayload(record, payload);
			} else {
				const next = createRecord(this.data!.columns);
				applyWorkoutPayload(next, payload);
				this.data!.records.push(next);
			}
			await this.persistAndRender();
		}, initial).open();
	}

	private openActionModal(section: FitnessSection, action?: FitnessAction): void {
		if (!this.data) return;
		new ActionModal(this.app, section, this.actionIconFolder, async (payload) => {
			if (action) {
				action.name = payload.name;
				action.muscles = payload.muscles;
				action.description = payload.description;
				action.icon = payload.icon;
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

function getActionIcon(data: FitnessData, actionName: string): string {
	const action = getAllActions(data).find((item) => item.name === actionName);
	return action?.icon?.trim() || DEFAULT_ACTION_ICON;
}

function stringifyCell(value: CellValue): string {
	if (value === null || value === undefined) return '';
	if (Array.isArray(value) && value.every((item) => typeof item === 'object')) {
		return (value as WorkoutEntry[]).map((item) => [item.action, item.sets, item.reps, item.weight].filter((part) => part !== null && part !== undefined).join(' ')).join(', ');
	}
	if (Array.isArray(value)) return value.join(', ');
	return String(value);
}

function recordMatchesFilter(record: FitnessRecord, data: FitnessData, filter: string): boolean {
	const query = filter.trim().toLowerCase();
	if (!query) return true;
	const actionNames = getWorkoutEntries(record).map((entry) => entry.action);
	const haystack = [
		...data.columns.map((column) => stringifyCell(record.cells[column.id])),
		...actionNames,
	].join(' ').toLowerCase();
	return haystack.includes(query);
}

function computeMuscleCounts(data: FitnessData, days: HeatmapDays): Map<string, number> {
	const actionMap = new Map<string, FitnessAction>();
	for (const action of getAllActions(data)) actionMap.set(action.name, action);
	const counts = new Map<string, number>();
	for (const record of data.records) {
		if (!isRecordInHeatmapRange(record, days)) continue;
		for (const entry of getWorkoutEntries(record)) {
			const action = actionMap.get(entry.action);
			if (!action) continue;
			for (const muscle of action.muscles) counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
		}
	}
	return counts;
}

function computeWeightSeries(data: FitnessData, days: HeatmapDays): { date: string; weight: number }[] {
	const byDate = new Map<string, { index: number; weight: number }>();
	data.records.forEach((record, index) => {
		if (!isRecordInHeatmapRange(record, days)) return;
		const weight = typeof record.cells.weight === 'number' ? record.cells.weight : null;
		if (weight === null) return;
		const date = String(record.cells.date ?? '');
		const current = byDate.get(date);
		if (!current || index > current.index) byDate.set(date, { index, weight });
	});
	return Array.from(byDate, ([date, item]) => ({ date, weight: item.weight }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

function isRecordInHeatmapRange(record: FitnessRecord, days: HeatmapDays): boolean {
	const recordDate = parseRecordDate(record.cells.date);
	if (!recordDate) return false;
	const today = startOfLocalDay(new Date());
	if (recordDate > today) return false;
	if (days === 'all') return true;
	const start = new Date(today);
	start.setDate(today.getDate() - (days - 1));
	return recordDate >= start;
}

function parseRecordDate(value: CellValue): Date | null {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const date = new Date(`${value}T00:00:00`);
	if (Number.isNaN(date.getTime())) return null;
	const localValue = [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, '0'),
		String(date.getDate()).padStart(2, '0'),
	].join('-');
	if (localValue !== value) return null;
	return startOfLocalDay(date);
}

function resetSvgMuscleRegions(svg: SVGSVGElement): void {
	for (const item of Array.from(svg.querySelectorAll<SVGElement>('#fitness-heatmap-regions-front > *, #fitness-heatmap-regions-back > *'))) {
		item.classList.add('fr-svg-muscle-source', 'is-empty');
		item.style.setProperty('fill', 'transparent');
		item.style.setProperty('stroke', 'transparent');
		item.style.setProperty('opacity', '1');
		Array.from(item.querySelectorAll('title')).forEach((title) => title.remove());
		const label = item.getAttribute('inkscape:label');
		if (label && !item.getAttribute('data-muscle-id')) item.setAttribute('data-muscle-id', muscleIdFromSvgRegionId(label));
	}
}

function buildSvgRegionStats(
	muscles: typeof MUSCLES,
	group: 'front' | 'back',
	counts: Map<string, number>,
	max: number,
): Map<string, { count: number; alpha: number; names: string[] }> {
	const stats = new Map<string, { count: number; alpha: number; names: string[] }>();
	for (const muscle of muscles) {
		const muscleCount = counts.get(muscle.id) ?? 0;
		for (const regionId of muscle.svgRegionIds[group] ?? []) {
			const stat = stats.get(regionId) ?? { count: 0, alpha: 0, names: [] };
			stat.count += muscleCount;
			if (!stat.names.includes(muscle.name)) stat.names.push(muscle.name);
			const intensity = stat.count / max;
			stat.alpha = stat.count === 0 ? 0 : 0.2 + intensity * 0.65;
			stats.set(regionId, stat);
		}
	}
	return stats;
}

function formatMuscleRegionTooltip(names: string[], count: number): string {
	return names.map((name) => `${name}: ${count} 次`).join('\n');
}

function findSvgMuscleRegion(parent: HTMLElement, regionId: string): SVGElement | null {
	return parent.querySelector<SVGElement>(`#${CSS.escape(regionId)}`)
		?? parent.querySelector<SVGElement>(`[inkscape\\:label="${cssAttrEscape(regionId)}"]`);
}

function muscleIdFromSvgRegionId(regionId: string): string {
	return regionId.replace(/^(front|back)-/, '').replace(/-(left|right)$/, '');
}

function cssAttrEscape(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function startOfLocalDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getSortedRecords(data: FitnessData): FitnessRecord[] {
	const sortedColumn = data.columns.find((column) => column.sort !== 'none' && (column.type === 'date' || column.type === 'number'));
	if (!sortedColumn) {
		return [...data.records].sort((a, b) => String(b.cells.date ?? '').localeCompare(String(a.cells.date ?? '')));
	}
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

function applyWorkoutPayload(record: FitnessRecord, payload: SaveWorkoutPayload): void {
	record.cells.date = payload.date;
	record.cells.section = payload.section;
	record.cells.actions = payload.actions.map((entry) => ({ ...entry }));
	record.cells.weight = payload.weight;
	record.cells.notes = payload.notes;
}

function getWorkoutEntries(record: FitnessRecord): WorkoutEntry[] {
	const raw = record.cells.actions;
	if (!Array.isArray(raw)) return [];
	return raw.map((item) => {
		if (typeof item === 'string') return { action: item, sets: null, reps: null, weight: null };
		return {
			action: item.action,
			sets: item.sets ?? null,
			reps: item.reps ?? null,
			weight: item.weight ?? null,
		};
	}).filter((entry) => entry.action);
}

function groupRecordsByDate(records: FitnessRecord[]): { date: string; records: FitnessRecord[] }[] {
	const groups = new Map<string, FitnessRecord[]>();
	for (const record of records) {
		const date = String(record.cells.date ?? '未填写日期');
		groups.set(date, [...(groups.get(date) ?? []), record]);
	}
	return Array.from(groups, ([date, items]) => ({ date, records: items }));
}

function getLatestWeight(records: FitnessRecord[]): number | null {
	let latestDate = '';
	let latestIndex = -1;
	let latestWeight: number | null = null;
	records.forEach((record, index) => {
		const weight = typeof record.cells.weight === 'number' ? record.cells.weight : null;
		if (weight === null) return;
		const date = String(record.cells.date ?? '');
		if (latestWeight === null || date > latestDate || (date === latestDate && index > latestIndex)) {
			latestDate = date;
			latestIndex = index;
			latestWeight = weight;
		}
	});
	return latestWeight;
}

function sumEntries(records: FitnessRecord[]): number {
	return records.reduce((total, record) => total + getWorkoutEntries(record).length, 0);
}

function formatEntry(entry: WorkoutEntry): string {
	const parts: string[] = [];
	if (entry.sets !== null) parts.push(`${entry.sets}组`);
	if (entry.reps !== null) parts.push(`${entry.reps}次`);
	if (entry.weight !== null) parts.push(`${entry.weight}kg`);
	return parts.length ? parts.join(' · ') : '未填写训练量';
}

function formatDateLabel(date: string): string {
	const today = new Date().toISOString().slice(0, 10);
	const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	if (date === today) return '今天';
	if (date === yesterday) return '昨天';
	return date;
}

function formatWeekday(date: string): string {
	const value = new Date(`${date}T00:00:00`);
	if (Number.isNaN(value.getTime())) return '';
	return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][value.getDay()] ?? '';
}

function formatShortDate(date: string): string {
	const parts = date.split('-');
	if (parts.length !== 3) return date;
	return `${Number(parts[1])}/${Number(parts[2])}`;
}

function buildMonthlySummary(data: FitnessData): string {
	const month = new Date().toISOString().slice(0, 7);
	const monthRecords = data.records.filter((record) => String(record.cells.date ?? '').startsWith(month));
	const actionTotal = sumEntries(monthRecords);
	return `本月 ${monthRecords.length} 条记录 · ${actionTotal} 个动作`;
}

function cleanSectionName(value: CellValue): string {
	return String(value || '训练').replace(/[\s_-]+$/g, '');
}

function readStoredSidebarWidth(): number {
	return clampSidebarWidth(Number(localStorage.getItem('fitness-record-heatmap-width') ?? 420));
}

function clampSidebarWidth(width: number): number {
	const maxByViewport = Math.max(380, Math.min(820, window.innerWidth - 320));
	const max = Math.max(380, maxByViewport);
	const value = Number.isFinite(width) ? width : 420;
	return Math.min(max, Math.max(380, Math.round(value)));
}

import { Modal, Notice, setIcon, Setting } from 'obsidian';
import { ACTION_ICON_SUBFOLDER, LUCIDE_ACTION_ICON_OPTIONS, loadLocalActionIcons, normalizeActionIcon, renderActionIcon, type LocalActionIcon } from './icons';
import { MUSCLES, type ColumnType, type FitnessAction, type FitnessColumn, type FitnessSection, type WorkoutEntry } from './types';

type SaveActionPayload = Pick<FitnessAction, 'name' | 'muscles' | 'description' | 'icon'>;
type MaybePromise<T> = T | Promise<T>;
export type SaveWorkoutPayload = {
	date: string;
	section: string;
	actions: WorkoutEntry[];
	weight: number | null;
	notes: string;
};

export class TextPromptModal extends Modal {
	private value = '';

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		private title: string,
		private placeholder: string,
		private onSubmit: (value: string) => void,
		initialValue = '',
	) {
		super(app);
		this.value = initialValue;
	}

	onOpen(): void {
		this.modalEl.addClass('fr-modal');
		const { contentEl } = this;
		contentEl.empty();
		renderModalHeader(contentEl, this.title);

		new Setting(contentEl)
			.setName(this.placeholder)
			.addText((text) => {
				text.setValue(this.value).onChange((value) => {
					this.value = value;
				});
				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key === 'Enter') this.submit();
				});
				setTimeout(() => text.inputEl.focus(), 0);
			});

		renderModalActions(contentEl, () => this.close(), () => this.submit());
	}

	private submit(): void {
		const value = this.value.trim();
		if (!value) {
			new Notice('请输入内容');
			return;
		}
		this.onSubmit(value);
		this.close();
	}
}

export class ActionModal extends Modal {
	private name: string;
	private description: string;
	private muscles: string[];
	private icon: string;
	private localIcons: LocalActionIcon[] = [];
	private iconsLoaded = false;

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		private section: FitnessSection,
		private actionIconFolder: string,
		private onSubmit: (payload: SaveActionPayload) => MaybePromise<void>,
		private action?: FitnessAction,
	) {
		super(app);
		this.name = action?.name ?? '';
		this.description = action?.description ?? '';
		this.muscles = action?.muscles ?? [];
		this.icon = normalizeActionIcon(action?.icon);
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass('fr-modal');
		this.localIcons = await loadLocalActionIcons(this.app, this.actionIconFolder);
		this.iconsLoaded = true;
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		renderModalHeader(contentEl, this.action ? '编辑动作' : `添加动作到 ${this.section.name}`);

		const nameRow = contentEl.createDiv({ cls: 'fr-form-row' });
		nameRow.createEl('label', { text: '动作名称' });
		const nameInput = nameRow.createEl('input', {
			attr: {
				type: 'text',
				placeholder: '例如：卧推',
				value: this.name,
			},
		});
		nameInput.addEventListener('input', () => {
			this.name = nameInput.value;
		});

		const iconRow = contentEl.createDiv({ cls: 'fr-form-row' });
		iconRow.createEl('label', { text: '动作图标' });
		const iconList = iconRow.createDiv({ cls: 'fr-icon-picker' });
		if (!this.iconsLoaded) {
			iconList.createDiv({ cls: 'fr-empty', text: '正在加载图标...' });
		}
		if (this.iconsLoaded && this.localIcons.length === 0) {
			iconList.createDiv({ cls: 'fr-icon-picker-hint', text: `把 SVG/PNG 图标放到插件目录的 ${ACTION_ICON_SUBFOLDER} 后可在这里选择` });
		}
		for (const localIcon of this.localIcons) {
			const active = this.icon === localIcon.id;
			const item = iconList.createEl('button', {
				cls: `fr-icon-option fr-local-icon-option ${active ? 'is-active' : ''}`,
				attr: {
					'aria-label': localIcon.name,
					'aria-pressed': String(active),
					title: localIcon.name,
				},
			});
			renderActionIcon(this.app, item, this.actionIconFolder, localIcon.id);
			item.addEventListener('click', () => {
				this.icon = localIcon.id;
				this.render();
			});
		}
		if (this.localIcons.length === 0) {
			for (const iconName of LUCIDE_ACTION_ICON_OPTIONS) {
				const active = this.icon === iconName;
				const item = iconList.createEl('button', {
					cls: `fr-icon-option ${active ? 'is-active' : ''}`,
					attr: {
						'aria-label': iconName,
						'aria-pressed': String(active),
						title: iconName,
					},
				});
				setIcon(item, iconName);
				item.addEventListener('click', () => {
					this.icon = iconName;
					this.render();
				});
			}
		}

		const musclesRow = contentEl.createDiv({ cls: 'fr-form-row' });
		musclesRow.createEl('label', { text: '锻炼肌肉' });
		const muscleList = musclesRow.createDiv({ cls: 'fr-pill-list fr-muscle-picker' });
		for (const muscle of MUSCLES) {
			let active = this.muscles.includes(muscle.id);
			const item = muscleList.createEl('button', {
				text: active ? `✓ ${muscle.name}` : muscle.name,
				cls: `fr-tag fr-clickable ${active ? 'is-active' : ''}`,
			});
			item.addEventListener('click', () => {
				active = !active;
				if (active) this.muscles = [...this.muscles, muscle.id];
				else this.muscles = this.muscles.filter((id) => id !== muscle.id);
				item.toggleClass('is-active', active);
				item.setText(active ? `✓ ${muscle.name}` : muscle.name);
			});
		}

		const descriptionRow = contentEl.createDiv({ cls: 'fr-form-row' });
		descriptionRow.createEl('label', { text: '详细说明' });
		const descriptionInput = descriptionRow.createEl('textarea', {
			attr: {
				placeholder: '可填写器械、姿势要点或备注',
			},
		});
		descriptionInput.value = this.description;
		descriptionInput.rows = 4;
		descriptionInput.addEventListener('input', () => {
			this.description = descriptionInput.value;
		});

		renderModalActions(contentEl, () => this.close(), () => {
			void this.submit();
		});
	}

	private async submit(): Promise<void> {
		const name = this.name.trim();
		if (!name) {
			new Notice('动作名称不能为空');
			return;
		}
		await this.onSubmit({
			name,
			muscles: this.muscles,
			description: this.description.trim(),
			icon: normalizeActionIcon(this.icon),
		});
		this.close();
	}
}

export class ActionLibraryModal extends Modal {
	private activeSectionId: string;

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		private sections: FitnessSection[],
		private actionIconFolder: string,
		private onChange: () => MaybePromise<void>,
	) {
		super(app);
		this.activeSectionId = sections[0]?.id ?? '';
	}

	onOpen(): void {
		this.modalEl.addClass('fr-modal', 'fr-action-library-modal');
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		renderModalHeader(contentEl, '动作库');

		const tabs = contentEl.createDiv({ cls: 'fr-workout-tabs' });
		for (const section of this.sections) {
			const tab = tabs.createDiv({ cls: `fr-library-tab ${section.id === this.activeSectionId ? 'is-active' : ''}` });
			const button = tab.createEl('button', { cls: 'fr-library-tab-button', text: section.name });
			button.addEventListener('click', () => {
				this.activeSectionId = section.id;
				this.render();
			});
		}
		const addSection = tabs.createEl('button', { cls: 'fr-library-tab-add', attr: { 'aria-label': '编辑标签', title: '编辑标签' } });
		setIcon(addSection, 'plus');
		addSection.addEventListener('click', () => {
			new SectionManagerModal(this.app, this.sections, this.activeSectionId, (activeSectionId) => {
				this.activeSectionId = activeSectionId;
				this.onChange();
				this.render();
			}).open();
		});

		const section = this.sections.find((item) => item.id === this.activeSectionId) ?? this.sections[0];
		const grid = contentEl.createDiv({ cls: 'fr-library-grid' });
		if (!section) {
			grid.createDiv({ cls: 'fr-empty', text: '暂无肌群' });
			return;
		}

		for (const action of section.actions) {
			const item = grid.createDiv({ cls: 'fr-library-action', attr: { role: 'button', tabindex: '0' } });
			const remove = item.createEl('button', { cls: 'fr-library-remove', text: '×', attr: { 'aria-label': '删除动作', title: '删除动作' } });
			remove.addEventListener('click', async (event) => {
				event.preventDefault();
				event.stopPropagation();
				section.actions = section.actions.filter((itemAction) => itemAction.id !== action.id);
				await this.onChange();
				this.render();
			});
			const title = item.createDiv({ cls: 'fr-library-title' });
			const icon = title.createSpan({ cls: 'fr-action-icon fr-library-icon' });
			renderActionIcon(this.app, icon, this.actionIconFolder, action.icon);
			title.createSpan({ cls: 'fr-library-name', text: action.name });
			const description = action.description || '点击编辑';
			item.createSpan({ cls: 'fr-library-desc', text: description, attr: { title: description } });
			const openEditor = () => {
				new ActionModal(this.app, section, this.actionIconFolder, async (payload) => {
					action.name = payload.name;
					action.muscles = payload.muscles;
					action.description = payload.description;
					action.icon = payload.icon;
					await this.onChange();
					this.render();
				}, action).open();
			};
			item.addEventListener('click', openEditor);
			item.addEventListener('keydown', (event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return;
				event.preventDefault();
				openEditor();
			});
		}

		const add = grid.createEl('button', { cls: 'fr-library-action fr-library-add' });
		const addIcon = add.createSpan({ cls: 'fr-library-name' });
		setIcon(addIcon, 'plus');
		add.createSpan({ cls: 'fr-library-desc', text: '新增动作' });
		add.addEventListener('click', () => {
			new ActionModal(this.app, section, this.actionIconFolder, async (payload) => {
				section.actions.push({
					id: createId(payload.name),
					...payload,
				});
				await this.onChange();
				this.render();
			}).open();
		});
	}
}

type SectionDraft = FitnessSection & { isNew?: boolean };

class SectionManagerModal extends Modal {
	private drafts: SectionDraft[];
	private newName = '';

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		private sections: FitnessSection[],
		private activeSectionId: string,
		private onSave: (activeSectionId: string) => void,
	) {
		super(app);
		this.drafts = sections.map((section) => ({
			...section,
			actions: section.actions,
		}));
	}

	onOpen(): void {
		this.modalEl.addClass('fr-modal', 'fr-section-manager-modal');
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		renderModalHeader(contentEl, '编辑标签');

		const addPanel = contentEl.createDiv({ cls: 'fr-section-manager-add' });
		const addField = addPanel.createDiv({ cls: 'fr-form-row' });
		addField.createEl('label', { text: '新增标签' });
		const addInput = addField.createEl('input', {
			attr: {
				placeholder: '输入新的标签名称',
				value: this.newName,
			},
		});
		addInput.addEventListener('input', () => {
			this.newName = addInput.value;
		});
		addInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') this.addDraft();
		});
		const addButton = addPanel.createEl('button', { cls: 'fr-section-manager-add-button', text: '新增' });
		addButton.addEventListener('click', () => this.addDraft());

		const list = contentEl.createDiv({ cls: 'fr-section-manager-list' });
		for (const draft of this.drafts) {
			const row = list.createDiv({ cls: 'fr-section-manager-row' });
			const nameWrap = row.createDiv({ cls: 'fr-section-manager-name' });
			nameWrap.createEl('label', { text: '标签名称' });
			const input = nameWrap.createEl('input', { attr: { value: draft.name } });
			input.addEventListener('input', () => {
				draft.name = input.value;
			});

			const count = draft.actions.length;
			row.createDiv({ cls: 'fr-section-manager-count', text: count > 0 ? `${count} 个动作` : '空标签' });
			const remove = row.createEl('button', {
				cls: 'fr-section-manager-delete fr-modal-danger',
				text: '删除',
				attr: {
					title: count > 0 ? '有动作的标签不能删除' : '删除标签',
				},
			});
			remove.disabled = count > 0;
			remove.addEventListener('click', () => {
				this.drafts = this.drafts.filter((item) => item !== draft);
				this.render();
			});
		}

		renderModalActions(contentEl, () => this.close(), () => this.submit());
	}

	private addDraft(): void {
		const name = this.newName.trim();
		if (!name) {
			new Notice('请输入标签名称');
			return;
		}
		this.drafts.push({
			id: createId(name),
			name,
			collapsed: false,
			actions: [],
			isNew: true,
		});
		this.newName = '';
		this.render();
	}

	private submit(): void {
		const names = this.drafts.map((draft) => draft.name.trim());
		if (names.length === 0) {
			new Notice('至少保留一个标签');
			return;
		}
		if (names.some((name) => !name)) {
			new Notice('标签名称不能为空');
			return;
		}
		if (new Set(names).size !== names.length) {
			new Notice('标签名称不能重复');
			return;
		}

		const nextSections = this.drafts.map((draft, index) => ({
			id: draft.id,
			name: names[index],
			collapsed: draft.collapsed,
			actions: draft.actions,
		}));
		this.sections.splice(0, this.sections.length, ...nextSections);
		const activeSectionId = this.sections.some((section) => section.id === this.activeSectionId)
			? this.activeSectionId
			: this.sections[0].id;
		this.onSave(activeSectionId);
		this.close();
	}
}

export class WorkoutRecordModal extends Modal {
	private date: string;
	private activeSectionId: string;
	private selected = new Map<string, WorkoutEntry>();
	private weight: string;
	private notes: string;

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		private sections: FitnessSection[],
		private actionIconFolder: string,
		private onSubmit: (payload: SaveWorkoutPayload) => void,
		private initial?: Partial<SaveWorkoutPayload>,
	) {
		super(app);
		this.date = initial?.date ?? new Date().toISOString().slice(0, 10);
		this.activeSectionId = sections.find((section) => section.name === initial?.section)?.id ?? sections[0]?.id ?? '';
		for (const entry of initial?.actions ?? []) {
			this.selected.set(entry.action, {
				action: entry.action,
				sets: entry.sets ?? 0,
				reps: entry.reps ?? 0,
				weight: entry.weight ?? 0,
			});
		}
		this.weight = initial?.weight === null || initial?.weight === undefined ? '' : String(initial.weight);
		this.notes = initial?.notes ?? '';
	}

	onOpen(): void {
		this.modalEl.addClass('fr-modal', 'fr-workout-modal');
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		renderModalHeader(contentEl, this.initial ? '编辑训练记录' : '添加一条新记录');

		const meta = contentEl.createDiv({ cls: 'fr-workout-meta' });
		const dateField = meta.createDiv({ cls: 'fr-form-row' });
		dateField.createEl('label', { text: '日期' });
		const dateWrap = dateField.createDiv({ cls: 'fr-date-field' });
		const dateInput = dateWrap.createEl('input', { cls: 'fr-date-picker', attr: { type: 'date', value: this.date } });
		const openDatePicker = () => {
			const picker = dateInput as HTMLInputElement & { showPicker?: () => void };
			try {
				if (picker.showPicker) picker.showPicker();
			} catch {
				// Some embedded Chromium builds only allow showPicker on direct clicks.
			}
		};
		dateInput.addEventListener('pointerdown', (event) => {
			event.stopPropagation();
		});
		dateInput.addEventListener('click', () => {
			dateInput.focus({ preventScroll: true });
			openDatePicker();
		});
		dateInput.addEventListener('keydown', (event) => {
			event.preventDefault();
		});
		dateInput.addEventListener('beforeinput', (event) => {
			event.preventDefault();
		});
		dateInput.addEventListener('paste', (event) => {
			event.preventDefault();
		});
		dateInput.addEventListener('change', () => {
			this.date = dateInput.value;
		});
		window.setTimeout(() => {
			if (document.activeElement === dateInput) dateInput.blur();
		}, 0);

		const weightField = meta.createDiv({ cls: 'fr-form-row' });
		weightField.createEl('label', { text: '体重(kg)' });
		const weightInput = weightField.createEl('input', { attr: { type: 'number', min: '0', step: '0.1', value: this.weight, placeholder: '可选' } });
		weightInput.addEventListener('input', () => {
			this.weight = weightInput.value;
		});

		const tabs = contentEl.createDiv({ cls: 'fr-workout-tabs' });
		for (const section of this.sections) {
			const button = tabs.createEl('button', {
				cls: section.id === this.activeSectionId ? 'is-active' : '',
				text: section.name,
			});
			button.addEventListener('click', () => {
				this.activeSectionId = section.id;
				this.render();
			});
		}

		const section = this.sections.find((item) => item.id === this.activeSectionId) ?? this.sections[0];
		const picker = contentEl.createDiv({ cls: 'fr-workout-picker' });
		if (!section || section.actions.length === 0) {
			picker.createDiv({ cls: 'fr-empty', text: '这个肌群下还没有动作' });
		} else {
			for (const action of section.actions) {
				const active = this.selected.has(action.name);
				const button = picker.createEl('button', {
					cls: active ? 'is-active' : '',
					attr: {
						'aria-pressed': String(active),
					},
				});
				const icon = button.createSpan({ cls: 'fr-action-icon fr-workout-picker-icon' });
				renderActionIcon(this.app, icon, this.actionIconFolder, action.icon);
				button.createSpan({ cls: 'fr-workout-picker-name', text: action.name });
				button.addEventListener('click', () => {
					if (active) this.selected.delete(action.name);
					else this.selected.set(action.name, { action: action.name, sets: 0, reps: 0, weight: 0 });
					this.render();
				});
			}
		}

		const selectedList = contentEl.createDiv({ cls: 'fr-workout-selected' });
		if (this.selected.size === 0) {
			selectedList.createDiv({ cls: 'fr-empty', text: '选择动作后填写组数、每组次数和重量' });
		}
		for (const entry of this.selected.values()) {
			const row = selectedList.createDiv({ cls: 'fr-workout-entry' });
			const name = row.createDiv({ cls: 'fr-workout-entry-name' });
			const action = findActionByName(this.sections, entry.action);
			const icon = name.createSpan({ cls: 'fr-action-icon fr-workout-entry-icon' });
			renderActionIcon(this.app, icon, this.actionIconFolder, action?.icon);
			name.createSpan({ text: entry.action });
			this.renderNumberField(row, '组数', entry.sets, (value) => {
				entry.sets = value;
			});
			this.renderNumberField(row, '每组个数', entry.reps, (value) => {
				entry.reps = value;
			});
			this.renderNumberField(row, '重量(kg)', entry.weight, (value) => {
				entry.weight = value;
			});
			const remove = row.createEl('button', { cls: 'fr-workout-remove', text: '移除' });
			remove.addEventListener('click', () => {
				this.selected.delete(entry.action);
				this.render();
			});
		}

		const noteRow = contentEl.createDiv({ cls: 'fr-form-row' });
		noteRow.createEl('label', { text: '备注' });
		const notes = noteRow.createEl('textarea', { attr: { placeholder: '训练感受、状态或特殊说明' } });
		notes.value = this.notes;
		notes.rows = 3;
		notes.addEventListener('input', () => {
			this.notes = notes.value;
		});

		renderModalActions(contentEl, () => this.close(), () => this.submit());
	}

	private renderNumberField(parent: HTMLElement, label: string, value: number | null, onChange: (value: number | null) => void): void {
		const wrap = parent.createDiv({ cls: 'fr-workout-number' });
		wrap.createSpan({ text: label });
		const initialValue = value ?? 0;
		if (value === null) onChange(initialValue);
		const input = wrap.createEl('input', {
			attr: {
				type: 'number',
				min: '0',
				step: '1',
				value: String(initialValue),
			},
		});
		const setValue = (nextValue: number) => {
			const normalized = Math.max(0, Math.round(nextValue));
			input.value = String(normalized);
			onChange(normalized);
		};
		input.addEventListener('input', () => {
			setValue(Number(input.value || 0));
		});
		input.addEventListener('wheel', (event) => {
			event.preventDefault();
			const current = Number(input.value || 0);
			setValue(current + (event.deltaY < 0 ? 1 : -1));
		});
	}

	private submit(): void {
		if (!this.date) {
			new Notice('请选择日期');
			return;
		}
		const actions = Array.from(this.selected.values());
		if (actions.length === 0) {
			new Notice('请至少选择一个动作');
			return;
		}
		const section = this.sections.find((item) => item.id === this.activeSectionId)?.name ?? this.sections[0]?.name ?? '';
		this.onSubmit({
			date: this.date,
			section,
			actions,
			weight: this.weight === '' ? null : Number(this.weight),
			notes: this.notes.trim(),
		});
		this.close();
	}
}

export class ColumnModal extends Modal {
	private title: string;
	private type: ColumnType;
	private wrap: boolean;
	private sort: FitnessColumn['sort'];
	private suffix: string;

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		private onSubmit: (payload: Omit<FitnessColumn, 'id'>) => void,
		private onDelete?: () => void,
		private column?: FitnessColumn,
	) {
		super(app);
		this.title = column?.title ?? '新列';
		this.type = column?.type ?? 'text';
		this.wrap = column?.wrap ?? false;
		this.sort = column?.sort ?? 'none';
		this.suffix = column?.suffix ?? '';
	}

	onOpen(): void {
		this.modalEl.addClass('fr-modal');
		const { contentEl } = this;
		contentEl.empty();
		renderModalHeader(contentEl, this.column ? '列设置' : '新增列');

		new Setting(contentEl)
			.setName('标题')
			.addText((text) => text.setValue(this.title).onChange((value) => {
				this.title = value;
			}));

		new Setting(contentEl)
			.setName('类型')
			.addDropdown((dropdown) => {
				const options: Record<ColumnType, string> = {
					date: '日期',
					tag: '标签',
					'multi-tag': '多标签',
					text: '文本',
					number: '数字',
					link: '链接',
					checkbox: '复选框',
				};
				for (const [value, label] of Object.entries(options)) dropdown.addOption(value, label);
				dropdown.setValue(this.type).onChange((value) => {
					this.type = value as ColumnType;
					if (this.type !== 'date' && this.type !== 'number') this.sort = 'none';
				});
			});

		new Setting(contentEl)
			.setName('自动换行')
			.addToggle((toggle) => toggle.setValue(this.wrap).onChange((value) => {
				this.wrap = value;
			}));

		new Setting(contentEl)
			.setName('排序')
			.setDesc('仅日期和数字类型生效')
			.addDropdown((dropdown) => {
				dropdown.addOption('none', '不排序');
				dropdown.addOption('asc', '升序');
				dropdown.addOption('desc', '降序');
				dropdown.setValue(this.sort).onChange((value) => {
					this.sort = value as FitnessColumn['sort'];
				});
			});

		new Setting(contentEl)
			.setName('数字后缀')
			.addText((text) => text.setValue(this.suffix).onChange((value) => {
				this.suffix = value;
			}));

		const actions = contentEl.createDiv({ cls: 'fr-modal-actions' });
		if (this.column && !this.column.locked && this.onDelete) {
			const deleteButton = actions.createEl('button', { cls: 'fr-modal-danger', text: '删除列' });
			deleteButton.addEventListener('click', () => {
				this.onDelete?.();
				this.close();
			});
		}
		const cancelButton = actions.createEl('button', { text: '取消' });
		cancelButton.addEventListener('click', () => this.close());
		const saveButton = actions.createEl('button', { text: '保存' });
		saveButton.addEventListener('click', () => this.submit());
	}

	private submit(): void {
		const title = this.title.trim();
		if (!title) {
			new Notice('列标题不能为空');
			return;
		}
		this.onSubmit({
			title,
			type: this.type,
			wrap: this.wrap,
			sort: this.type === 'date' || this.type === 'number' ? this.sort : 'none',
			suffix: this.type === 'number' ? this.suffix.trim() : '',
			locked: this.column?.locked,
		});
		this.close();
	}
}

function renderModalHeader(contentEl: HTMLElement, title: string): void {
	const header = contentEl.createDiv({ cls: 'fr-modal-header' });
	header.createDiv({ cls: 'fr-modal-title', text: title });
}

function renderModalActions(contentEl: HTMLElement, onCancel: () => void, onSave: () => void): void {
	const actions = contentEl.createDiv({ cls: 'fr-modal-actions' });
	const cancel = actions.createEl('button', { text: '取消' });
	cancel.addEventListener('click', onCancel);
	const save = actions.createEl('button', { text: '保存' });
	save.addEventListener('click', onSave);
}

function createId(seed: string): string {
	const base = seed.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '') || 'item';
	return `${base}-${Date.now().toString(36)}`;
}

function findActionByName(sections: FitnessSection[], name: string): FitnessAction | undefined {
	return sections.flatMap((section) => section.actions).find((action) => action.name === name);
}

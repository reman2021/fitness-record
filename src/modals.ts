import { Modal, Notice, Setting } from 'obsidian';
import { MUSCLES, type ColumnType, type FitnessAction, type FitnessColumn, type FitnessSection } from './types';

type SaveActionPayload = Pick<FitnessAction, 'name' | 'muscles' | 'description'>;

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
		renderModalHeader(contentEl, this.title, () => this.close());

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
	private selectedMuscles: Set<string>;
	private filter = '';

	constructor(
		app: ConstructorParameters<typeof Modal>[0],
		private section: FitnessSection,
		private onSubmit: (payload: SaveActionPayload) => void,
		private action?: FitnessAction,
	) {
		super(app);
		this.name = action?.name ?? '';
		this.description = action?.description ?? '';
		this.selectedMuscles = new Set(action?.muscles ?? []);
	}

	onOpen(): void {
		this.modalEl.addClass('fr-modal');
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		renderModalHeader(contentEl, this.action ? '编辑动作' : `添加动作到 ${this.section.name}`, () => this.close());

		new Setting(contentEl)
			.setName('动作名称')
			.addText((text) => {
				text.setValue(this.name).onChange((value) => {
					this.name = value;
				});
			});

		const filterRow = contentEl.createDiv({ cls: 'fr-form-row' });
		filterRow.createEl('label', { text: '锻炼肌肉' });
		const filterInput = filterRow.createEl('input', {
			attr: {
				placeholder: '输入肌肉名称进行匹配，例如：肱',
				value: this.filter,
			},
		});
		filterInput.addEventListener('input', () => {
			this.filter = filterInput.value;
			this.render();
		});

		const muscleList = contentEl.createDiv({ cls: 'fr-pill-list' });
		const matched = MUSCLES.filter((muscle) => muscle.name.includes(this.filter.trim()));
		for (const muscle of matched) {
			const active = this.selectedMuscles.has(muscle.id);
			const item = muscleList.createEl('button', {
				text: active ? `✓ ${muscle.name}` : muscle.name,
				cls: 'fr-tag fr-clickable',
			});
			item.addEventListener('click', () => {
				if (active) this.selectedMuscles.delete(muscle.id);
				else this.selectedMuscles.add(muscle.id);
				this.render();
			});
		}

		new Setting(contentEl)
			.setName('详细说明')
			.addTextArea((text) => {
				text.setValue(this.description).onChange((value) => {
					this.description = value;
				});
				text.inputEl.rows = 4;
			});

		renderModalActions(contentEl, () => this.close(), () => this.submit());
	}

	private submit(): void {
		const name = this.name.trim();
		if (!name) {
			new Notice('动作名称不能为空');
			return;
		}
		this.onSubmit({
			name,
			muscles: Array.from(this.selectedMuscles),
			description: this.description.trim(),
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
		renderModalHeader(contentEl, this.column ? '列设置' : '新增列', () => this.close());

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
			const deleteButton = actions.createEl('button', { text: '删除列' });
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

function renderModalHeader(contentEl: HTMLElement, title: string, onClose: () => void): void {
	const header = contentEl.createDiv({ cls: 'fr-modal-header' });
	header.createDiv({ cls: 'fr-modal-title', text: title });
	const closeButton = header.createEl('button', { text: '关闭' });
	closeButton.addEventListener('click', onClose);
}

function renderModalActions(contentEl: HTMLElement, onCancel: () => void, onSave: () => void): void {
	const actions = contentEl.createDiv({ cls: 'fr-modal-actions' });
	const cancel = actions.createEl('button', { text: '取消' });
	cancel.addEventListener('click', onCancel);
	const save = actions.createEl('button', { text: '保存' });
	save.addEventListener('click', onSave);
}

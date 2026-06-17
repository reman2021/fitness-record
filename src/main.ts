import { Notice, Plugin } from 'obsidian';
import { FitnessSettingTab } from './settings';
import { DEFAULT_SETTINGS, type FitnessSettings } from './types';
import { FITNESS_VIEW_TYPE, FitnessView } from './view';

export default class FitnessRecordPlugin extends Plugin {
	settings!: FitnessSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(FITNESS_VIEW_TYPE, (leaf) => new FitnessView(leaf, this));

		this.addRibbonIcon('dumbbell', '打开健身记录', () => {
			void this.openFitnessView();
		});

		this.addCommand({
			id: 'open-fitness-record',
			name: '打开健身记录',
			callback: () => {
				void this.openFitnessView();
			},
		});

		this.addCommand({
			id: 'add-workout-row',
			name: '新增健身记录行',
			callback: () => {
				const view = this.getFirstFitnessView();
				if (!view) {
					new Notice('请先打开健身记录视图');
					return;
				}
				void view.addRecord();
			},
		});

		this.addSettingTab(new FitnessSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.openOnStartup) void this.openFitnessView();
		});
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<FitnessSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...(saved ?? {}),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refreshViews();
	}

	async openFitnessView(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(FITNESS_VIEW_TYPE);
		if (leaves.length > 0) {
			this.app.workspace.setActiveLeaf(leaves[0]!, { focus: true });
			return;
		}
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: FITNESS_VIEW_TYPE, active: true });
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(FITNESS_VIEW_TYPE)) {
			if (leaf.view instanceof FitnessView) void leaf.view.refresh();
		}
	}

	private getFirstFitnessView(): FitnessView | null {
		const leaf = this.app.workspace.getLeavesOfType(FITNESS_VIEW_TYPE)[0];
		return leaf?.view instanceof FitnessView ? leaf.view : null;
	}
}

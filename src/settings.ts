import { App, PluginSettingTab, Setting } from 'obsidian';
import type FitnessRecordPlugin from './main';

export class FitnessSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: FitnessRecordPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Fitness Record 设置' });

		new Setting(containerEl)
			.setName('数据文件')
			.setDesc('用于保存健身记录数据的 Markdown 文件路径。')
			.addText((text) => {
				text.setPlaceholder('fitness-record.md')
					.setValue(this.plugin.settings.dataFile)
					.onChange(async (value) => {
						this.plugin.settings.dataFile = value.trim() || 'fitness-record.md';
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('视图标题')
			.setDesc('健身记录标签页显示名称。')
			.addText((text) => {
				text.setPlaceholder('健身记录')
					.setValue(this.plugin.settings.viewTitle)
					.onChange(async (value) => {
						this.plugin.settings.viewTitle = value.trim() || '健身记录';
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('启动时打开')
			.setDesc('打开 Vault 时自动打开健身记录视图。')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.openOnStartup)
					.onChange(async (value) => {
						this.plugin.settings.openOnStartup = value;
						await this.plugin.saveSettings();
					});
			});
	}
}

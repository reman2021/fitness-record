import { App, normalizePath, setIcon } from 'obsidian';

export const ACTION_ICON_SUBFOLDER = 'icons/actions';
export const DEFAULT_ACTION_ICON = 'dumbbell';

export const LUCIDE_ACTION_ICON_OPTIONS = [
	'dumbbell',
	'footprints',
	'bike',
	'heart-pulse',
	'timer',
	'flame',
	'target',
	'repeat',
	'activity',
	'zap',
	'trophy',
	'circle-dot',
];

const LOCAL_ICON_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];

export interface LocalActionIcon {
	id: string;
	name: string;
	path: string;
	url: string;
}

export function normalizeActionIcon(icon: string | undefined): string {
	return icon?.trim() || DEFAULT_ACTION_ICON;
}

export function getActionIconFolder(pluginDir: string | undefined, pluginId: string): string {
	return normalizePath(`${pluginDir ?? `.obsidian/plugins/${pluginId}`}/${ACTION_ICON_SUBFOLDER}`);
}

export async function loadLocalActionIcons(app: App, iconFolder: string): Promise<LocalActionIcon[]> {
	try {
		const folder = normalizePath(iconFolder);
		const exists = await app.vault.adapter.exists(folder);
		if (!exists) return [];
		const listed = await app.vault.adapter.list(folder);
		return listed.files
			.filter((path) => isLocalIconPath(path))
			.map((path) => {
				const normalized = normalizePath(path);
				const id = normalized.slice(`${folder}/`.length);
				return {
					id,
					name: stripExtension(id),
					path: normalized,
					url: app.vault.adapter.getResourcePath(normalized),
				};
			})
			.sort((left, right) => left.name.localeCompare(right.name));
	} catch (error) {
		console.error('Failed to load local action icons', error);
		return [];
	}
}

export function renderActionIcon(app: App, parent: HTMLElement, iconFolder: string, icon: string | undefined): void {
	const value = normalizeActionIcon(icon);
	parent.empty();
	if (isLocalIconValue(value)) {
		const path = localIconPath(iconFolder, value);
		const url = app.vault.adapter.getResourcePath(path);
		if (isSvgIconPath(path)) {
			const mask = parent.createSpan({ cls: 'fr-action-icon-mask' });
			mask.style.setProperty('--fr-action-icon-url', `url("${url}")`);
		} else {
			const image = parent.createEl('img', {
				cls: 'fr-action-icon-img',
				attr: {
					alt: '',
					src: url,
				},
			});
			image.addEventListener('error', () => {
				parent.empty();
				setIcon(parent, DEFAULT_ACTION_ICON);
			});
		}
		return;
	}
	setIcon(parent, value);
}

function localIconPath(iconFolder: string, icon: string): string {
	const fileName = icon.split('/').pop() ?? icon;
	return normalizePath(`${iconFolder}/${fileName}`);
}

function isLocalIconValue(icon: string): boolean {
	return isLocalIconPath(icon);
}

function isLocalIconPath(path: string): boolean {
	const lower = path.toLowerCase();
	return LOCAL_ICON_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isSvgIconPath(path: string): boolean {
	return path.toLowerCase().endsWith('.svg');
}

function stripExtension(name: string): string {
	const index = name.lastIndexOf('.');
	return index > 0 ? name.slice(0, index) : name;
}

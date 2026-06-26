export type ColumnType = 'date' | 'tag' | 'multi-tag' | 'text' | 'number' | 'link' | 'checkbox';
export type SortDirection = 'none' | 'asc' | 'desc';
export type HeatmapDays = 30 | 90 | 180 | 365 | 'all';

export const HEATMAP_DAY_OPTIONS: HeatmapDays[] = [30, 90, 180, 365, 'all'];
export const DEFAULT_HEATMAP_DAYS: HeatmapDays = 90;

export interface FitnessSettings {
	dataFile: string;
	viewTitle: string;
	openOnStartup: boolean;
}

export const DEFAULT_SETTINGS: FitnessSettings = {
	dataFile: 'fitness-record.md',
	viewTitle: '健身记录',
	openOnStartup: false,
};

export interface MuscleDefinition {
	id: string;
	name: string;
	group: 'front' | 'back' | 'both';
	svgRegionIds: {
		front?: string[];
		back?: string[];
	};
}

export interface FitnessAction {
	id: string;
	name: string;
	muscles: string[];
	description: string;
}

export interface WorkoutEntry {
	action: string;
	sets: number | null;
	reps: number | null;
	weight: number | null;
}

export interface FitnessSection {
	id: string;
	name: string;
	collapsed: boolean;
	actions: FitnessAction[];
}

export interface FitnessColumn {
	id: string;
	title: string;
	type: ColumnType;
	wrap: boolean;
	sort: SortDirection;
	suffix: string;
	locked?: boolean;
}

export type CellValue = string | number | boolean | string[] | WorkoutEntry[] | null;

export interface FitnessRecord {
	id: string;
	cells: Record<string, CellValue>;
}

export interface FitnessUiState {
	leftCollapsed: boolean;
	rightCollapsed: boolean;
	heatmapDays: HeatmapDays;
}

export interface FitnessData {
	schemaVersion: number;
	sections: FitnessSection[];
	columns: FitnessColumn[];
	records: FitnessRecord[];
	ui: FitnessUiState;
}

export const MUSCLES: MuscleDefinition[] = [
	{ id: 'pectoralis-major', name: '胸大肌', group: 'front', svgRegionIds: { front: ['front-pectoralis-major-left', 'front-pectoralis-major-right'] } },
	{ id: 'anterior-deltoid', name: '三角肌前束', group: 'front', svgRegionIds: { front: ['front-middle-deltoid-left', 'front-middle-deltoid-right'] } },
	{ id: 'middle-deltoid', name: '三角肌中束', group: 'front', svgRegionIds: { front: ['front-middle-deltoid-left', 'front-middle-deltoid-right'] } },
	{ id: 'posterior-deltoid', name: '三角肌后束', group: 'back', svgRegionIds: { back: ['back-posterior-deltoid-left', 'back-posterior-deltoid-right'] } },
	{ id: 'biceps-brachii', name: '肱二头肌', group: 'front', svgRegionIds: { front: ['front-biceps-brachii-left', 'front-biceps-brachii-right'] } },
	{ id: 'triceps-brachii', name: '肱三头肌', group: 'back', svgRegionIds: { back: ['back-triceps-brachii-left', 'back-triceps-brachii-right'] } },
	{ id: 'forearm-flexors', name: '前臂肌群', group: 'both', svgRegionIds: { front: ['front-forearm-flexors-left', 'front-forearm-flexors-right'], back: ['back-forearm-flexors-left', 'back-forearm-flexors-right'] } },
	{ id: 'rectus-abdominis', name: '腹直肌', group: 'front', svgRegionIds: { front: ['front-rectus-abdominis'] } },
	{ id: 'obliques', name: '腹斜肌', group: 'front', svgRegionIds: { front: ['front-obliques-left', 'front-obliques-right'] } },
	{ id: 'latissimus-dorsi', name: '背阔肌', group: 'back', svgRegionIds: { back: ['back-latissimus-dorsi-left', 'back-latissimus-dorsi-right'] } },
	{ id: 'trapezius', name: '斜方肌', group: 'back', svgRegionIds: { back: ['back-trapezius-left', 'back-trapezius-right'] } },
	{ id: 'erector-spinae', name: '竖脊肌', group: 'back', svgRegionIds: { back: ['back-erector-spinae'] } },
	{ id: 'quadriceps', name: '股四头肌', group: 'front', svgRegionIds: { front: ['front-quadriceps-left', 'front-quadriceps-right'] } },
	{ id: 'hamstrings', name: '腘绳肌', group: 'back', svgRegionIds: { back: ['back-hamstrings-left', 'back-hamstrings-right'] } },
	{ id: 'gluteus', name: '臀大肌', group: 'back', svgRegionIds: { back: ['back-gluteus-left', 'back-gluteus-right'] } },
	{ id: 'calves', name: '小腿三头肌', group: 'both', svgRegionIds: { front: ['front-calves-left', 'front-calves-right'], back: ['back-calves-left', 'back-calves-right'] } },
	{ id: 'cardio', name: '心肺耐力', group: 'both', svgRegionIds: {} },
];

export const DEFAULT_COLUMNS: FitnessColumn[] = [
	{ id: 'date', title: '日期', type: 'date', wrap: false, sort: 'none', suffix: '', locked: true },
	{ id: 'section', title: '板块', type: 'tag', wrap: false, sort: 'none', suffix: '', locked: true },
	{ id: 'actions', title: '动作', type: 'multi-tag', wrap: true, sort: 'none', suffix: '', locked: true },
	{ id: 'weight', title: '体重', type: 'number', wrap: false, sort: 'none', suffix: 'kg', locked: true },
	{ id: 'notes', title: '备注', type: 'text', wrap: true, sort: 'none', suffix: '', locked: true },
];

export function createDefaultData(): FitnessData {
	return {
		schemaVersion: 1,
		sections: [
			{
				id: 'chest',
				name: '胸',
				collapsed: false,
				actions: [
					{ id: 'bench-press', name: '卧推', muscles: ['pectoralis-major', 'triceps-brachii', 'anterior-deltoid'], description: '杠铃或哑铃卧推。' },
					{ id: 'push-up', name: '俯卧撑', muscles: ['pectoralis-major', 'triceps-brachii'], description: '自重胸部训练。' },
				],
			},
			{
				id: 'back',
				name: '背',
				collapsed: false,
				actions: [
					{ id: 'pull-up', name: '引体向上', muscles: ['latissimus-dorsi', 'biceps-brachii'], description: '上肢拉力训练。' },
					{ id: 'row', name: '划船', muscles: ['latissimus-dorsi', 'trapezius', 'posterior-deltoid'], description: '背部厚度训练。' },
				],
			},
			{ id: 'legs', name: '腿', collapsed: false, actions: [{ id: 'squat', name: '深蹲', muscles: ['quadriceps', 'gluteus', 'hamstrings'], description: '下肢复合动作。' }] },
			{ id: 'core', name: '核心', collapsed: false, actions: [{ id: 'plank', name: '平板支撑', muscles: ['rectus-abdominis', 'obliques'], description: '核心稳定训练。' }] },
			{ id: 'cardio-section', name: '有氧', collapsed: false, actions: [{ id: 'running', name: '跑步', muscles: ['cardio', 'calves', 'quadriceps'], description: '心肺耐力训练。' }] },
		],
		columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
		records: [],
		ui: {
			leftCollapsed: false,
			rightCollapsed: false,
			heatmapDays: DEFAULT_HEATMAP_DAYS,
		},
	};
}

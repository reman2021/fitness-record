export type ColumnType = 'date' | 'tag' | 'multi-tag' | 'text' | 'number' | 'link' | 'checkbox';
export type SortDirection = 'none' | 'asc' | 'desc';

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
}

export interface FitnessAction {
	id: string;
	name: string;
	muscles: string[];
	description: string;
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

export type CellValue = string | number | boolean | string[] | null;

export interface FitnessRecord {
	id: string;
	cells: Record<string, CellValue>;
}

export interface FitnessUiState {
	leftCollapsed: boolean;
	rightCollapsed: boolean;
}

export interface FitnessData {
	schemaVersion: number;
	sections: FitnessSection[];
	columns: FitnessColumn[];
	records: FitnessRecord[];
	ui: FitnessUiState;
}

export const MUSCLES: MuscleDefinition[] = [
	{ id: 'pectoralis-major', name: '胸大肌', group: 'front' },
	{ id: 'anterior-deltoid', name: '三角肌前束', group: 'front' },
	{ id: 'middle-deltoid', name: '三角肌中束', group: 'both' },
	{ id: 'posterior-deltoid', name: '三角肌后束', group: 'back' },
	{ id: 'biceps-brachii', name: '肱二头肌', group: 'front' },
	{ id: 'triceps-brachii', name: '肱三头肌', group: 'back' },
	{ id: 'forearm-flexors', name: '前臂肌群', group: 'both' },
	{ id: 'rectus-abdominis', name: '腹直肌', group: 'front' },
	{ id: 'obliques', name: '腹斜肌', group: 'front' },
	{ id: 'latissimus-dorsi', name: '背阔肌', group: 'back' },
	{ id: 'trapezius', name: '斜方肌', group: 'back' },
	{ id: 'erector-spinae', name: '竖脊肌', group: 'back' },
	{ id: 'quadriceps', name: '股四头肌', group: 'front' },
	{ id: 'hamstrings', name: '腘绳肌', group: 'back' },
	{ id: 'gluteus', name: '臀大肌', group: 'back' },
	{ id: 'calves', name: '小腿三头肌', group: 'both' },
	{ id: 'cardio', name: '心肺耐力', group: 'both' },
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
		},
	};
}

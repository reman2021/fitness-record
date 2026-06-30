import type { WorkoutEntry } from './types';

type RawWorkoutEntry = string | Partial<WorkoutEntry>;

export function normalizeWorkoutEntry(item: RawWorkoutEntry): WorkoutEntry {
	if (typeof item === 'string') {
		return { action: item, sets: null, reps: null, weight: null, duration: null };
	}
	return {
		action: item.action ?? '',
		sets: item.sets ?? null,
		reps: item.reps ?? null,
		weight: item.weight ?? null,
		duration: item.duration ?? null,
	};
}

export function formatWorkoutEntry(entry: WorkoutEntry): string {
	const parts: string[] = [];
	if (isVisibleTrainingValue(entry.sets)) parts.push(`${entry.sets}组`);
	if (isVisibleTrainingValue(entry.reps)) parts.push(`${entry.reps}次`);
	if (isVisibleTrainingValue(entry.weight)) parts.push(`${entry.weight}kg`);
	if (isVisibleTrainingValue(entry.duration)) parts.push(`${entry.duration}分钟`);
	return parts.length ? parts.join(' · ') : '未填写训练量';
}

export function stringifyWorkoutEntries(entries: WorkoutEntry[]): string {
	return entries.map((entry) => {
		const parts: Array<string | number> = [entry.action];
		if (isVisibleTrainingValue(entry.sets)) parts.push(entry.sets);
		if (isVisibleTrainingValue(entry.reps)) parts.push(entry.reps);
		if (isVisibleTrainingValue(entry.weight)) parts.push(entry.weight);
		if (isVisibleTrainingValue(entry.duration)) parts.push(entry.duration);
		return parts.join(' ');
	}).join(', ');
}

function isVisibleTrainingValue(value: number | null): value is number {
	return typeof value === 'number' && value > 0;
}

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatWorkoutEntry, normalizeWorkoutEntry, stringifyWorkoutEntries } from '../node_modules/.cache/fitness-record-tests/workout-entry.js';

test('formatWorkoutEntry hides zero training values and shows duration in minutes', () => {
	assert.equal(
		formatWorkoutEntry({ action: '羽毛球', sets: 0, reps: 0, weight: 0, duration: 90 }),
		'90分钟',
	);
	assert.equal(
		formatWorkoutEntry({ action: '卧推', sets: 4, reps: 10, weight: 60, duration: 0 }),
		'4组 · 10次 · 60kg',
	);
	assert.equal(
		formatWorkoutEntry({ action: '滑雪', sets: 0, reps: 0, weight: 0, duration: 0 }),
		'未填写训练量',
	);
});

test('normalizeWorkoutEntry keeps old records compatible with duration', () => {
	assert.deepEqual(
		normalizeWorkoutEntry({ action: '跑步', sets: 0, reps: 0, weight: 0 }),
		{ action: '跑步', sets: 0, reps: 0, weight: 0, duration: null },
	);
	assert.deepEqual(
		normalizeWorkoutEntry('平板支撑'),
		{ action: '平板支撑', sets: null, reps: null, weight: null, duration: null },
	);
});

test('stringifyWorkoutEntries includes non-zero duration for search', () => {
	assert.equal(
		stringifyWorkoutEntries([{ action: '羽毛球', sets: 0, reps: 0, weight: 0, duration: 90 }]),
		'羽毛球 90',
	);
});

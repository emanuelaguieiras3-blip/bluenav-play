import test from 'node:test';
import assert from 'node:assert/strict';
import { RHYTHM_TRACKS, presetChart, makeChart, detectOnsets, cutResult, importBeatmap } from '../src/games/rhythmChart.js';

test('preset charts are deterministic, sorted and use both saber colors', () => {
  for (const track of RHYTHM_TRACKS) {
    const chart = presetChart(track, 'normal');
    assert.deepEqual(chart, presetChart(track, 'normal'));
    assert.ok(chart.length > 100);
    assert.ok(chart.every((note, i) => note.at < track.duration && (!i || note.at > chart[i - 1].at)));
    assert.deepEqual([...new Set(chart.map(n => n.side))].sort(), [0, 1]);
    assert.ok(presetChart(track, 'easy').every(n => n.direction === null));
  }
});
test('Expert charts add paired cuts on the same beat', () => {
  const chart = presetChart(RHYTHM_TRACKS[1], 'expert');
  assert.ok(chart.length > presetChart(RHYTHM_TRACKS[1], 'normal').length);
  assert.ok(chart.some((n, i) => i > 0 && n.at === chart[i - 1].at && n.side !== chart[i - 1].side));
});
test('chart skips corrupt timestamps and excessively dense notes', () => {
  const chart = makeChart([NaN, -1, 0, 0.01, 0.5, Infinity, 0.7, 1]);
  assert.deepEqual(chart.map(n => n.at), [0, 0.5, 1]);
});
test('cuts require motion, correct color and indicated direction', () => {
  const cut = { side: 0, noteSide: 0, twoHands: true, motionX: 0, motionY: -0.1, speed: 2, direction: 0, timing: 0 };
  assert.ok(cutResult(cut).points > 100);
  assert.equal(cutResult({ ...cut, speed: 0 }).hit, false);
  assert.equal(cutResult({ ...cut, side: 1 }).penalty, true);
  assert.equal(cutResult({ ...cut, motionY: 0.1 }).penalty, true);
  assert.equal(cutResult({ ...cut, motionZ: 0.5 }).penalty, true);
  assert.equal(cutResult({ ...cut, side: 1, twoHands: false }).hit, true);
  assert.equal(cutResult({ ...cut, motionY: 0.1, direction: null }).hit, true);
  assert.ok(cutResult({ ...cut, timing: 0.1 }).points < 100);
  assert.equal(cutResult({ ...cut, timing: 0.2 }).penalty, undefined);
  assert.ok(cutResult({ ...cut, centerError: 0.1 }).points < cutResult(cut).points);
  assert.ok(cutResult({ ...cut, speed: 3, centerError: 0, timing: 0 }).points <= 115);
});
test('audio onset detection finds pulses and rejects silence', () => {
  const sampleRate = 8000, data = new Float32Array(sampleRate * 6);
  for (let t = 0.5; t < 5.8; t += 0.5) for (let i = 0; i < 400; i++) data[Math.round(t * sampleRate) + i] = Math.sin(i * 0.1) * 0.8 * (1 - i / 400);
  const buffer = { sampleRate, getChannelData: () => data };
  const onsets = detectOnsets(buffer);
  assert.ok(onsets.length >= 9);
  assert.ok(onsets.every((t, i) => !i || t - onsets[i - 1] >= 0.26));
  assert.deepEqual(detectOnsets({ sampleRate, getChannelData: () => new Float32Array(sampleRate) }), []);
});

test('Beat Saber v2 maps preserve beats, colors, directions, bombs and walls', () => {
  const map = { _notes: [
    { _time: 1, _lineIndex: 0, _lineLayer: 0, _type: 0, _cutDirection: 0 },
    { _time: 1, _lineIndex: 3, _lineLayer: 2, _type: 1, _cutDirection: 8 },
    { _time: 2, _lineIndex: 1, _lineLayer: 1, _type: 3 },
  ], _obstacles: [{ _time: 3, _lineIndex: 0, _width: 2, _duration: 2 }] };
  const result = importBeatmap(map, 120, 10);
  assert.deepEqual(result.chart.map(n => [n.at, n.side, n.direction]), [[0.5, 0, 1], [0.5, 1, null]]);
  assert.deepEqual(result.obstacles.map(n => [n.at, n.wall]), [[1, false], [1.5, true]]);
  assert.equal(result.obstacles[1].width, 2);
  assert.equal(result.obstacles[1].duration, 1);
});

test('Beat Saber v3 maps sort notes and reject corrupt input', () => {
  const result = importBeatmap({ colorNotes: [
    { b: 4, x: 3, y: 2, c: 1, d: 6 },
    { b: 2, x: 0, y: 0, c: 0, d: 5 },
    { b: NaN, x: 1, y: 0, c: 0, d: 0 },
  ], bombNotes: [{ b: 3, x: 2, y: 1 }], obstacles: [] }, 120, 10);
  assert.deepEqual(result.chart.map(n => [n.at, n.direction]), [[1, 7], [2, 4]]);
  assert.equal(result.obstacles[0].at, 1.5);
  assert.throws(() => importBeatmap({ colorNotes: [] }, 120, 10), /Mapa sem blocos/);
  assert.throws(() => importBeatmap({ colorNotes: [] }, NaN, 10), /BPM/);
  assert.throws(() => importBeatmap({ colorNotes: Array(5001) }, 120, 10), /notas demais/);
  assert.throws(() => importBeatmap({ colorNotes: [{ b: 1, x: 0, y: 0, c: 0, d: 0 }], bombNotes: {} }, 120, 10), /Bombas inválidas/);
  assert.throws(() => importBeatmap({ colorNotes: [{ b: 1, x: 0, y: 0, c: 0, d: 0 }], bombNotes: Array(1001) }, 120, 10), /Bombas inválidas/);
});

test('v3 BPM changes retime notes, bombs and walls across the tempo boundary', () => {
  const map = { colorNotes: [
    { b: 1, x: 0, y: 0, c: 0, d: 0 },
    { b: 3, x: 3, y: 2, c: 1, d: 1 },
  ], bombNotes: [{ b: 2.5, x: 1, y: 1 }],
  obstacles: [{ b: 1, x: 1, w: 2, d: 2 }],
  bpmEvents: [{ b: 2, m: 60 }, { b: 0, m: 120 }] };
  const result = importBeatmap(map, 100, 10);
  assert.deepEqual(result.chart.map(note => note.at), [0.5, 2]);
  assert.equal(result.obstacles[0].at, 0.5);
  assert.equal(result.obstacles[0].duration, 1.5);
  assert.equal(result.obstacles[1].at, 1.5);
  assert.throws(() => importBeatmap({ ...map, bpmEvents: [{ b: 2, m: 0 }] }, 120, 10), /BPM inválidas/);
});

test('legacy crouch and v3 free walls keep their vertical collision bounds', () => {
  const note = { _time: 1, _lineIndex: 0, _lineLayer: 0, _type: 0, _cutDirection: 0 };
  const v2 = importBeatmap({ _notes: [note], _obstacles: [
    { _time: 2, _lineIndex: 1, _width: 2, _type: 1, _duration: 1 },
  ] }, 120, 10).obstacles[0];
  assert.equal(v2.y, 1.54); assert.equal(v2.height, 1.32); assert.equal(v2.crouch, true);
  const v3 = importBeatmap({ colorNotes: [{ b: 1, x: 0, y: 0, c: 0, d: 0 }], obstacles: [
    { b: 2, x: 0, w: 1, y: 1, h: 2, d: 1 },
    { b: 3, x: 0, w: 1, y: 4, h: 2, d: 1 },
  ] }, 120, 10).obstacles;
  assert.equal(v3.length, 1);
  assert.equal(v3[0].y, 0.88); assert.equal(v3[0].height, 0.88);
});

test('v2 BPM events retime notes without changing unrelated light events', () => {
  const map = { _notes: [
    { _time: 1, _lineIndex: 0, _lineLayer: 0, _type: 0, _cutDirection: 0 },
    { _time: 3, _lineIndex: 3, _lineLayer: 0, _type: 1, _cutDirection: 1 },
  ], _events: [
    { _time: 1.5, _type: 1, _floatValue: 5 },
    { _time: 2, _type: 100, _floatValue: 60 },
  ] };
  assert.deepEqual(importBeatmap(map, 120, 10).chart.map(note => note.at), [0.5, 2]);
});

test('v4 metadata indices resolve notes, bombs and a crouch wall', () => {
  const map = { version: '4.0.0',
    colorNotes: [{ b: 1, i: 0 }, { b: 2, i: 1 }],
    colorNotesData: [{ x: 0, y: 0, c: 0, d: 0 }, { x: 3, y: 2, c: 1, d: 1 }],
    bombNotes: [{ b: 2.5, i: 0 }], bombNotesData: [{ x: 1, y: 1 }],
    obstacles: [{ b: 3, i: 0 }], obstaclesData: [{ x: 1, y: 2, w: 2, h: 3, d: 2 }],
  };
  const result = importBeatmap(map, 120, 10);
  assert.deepEqual(result.chart.map(note => [note.at, note.side, note.direction]), [[0.5, 0, 1], [1, 1, 0]]);
  assert.deepEqual(result.obstacles.map(hazard => [hazard.at, hazard.wall]), [[1.25, false], [1.5, true]]);
  assert.equal(result.obstacles[1].y, 1.54);
  assert.equal(result.obstacles[1].duration, 1);
  assert.throws(() => importBeatmap({ ...map, colorNotes: [{ b: 1, i: 9 }] }, 120, 10), /Índice v4/);
});

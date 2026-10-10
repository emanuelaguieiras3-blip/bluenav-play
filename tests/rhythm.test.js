import test from 'node:test';
import assert from 'node:assert/strict';
import { RHYTHM_TRACKS, presetChart, makeChart, detectOnsets, cutResult } from '../src/games/rhythmChart.js';

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
test('chart skips corrupt timestamps and excessively dense notes', () => {
  const chart = makeChart([NaN, -1, 0, 0.01, 0.5, Infinity, 0.7, 1]);
  assert.deepEqual(chart.map(n => n.at), [0, 0.5, 1]);
});
test('cuts require motion, correct color and indicated direction', () => {
  const cut = { side: 0, noteSide: 0, twoHands: true, motionX: 0, motionY: -0.1, speed: 2, direction: 0, timing: 0 };
  assert.equal(cutResult(cut).points, 100);
  assert.equal(cutResult({ ...cut, speed: 0 }).hit, false);
  assert.equal(cutResult({ ...cut, side: 1 }).hit, false);
  assert.equal(cutResult({ ...cut, motionY: 0.1 }).hit, false);
  assert.equal(cutResult({ ...cut, side: 1, twoHands: false }).hit, true);
  assert.equal(cutResult({ ...cut, motionY: 0.1, direction: null }).hit, true);
  assert.ok(cutResult({ ...cut, timing: 0.1 }).points < 100);
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

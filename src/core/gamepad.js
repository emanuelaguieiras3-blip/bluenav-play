// WebXR axes follow xr-standard. Bluetooth pads use the browser Gamepad API.
export function deadAxis(value, zone = 0.18) {
  if (!Number.isFinite(value) || Math.abs(value) <= zone) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - zone) / (1 - zone));
}

export function gamepadIntent(xrSources = [], pads = []) {
  let x = 0, forward = 0, turn = 0, select = false, menu = false;
  if (xrSources.length) {
    const hasLeft = xrSources.some(source => source.handedness === 'left' && source.gamepad && !source.hand);
    for (const source of xrSources) {
      const pad = source.gamepad;
      if (!pad || source.hand) continue;
      const axes = pad.axes || [], offset = axes.length >= 4 ? 2 : 0;
      if (source.handedness === 'right' && hasLeft) turn = deadAxis(axes[offset]);
      else { x = deadAxis(axes[offset]); forward = -deadAxis(axes[offset + 1]); }
    }
  } else {
    const pad = Array.from(pads).find(p => p?.connected && p.axes?.length >= 2);
    if (pad) {
      x = deadAxis(pad.axes[0]); forward = -deadAxis(pad.axes[1]); turn = deadAxis(pad.axes[2]);
      select = !!pad.buttons?.[0]?.pressed; menu = !!pad.buttons?.[9]?.pressed;
    }
  }
  const length = Math.max(1, Math.hypot(x, forward));
  return { x: x / length, forward: forward / length, turn, select, menu };
}

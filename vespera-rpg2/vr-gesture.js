// A held left-hand pinch acts like a small joystick around its starting point.
// WebXR positions use +x right and -z forward; the 2D world uses +y forward.
export function pinchMovement(anchor, wrist, deadzone = 0.045, fullSpeed = 0.2) {
  if (!anchor || !wrist) return { x: 0, y: 0 };
  const dx = wrist.x - anchor.x, dy = anchor.z - wrist.z;
  const distance = Math.hypot(dx, dy);
  if (distance <= deadzone) return { x: 0, y: 0 };
  const strength = Math.min(1, (distance - deadzone) / (fullSpeed - deadzone));
  return { x: dx / distance * strength, y: dy / distance * strength };
}

// XR-standard controllers normally put the thumbstick at axes 2/3; some
// devices expose only axes 0/1. Rotate the 2D input by the headset yaw.
export function stickMovement(axes, yaw = 0, deadzone = 0.16) {
  if (!axes?.length) return { x: 0, y: 0 };
  const pair = axes.length >= 4 && Math.hypot(axes[2] || 0, axes[3] || 0) > .01 ? 2 : 0;
  const right = Number.isFinite(axes[pair]) ? axes[pair] : 0;
  const forward = Number.isFinite(axes[pair + 1]) ? -axes[pair + 1] : 0;
  const length = Math.hypot(right, forward);
  if (length <= deadzone) return { x: 0, y: 0 };
  const strength = Math.min(1, (Math.min(1, length) - deadzone) / (1 - deadzone));
  const x = right / length * strength, y = forward / length * strength;
  return { x: x * Math.cos(yaw) - y * Math.sin(yaw), y: x * Math.sin(yaw) + y * Math.cos(yaw) };
}

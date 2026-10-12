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

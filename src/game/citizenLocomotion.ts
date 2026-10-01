const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
export type CountingRunner = { x: number; velocity: number; goal?: number };

/** The runner follows counted progress. Changing vote share cannot send it backwards. */
export function countingRunnerTarget(progress: number, share: number, average: number) {
  const position = clamp((share - Math.max(0, average - 2)) / 4);
  return 284 + 469 * Math.pow(clamp(progress / 100), .88) * (.72 + position * .28);
}

export function advanceCountingRunner(runner: CountingRunner, target: number, seconds: number, immediate = false) {
  const acceleration = 180, maxSpeed = 150;
  runner.goal = Math.max(runner.goal ?? runner.x, runner.x, target);
  if (immediate) { runner.x = runner.goal; runner.velocity = 0; return; }
  if (seconds <= 0) return;
  // Preserve enough room to stop when a live share update shortens the target.
  runner.goal = Math.max(runner.goal, runner.x + runner.velocity ** 2 / (2 * acceleration));
  let remaining = seconds;
  for (let phase = 0; phase < 6 && remaining > 1e-8; phase++) {
    const distance = Math.max(0, runner.goal - runner.x), speed = runner.velocity;
    const stoppingDistance = speed ** 2 / (2 * acceleration);
    let duration: number, nextSpeed: number;
    if (distance <= stoppingDistance + 1e-7) {
      duration = Math.min(remaining, speed / acceleration);
      if (duration <= 1e-8) break;
      nextSpeed = Math.max(0, speed - acceleration * duration);
    } else if (speed >= maxSpeed - 1e-8) {
      duration = Math.min(remaining, (distance - stoppingDistance) / speed);
      nextSpeed = speed;
    } else {
      // Split the frame at acceleration/cruise/braking boundaries so the last
      // step settles without clamping a moving figure to zero velocity.
      const untilBraking = (Math.sqrt(speed ** 2 / 2 + acceleration * distance) - speed) / acceleration;
      duration = Math.min(remaining, untilBraking, (maxSpeed - speed) / acceleration);
      nextSpeed = Math.min(maxSpeed, speed + acceleration * duration);
    }
    runner.x = Math.min(runner.goal, runner.x + (speed + nextSpeed) * duration / 2);
    runner.velocity = nextSpeed;
    remaining -= duration;
  }
}

/** A planted foot moves back exactly as far as the body moves forward. */
export function citizenStride(distance: number, index: number, running: boolean | number) {
  const activity = typeof running === 'number' ? clamp(running) : Number(running);
  const cycleLength = 24, stance = .64 - activity * .22;
  const launch = smooth(distance / 10);
  const phase = ((distance / cycleLength + index * .17) % 1 + 1) % 1;
  const feet = [0, 1].map(leg => {
    const cycle = (phase + leg * .5) % 1, planted = cycle < stance;
    const swing = clamp((cycle - stance) / (1 - stance));
    const reach = cycleLength * stance / 2;
    return { x: (planted ? reach - cycle * cycleLength : -reach + 2 * reach * smooth(swing)) * launch, y: planted ? 0 : -(Math.sin(Math.PI * swing) ** 2) * (2.5 + activity * 1.5) * launch, planted };
  });
  return { phase, feet, bounce: 3.8 - activity * .7 - Math.sin(phase * Math.PI * 2) ** 2 * (.45 + activity * .45) };
}

/** Solve the same 7px thigh and 6.5px shin used by the pixel figure. */
export function citizenLegAngles(foot: { x: number; y: number }, hip: { x: number; y: number }, lean: number, bob: number) {
  const angle = -lean * Math.PI / 180, wx = foot.x, wy = foot.y - bob;
  const local = { x: wx * Math.cos(angle) - wy * Math.sin(angle) - hip.x, y: wx * Math.sin(angle) + wy * Math.cos(angle) - hip.y };
  const a = 7, b = 6.5, length = clamp(Math.hypot(local.x, local.y), .1, a + b - .01);
  const direction = Math.atan2(local.x, local.y), bend = Math.acos(clamp((a * a + length * length - b * b) / (2 * a * length), -1, 1));
  const upper = -(direction + bend), knee = Math.acos(clamp((a * a + b * b - length * length) / (2 * a * b), -1, 1));
  return { upper: upper * 180 / Math.PI, lower: (Math.PI - knee) * 180 / Math.PI };
}

import type { Candidate } from '../election';

export type ArenaPose = 'idle' | 'guard' | 'walk' | 'run' | 'grapple' | 'brace' | 'push' | 'dodge' | 'lift' | 'throw' | 'airborne' | 'land' | 'recover' | 'cheer' | 'clap' | 'bow';
export type ArenaActor = { candidate: Candidate; index: number; x: number; y: number; scale: number; facing: number; pose: ArenaPose; angle: number; alpha: number; velocityX: number; velocityY: number; gaitDistance: number; phase: number; power?: number; rank?: number; nameVisible?: boolean };
type Point = { x: number; y: number };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

function knee(a: Point, b: Point, upper: number, lower: number, bend: number): Point {
  const dx = b.x - a.x, dy = b.y - a.y;
  const raw = Math.hypot(dx, dy);
  const length = Math.max(0.01, Math.min(upper + lower - 0.01, raw));
  const along = (upper * upper - lower * lower + length * length) / (2 * length);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const nx = dx / (raw || 1), ny = dy / (raw || 1);
  return { x: a.x + nx * along + ny * height * bend, y: a.y + ny * along - nx * height * bend };
}

function segment(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, color: string) {
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
  ctx.fillStyle = color; ctx.fillRect(-1, -width / 2, Math.hypot(b.x - a.x, b.y - a.y) + 2, width);
  ctx.fillStyle = '#70473344'; ctx.fillRect(-1, width / 2 - 1, Math.hypot(b.x - a.x, b.y - a.y) + 2, 1);
  ctx.restore();
}

/** Hip motion and feet are independent: a planted sole stays on the floor as the body passes. */
export function drawArenaFighter(ctx: CanvasRenderingContext2D, actor: ArenaActor, clock: number) {
  const { candidate, index, x, y, scale, facing, pose, phase } = actor;
  const skin = ['#e7ac81', '#c48b64', '#f2c397', '#a87151'][index % 4];
  const hair = ['#162536', '#4b362e', '#6f493e', '#2b3f49'][index % 4];
  const breath = Math.sin((clock + index * 719) / (560 + index % 3 * 90));
  const speed = Math.hypot(actor.velocityX, actor.velocityY);
  const moving = speed > 11 && !['airborne', 'land', 'recover', 'lift', 'throw', 'cheer', 'clap'].includes(pose);
  const gait = actor.gaitDistance / (scale * (pose === 'run' ? 34 : 30));
  const direction = actor.velocityX * facing < -5 ? -1 : 1;
  let crouch = 0, lean = 0, hipX = 0, armLeft = { x: 11, y: -10 }, armRight = { x: 20, y: -13 }, mouth = 1.5, headAngle = 0;
  const power = clamp(actor.power ?? 0.6);
  if (pose === 'guard' || pose === 'grapple') { crouch = 2.5; lean = 4; armLeft = { x: 17, y: -21 }; armRight = { x: 28, y: -20 }; }
  if (pose === 'brace') { crouch = 5; hipX = -2; lean = -7; armLeft = { x: 15, y: -19 }; armRight = { x: 24, y: -20 }; mouth = 1; }
  if (pose === 'push') { crouch = 2.3; hipX = 2; lean = 10 + power * 7; armLeft = { x: 20, y: -21 }; armRight = { x: 29, y: -20 }; mouth = 2; }
  if (pose === 'dodge') { crouch = 4; hipX = -4; lean = -14; armLeft = { x: 8, y: -28 }; armRight = { x: 18, y: -31 }; }
  if (pose === 'lift' || pose === 'throw') { crouch = (1 - ease(phase)) * 6; lean = mix(10, -7, ease(phase)); armLeft = { x: 16, y: mix(-12, -32, ease(phase)) }; armRight = { x: 24, y: mix(-13, -36, ease(phase)) }; mouth = 2.5; }
  if (pose === 'airborne') { crouch = 3; lean = 0; armLeft = { x: -23, y: -31 }; armRight = { x: 25, y: -33 }; mouth = 4; }
  if (pose === 'land') { crouch = 7 * Math.sin(clamp(phase) * Math.PI); lean = 14; armLeft = { x: 3, y: 3 }; armRight = { x: 20, y: 4 }; mouth = 3; }
  if (pose === 'recover') { crouch = mix(7, 0, ease(phase)); lean = mix(20, 0, ease(phase)); armLeft = { x: 5, y: mix(2, -10, ease(phase)) }; armRight = { x: 20, y: mix(1, -12, ease(phase)) }; }
  if (pose === 'cheer') { crouch = -Math.max(0, Math.sin((clock + index * 400) / 430)) * 3; armLeft = { x: -18, y: -39 }; armRight = { x: 19, y: -41 }; mouth = 3; }
  if (pose === 'clap') { const clap = (Math.sin((clock + index * 273) / 145) + 1) / 2; armLeft = { x: mix(4, 12, clap), y: -23 }; armRight = { x: mix(20, 12, clap), y: -23 }; mouth = 2; }
  if (pose === 'bow') { lean = 9 + breath * 3; headAngle = 7; armLeft = { x: -9, y: -1 }; armRight = { x: 13, y: 0 }; }
  if (moving) {
    crouch += Math.abs(Math.sin(gait * Math.PI * 2)) * (pose === 'run' ? 2 : 0.9); lean += pose === 'run' ? 7 : 1;
    if (pose === 'walk' || pose === 'run') {
      const swing = Math.cos(gait * Math.PI * 2 + index % 3 * .07);
      const reach = pose === 'run' ? 9 : 6;
      armLeft = { x: -9 - swing * reach, y: 1 - Math.abs(swing) * (pose === 'run' ? 3 : 1) };
      armRight = { x: 10 + swing * reach, y: 1 - Math.abs(swing) * (pose === 'run' ? 3 : 1) };
    }
  }
  const hip = { x: hipX + breath * 0.16, y: -20 + crouch };
  const foot = (leg: number): Point => {
    if (pose === 'airborne') return { x: leg ? 12 : -9, y: -10 + (leg ? 3 : 0) };
    if (!moving) return { x: leg ? (pose === 'brace' ? 14 : 8) : (pose === 'brace' ? -13 : -7), y: 0 };
    const cycle = (gait + leg * 0.5) % 1;
    const stride = pose === 'run' ? 11 : 9.3;
    const stance = 0.62;
    let fx: number, lift = 0;
    if (cycle < stance) fx = mix(stride, -stride, cycle / stance);
    else { const swing = (cycle - stance) / (1 - stance); fx = mix(-stride, stride, ease(swing)); lift = Math.sin(swing * Math.PI) * (pose === 'run' ? 9 : 5.5); }
    return { x: (leg ? 3 : -3) + fx * direction, y: -lift };
  };
  const backFoot = foot(0), frontFoot = foot(1);
  ctx.save(); ctx.globalAlpha = actor.alpha;
  if (pose !== 'airborne') { ctx.fillStyle = '#25302d44'; ctx.beginPath(); ctx.ellipse(x, y + 3, 19 * scale, 4 * scale, 0, 0, Math.PI * 2); ctx.fill(); }
  const airborneRotation = ['airborne', 'land', 'recover'].includes(pose);
  if (airborneRotation) {
    const pivotY = -24;
    const bodyPoint = (px: number, py: number): Point => ({ x: hip.x + Math.cos(lean * Math.PI / 180) * px - Math.sin(lean * Math.PI / 180) * py, y: hip.y + Math.sin(lean * Math.PI / 180) * px + Math.cos(lean * Math.PI / 180) * py });
    const bounds: Point[] = [
      { x: backFoot.x - 4, y: backFoot.y + 3 }, { x: backFoot.x + 7, y: backFoot.y + 3 },
      { x: frontFoot.x - 4, y: frontFoot.y + 3 }, { x: frontFoot.x + 7, y: frontFoot.y + 3 },
      bodyPoint(-11, -49), bodyPoint(11, -49), bodyPoint(-12, -24), bodyPoint(12, -24),
      bodyPoint(armLeft.x - 3, armLeft.y + 3), bodyPoint(armLeft.x + 3, armLeft.y - 3),
      bodyPoint(armRight.x - 3, armRight.y + 3), bodyPoint(armRight.x + 3, armRight.y - 3),
    ];
    const lowest = Math.max(...bounds.map(point => Math.sin(actor.angle) * point.x * facing + Math.cos(actor.angle) * (point.y - pivotY)));
    // Rotate about the torso, then place the lowest rotated limb on the trajectory.
    ctx.translate(x, y - lowest * scale); ctx.rotate(actor.angle); ctx.scale(scale * facing, scale); ctx.translate(0, -pivotY);
  } else { ctx.translate(x, y - 3 * scale); ctx.rotate(actor.angle); ctx.scale(scale * facing, scale); }
  const rect = (px: number, py: number, width: number, height: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(px, py, width, height); };
  const leg = (back: boolean) => {
    const hipPoint = { x: hip.x + (back ? -5 : 5), y: hip.y };
    const ankle = back ? backFoot : frontFoot;
    const joint = knee(hipPoint, ankle, 11, 11, 1);
    segment(ctx, hipPoint, joint, 7, back ? '#997455' : candidate.color);
    segment(ctx, joint, ankle, 6, back ? '#bb8966' : skin);
    rect(ankle.x - 4, ankle.y - 1, 11, 4, back ? '#bb8966' : skin);
    rect(ankle.x - 4, ankle.y + 2, 11, 1, '#704b36');
  };
  leg(true);
  ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(lean * Math.PI / 180);
  const arm = (back: boolean) => {
    const shoulder = { x: back ? -10 : 10, y: -21 };
    const target = back ? armLeft : armRight;
    const distance = Math.hypot(target.x - shoulder.x, target.y - shoulder.y);
    const reach = Math.min(1, 22.8 / Math.max(.01, distance));
    const hand = { x: shoulder.x + (target.x - shoulder.x) * reach, y: shoulder.y + (target.y - shoulder.y) * reach };
    const elbow = knee(shoulder, hand, 12, 11, back ? -1 : 1);
    segment(ctx, shoulder, elbow, 6, back ? '#bc8865' : skin); segment(ctx, elbow, hand, 5, back ? '#bc8865' : skin);
    rect(hand.x - 3, hand.y - 2, 6, 5, skin);
  };
  arm(true);
  rect(-10, -24, 20, 24, skin); rect(6, -22, 4, 21, '#875b4044');
  rect(-11, -5, 22, 6, candidate.color); rect(-10, 1, 20, 5, candidate.color); rect(-2, -5, 4, 11, '#fff0cf');
  rect(-3, -30, 6, 8, skin);
  ctx.save(); ctx.translate(0, -36); ctx.rotate(headAngle * Math.PI / 180);
  rect(-8, -9, 16, 18, skin); rect(-10, -5, 2, 7, skin); rect(8, -5, 2, 7, skin);
  rect(-9, -12, 18, 7, hair); rect(-9, -7, 3, 7, hair); rect(6, -7, 3, 5, hair);
  rect(-4, -1, 2, pose === 'airborne' ? 3 : 2, '#172b37'); rect(3, -1, 2, pose === 'airborne' ? 3 : 2, '#172b37');
  rect(-5, -4, 4, 1, hair); rect(2, -4, 4, 1, hair); rect(-1, 4, 3, mouth, '#985243');
  ctx.restore(); arm(false); ctx.restore(); leg(false);
  ctx.restore();
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const text = actor.rank ? `${actor.rank}위` : actor.nameVisible === false ? String(index + 1) : candidate.name;
  ctx.font = `800 ${actor.rank ? 13 : actor.nameVisible === false ? 12 : 14}px "Malgun Gothic", sans-serif`;
  ctx.fillStyle = actor.rank ? '#f7d697' : '#fff1d6';
  if (actor.nameVisible === false) { ctx.fillStyle = '#18343de0'; ctx.fillRect(x - 11, y + 7, 22, 18); ctx.fillStyle = candidate.color; }
  ctx.fillText(text, x, y + 9, actor.rank ? 110 : actor.nameVisible === false ? 20 : 148);
  ctx.restore();
}

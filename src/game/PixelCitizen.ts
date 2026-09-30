import Phaser from 'phaser';

export type Pose = 'idle' | 'walk' | 'run' | 'wave' | 'vote' | 'cheer' | 'nervous' | 'surprised' | 'bow';
const skinColors = [0xf2c09b, 0xd9a078, 0xf6d2b1, 0xb98062];
const hairColors = [0x1b2337, 0x553a34, 0xa96940, 0x35425b];
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
type Limb = { upper: Phaser.GameObjects.Container; lower: Phaser.GameObjects.Container };
type Motion = { y: number; angle: number; head: number; sx: number; sy: number; la: number; ra: number; le: number; re: number; ll: number; rl: number; lk: number; rk: number; mouth: number; brows: number };

/** Separate joints and overlapping motion give each small silhouette weight and personality. */
export class PixelCitizen {
  readonly root: Phaser.GameObjects.Container;
  pose: Pose = 'idle';
  gestureProgress = 0;
  private figure: Phaser.GameObjects.Container;
  private head: Phaser.GameObjects.Container;
  private leftArm: Limb;
  private rightArm: Limb;
  private leftLeg: Limb;
  private rightLeg: Limb;
  private eyes: Phaser.GameObjects.Rectangle[];
  private brows: Phaser.GameObjects.Rectangle[];
  private mouth: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private offset: number;
  private tempo: number;
  private personality: number;
  private lastTime = 0;
  private lastPose: Pose = 'idle';
  private poseStart = 0;
  private motion: Motion = { y: 0, angle: 0, head: 0, sx: 1, sy: 1, la: 3, ra: -3, le: 0, re: 0, ll: 0, rl: 0, lk: 0, rk: 0, mouth: 1, brows: 0 };

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, scale: number, color: number, index: number) {
    this.root = scene.add.container(x, y).setScale(scale);
    parent.add(this.root);
    this.shadow = scene.add.ellipse(0, 1, 27, 5, 0x0d1830, 0.26);
    this.figure = scene.add.container(0, 0);
    this.root.add([this.shadow, this.figure]);
    this.offset = index * 593 + (index % 3) * 137;
    this.tempo = 0.87 + (index * 7 % 11) * 0.025;
    this.personality = index % 4;
    const skin = skinColors[index % 4];
    const hair = hairColors[index % 4];
    const rect = (part: Phaser.GameObjects.Container, px: number, py: number, w: number, h: number, fill: number) => {
      const item = scene.add.rectangle(px, py, w, h, fill).setOrigin(0, 0);
      part.add(item);
      return item;
    };
    const makeLeg = (px: number): Limb => {
      const upper = scene.add.container(px, -14);
      const lower = scene.add.container(0, 7);
      rect(upper, -2, 0, 5, 8, 0x3b4c6e);
      // Overlap the knee pivot so bending cannot expose a gap between the two segments.
      rect(lower, -2, -2, 5, 4, 0x334160);
      rect(lower, -2, 0, 5, 6, 0x334160);
      rect(lower, -3, 5, 8, 3, 0x162039);
      rect(lower, -2, 5, 6, 1, 0x667188);
      upper.add(lower);
      this.figure.add(upper);
      return { upper, lower };
    };
    this.leftLeg = makeLeg(-5);
    this.rightLeg = makeLeg(4);
    const makeArm = (px: number): Limb => {
      const upper = scene.add.container(px, -28);
      const lower = scene.add.container(0, 7);
      rect(upper, -3, -2, 6, 5, color);
      rect(upper, -2, 0, 5, 8, color);
      rect(lower, -2, -2, 5, 4, color);
      rect(lower, -2, 0, 5, 5, color);
      rect(lower, -2, 4, 5, 5, skin);
      rect(lower, -2, 5, 1, 3, Phaser.Display.Color.IntegerToColor(skin).darken(12).color);
      upper.add(lower);
      this.figure.add(upper);
      return { upper, lower };
    };
    this.leftArm = makeArm(-9);
    this.rightArm = makeArm(9);
    // The chin ends at -31 and the shirt begins at -30; the neck bridges both during head turns.
    rect(this.figure, -3, -35, 6, 7, skin);
    rect(this.figure, 2, -34, 1, 6, Phaser.Display.Color.IntegerToColor(skin).darken(12).color);
    rect(this.figure, -8, -30, 16, 18, color);
    rect(this.figure, -6, -29, 12, 2, Phaser.Display.Color.IntegerToColor(color).lighten(15).color);
    rect(this.figure, 5, -27, 3, 14, Phaser.Display.Color.IntegerToColor(color).darken(10).color);
    rect(this.figure, -2, -29, 4, 3, 0xf8edcb);
    rect(this.figure, -1, -25, 2, 9, 0x233351);
    rect(this.figure, -8, -14, 16, 2, 0x26344e);
    this.head = scene.add.container(0, -38);
    this.figure.add(this.head);
    rect(this.head, -7, -8, 14, 15, skin);
    rect(this.head, -9, -3, 2, 6, skin);
    rect(this.head, 7, -3, 2, 6, skin);
    rect(this.head, -8, -12, 16, 6, hair);
    rect(this.head, -8, -7, 3, 7, hair);
    rect(this.head, 6, -7, 2, 5, hair);
    if (index % 2 === 0) rect(this.head, -4, -8, 8, 2, hair);
    if (index % 5 === 2) rect(this.head, -6, -13, 5, 2, hair);
    // Preserve the resting pixel bounds while scaling and rotating around each feature's center.
    this.eyes = [rect(this.head, -3, 0, 2, 2, 0x182137).setOrigin(0.5), rect(this.head, 4, 0, 2, 2, 0x182137).setOrigin(0.5)];
    this.brows = [rect(this.head, -3, -3.5, 4, 1, hair).setOrigin(0.5), rect(this.head, 4, -3.5, 4, 1, hair).setOrigin(0.5)];
    this.mouth = rect(this.head, 0.5, 4.5, 3, 1, 0x9d594e).setOrigin(0.5);
    if (index % 3 === 1) {
      rect(this.head, -6, -3, 6, 1, 0x26334c);
      rect(this.head, 1, -3, 6, 1, 0x26334c);
      rect(this.head, -6, 2, 6, 1, 0x26334c);
      rect(this.head, 1, 2, 6, 1, 0x26334c);
      [-6, -1, 1, 6].forEach(x => rect(this.head, x, -2, 1, 4, 0x26334c));
      rect(this.head, -1, -1, 3, 1, 0x26334c);
      rect(this.head, -8, -2, 2, 1, 0x26334c);
      rect(this.head, 7, -2, 2, 1, 0x26334c);
    }
  }

  update(time: number, reduced = false) {
    if (!this.root.active) return;
    const delta = Math.min(50, Math.max(1, this.lastTime ? time - this.lastTime : 16));
    this.lastTime = time;
    if (this.lastPose !== this.pose) { this.lastPose = this.pose; this.poseStart = time; }
    const clock = time * this.tempo + this.offset;
    const stride = clock / 145;
    const breath = Math.sin(clock / 540);
    const p = this.personality;
    const target: Motion = { y: breath * 0.4, angle: Math.sin(clock / 1100) * 0.6, head: Math.sin(clock / 730) * 1.5, sx: 1, sy: 1, la: 4 + breath * 2, ra: -4 - breath * 2, le: 3, re: -3, ll: 0, rl: 0, lk: 0, rk: 0, mouth: 1, brows: 0 };
    if (this.pose === 'walk' || this.pose === 'run') {
      const running = this.pose === 'run';
      const swing = Math.sin(stride * (running ? 1.35 : 1));
      target.ll = swing * (running ? 42 : 24); target.rl = -target.ll;
      target.lk = Math.max(0, -swing) * (running ? 62 : 30); target.rk = Math.max(0, swing) * (running ? 62 : 30);
      target.la = -swing * (running ? 48 : 25); target.ra = -target.la;
      target.le = running ? -58 : -12 - Math.max(0, swing) * 12;
      target.re = running ? 58 : 12 + Math.max(0, -swing) * 12;
      target.y = -Math.abs(swing) * (running ? 3.3 : 1.5);
      target.angle = running ? 8 : 2 + swing * 1.2;
      target.head = -target.angle * 0.65 + Math.sin(stride - 0.7) * 1.5;
      target.sx = 1 + Math.abs(swing) * 0.012; target.sy = 1 - Math.abs(swing) * 0.012;
    } else if (this.pose === 'wave') {
      const wave = Math.sin(clock / (185 + p * 22));
      if (p !== 3) { target.ra = -117 - p * 6 + wave * 9; target.re = -24 + wave * 21; }
      else { target.la = 123 + wave * 9; target.le = 24 - wave * 21; }
      target.head = Math.sin(clock / (410 + p * 75)) * (p === 1 ? 5 : 2.5);
      target.angle = p !== 3 ? 1.5 : -1.5;
      target.mouth = 1.6 + Math.max(0, Math.sin(clock / 450)) * 0.7; target.brows = -0.5;
    } else if (this.pose === 'vote') {
      const progress = clamp(this.gestureProgress);
      const reach = smooth(progress / 0.5); const release = smooth((progress - 0.55) / 0.4);
      target.ra = 8 - reach * 92 + release * 18; target.re = -22 + reach * 22 - release * 15;
      target.la = 8; target.le = -23; target.head = 4 + reach * 6;
      target.angle = reach * 5 - release * 3; target.y = reach * 0.65;
    } else if (this.pose === 'cheer') {
      const period = 1600 + p * 145; const cycle = (clock % period) / period;
      const load = cycle < 0.18 ? Math.sin(cycle / 0.18 * Math.PI) : 0;
      const flight = cycle > 0.18 && cycle < 0.65 ? Math.sin((cycle - 0.18) / 0.47 * Math.PI) : 0;
      const land = cycle >= 0.65 && cycle < 0.8 ? Math.sin((cycle - 0.65) / 0.15 * Math.PI) : 0;
      target.y = load * 1.7 - flight * (p === 1 ? 3.8 : 6.2) + land * 1.2;
      target.sy = 1 - load * 0.05 + flight * 0.025 - land * 0.045; target.sx = 1 + load * 0.025 - flight * 0.015 + land * 0.025;
      target.lk = target.rk = (load + land) * 16;
      target.la = p === 1 ? 45 : 142 + Math.sin(clock / 230) * 9;
      target.ra = p === 2 ? -58 : -142 - Math.sin(clock / 260) * 9;
      target.le = p === 1 ? -60 : 12 + Math.sin(clock / 210) * 14;
      target.re = p === 2 ? 65 : -12 - Math.sin(clock / 235) * 14;
      target.head = Math.sin(clock / 370) * 3 - flight * 3; target.angle = Math.sin(clock / 475) * 1.8;
      target.mouth = 2.7; target.brows = -0.8;
    } else if (this.pose === 'nervous') {
      target.la = 22 + p * 3; target.le = -38;
      target.ra = -31 + Math.sin(clock / (340 + p * 45)) * 4; target.re = 57 + Math.sin(clock / 430) * 7;
      target.head = 2 + Math.sin(clock / (580 + p * 105)) * 3; target.angle = -1.5;
      target.brows = 0.75; target.mouth = 0.7;
    } else if (this.pose === 'surprised') {
      const reaction = 1 - smooth((time - this.poseStart) / 700);
      target.y = -reaction * 1.5; target.angle = -7 * reaction; target.head = -7;
      target.la = 70; target.ra = -85; target.le = -38; target.re = 38;
      target.mouth = 3.5; target.brows = -1.5;
    } else if (this.pose === 'bow') {
      const bow = Math.sin(clamp((time - this.poseStart) / 640) * Math.PI);
      target.angle = bow * 17; target.head = bow * 14; target.la = 10; target.ra = -12; target.y = bow * 2;
    }
    if (reduced) {
      target.y = 0; target.angle = 0; target.head = 0; target.sx = 1; target.sy = 1;
      target.ll = 0; target.rl = 0; target.lk = 0; target.rk = 0;
      target.la = this.pose === 'cheer' ? 140 : 4; target.ra = this.pose === 'cheer' ? -140 : -4;
      target.le = 0; target.re = 0;
      target.mouth = this.pose === 'cheer' ? 2.7 : 1; target.brows = 0;
    }
    const blend = reduced ? 1 : 1 - Math.exp(-delta / (this.pose === 'run' ? 38 : 65));
    (Object.keys(target) as (keyof Motion)[]).forEach(key => { this.motion[key] += (target[key] - this.motion[key]) * blend; });
    const m = this.motion;
    this.figure.setY(m.y).setAngle(m.angle).setScale(m.sx, m.sy); this.head.setAngle(m.head);
    this.leftArm.upper.setAngle(m.la); this.rightArm.upper.setAngle(m.ra);
    this.leftArm.lower.setAngle(m.le); this.rightArm.lower.setAngle(m.re);
    this.leftLeg.upper.setAngle(m.ll); this.rightLeg.upper.setAngle(m.rl);
    this.leftLeg.lower.setAngle(m.lk); this.rightLeg.lower.setAngle(m.rk);
    this.mouth.setScale(1, m.mouth);
    this.brows.forEach((brow, index) => { brow.y = -3.5 + m.brows; brow.angle = this.pose === 'nervous' ? (index ? -8 : 8) : 0; });
    const blinkAt = clock % (3100 + p * 470); const blink = reduced || blinkAt < 2950 + p * 470 ? 1 : 0.12;
    this.eyes.forEach(eye => { eye.scaleY += (blink - eye.scaleY) * Math.min(1, delta / 24); });
    this.shadow.setScale(1 + m.y * 0.025, 1).setAlpha(0.26 + m.y * 0.009);
  }
}

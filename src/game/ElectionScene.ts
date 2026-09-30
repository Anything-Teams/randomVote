import Phaser from 'phaser';
import type { Candidate } from '../election';
import type { ShowPhase } from '../show';
import { PixelCitizen } from './PixelCitizen';

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;
export type StageState = {
  phase: ShowPhase;
  candidates: Candidate[];
  winnerId: string;
  percentages: Record<string, number>;
  finalPercentages: Record<string, number>;
  progress: number;
  totalVotes: number;
  topic: string;
  preview: boolean;
  reducedMotion: boolean;
};
type Voter = { citizen: PixelCitizen; ballot: Phaser.GameObjects.Rectangle; offset: number; duration: number; lastDrop: number };
type RaceSlot = { candidate: Candidate; panel: Phaser.GameObjects.Container; citizen: PixelCitizen; percentage: Phaser.GameObjects.Text; badge: Phaser.GameObjects.Text; position: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Rectangle; frame: Phaser.GameObjects.Rectangle; displayed: number; rank: number; reactedAt: number; rising: boolean };
type Confetti = { rectangle: Phaser.GameObjects.Rectangle; speed: number; drift: number };
type Spark = { rectangle: Phaser.GameObjects.Rectangle; vx: number; vy: number; age: number; life: number; gravity: number };
const ink = 0x14223b;
const gold = 0xfbd975;
const paper = 0xf5eedc;
const colorOf = (candidate: Candidate) => Phaser.Display.Color.HexStringToColor(candidate.color).color;
const format = new Intl.NumberFormat('ko-KR');

export class ElectionScene extends Phaser.Scene {
  private readState: () => StageState;
  private currentPhase: ShowPhase | null = null;
  private root!: Phaser.GameObjects.Container;
  private phaseStart = 0;
  private citizens: PixelCitizen[] = [];
  private voters: Voter[] = [];
  private race: RaceSlot[] = [];
  private confetti: Confetti[] = [];
  private paperHeadline?: Phaser.GameObjects.Text;
  private voteCounter?: Phaser.GameObjects.Text;
  private marginText?: Phaser.GameObjects.Text;
  private raceBars: Phaser.GameObjects.Rectangle[] = [];
  private leaderId = '';
  private winner?: PixelCitizen;
  private rings: Phaser.GameObjects.Arc[] = [];
  private sparks: Spark[] = [];
  private previewSignature = '';
  private countdownLabel?: Phaser.GameObjects.Text;
  private studioPulse?: Phaser.GameObjects.Rectangle;
  private ballotBox?: Phaser.GameObjects.Container;
  private lastFirework = -1;
  private lastBoxImpact = 0;
  private screenWindows: Phaser.GameObjects.Rectangle[] = [];

  constructor(readState: () => StageState) {
    super('election-show');
    this.readState = readState;
  }

  create() { this.switchPhase(this.readState().phase, true); }

  private rect(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, color: number, alpha = 1) {
    const rectangle = this.add.rectangle(x, y, w, h, color, alpha).setOrigin(0, 0);
    parent.add(rectangle);
    return rectangle;
  }

  private text(parent: Phaser.GameObjects.Container, value: string, x: number, y: number, size = 26, color = '#fff7e7', center = false) {
    const label = this.add.text(x, y, value, { fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color });
    if (center) label.setOrigin(0.5, 0);
    parent.add(label);
    return label;
  }

  private citizen(parent: Phaser.GameObjects.Container, candidate: Candidate, index: number, x: number, y: number, scale: number) {
    const citizen = new PixelCitizen(this, parent, x, y, scale, colorOf(candidate), index);
    this.citizens.push(citizen);
    return citizen;
  }

  private background(color: number) {
    this.rect(this.root, 0, 0, STAGE_WIDTH, STAGE_HEIGHT, color);
    for (let y = 20; y < 720; y += 32) for (let x = 20; x < 1280; x += 32) this.rect(this.root, x, y, 2, 2, 0xffffff, 0.05);
  }

  private burst(x: number, y: number, color: number, count = 24, gravity = 120) {
    if (this.readState().reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.phaseStart / 1700;
      const speed = 90 + (i * 47 % 170);
      const rectangle = this.add.rectangle(x, y, 3 + i % 3, 3 + i % 2, i % 5 ? color : paper).setDepth(200);
      this.root.add(rectangle);
      this.sparks.push({ rectangle, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 720 + i % 5 * 95, gravity });
    }
  }

  private destroyPhase(container: Phaser.GameObjects.Container) {
    const kill = (object: Phaser.GameObjects.GameObject) => {
      this.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach(kill);
    };
    kill(container);
    container.destroy(true);
  }

  private switchPhase(phase: ShowPhase, first = false) {
    const state = this.readState();
    const old = this.root;
    this.currentPhase = phase;
    this.phaseStart = this.time.now;
    this.citizens = [];
    this.voters = [];
    this.race = [];
    this.confetti = [];
    this.rings = [];
    this.sparks = [];
    this.paperHeadline = undefined;
    this.voteCounter = undefined;
    this.marginText = undefined;
    this.raceBars = [];
    this.winner = undefined;
    this.countdownLabel = undefined;
    this.studioPulse = undefined;
    this.ballotBox = undefined;
    this.lastFirework = -1;
    this.lastBoxImpact = 0;
    this.screenWindows = [];
    this.leaderId = '';
    this.root = this.add.container(0, 0);
    if (phase === 'declaration') this.newspaper(state);
    if (phase === 'voting') this.pollingStation(state);
    if (phase === 'counting') this.countingStudio(state);
    if (phase === 'winner') this.victory(state);
    if (old) {
      if (state.reducedMotion || state.preview) this.destroyPhase(old);
      else this.tweens.add({ targets: old, x: -110, alpha: 0, duration: 550, ease: 'Cubic.in', onComplete: () => {
        this.destroyPhase(old);
      } });
    }
    if (!first && !state.reducedMotion) {
      this.root.setX(150).setAlpha(0);
      this.tweens.add({ targets: this.root, x: 0, alpha: 1, duration: 680, ease: 'Cubic.out' });
    }
    this.cameras.main.centerOn(640, 360);
    if (state.reducedMotion || state.preview) this.cameras.main.setZoom(1);
    else this.cameras.main.zoomTo(1, 500, Phaser.Math.Easing.Sine.InOut, true);
    this.previewSignature = this.signature(state);
  }

  private signature(state: StageState) { return `${state.topic}|${state.candidates.map(candidate => `${candidate.id}:${candidate.name}:${candidate.color}`).join('|')}`; }

  private newspaper(state: StageState) {
    this.background(0x263b49);
    for (let i = 0; i < 5; i++) {
      const sheet = this.add.rectangle(640 + (i - 2) * 15, 362 + i * 8, 1100, 565, i % 2 ? 0x8b9b92 : 0xc3c8b9).setAngle((i - 2) * 3);
      this.root.add(sheet);
    }
    const news = this.add.container(640, 345);
    this.root.add(news);
    this.rect(news, -560, -275, 1120, 570, paper);
    this.rect(news, -560, -275, 1120, 570, 0x7e6950, 0.035);
    this.rect(news, -530, -185, 1060, 5, ink);
    this.rect(news, -530, -171, 1060, 1, ink);
    this.text(news, 'THE PIXEL DAILY', -524, -252, 15, '#5d625b');
    this.text(news, '픽 셀 일 보', 0, -255, 55, '#162838', true);
    this.text(news, '특별판 / 제 001호', 524, -247, 15, '#5d625b').setOrigin(1, 0);
    this.text(news, '호외', -505, -151, 26, '#d64e3c');
    this.paperHeadline = this.text(news, state.topic || '오늘의 당선자를 뽑습니다', 10, -151, state.topic.length > 30 ? 23 : 37, '#17293b', true).setWordWrapWidth(870);
    const columns = state.candidates.length > 4 ? 5 : 4;
    const hasTwoRows = state.candidates.length > columns;
    const cardWidth = columns === 5 ? 198 : 238;
    const pitch = columns === 5 ? 211 : 262;
    state.candidates.forEach((candidate, index) => {
      const row = Math.floor(index / columns);
      const count = Math.min(columns, state.candidates.length - row * columns);
      const x = ((index % columns) - (count - 1) / 2) * pitch;
      const y = hasTwoRows ? -74 + row * 159 : -56;
      const card = this.add.container(x, y);
      news.add(card);
      const height = hasTwoRows ? 148 : 274;
      this.rect(card, -cardWidth / 2, 0, cardWidth, height, 0xdedfcf);
      this.rect(card, -cardWidth / 2 + 4, 4, cardWidth - 8, height - 37, 0x263b49);
      for (let line = 0; line < 5; line++) this.rect(card, -cardWidth / 2 + 7, 18 + line * 19, cardWidth - 14, 1, 0xffffff, 0.05);
      const avatar = this.citizen(card, candidate, index, 0, height - 39, hasTwoRows ? 2.05 : 4.05);
      avatar.pose = 'wave';
      this.rect(card, -cardWidth / 2 + 4, height - 33, cardWidth - 8, 30, colorOf(candidate));
      this.text(card, `기호 ${index + 1}`, -cardWidth / 2 + 16, 8, 13, '#fbd975');
      this.text(card, candidate.name, 0, height - 29, candidate.name.length > 9 ? 14 : 19, '#14223b', true).setWordWrapWidth(cardWidth - 12);
      if (!state.preview && !state.reducedMotion) {
        card.setAlpha(0).setScale(0.82).setY(y + 32);
        this.tweens.add({ targets: card, y, scaleX: 1, scaleY: 1, alpha: 1, delay: 480 + index * 280, duration: 640, ease: 'Back.out' });
      }
    });
    if (!state.candidates.length) {
      const invitation = this.add.container(0, 44);
      news.add(invitation);
      this.rect(invitation, -196, -113, 392, 188, 0xddd9c7).setStrokeStyle(2, 0xb0ad9f);
      this.rect(invitation, -170, -90, 340, 144, paper);
      this.rect(invitation, -145, -66, 196, 8, 0xaeb5aa);
      this.rect(invitation, -145, -40, 222, 6, 0xc5c8b8);
      this.rect(invitation, -145, -14, 153, 6, 0xc5c8b8);
      this.rect(invitation, 83, -49, 47, 47, 0x59a99e).setStrokeStyle(3, 0x397d76);
      this.text(invitation, '✓', 106, -49, 42, '#f5eedc', true);
      this.text(news, '당신의 후보를 기다립니다', 0, 153, 30, '#17293b', true);
      this.text(news, '이름을 입력하면 특별판이 완성됩니다', 0, 197, 18, '#647264', true);
    }
    this.rect(news, -530, 244, 1060, 2, ink);
    this.text(news, '사소한 결정, 전례 없는 선거전으로 번지다', -520, 255, 20, '#334536');
    this.text(news, '전국 투표 / 특별 취재팀', 520, 260, 14, '#536154').setOrigin(1, 0);
    const stamp = this.add.container(456, 273).setAngle(-11).setScale(0.65);
    news.add(stamp);
    this.rect(stamp, -115, -27, 230, 66, 0xc54935, 0.12).setStrokeStyle(5, 0xc54935);
    this.text(stamp, state.candidates.length ? '출 마 완 료' : '후 보 모 집', 0, -18, 30, '#c54935', true);
    if (!state.preview && !state.reducedMotion) {
      news.setAngle(-13).setScale(0.42).setAlpha(0).setY(388);
      this.tweens.add({ targets: news, y: 345, angle: 0, scaleX: 1, scaleY: 1, alpha: 1, duration: 1050, ease: 'Back.out' });
      stamp.setAlpha(0).setScale(2.4);
      this.tweens.add({ targets: stamp, alpha: 1, scaleX: 0.65, scaleY: 0.65, delay: 4400, duration: 330, ease: 'Cubic.in', onComplete: () => this.burst(1075, 611, 0xc54935, 14, 50) });
    }
  }

  private pollingStation(state: StageState) {
    this.background(0x8ec7d1);
    for (let i = 0; i < 3; i++) {
      const cloud = this.add.container(250 + i * 340, 38 + i % 2 * 26);
      this.root.add(cloud);
      this.rect(cloud, 0, 12, 92, 12, 0xd6e7dc, 0.55);
      this.rect(cloud, 16, 0, 43, 12, 0xd6e7dc, 0.55);
      if (!state.reducedMotion) this.tweens.add({ targets: cloud, x: cloud.x + 38, duration: 7000, ease: 'Sine.inOut' });
    }
    for (let i = 0; i < 8; i++) {
      const buildingHeight = 95 + (i * 41) % 140;
      this.rect(this.root, i * 175, 310 - buildingHeight, 146, buildingHeight, i % 2 ? 0x7da7af : 0x6b9ba7);
      for (let j = 0; j < 5; j++) this.rect(this.root, i * 175 + 17 + (j % 3) * 40, 223 - Math.floor(j / 3) * 40, 15, 24, 0xdce9d5, 0.65);
    }
    this.rect(this.root, 0, 314, 1280, 406, 0x557d7d);
    this.rect(this.root, 0, 492, 1280, 228, 0x345662);
    this.rect(this.root, 0, 580, 1280, 9, 0xd4cdaa);
    for (let i = 0; i < 15; i++) this.rect(this.root, i * 100, 644, 53, 6, 0x9eb9ad);
    this.rect(this.root, 844, 220, 339, 302, paper);
    this.rect(this.root, 827, 202, 373, 34, gold);
    this.rect(this.root, 865, 270, 296, 238, 0x284652);
    this.rect(this.root, 920, 287, 90, 203, 0x182e40);
    this.rect(this.root, 1028, 287, 90, 203, 0x182e40);
    this.text(this.root, 'PIXEL  투표소', 1014, 234, 26, '#253d41', true);
    this.ballotBox = this.add.container(730, 545);
    this.root.add(this.ballotBox);
    this.rect(this.ballotBox, -64, -110, 127, 110, gold);
    this.rect(this.ballotBox, 50, -110, 13, 110, 0xd4b458);
    this.rect(this.ballotBox, -49, -115, 96, 12, ink);
    this.text(this.ballotBox, '투표함', 0, -78, 29, '#253d41', true);
    this.rect(this.root, 105, 88, 579, 215, ink, 0.94);
    this.text(this.root, '전국 투표 현황', 142, 116, 24, '#a7cbd1');
    this.voteCounter = this.text(this.root, '0', 144, 154, 66, '#fbd975');
    this.text(this.root, '운명의 한 표가 모이고 있습니다', 145, 243, 19, '#d1e3df');
    for (let i = 0; i < 16; i++) {
      const candidate = state.candidates[i % state.candidates.length];
      const citizen = this.citizen(this.root, candidate, i + 5, -100, 550, 2.1 + (i % 2) * 0.35);
      const ballot = this.add.rectangle(0, 0, 19, 26, paper).setStrokeStyle(2, ink).setVisible(false);
      this.root.add(ballot);
      this.voters.push({ citizen, ballot, offset: i * 347, duration: 4650 + i % 5 * 173, lastDrop: -1 });
    }
    for (let i = 0; i < 4; i++) {
      const flag = this.rect(this.root, 806 + i * 117, 176, 52, 30, i % 2 ? 0xff7957 : gold);
      this.rect(this.root, 804 + i * 117, 176, 4, 90, ink);
      if (!state.reducedMotion) this.tweens.add({ targets: flag, scaleX: 0.72, duration: 580, yoyo: true, repeat: -1, delay: i * 150, ease: 'Sine.inOut' });
    }
  }

  private countingStudio(state: StageState) {
    this.background(0x10182d);
    for (let i = 0; i < 12; i++) {
      this.rect(this.root, i * 114, 108, 94, 432, 0x1d2c48);
      for (let j = 0; j < 8; j++) this.screenWindows.push(this.rect(this.root, i * 114 + 18, 130 + j * 48, 60, 16, j % 3 ? 0x38536b : 0x437c86, 0.3));
    }
    const floor = this.add.graphics();
    floor.lineStyle(1, 0x466a89, 0.19);
    for (let i = 0; i < 9; i++) floor.lineBetween(640, 455, i * 160, 720);
    [572, 598, 641, 700].forEach(y => floor.lineBetween(0, y, 1280, y));
    this.root.add(floor);
    const rim = this.add.graphics();
    rim.fillStyle(0x71c9cc, 0.045);
    rim.fillTriangle(40, 720, 177, 70, 455, 70);
    rim.fillTriangle(1240, 720, 825, 70, 1103, 70);
    this.root.add(rim);
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(640, 330, 70 + i * 50).setStrokeStyle(2, 0x58b6b1, 0.23);
      this.root.add(ring);
      this.rings.push(ring);
    }
    this.text(this.root, '전 국 개 표 특 별 방 송', 640, 38, 26, '#d7e6e9', true);
    this.countdownLabel = this.text(this.root, '첫 투표함이 열립니다', 68, 82, 20, '#b2d7d8');
    this.marginText = this.text(this.root, '선두 격차 0.0%p', 1212, 82, 20, '#fbd975').setOrigin(1, 0);
    const compact = state.candidates.length > 5;
    state.candidates.forEach((candidate, index) => {
      const { x, y, width, height } = this.racePosition(index, state.candidates.length);
      const panel = this.add.container(x, y);
      this.root.add(panel);
      const frame = this.rect(panel, -width / 2, 0, width, height, 0x1b2c48).setStrokeStyle(2, 0x39516c);
      const glow = this.rect(panel, -width / 2, 0, width, height, colorOf(candidate), 0.04);
      this.rect(panel, -width / 2, 0, width, 5, colorOf(candidate));
      const position = this.text(panel, `${index + 1}위`, -width / 2 + 13, 14, compact ? 16 : 21, '#bed0df');
      const badge = this.text(panel, '개표 중', width / 2 - 12, 16, compact ? 13 : 17, '#cad9e9').setOrigin(1, 0);
      const citizen = this.citizen(panel, candidate, index, 0, compact ? 146 : 286, compact ? 2.15 : 4.45);
      citizen.pose = index % 3 === 0 ? 'wave' : index % 3 === 1 ? 'nervous' : 'idle';
      this.rect(panel, -width / 2 + 12, compact ? 155 : 302, width - 24, 2, colorOf(candidate), 0.55);
      this.text(panel, candidate.name, 0, compact ? 163 : 320, compact ? candidate.name.length > 14 ? 12 : candidate.name.length > 10 ? 13 : 17 : candidate.name.length > 10 ? 19 : 26, '#fff7e7', true).setWordWrapWidth(width - 20);
      const percentage = this.text(panel, '0.0%', 0, compact ? 187 : 369, compact ? 27 : 43, candidate.color, true);
      if (!state.reducedMotion) {
        panel.setAlpha(0);
        citizen.root.setY(citizen.root.y + 10);
        this.tweens.add({ targets: panel, alpha: 1, duration: 520, delay: index * 65, ease: 'Cubic.out' });
        this.tweens.add({ targets: citizen.root, y: compact ? 146 : 286, duration: 700, delay: index * 65, ease: 'Cubic.out' });
      }
      this.race.push({ candidate, panel, citizen, percentage, badge, position, glow, frame, displayed: state.percentages[candidate.id] ?? 0, rank: index, reactedAt: -10000, rising: false });
      this.raceBars.push(this.rect(this.root, 68 + index * 1144 / state.candidates.length, 606, 1144 / state.candidates.length, 7, colorOf(candidate)));
    });
    this.studioPulse = this.rect(this.root, 0, 0, 1280, 720, 0xffdd8a, 0).setDepth(300);
  }

  private racePosition(rank: number, count: number) {
    const columns = Math.min(5, count);
    const width = (1144 - (columns - 1) * 14) / columns;
    const height = count > 5 ? 220 : 444;
    const row = Math.floor(rank / columns);
    const rowCount = Math.min(columns, count - row * columns);
    const rowWidth = rowCount * width + (rowCount - 1) * 14;
    return { x: (1280 - rowWidth) / 2 + width / 2 + rank % columns * (width + 14), y: 128 + row * (height + 20), width, height };
  }

  private victory(state: StageState) {
    this.background(0x23213f);
    const candidate = state.candidates.find(item => item.id === state.winnerId) ?? state.candidates[0];
    for (let i = 0; i < 4; i++) {
      const beam = this.add.graphics({ x: i < 2 ? 170 : 1110, y: -80 });
      beam.fillStyle(i % 2 ? 0xfbd975 : 0x5bcfc8, 0.09);
      beam.fillTriangle(0, 0, -195, 850, 195, 850);
      beam.setAngle(i % 2 ? 30 : -30);
      this.root.add(beam);
      if (!state.reducedMotion) this.tweens.add({ targets: beam, angle: i % 2 ? -27 : 27, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    this.text(this.root, 'E L E C T E D', 640, 35, 18, '#ba9c66', true);
    const title = this.text(this.root, '당 선 확 정', 640, 74, 66, '#fbd975', true);
    this.rect(this.root, 389, 484, 502, 89, colorOf(candidate));
    this.rect(this.root, 329, 552, 622, 63, gold);
    this.rect(this.root, 279, 613, 722, 37, 0xe6bc58);
    this.text(this.root, candidate.name, 640, 565, candidate.name.length > 10 ? 33 : 45, '#14223b', true);
    this.winner = this.citizen(this.root, candidate, state.candidates.indexOf(candidate), 640, 480, 5.9);
    this.winner.pose = 'cheer';
    if (!state.reducedMotion) {
      this.winner.root.setX(-140);
      this.tweens.add({ targets: this.winner.root, x: 640, duration: 1130, ease: 'Cubic.out', onComplete: () => {
        this.burst(640, 479, colorOf(candidate), 18, 240);
        this.tweens.add({ targets: this.winner!.root, y: 473, duration: 170, yoyo: true, ease: 'Sine.inOut' });
      } });
      title.setAlpha(0).setScale(1.35);
      this.tweens.add({ targets: title, alpha: 1, scaleX: 1, scaleY: 1, delay: 750, duration: 650, ease: 'Back.out' });
    }
    for (let i = 0; i < 24; i++) {
      const person = state.candidates[i % state.candidates.length];
      const citizen = this.citizen(this.root, person, i + 9, 23 + i * 55, 748 + (i % 2) * 15, 2.1 + (i % 3) * 0.2);
      citizen.pose = 'cheer';
    }
    for (let i = 0; i < 100; i++) {
      const rectangle = this.add.rectangle((i * 179) % 1280, state.reducedMotion ? (i * 103) % 710 : -((i * 103) % 740), 8 + (i % 3) * 3, 5, [gold, 0xff7957, 0x64d5c8, 0xf5eedc][i % 4]);
      this.root.add(rectangle);
      this.confetti.push({ rectangle, speed: 140 + (i % 8) * 24, drift: (i % 5 - 2) * 21 });
    }
  }

  update(time: number, delta: number) {
    const state = this.readState();
    if (this.currentPhase !== state.phase) this.switchPhase(state.phase);
    else if (state.preview && this.signature(state) !== this.previewSignature) this.switchPhase(state.phase, true);
    const local = time - this.phaseStart;
    if (state.phase === 'declaration') {
      this.paperHeadline?.setText(state.topic || '오늘의 당선자를 뽑습니다').setFontSize(state.topic.length > 30 ? 23 : 37);
      if (!state.preview && state.candidates.length) this.citizens.forEach((citizen, index) => {
        const focus = Math.floor(local / (4800 / state.candidates.length)) % state.candidates.length;
        citizen.pose = focus === index ? 'wave' : index % 3 === 1 && local > 3800 ? 'bow' : 'idle';
      });
    }
    if (state.phase === 'voting') {
      this.voteCounter?.setText(format.format(Math.floor(state.totalVotes * Math.min(1, local / 4200))));
      this.voters.forEach(voter => {
        const { citizen, ballot, offset, duration } = voter;
        const cycle = Math.floor((local + offset) / duration);
        const t = ((local + offset) % duration) / duration;
        if (t < 0.54) {
          const approach = t / 0.54;
          // Ease the last step into the ballot box without stopping the gait abruptly.
          citizen.root.x = -110 + 747 * (approach < 0.85 ? approach : 0.85 + 0.15 * Math.sin((approach - 0.85) / 0.15 * Math.PI / 2));
          citizen.pose = 'walk';
        } else if (t < 0.68) {
          citizen.root.x = 637;
          citizen.pose = 'vote';
          citizen.gestureProgress = (t - 0.54) / 0.14;
        } else {
          const departure = (t - 0.68) / 0.32;
          citizen.root.x = 637 + departure * departure * 760;
          citizen.pose = departure > 0.48 && voter.offset % 2 ? 'run' : 'walk';
        }
        ballot.setVisible(t < 0.665).setAlpha(1);
        if (ballot.visible) {
          if (t < 0.54) ballot.setPosition(citizen.root.x + 22, citizen.root.y - 48).setAngle(-11);
          else {
            const drop = Math.min(1, (t - 0.54) / 0.125);
            ballot.setPosition(663 + drop * 66, 462 - Math.sin(drop * Math.PI) * 29 - drop * 28);
            ballot.setAngle(-25 + drop * 36).setAlpha(1 - Math.max(0, drop - 0.8) * 5);
          }
        }
        if (t >= 0.665 && voter.lastDrop !== cycle) {
          voter.lastDrop = cycle;
          if (!state.reducedMotion && local - this.lastBoxImpact > 130 && this.ballotBox) {
            this.lastBoxImpact = local;
            this.tweens.killTweensOf(this.ballotBox);
            this.ballotBox.setAngle(-2);
            this.tweens.add({ targets: this.ballotBox, angle: 0, duration: 230, ease: 'Back.out' });
            this.burst(730, 431, gold, 5, 280);
          }
        }
      });
    }
    if (state.phase === 'counting' && this.race.length) {
      const ranked = [...state.candidates].sort((a, b) => (state.percentages[b.id] ?? 0) - (state.percentages[a.id] ?? 0));
      const leader = ranked[0].id;
      if (leader !== this.leaderId) {
        if (this.leaderId && !state.reducedMotion) {
          this.cameras.main.shake(160, 0.0016);
          this.studioPulse?.setAlpha(0.09);
          if (this.studioPulse) this.tweens.add({ targets: this.studioPulse, alpha: 0, duration: 420, ease: 'Cubic.out' });
          const newLeader = this.race.find(slot => slot.candidate.id === leader);
          if (newLeader) {
            this.burst(newLeader.panel.x, newLeader.panel.y + 48, colorOf(newLeader.candidate), 14, 75);
            this.tweens.killTweensOf(newLeader.percentage);
            newLeader.percentage.setScale(1.13);
            this.tweens.add({ targets: newLeader.percentage, scaleX: 1, scaleY: 1, duration: 450, ease: 'Back.out' });
          }
        }
        this.leaderId = leader;
      }
      let barX = 68;
      this.race.forEach((slot, index) => {
        const rank = ranked.findIndex(candidate => candidate.id === slot.candidate.id);
        if (rank !== slot.rank) {
          slot.rising = rank < slot.rank;
          slot.reactedAt = time;
          slot.rank = rank;
        }
        const target = this.racePosition(rank, this.race.length);
        const move = state.reducedMotion ? 1 : 1 - Math.exp(-delta / 170);
        slot.panel.setPosition(Phaser.Math.Linear(slot.panel.x, target.x, move), Phaser.Math.Linear(slot.panel.y, target.y, move));
        slot.displayed = Phaser.Math.Linear(slot.displayed, state.percentages[slot.candidate.id] ?? 0, 1 - Math.exp(-delta / 90));
        slot.percentage.setText(`${slot.displayed.toFixed(1)}%`);
        slot.position.setText(`${rank + 1}위`).setColor(rank === 0 ? '#fbd975' : '#bed0df');
        const leading = slot.candidate.id === leader;
        slot.panel.setDepth(leading ? 100 : 20 - rank);
        const reacting = time - slot.reactedAt < 700;
        slot.badge.setText(leading ? '▲ 선두' : reacting ? slot.rising ? '순위 상승' : '다시 추격' : rank < 3 ? '초접전' : '추격 중').setColor(leading ? '#fbd975' : '#9cb6cc');
        slot.frame.setStrokeStyle(leading ? 3 : 1, leading ? colorOf(slot.candidate) : 0x39516c, leading ? 1 : 0.8);
        slot.glow.setAlpha(leading ? 0.085 + (state.reducedMotion ? 0 : Math.sin(time / (state.progress > 90 ? 160 : 330)) * 0.035) : reacting && slot.rising ? 0.055 : 0.025);
        const individual = Math.floor((local + index * 367) / (1400 + index % 3 * 310));
        slot.citizen.pose = reacting ? slot.rising ? index % 2 ? 'wave' : 'cheer' : index % 3 ? 'surprised' : 'nervous' : state.progress > 90 ? individual % 3 === 0 ? 'idle' : 'nervous' : leading ? individual % 2 ? 'cheer' : 'wave' : individual % 4 === 0 ? 'wave' : individual % 3 === 0 ? 'nervous' : 'idle';
        const barWidth = 1144 * Math.max(0, slot.displayed) / 100;
        this.raceBars[index].setX(barX).setDisplaySize(barWidth, 7);
        barX += barWidth;
      });
      this.root.sort('depth');
      const gap = ranked.length > 1 ? Math.max(0, (state.percentages[ranked[0].id] ?? 0) - (state.percentages[ranked[1].id] ?? 0)) : 0;
      this.marginText?.setText(`선두 격차 ${gap.toFixed(1)}%p`);
      if (!state.reducedMotion) this.rings.forEach((ring, index) => { ring.setScale(1 + Math.sin(time / 500 + index) * 0.05); });
      this.countdownLabel?.setText(state.progress >= 96 ? '마지막 표가 공개됩니다' : state.progress >= 90 ? '마지막 투표함 · 숨죽인 개표장' : gap < 1 ? '단 한 표로도 뒤집히는 승부' : '전국 투표함 실시간 집계');
      if (!state.reducedMotion) {
        this.screenWindows.forEach((window, index) => window.setAlpha(0.22 + (Math.sin(time / 440 + index * 1.7) + 1) * 0.13));
        const camera = this.cameras.main;
        const targetZoom = 1 + state.progress / 100 * 0.012 + (state.progress >= 90 && state.progress < 96 ? 0.004 : 0);
        camera.setZoom(Phaser.Math.Linear(camera.zoom, targetZoom, 1 - Math.exp(-delta / 450)));
        const focus = this.racePosition(0, this.race.length).x < 640 ? -4 : 0;
        camera.centerOn(640 + Phaser.Math.Linear(camera.midPoint.x - 640, focus, 1 - Math.exp(-delta / 500)), 360);
      }
    }
    if (state.phase === 'winner') {
      if (this.winner) this.winner.pose = state.reducedMotion ? 'cheer' : local < 1080 ? 'run' : local < 1760 ? 'bow' : 'cheer';
      const firework = Math.floor((local - 800) / 750);
      if (!state.reducedMotion && firework >= 0 && firework <= 4 && firework !== this.lastFirework) {
        this.lastFirework = firework;
        const x = firework % 2 ? 1070 : 210;
        const y = 176 + firework % 3 * 44;
        const color = [gold, 0x64d5c8, 0xff7957][firework % 3];
        this.burst(x, y, color, 32, 85);
        const halo = this.add.circle(x, y, 18).setStrokeStyle(2, color, 0.65);
        this.root.add(halo);
        this.tweens.add({ targets: halo, scaleX: 5, scaleY: 5, alpha: 0, duration: 750, ease: 'Cubic.out', onComplete: () => halo.destroy() });
      }
      if (!state.reducedMotion) this.confetti.forEach(({ rectangle, speed, drift }, index) => {
        rectangle.y += speed * delta / 1000;
        rectangle.x += (drift + Math.sin(time / 380 + index) * 20) * delta / 1000;
        rectangle.angle += delta * 0.06;
        if (rectangle.y > 735) { rectangle.y = -20; rectangle.x = (index * 179 + time / 7) % 1280; }
      });
    }
    this.citizens.forEach(citizen => citizen.update(time, state.reducedMotion));
    if (!state.reducedMotion) this.sparks = this.sparks.filter(spark => {
      spark.age += delta;
      if (spark.age >= spark.life) { spark.rectangle.destroy(); return false; }
      spark.vy += spark.gravity * delta / 1000;
      spark.rectangle.x += spark.vx * delta / 1000;
      spark.rectangle.y += spark.vy * delta / 1000;
      spark.rectangle.setAlpha(1 - spark.age / spark.life).setAngle(spark.age / 4);
      return true;
    });
  }
}

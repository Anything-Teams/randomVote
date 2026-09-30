import Phaser from 'phaser';
import type { Candidate } from '../election';
import { COUNT_START, countBeat, type CountingBeat, type ShowPhase } from '../show';
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
  elapsed: number;
  cheeringId?: string;
};
type Voter = { citizen: PixelCitizen; ballot: Phaser.GameObjects.Rectangle; offset: number; duration: number; lastDrop: number };
type RaceSlot = { candidate: Candidate; panel: Phaser.GameObjects.Container; citizen: PixelCitizen; percentage: Phaser.GameObjects.Text; badge: Phaser.GameObjects.Text; position: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Rectangle; frame: Phaser.GameObjects.Rectangle; support: Phaser.GameObjects.Text; displayed: number };
type Confetti = { rectangle: Phaser.GameObjects.Rectangle; speed: number; drift: number };
type Spark = { rectangle: Phaser.GameObjects.Rectangle; vx: number; vy: number; age: number; life: number; gravity: number };
type NewspaperCard = { candidate: Candidate; card: Phaser.GameObjects.Container; citizen: PixelCitizen; background: Phaser.GameObjects.Rectangle; portrait: Phaser.GameObjects.Rectangle; rules: Phaser.GameObjects.Rectangle[]; nameBand: Phaser.GameObjects.Rectangle; number: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text };
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
  private winner?: PixelCitizen;
  private sparks: Spark[] = [];
  private previewSignature = '';
  private newspaperRoot?: Phaser.GameObjects.Container;
  private newspaperCards = new Map<string, NewspaperCard>();
  private newspaperLayoutSignature = '';
  private newspaperInvitation?: Phaser.GameObjects.Container;
  private newspaperStamp?: Phaser.GameObjects.Text;
  private countdownLabel?: Phaser.GameObjects.Text;
  private ballotBox?: Phaser.GameObjects.Container;
  private lastFirework = -1;
  private lastBoxImpact = 0;
  private screenWindows: Phaser.GameObjects.Rectangle[] = [];
  private countingBox?: Phaser.GameObjects.Container;
  private countingLid?: Phaser.GameObjects.Container;
  private countingLock?: Phaser.GameObjects.Container;
  private countingEnvelope?: Phaser.GameObjects.Container;
  private countingEnvelopeFlap?: Phaser.GameObjects.Triangle;
  private countingEnvelopeMark?: Phaser.GameObjects.Text;
  private countingBoxNumber?: Phaser.GameObjects.Text;
  private countingTitle?: Phaser.GameObjects.Text;
  private countingLocation?: Phaser.GameObjects.Text;
  private countingCue?: Phaser.GameObjects.Text;
  private countingBeam?: Phaser.GameObjects.Graphics;
  private countingLights: Phaser.GameObjects.Arc[] = [];
  private countingBallots: Phaser.GameObjects.Container[] = [];
  private countingBubble?: Phaser.GameObjects.Container;
  private countingBubbleText?: Phaser.GameObjects.Text;
  private countingPortrait?: Phaser.GameObjects.Container;
  private countingBeatKey = '';
  private countingReactions = new Map<string, { pose: 'wave' | 'cheer' | 'surprised' | 'nervous'; until: number }>();
  private countingLastLeader = '';
  private countingBubbleUntil = 0;
  private finalEnvelopeOpened = false;

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
    this.sparks = [];
    this.paperHeadline = undefined;
    this.newspaperRoot = undefined;
    this.newspaperCards.clear();
    this.newspaperLayoutSignature = '';
    this.newspaperInvitation = undefined;
    this.newspaperStamp = undefined;
    this.voteCounter = undefined;
    this.marginText = undefined;
    this.winner = undefined;
    this.countdownLabel = undefined;
    this.ballotBox = undefined;
    this.lastFirework = -1;
    this.lastBoxImpact = 0;
    this.screenWindows = [];
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

  /** Editing a preview updates its existing objects, so a keystroke never restarts the actors. */
  private syncNewspaperCandidates(state: StageState) {
    const news = this.newspaperRoot;
    if (!news) return;
    const layoutSignature = state.candidates.map(candidate => candidate.id).join('|');
    const layoutChanged = layoutSignature !== this.newspaperLayoutSignature;
    const ids = new Set(state.candidates.map(candidate => candidate.id));
    this.newspaperCards.forEach((slot, id) => {
      if (ids.has(id)) return;
      this.citizens = this.citizens.filter(citizen => citizen !== slot.citizen);
      this.destroyPhase(slot.card);
      this.newspaperCards.delete(id);
    });
    const columns = state.candidates.length > 4 ? 5 : 4;
    const hasTwoRows = state.candidates.length > columns;
    const width = columns === 5 ? 198 : 238;
    const pitch = columns === 5 ? 211 : 262;
    const height = hasTwoRows ? 148 : 274;
    state.candidates.forEach((candidate, index) => {
      const row = Math.floor(index / columns);
      const count = Math.min(columns, state.candidates.length - row * columns);
      const x = ((index % columns) - (count - 1) / 2) * pitch;
      const y = hasTwoRows ? -74 + row * 159 : -56;
      let slot = this.newspaperCards.get(candidate.id);
      const isNew = !slot;
      if (!slot) {
        const card = this.add.container(x, y);
        news.add(card);
        const background = this.rect(card, 0, 0, 1, 1, 0xdedfcf);
        const portrait = this.rect(card, 0, 0, 1, 1, 0x263b49);
        const rules = Array.from({ length: 5 }, () => this.rect(card, 0, 0, 1, 1, 0xffffff, 0.05));
        const identity = Number(candidate.id);
        const citizen = this.citizen(card, candidate, Number.isFinite(identity) ? Math.max(0, identity - 1) : index, 0, height - 39, hasTwoRows ? 2.05 : 4.05);
        citizen.pose = index % 3 === 0 ? 'wave' : 'idle';
        const nameBand = this.rect(card, 0, 0, 1, 30, colorOf(candidate));
        const number = this.text(card, '', 0, 8, 13, '#fbd975');
        const name = this.text(card, '', 0, height - 29, 19, '#14223b', true);
        slot = { candidate, card, citizen, background, portrait, rules, nameBand, number, name };
        this.newspaperCards.set(candidate.id, slot);
      }
      if (slot.candidate.color !== candidate.color) this.recolorNewspaperCitizen(slot.citizen, colorOf(slot.candidate), colorOf(candidate));
      slot.candidate = candidate;
      if (layoutChanged || isNew) {
        slot.background.setPosition(-width / 2, 0).setSize(width, height);
        slot.portrait.setPosition(-width / 2 + 4, 4).setSize(width - 8, height - 37);
        slot.rules.forEach((rule, line) => rule.setPosition(-width / 2 + 7, 18 + line * 19).setSize(width - 14, 1));
        slot.citizen.root.setPosition(0, height - 39).setScale(hasTwoRows ? 2.05 : 4.05);
        slot.nameBand.setPosition(-width / 2 + 4, height - 33).setSize(width - 8, 30);
      }
      slot.nameBand.setFillStyle(colorOf(candidate));
      slot.number.setPosition(-width / 2 + 16, 8).setText(`기호 ${index + 1}`);
      slot.name.setY(height - 29).setText(candidate.name).setFontSize(candidate.name.length > 9 ? 14 : 19).setWordWrapWidth(width - 12);
      if (isNew && !state.preview && !state.reducedMotion) {
        slot.card.setAlpha(0).setScale(0.82).setY(y + 32);
        this.tweens.add({ targets: slot.card, y, scaleX: 1, scaleY: 1, alpha: 1, delay: 480 + index * 280, duration: 640, ease: 'Back.out' });
      } else if (layoutChanged && (slot.card.x !== x || slot.card.y !== y)) {
        this.tweens.killTweensOf(slot.card);
        if (state.reducedMotion) slot.card.setPosition(x, y);
        else this.tweens.add({ targets: slot.card, x, y, duration: 320, ease: 'Cubic.out' });
      }
    });
    this.newspaperInvitation?.setVisible(!state.candidates.length);
    this.newspaperStamp?.setText(state.candidates.length ? '출 마 완 료' : '후 보 모 집');
    this.paperHeadline?.setText(state.topic || '오늘의 당선자를 뽑습니다').setFontSize(state.topic.length > 30 ? 23 : 37);
    this.newspaperLayoutSignature = layoutSignature;
    this.previewSignature = this.signature(state);
  }

  private recolorNewspaperCitizen(citizen: PixelCitizen, oldColor: number, nextColor: number) {
    const colors = new Map([
      [oldColor, nextColor],
      [Phaser.Display.Color.IntegerToColor(oldColor).lighten(15).color, Phaser.Display.Color.IntegerToColor(nextColor).lighten(15).color],
      [Phaser.Display.Color.IntegerToColor(oldColor).darken(10).color, Phaser.Display.Color.IntegerToColor(nextColor).darken(10).color],
    ]);
    const recolor = (object: Phaser.GameObjects.GameObject) => {
      if (object instanceof Phaser.GameObjects.Container) object.list.forEach(recolor);
      else if (object instanceof Phaser.GameObjects.Rectangle && colors.has(object.fillColor)) object.setFillStyle(colors.get(object.fillColor));
    };
    recolor(citizen.root);
  }

  private newspaper(state: StageState) {
    this.background(0x263b49);
    for (let i = 0; i < 5; i++) {
      const sheet = this.add.rectangle(640 + (i - 2) * 15, 362 + i * 8, 1100, 565, i % 2 ? 0x8b9b92 : 0xc3c8b9).setAngle((i - 2) * 3);
      this.root.add(sheet);
    }
    const news = this.add.container(640, 345);
    this.root.add(news);
    this.newspaperRoot = news;
    this.rect(news, -560, -275, 1120, 570, paper);
    this.rect(news, -560, -275, 1120, 570, 0x7e6950, 0.035);
    this.rect(news, -530, -185, 1060, 5, ink);
    this.rect(news, -530, -171, 1060, 1, ink);
    this.text(news, 'THE PIXEL DAILY', -524, -252, 15, '#5d625b');
    this.text(news, '픽 셀 일 보', 0, -255, 55, '#162838', true);
    this.text(news, '특별판 / 제 001호', 524, -247, 15, '#5d625b').setOrigin(1, 0);
    this.text(news, '호외', -505, -151, 26, '#d64e3c');
    this.paperHeadline = this.text(news, state.topic || '오늘의 당선자를 뽑습니다', 10, -151, state.topic.length > 30 ? 23 : 37, '#17293b', true).setWordWrapWidth(870);
    const invitation = this.add.container(0, 44);
    news.add(invitation);
    this.newspaperInvitation = invitation;
    this.rect(invitation, -196, -113, 392, 188, 0xddd9c7).setStrokeStyle(2, 0xb0ad9f);
    this.rect(invitation, -170, -90, 340, 144, paper);
    this.rect(invitation, -145, -66, 196, 8, 0xaeb5aa);
    this.rect(invitation, -145, -40, 222, 6, 0xc5c8b8);
    this.rect(invitation, -145, -14, 153, 6, 0xc5c8b8);
    this.rect(invitation, 83, -49, 47, 47, 0x59a99e).setStrokeStyle(3, 0x397d76);
    this.text(invitation, '✓', 106, -49, 42, '#f5eedc', true);
    this.text(invitation, '당신의 후보를 기다립니다', 0, 109, 30, '#17293b', true);
    this.text(invitation, '이름을 입력하면 특별판이 완성됩니다', 0, 153, 18, '#647264', true);
    this.syncNewspaperCandidates(state);
    this.rect(news, -530, 244, 1060, 2, ink);
    this.text(news, '사소한 결정, 전례 없는 선거전으로 번지다', -520, 255, 20, '#334536');
    this.text(news, '전국 투표 / 특별 취재팀', 520, 260, 14, '#536154').setOrigin(1, 0);
    const stamp = this.add.container(456, 273).setAngle(-11).setScale(0.65);
    news.add(stamp);
    this.rect(stamp, -115, -27, 230, 66, 0xc54935, 0.12).setStrokeStyle(5, 0xc54935);
    this.newspaperStamp = this.text(stamp, state.candidates.length ? '출 마 완 료' : '후 보 모 집', 0, -18, 30, '#c54935', true);
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
    this.background(0x101c2c);
    this.countingBeatKey = '';
    this.countingLastLeader = '';
    this.countingReactions.clear();
    this.countingLights = [];
    this.countingBallots = [];
    this.countingBubbleUntil = 0;
    this.countingPortrait = undefined;
    this.finalEnvelopeOpened = false;
    for (let i = 0; i < 9; i++) {
      this.rect(this.root, 351 + i * 66, 91, 50, 385, i % 2 ? 0x1c3141 : 0x172b3b);
      for (let j = 0; j < 7; j++) this.screenWindows.push(this.rect(this.root, 364 + i * 66, 114 + j * 46, 22, 10, 0x82b3b1, 0.11));
    }
    const floor = this.add.graphics();
    floor.lineStyle(1, 0x466a89, 0.19);
    for (let i = 0; i < 9; i++) floor.lineBetween(640, 462, i * 160, 720);
    [538, 572, 620, 690].forEach(y => floor.lineBetween(0, y, 1280, y));
    this.root.add(floor);
    this.countingBeam = this.add.graphics();
    this.countingBeam.fillStyle(gold, 0.09);
    this.countingBeam.fillTriangle(640, 58, 444, 527, 836, 527);
    this.root.add(this.countingBeam);
    this.text(this.root, '전 국 개 표 특 별 방 송', 640, 44, 23, '#d7e6e9', true);
    this.text(this.root, '후보들의 대기실', 68, 83, 18, '#9ab4c7');
    this.marginText = this.text(this.root, '선두 격차 0.0%p', 1212, 82, 20, '#fbd975').setOrigin(1, 0);
    this.countingTitle = this.text(this.root, '첫 번째 투표함', 640, 138, 30, '#fff1c7', true);
    this.countingLocation = this.text(this.root, '개표장으로 도착한 표를 확인합니다', 640, 182, 17, '#a8c2c4', true);
    this.countdownLabel = this.text(this.root, '봉인을 풀고 있습니다', 640, 225, 21, '#fbd975', true);
    this.countingCue = this.text(this.root, '표가 모일수록, 표정도 달라집니다', 640, 565, 18, '#b8cbd0', true).setWordWrapWidth(540);
    state.candidates.forEach((candidate, index) => {
      const { x, y, width, height } = this.racePosition(index, state.candidates.length);
      const panel = this.add.container(x, y);
      this.root.add(panel);
      const frame = this.rect(panel, -width / 2, 0, width, height, 0x1b2c48).setStrokeStyle(1, 0x39516c);
      const glow = this.rect(panel, -width / 2, 0, width, height, colorOf(candidate), 0.04);
      this.rect(panel, -width / 2, 0, 4, height, colorOf(candidate));
      const position = this.text(panel, '집계 전', width / 2 - 11, 12, 13, '#91adbf').setOrigin(1, 0);
      const badge = this.text(panel, '기호 ' + (index + 1), -width / 2 + 69, 12, 13, '#a8c3ce');
      const citizen = this.citizen(panel, candidate, index, -width / 2 + 36, height - 8, 1.42);
      citizen.pose = index % 4 === 1 ? 'nervous' : 'idle';
      this.text(panel, candidate.name, -width / 2 + 69, 34, candidate.name.length > 10 ? 14 : 17, '#fff7e7').setWordWrapWidth(152);
      const percentage = this.text(panel, '0.0%', width / 2 - 10, 40, 22, candidate.color).setOrigin(1, 0);
      const support = this.text(panel, '♥', -width / 2 + 21, 7, 16, '#ff9b9b').setVisible(candidate.id === state.cheeringId);
      if (!state.reducedMotion) {
        panel.setAlpha(0);
        this.tweens.add({ targets: panel, alpha: 1, duration: 450, delay: index * 38, ease: 'Cubic.out' });
      }
      this.race.push({ candidate, panel, citizen, percentage, badge, position, glow, frame, support, displayed: state.percentages[candidate.id] ?? 0 });
    });
    this.rect(this.root, 446, 510, 388, 19, 0x60737a);
    this.rect(this.root, 468, 529, 26, 47, 0x253b48);
    this.rect(this.root, 786, 529, 26, 47, 0x253b48);
    this.countingBox = this.add.container(640, 441);
    this.root.add(this.countingBox);
    this.rect(this.countingBox, -143, -110, 286, 169, 0xf1d986).setStrokeStyle(2, 0x9f834d);
    this.rect(this.countingBox, 114, -110, 29, 169, 0xc3a65f);
    this.rect(this.countingBox, -136, -101, 265, 13, 0x172738);
    this.rect(this.countingBox, -96, -52, 191, 77, 0xffedb6).setStrokeStyle(2, 0xb99a55);
    this.text(this.countingBox, '운명의 한 표', 0, -40, 21, '#6c6140', true);
    this.countingBoxNumber = this.text(this.countingBox, 'BOX 01', 0, -9, 27, '#343d3c', true);
    this.countingLid = this.add.container(-151, -112);
    this.countingBox.add(this.countingLid);
    this.rect(this.countingLid, 0, -6, 303, 17, gold).setStrokeStyle(2, 0xa98d4a);
    this.rect(this.countingLid, 71, -11, 156, 7, 0x273b40);
    this.countingLock = this.add.container(0, -96);
    this.countingBox.add(this.countingLock);
    this.rect(this.countingLock, -15, -6, 30, 22, 0xd45640).setStrokeStyle(2, 0xffba86);
    this.rect(this.countingLock, -9, -20, 5, 14, 0xc5d5d0);
    this.rect(this.countingLock, 4, -20, 5, 14, 0xc5d5d0);
    this.rect(this.countingLock, -9, -23, 18, 5, 0xc5d5d0);
    this.text(this.countingLock, '封', 0, -5, 15, '#ffebbe', true);
    for (let i = 0; i < 3; i++) {
      const light = this.add.circle(582 + i * 58, 542, 9, 0x385269).setStrokeStyle(2, 0x78949c);
      this.root.add(light);
      this.countingLights.push(light);
      this.text(this.root, String(i + 1), 582 + i * 58, 537, 11, '#dce6d6', true);
    }
    for (let i = 0; i < 16; i++) {
      const ballot = this.add.container(640, 328).setVisible(false);
      this.root.add(ballot);
      this.rect(ballot, -12, -16, 24, 33, paper).setStrokeStyle(1, 0x9b9f8d);
      this.rect(ballot, -7, -9, 14, 2, 0x8f9a8e);
      this.rect(ballot, -7, -3, 14, 2, 0xb7bdac);
      this.rect(ballot, -2, 5, 7, 6, 0xd77963);
      this.countingBallots.push(ballot);
    }
    this.countingEnvelope = this.add.container(640, 338).setVisible(false);
    this.root.add(this.countingEnvelope);
    this.rect(this.countingEnvelope, -55, -37, 110, 74, paper).setStrokeStyle(2, 0xa69a77);
    this.countingEnvelopeFlap = this.add.triangle(-55, -37, 0, 0, 110, 0, 55, 38, 0xe3dcc4).setOrigin(0, 0);
    this.countingEnvelope.add(this.countingEnvelopeFlap);
    this.countingEnvelopeMark = this.text(this.countingEnvelope, '?', 0, -21, 38, '#a05540', true);
    this.countingBubble = this.add.container(640, 487).setAlpha(0).setDepth(12);
    this.root.add(this.countingBubble);
    this.rect(this.countingBubble, -163, -9, 326, 42, paper).setStrokeStyle(2, 0x69777b);
    const tail = this.add.triangle(-16, 31, 0, 0, 15, 0, 4, 12, paper).setOrigin(0, 0);
    this.countingBubble.add(tail);
    this.countingBubbleText = this.text(this.countingBubble, '', 0, 0, 18, '#394c4e', true);
  }

  private racePosition(index: number, count: number) {
    const rows = Math.ceil(count / 2);
    const right = index >= rows;
    const row = right ? index - rows : index;
    return { x: right ? 1095 : 185, y: 122 + (5 - rows) * 44 + row * 88, width: 304, height: 78 };
  }

  private countReaction(beat: CountingBeat, ranked: Candidate[], time: number) {
    this.countingReactions.clear();
    this.countingBubble?.setAlpha(0);
    if (this.countingPortrait) {
      const oldPortrait = this.countingPortrait;
      this.citizens = this.citizens.filter(citizen => citizen.root.parentContainer !== oldPortrait);
      this.tweens.killTweensOf(oldPortrait);
      oldPortrait.destroy(true);
      this.countingPortrait = undefined;
    }
    if (beat.state === 'settled') {
      const state = this.readState();
      const leader = ranked[0];
      const previousLeader = this.countingLastLeader;
      const changed = previousLeader && previousLeader !== leader.id;
      const burden = /커피|점심|벌칙|청소/.test(state.topic);
      const presentation = state.topic.includes('발표');
      this.countingReactions.set(leader.id, { pose: burden ? changed ? 'surprised' : 'nervous' : changed ? 'cheer' : 'wave', until: time + 1500 });
      if (changed) this.countingReactions.set(previousLeader, { pose: 'surprised', until: time + 1800 });
      else if (ranked[1]) this.countingReactions.set(ranked[1].id, { pose: 'nervous', until: time + 2000 });
      const portrait = this.add.container(640, 274).setDepth(11);
      this.root.add(portrait);
      this.countingPortrait = portrait;
      this.rect(portrait, -154, -54, 308, 251, 0x183243).setStrokeStyle(2, colorOf(leader));
      this.rect(portrait, -154, -54, 308, 31, colorOf(leader));
      this.text(portrait, leader.name, 0, -48, leader.name.length > 10 ? 13 : 17, '#17293b', true).setWordWrapWidth(284);
      this.text(portrait, '대기실 현장', 0, -15, 12, '#9abbca', true);
      const closeup = this.citizen(portrait, leader, state.candidates.findIndex(candidate => candidate.id === leader.id), 0, 177, 3.7);
      closeup.pose = presentation ? 'bow' : burden ? changed ? 'surprised' : 'nervous' : changed ? 'surprised' : 'wave';
      if (!this.readState().reducedMotion) {
        portrait.setAlpha(0).setScale(0.95);
        this.tweens.add({ targets: portrait, alpha: 1, scaleX: 1, scaleY: 1, duration: 430, ease: 'Cubic.out' });
      }
      this.countingBubbleText?.setText(presentation ? '일단… 인사부터 드릴게요!' : burden ? '잠깐, 제가 앞선다고요…?' : changed ? '어? 저요? 정말 저예요?' : beat.box === 1 ? '일단 한숨 돌려도 되겠죠…?' : '끝까지 지켜봐야겠네요…');
      this.countingBubbleUntil = time + 1600;
      this.countingBubble?.setAlpha(this.readState().reducedMotion ? 1 : 0);
      if (!this.readState().reducedMotion && this.countingBubble) {
        this.countingBubble.setY(494);
        this.tweens.add({ targets: this.countingBubble, y: 487, alpha: 1, duration: 330, ease: 'Cubic.out' });
      }
      this.countingLastLeader = leader.id;
      this.root.sort('depth');
    } else if (beat.state === 'sealed') {
      if (ranked[0]) this.countingReactions.set(ranked[0].id, { pose: 'nervous', until: time + 3500 });
      if (ranked[ranked.length - 1]) this.countingReactions.set(ranked[ranked.length - 1].id, { pose: 'nervous', until: time + 2600 });
    }
  }

  private updateCounting(state: StageState, time: number, delta: number) {
    const local = Math.max(0, state.elapsed - COUNT_START);
    const beat = countBeat(state.elapsed);
    const key = `${beat.id}:${beat.state}`;
    const ranked = [...state.candidates].sort((a, b) => (state.percentages[b.id] ?? 0) - (state.percentages[a.id] ?? 0));
    const hasResult = local >= 2200;
    if (key !== this.countingBeatKey) {
      this.countingBeatKey = key;
      this.countReaction(beat, ranked, time);
    }
    const leader = ranked[0].id;
    this.countingTitle?.setText(beat.box === 3 ? '마지막 투표함' : beat.box === 2 ? '두 번째 투표함' : '첫 번째 투표함');
    this.countingLocation?.setText(beat.location);
    this.countingBoxNumber?.setText(`BOX 0${beat.box}`);
    this.countingLights.forEach((light, index) => light.setFillStyle(index < beat.box - 1 ? 0x7bc7ac : index === beat.box - 1 ? gold : 0x385269));
    const sealed = beat.state === 'sealed';
    const revealing = beat.state === 'revealing';
    const opening = beat.state === 'opening';
    const segmentStart = beat.box === 1 ? 0 : beat.box === 2 ? 5000 : 14500;
    const segmentTime = local - segmentStart;
    const openProgress = Phaser.Math.Clamp(segmentTime / (revealing ? 1900 : 1650), 0, 1);
    const eased = Phaser.Math.Easing.Cubic.InOut(openProgress);
    if (this.countingBox) {
      this.countingBox.setY(441 + (state.reducedMotion ? 0 : sealed ? Math.sin(time / 420) * 0.45 : 0));
      this.countingBox.setAngle(state.reducedMotion || !opening ? 0 : Math.sin(segmentTime / 210) * Math.sin(openProgress * Math.PI) * 0.8);
    }
    if (this.countingLid) {
      const angle = sealed ? 0 : opening || revealing ? -19 * Math.sin(eased * Math.PI) - eased * 7 : -7;
      this.countingLid.setAngle(state.reducedMotion ? (sealed ? 0 : -7) : angle);
    }
    if (this.countingLock) {
      this.countingLock.setVisible(sealed || revealing && openProgress < 0.3 || opening && openProgress < 0.22);
      if (revealing) this.countingLock.setY(-96 + eased * 48).setAngle(eased * 28).setAlpha(1 - eased * 2);
      else this.countingLock.setY(-96).setAngle(0).setAlpha(1);
    }
    this.countingBeam?.setAlpha(sealed ? 0.3 : revealing ? 0.65 + eased * 0.35 : 0.45);
    this.countdownLabel?.setText(sealed ? `봉인 해제까지 ${Math.max(1, Math.ceil((14500 - local) / 1000))}…` : revealing ? segmentTime < 1100 ? '천천히… 마지막 봉투가 나옵니다' : '그 이름이 적혀 있습니다' : opening ? '한 표씩, 차분히 확인합니다' : '다음 투표함이 도착하는 중');
    this.countingCue?.setText(sealed ? '아직 열지 않은 이 상자에, 결말이 있습니다' : revealing ? '끝까지 남아 있던 한 장의 봉투' : beat.state === 'settled' ? beat.box === 1 ? '이제 첫 결과. 아직 두 상자가 남았습니다' : '마지막 상자 앞에서 모두가 말을 멈췄습니다' : '후보들은 같은 자리에서 결과를 기다립니다');
    this.countingBallots.forEach((ballot, index) => {
      const age = segmentTime - 180 - index * 66;
      const duration = 1130 + index % 3 * 85;
      const p = age / duration;
      const visible = opening && p > 0 && p < 1;
      ballot.setVisible(visible);
      if (!visible) return;
      const side = index % 2 ? 1 : -1;
      const distance = 54 + index % 5 * 12;
      ballot.setPosition(640 + side * Math.sin(p * Math.PI / 2) * distance, 322 - Math.sin(p * Math.PI) * (54 + index % 4 * 8) + p * 169);
      ballot.setAngle(side * (p * 73 + index * 5)).setAlpha(Math.min(1, p * 8, (1 - p) * 8));
      if (state.reducedMotion) ballot.setVisible(false);
    });
    const envelopeProgress = Phaser.Math.Clamp((segmentTime - 410) / 1450, 0, 1);
    if (this.countingEnvelope) {
      this.countingEnvelope.setVisible(revealing && envelopeProgress > 0);
      this.countingEnvelope.setY(338 - Phaser.Math.Easing.Cubic.Out(envelopeProgress) * 50);
      this.countingEnvelope.setAngle(state.reducedMotion ? 0 : -8 * (1 - envelopeProgress)).setAlpha(Math.min(1, envelopeProgress * 4));
      this.countingEnvelope.setScale(0.82 + envelopeProgress * 0.2);
    }
    const flapOpen = Phaser.Math.Clamp((segmentTime - 1250) / 800, 0, 1);
    this.countingEnvelopeFlap?.setScale(1, 1 - 2 * Phaser.Math.Easing.Cubic.InOut(flapOpen));
    if (revealing && segmentTime >= 1650) {
      const winner = state.candidates.find(candidate => candidate.id === state.winnerId);
      if (winner && this.countingEnvelopeMark) {
        this.countingEnvelopeMark.setText(winner.name).setFontSize(winner.name.length > 10 ? 10 : 15).setWordWrapWidth(98).setY(-10);
        if (!this.finalEnvelopeOpened) {
          this.finalEnvelopeOpened = true;
          this.burst(640, 285, gold, 10, 40);
          this.countingReactions.set(winner.id, { pose: 'surprised', until: time + 800 });
        }
      }
    } else this.countingEnvelopeMark?.setText('?').setFontSize(38).setY(-21);
    if (time > this.countingBubbleUntil && this.countingBubble && this.countingBubble.alpha > 0) this.countingBubble.setAlpha(state.reducedMotion ? 0 : Math.max(0, this.countingBubble.alpha - delta / 250));
    if (time > this.countingBubbleUntil && this.countingPortrait && this.countingPortrait.alpha > 0) this.countingPortrait.setAlpha(state.reducedMotion ? 0 : Math.max(0, this.countingPortrait.alpha - delta / 250));
    this.race.forEach((slot, index) => {
      const rank = ranked.findIndex(candidate => candidate.id === slot.candidate.id);
      const leading = hasResult && slot.candidate.id === leader;
      slot.displayed = Phaser.Math.Linear(slot.displayed, state.percentages[slot.candidate.id] ?? 0, state.reducedMotion ? 1 : 1 - Math.exp(-delta / 280));
      slot.percentage.setText(hasResult ? `${slot.displayed.toFixed(1)}%` : '—');
      slot.position.setText(hasResult ? `${rank + 1}위` : '집계 전').setColor(leading ? '#fbd975' : '#91adbf');
      slot.badge.setText(leading ? revealing ? '직전 집계 선두' : '현재 선두' : `기호 ${index + 1}`).setColor(leading ? '#fbd975' : '#a8c3ce');
      const supported = slot.candidate.id === state.cheeringId;
      slot.support.setVisible(supported);
      slot.frame.setStrokeStyle(leading || supported ? 2 : 1, leading ? colorOf(slot.candidate) : supported ? 0xffaaae : 0x39516c);
      slot.glow.setAlpha(leading ? 0.07 : supported ? 0.05 : 0.025);
      const reaction = this.countingReactions.get(slot.candidate.id);
      slot.citizen.pose = reaction && reaction.until > time ? reaction.pose : sealed && index % 4 === 1 ? 'nervous' : 'idle';
    });
    const gap = hasResult && ranked.length > 1 ? Math.max(0, (state.percentages[ranked[0].id] ?? 0) - (state.percentages[ranked[1].id] ?? 0)) : 0;
    this.marginText?.setText(hasResult ? `선두 격차 ${gap.toFixed(1)}%p` : '첫 결과를 기다립니다');
    if (!state.reducedMotion) {
      this.screenWindows.forEach((window, index) => window.setAlpha(0.13 + Math.sin(time / 1500 + index * 0.4) * 0.035));
      const camera = this.cameras.main;
      camera.setZoom(Phaser.Math.Linear(camera.zoom, sealed ? 1.008 : 1, 1 - Math.exp(-delta / 650)));
      camera.centerOn(640, 360);
    }
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
    else if (state.preview && this.signature(state) !== this.previewSignature) this.syncNewspaperCandidates(state);
    const local = time - this.phaseStart;
    if (state.phase === 'declaration') {
      this.paperHeadline?.setText(state.topic || '오늘의 당선자를 뽑습니다').setFontSize(state.topic.length > 30 ? 23 : 37);
      if (!state.preview && state.candidates.length) this.citizens.forEach((citizen, index) => {
        const focus = Math.floor(local / (4800 / state.candidates.length)) % state.candidates.length;
        citizen.pose = focus === index ? 'wave' : index % 3 === 1 && local > 3800 ? 'bow' : 'idle';
      });
      if (state.preview) this.newspaperCards.forEach((slot, id) => {
        const identity = Number(id) || 1;
        const beat = Math.floor((local + identity * 617) / (2300 + identity % 4 * 230)) % 5;
        slot.citizen.pose = beat === 0 ? 'wave' : beat === 3 && identity % 3 === 1 ? 'bow' : 'idle';
      });
    }
    if (state.phase === 'voting') {
      this.voteCounter?.setText(format.format(Math.floor(state.totalVotes * Math.min(1, local / 4000))));
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
    if (state.phase === 'counting' && this.race.length) this.updateCounting(state, time, delta);
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

import Phaser from 'phaser';
import type { Candidate, ElectionEvent } from '../election';
import { countBeat, type ShowPhase } from '../show';
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
  events?: ElectionEvent[];
};
type Voter = { citizen: PixelCitizen; ballot: Phaser.GameObjects.Rectangle; offset: number; duration: number; lastDrop: number };
type RaceSlot = { candidate: Candidate; panel: Phaser.GameObjects.Container; citizen: PixelCitizen; percentage: Phaser.GameObjects.Text; badge: Phaser.GameObjects.Text; position: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Rectangle; frame: Phaser.GameObjects.Rectangle; support: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Rectangle; cap: Phaser.GameObjects.Rectangle; displayed: number; previous: number; previousRank: number; reactedAt: number; voteAt: number; width: number; height: number; eliminationShare?: number; eliminationWidth?: number };
type VoteMote = { rectangle: Phaser.GameObjects.Rectangle; candidateId: string; age: number; startX: number; startY: number; life: number };
type StoryActor = { candidate: Candidate; citizen: PixelCitizen; name: Phaser.GameObjects.Text; side: number; scale: number };
type StoryCut = { event: ElectionEvent; startedAt: number; duration: number; layer: Phaser.GameObjects.Container; actors: StoryActor[]; props: Phaser.GameObjects.Container[]; stamp: Phaser.GameObjects.Text; lamp: Phaser.GameObjects.Arc; darkness: Phaser.GameObjects.Rectangle; beam: Phaser.GameObjects.Graphics; impactFired: boolean };
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
  private victoryPayoffTitle?: Phaser.GameObjects.Text;
  private victoryPayoffProp?: Phaser.GameObjects.Container;
  private victoryPayoffCaption?: Phaser.GameObjects.Container;
  private victoryPayoffSweat?: Phaser.GameObjects.Container;
  private victoryPayoffStarted = false;
  private victoryPayoffPose: 'nervous' | 'surprised' = 'nervous';
  private lastBoxImpact = 0;
  private screenWindows: Phaser.GameObjects.Rectangle[] = [];
  private countingTitle?: Phaser.GameObjects.Text;
  private countingLocation?: Phaser.GameObjects.Text;
  private countingCue?: Phaser.GameObjects.Text;
  private countingHeadline?: Phaser.GameObjects.Text;
  private countingPortrait?: Phaser.GameObjects.Container;
  private countingProfileCitizens: PixelCitizen[] = [];
  private countingProfilePercentages: Phaser.GameObjects.Text[] = [];
  private countingProfileKey = '';
  private countingBeatKey = '';
  private countingReactions = new Map<string, { pose: 'wave' | 'cheer' | 'surprised' | 'nervous'; until: number }>();
  private countingLastLeader = '';
  private countingCalloutUntil = 0;
  private countingCalloutAt = -10000;
  private countingAverage = 0;
  private countingAxis: Phaser.GameObjects.Text[] = [];
  private countingVotes: VoteMote[] = [];
  private countingLastProgress = -1;
  private storySeen = new Set<string>();
  private storyEliminated = new Set<string>();
  private storyQueue: ElectionEvent[] = [];
  private storyActive?: StoryCut;

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
    this.background(0x0c192b);
    this.countingBeatKey = '';
    this.countingLastLeader = '';
    this.countingCalloutAt = -10000;
    this.countingCalloutUntil = 0;
    this.countingAverage = 100 / state.candidates.length;
    this.countingReactions.clear();
    this.countingPortrait = undefined;
    this.countingProfileKey = '';
    this.countingProfileCitizens = [];
    this.countingProfilePercentages = [];
    this.countingVotes = [];
    this.countingAxis = [];
    this.countingLastProgress = -1;
    this.storySeen.clear();
    this.storyEliminated.clear();
    this.storyQueue = [];
    this.storyActive = undefined;
    for (let i = 0; i < 10; i++) {
      this.rect(this.root, 42 + i * 124, 94, 100, 442, i % 2 ? 0x14293b : 0x11243a);
      for (let j = 0; j < 6; j++) this.screenWindows.push(this.rect(this.root, 60 + i * 124, 116 + j * 59, 64, 12, 0x75aaa9, 0.08));
    }
    const floor = this.add.graphics();
    floor.lineStyle(1, 0x4d87a0, 0.2);
    for (let i = 0; i < 10; i++) floor.lineBetween(640, 551, i * 142, 720);
    [570, 600, 650, 710].forEach(y => floor.lineBetween(0, y, 1280, y));
    this.root.add(floor);
    this.countingTitle = this.text(this.root, '전국 실시간 개표', 50, 76, 20, '#b4cfd6');
    this.countingHeadline = this.text(this.root, '단 한 표도 놓치지 마세요', 616, 48, 31, '#fff1c7', true).setWordWrapWidth(790).setDepth(20);
    this.countingLocation = this.text(this.root, '첫 지역의 표가 도착합니다', 951, 83, 16, '#9ebcc6').setOrigin(1, 0);
    this.countingCue = this.text(this.root, '모든 후보가 같은 결승선을 향합니다', 640, 574, 18, '#bdd4d7', true);
    this.rect(this.root, 976, 118, 261, 441, 0x142d3e).setStrokeStyle(2, 0x3c6975);
    this.text(this.root, '선두 격차', 1106, 132, 15, '#9fc4cb', true);
    this.marginText = this.text(this.root, '0표', 1106, 154, 42, '#fbd975', true);
    this.countdownLabel = this.text(this.root, '끝까지 따라붙습니다', 1106, 210, 14, '#b7d0d4', true);
    const grid = this.add.graphics().setDepth(0);
    grid.lineStyle(1, 0x6ea8b4, 0.17);
    for (let i = 0; i < 5; i++) grid.lineBetween(294 + i * 139, 128, 294 + i * 139, 558);
    this.root.add(grid);
    [0, 1, 2].forEach(index => this.countingAxis.push(this.text(this.root, '', 294 + index * 278, 109, 12, '#8faeba', index > 0)));
    state.candidates.forEach((candidate, index) => {
      const { x, y, width, height } = this.racePosition(index, state.candidates.length);
      const panel = this.add.container(x, y).setDepth(2);
      this.root.add(panel);
      const frame = this.rect(panel, 0, 0, width, height - 3, 0x1b3047, 0.85).setStrokeStyle(1, 0x30495e, 0.7);
      const glow = this.rect(panel, 0, 0, width, height - 3, colorOf(candidate), 0.035);
      this.rect(panel, 0, 0, 4, height - 3, colorOf(candidate));
      const position = this.text(panel, String(index + 1), 24, height / 2 - 11, 19, '#8dadc1', true);
      const support = this.text(panel, '♥', 53, height / 2 - 10, 16, '#ff9b9b').setVisible(candidate.id === state.cheeringId);
      this.text(panel, candidate.name, 70, height / 2 - 12, candidate.name.length > 12 ? 11 : candidate.name.length > 9 ? 13 : 17, '#f9f0dc').setWordWrapWidth(174);
      const badge = this.text(panel, '', 70, height / 2 + 10, 11, '#9cbdc8');
      const barHeight = Math.min(24, height * 0.38);
      this.rect(panel, 252, height / 2 - barHeight / 2 + 3, 556, barHeight, 0x091b2d, 0.6);
      const bar = this.rect(panel, 252, height / 2 - barHeight / 2, 1, barHeight, colorOf(candidate));
      bar.setStrokeStyle(1, 0xffffff, 0.15);
      const cap = this.rect(panel, 252, height / 2 - barHeight / 2, 4, barHeight, 0xf6efd6, 0.65);
      const scale = Math.min(1.85, height / 57);
      const citizen = this.citizen(panel, candidate, index, 252, height - 5, scale);
      citizen.pose = 'idle';
      const percentage = this.text(panel, '0.00%', width - 13, height / 2 - 11, height > 70 ? 23 : 18, candidate.color).setOrigin(1, 0);
      if (!state.reducedMotion) {
        panel.setAlpha(0);
        this.tweens.add({ targets: panel, alpha: 1, duration: 380, delay: index * 27, ease: 'Cubic.out' });
      }
      const value = state.percentages[candidate.id] ?? 0;
      this.race.push({ candidate, panel, citizen, percentage, badge, position, glow, frame, support, bar, cap, displayed: value, previous: value, previousRank: index, reactedAt: -10000, voteAt: -10000, width, height });
    });
    this.root.sort('depth');
  }

  private racePosition(index: number, count: number) {
    const height = Math.min(110, 430 / count);
    const top = 128 + (430 - count * height) / 2;
    return { x: 42, y: top + index * height, width: 910, height };
  }

  private clearCountingPortrait() {
    if (!this.countingPortrait) return;
    const portrait = this.countingPortrait;
    this.citizens = this.citizens.filter(citizen => citizen.root.parentContainer !== portrait);
    this.tweens.killTweensOf(portrait);
    portrait.destroy(true);
    this.countingPortrait = undefined;
    this.countingProfileCitizens = [];
    this.countingProfilePercentages = [];
  }

  private countingProfiles(state: StageState, ranked: Candidate[]) {
    const leaders = ranked.filter(candidate => !this.storyEliminated.has(candidate.id)).slice(0, 2);
    const key = leaders.map(candidate => candidate.id).join(':');
    if (key !== this.countingProfileKey) {
      this.clearCountingPortrait();
      this.countingProfileKey = key;
      const portrait = this.add.container(1106, 258).setDepth(10);
      this.root.add(portrait);
      this.countingPortrait = portrait;
      leaders.forEach((candidate, index) => {
        const row = index * 145;
        this.text(portrait, index ? '맹추격' : '현재 선두', 0, row - 13, 12, index ? '#9ed8d2' : '#fbd975', true);
        this.text(portrait, candidate.name, 0, row + 5, candidate.name.length > 12 ? 12 : 15, '#f7f0dc', true).setWordWrapWidth(224);
        const citizen = this.citizen(portrait, candidate, state.candidates.findIndex(item => item.id === candidate.id), index ? 19 : -16, row + 107, 1.6);
        citizen.pose = index ? 'run' : 'nervous';
        this.countingProfileCitizens.push(citizen);
        this.countingProfilePercentages.push(this.text(portrait, '', index ? -25 : 35, row + 81, 19, candidate.color, true));
      });
      this.root.sort('depth');
    }
    leaders.forEach((candidate, index) => {
      this.countingProfilePercentages[index]?.setText(`${(state.percentages[candidate.id] ?? 0).toFixed(2)}%`);
      const citizen = this.countingProfileCitizens[index];
      if (citizen) citizen.pose = index ? state.progress > 88 ? 'run' : 'wave' : state.progress > 88 ? 'nervous' : 'wave';
    });
  }

  private countReaction(state: StageState, leader: Candidate, previousLeader: string, time: number) {
    const burden = /커피|점심|벌칙|청소/.test(state.topic);
    this.countingReactions.set(leader.id, { pose: burden ? 'surprised' : 'cheer', until: time + 1500 });
    if (previousLeader) this.countingReactions.set(previousLeader, { pose: 'surprised', until: time + 1300 });
    if (this.storyActive || time - this.countingCalloutAt < 2500) return;
    this.countingCalloutAt = time;
    this.countingCalloutUntil = time + 1500;
    this.countingHeadline?.setText(`${leader.name} 후보, 새 선두!`).setFontSize(leader.name.length > 10 ? 25 : 34).setColor('#fbd975').setAlpha(1);
    if (!state.reducedMotion && this.countingHeadline) {
      this.countingHeadline.setY(55);
      this.tweens.add({ targets: this.countingHeadline, y: 48, duration: 380, ease: 'Cubic.out' });
      const slot = this.race.find(item => item.candidate.id === leader.id);
      if (slot) this.burst(slot.panel.x + slot.citizen.root.x, slot.panel.y + slot.height / 2, colorOf(leader), 8, 100);
    }
  }

  private storyProp(parent: Phaser.GameObjects.Container, prop: string, x: number, y: number, color: number) {
    const object = this.add.container(x, y);
    parent.add(object);
    if (/banana|바나나|과일/.test(prop)) {
      this.rect(object, -18, -7, 10, 9, gold);
      this.rect(object, -10, -1, 18, 9, gold);
      this.rect(object, 6, -6, 10, 9, gold);
      this.rect(object, 12, -9, 5, 5, 0x736537);
    } else if (/flag|깃발|응원|현수막|팻말/.test(prop)) {
      this.rect(object, -16, -20, 4, 48, paper);
      this.rect(object, -12, -20, 39, 26, color);
      this.rect(object, -7, -9, 24, 4, paper);
    } else if (/쿠폰|번호표|영수|계약서|장부|공약집|차용|협약서|순서표|구역표|명찰|봉투|종이/.test(prop)) {
      this.rect(object, -17, -20, 34, 40, paper).setStrokeStyle(2, color);
      this.rect(object, -11, -13, 22, 3, color);
      this.rect(object, -11, -5, 22, 2, 0xb2bcb1);
      this.rect(object, -11, 1, 16, 2, 0xb2bcb1);
      this.rect(object, 1, 9, 10, 7, 0xe16a55);
    } else if (/커피|잔|컵/.test(prop)) {
      this.rect(object, -14, -14, 27, 31, paper).setStrokeStyle(2, color);
      this.rect(object, -12, -14, 23, 7, 0x775442);
      this.rect(object, 13, -7, 10, 4, paper);
      this.rect(object, 19, -5, 4, 13, paper);
      this.rect(object, 13, 7, 10, 4, paper);
      this.rect(object, -18, 18, 38, 4, color);
      this.rect(object, -4, -28, 3, 8, paper, 0.45);
      this.rect(object, 4, -25, 3, 6, paper, 0.4);
    } else if (/우산/.test(prop)) {
      this.rect(object, -28, -10, 56, 9, color);
      this.rect(object, -20, -18, 40, 9, color);
      this.rect(object, -10, -23, 20, 6, color);
      this.rect(object, -2, -3, 4, 35, paper);
      this.rect(object, -11, 28, 12, 4, paper);
    } else if (/의자|방석/.test(prop)) {
      this.rect(object, -25, -4, 50, 14, color).setStrokeStyle(2, paper);
      if (prop.includes('의자')) {
        this.rect(object, -25, -27, 8, 25, color);
        this.rect(object, -25, -31, 50, 8, color);
        this.rect(object, -20, 10, 5, 23, paper);
        this.rect(object, 15, 10, 5, 23, paper);
      }
    } else if (/마이크|무전기|확성기/.test(prop)) {
      this.rect(object, -10, -10, 20, 32, 0x4b6475).setStrokeStyle(2, paper);
      this.rect(object, -13, -22, 26, 15, 0x8ca6af);
      this.rect(object, -9, -17, 18, 3, 0x293d52);
      this.rect(object, 4, 1, 4, 5, 0xef7963);
      this.rect(object, -5, 22, 10, 7, 0x2f4354);
    } else if (/등|전광판|타이머|자막|프린터|카메라|센서/.test(prop)) {
      this.rect(object, -25, -18, 50, 36, 0x182b43).setStrokeStyle(3, color);
      this.rect(object, -19, -12, 38, 22, 0x548278);
      this.text(object, prop.includes('카메라') ? '●' : '88', 0, -14, 19, '#f8e6a3', true);
      this.rect(object, 10, 13, 5, 3, 0xef7963);
    } else if (/풍선/.test(prop)) {
      const balloon = this.add.circle(0, -14, 18, color).setStrokeStyle(2, paper);
      object.add(balloon);
      this.rect(object, -2, 5, 4, 34, paper);
      this.rect(object, -8, -23, 5, 8, paper, 0.5);
    } else if (/쿠키|과자|도넛|빵|젤리|사탕|케이크|아이스크림|도시락/.test(prop)) {
      this.rect(object, -24, 16, 48, 4, paper);
      if (/젤리|사탕/.test(prop)) {
        this.rect(object, -18, -15, 36, 28, color).setStrokeStyle(2, paper);
        this.rect(object, -22, -6, 5, 14, color);
        this.rect(object, 17, -6, 5, 14, color);
      } else {
        this.rect(object, -20, -15, 40, 29, 0xe9bb70);
        this.rect(object, -14, -20, 28, 7, 0xe9bb70);
        [[-11, -9], [7, -5], [-1, 6]].forEach(([px, py]) => this.rect(object, px, py, 5, 5, 0x805747));
        if (prop.includes('도넛')) this.rect(object, -6, -4, 12, 10, 0x193247);
      }
    } else if (/양말|슬리퍼|장갑/.test(prop)) {
      this.rect(object, -13, -24, 19, 32, color);
      this.rect(object, -13, 6, 34, 12, color);
      this.rect(object, -13, -18, 19, 5, paper);
      this.rect(object, -13, -6, 19, 5, paper);
    } else if (/충전|케이블/.test(prop)) {
      this.rect(object, -30, -3, 60, 6, color);
      this.rect(object, -36, -10, 9, 20, paper);
      this.rect(object, 27, -10, 9, 20, paper);
    } else if (/별/.test(prop)) {
      this.rect(object, -5, -23, 10, 46, gold);
      this.rect(object, -23, -5, 46, 10, gold);
      this.rect(object, -14, -14, 28, 28, gold);
    } else if (/사진|프레임/.test(prop)) {
      this.rect(object, -25, -20, 50, 40, paper).setStrokeStyle(3, color);
      this.rect(object, -19, -14, 38, 26, 0x618c91);
      this.rect(object, -5, -10, 10, 9, 0xf2c09b);
      this.rect(object, -9, -1, 18, 12, color);
    } else if (/bag|가방|돈|상자|통/.test(prop)) {
      this.rect(object, -21, -13, 42, 31, color).setStrokeStyle(2, 0xffedb6);
      this.rect(object, -11, -22, 22, 5, 0xffedb6);
      this.rect(object, -11, -20, 4, 8, 0xffedb6);
      this.rect(object, 7, -20, 4, 8, 0xffedb6);
      this.text(object, '₩', 0, -12, 21, '#f7f0dc', true);
    } else {
      this.rect(object, -15, -19, 30, 38, paper).setStrokeStyle(2, color);
      this.rect(object, -10, -11, 20, 3, color);
      this.rect(object, -10, -3, 20, 2, 0xb2bcb1);
      this.rect(object, -10, 3, 15, 2, 0xb2bcb1);
      this.rect(object, 0, 9, 9, 7, 0xe16a55);
    }
    return object;
  }

  private storyBurst(layer: Phaser.GameObjects.Container, x: number, y: number, color: number, count = 20) {
    if (this.readState().reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      const speed = 80 + i % 6 * 30;
      const rectangle = this.add.rectangle(x, y, i % 2 ? 8 : 5, 5, i % 3 ? color : paper);
      layer.add(rectangle);
      this.sparks.push({ rectangle, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: 530 + i % 3 * 110, gravity: 280 });
    }
  }

  private startStory(state: StageState, event: ElectionEvent, time: number) {
    const layer = this.add.container(0, 0).setDepth(500);
    this.root.add(layer);
    this.rect(layer, 0, 0, 1280, 720, 0x061022, 0.62);
    const darkness = this.rect(layer, 302, 132, 676, 426, 0x193247).setStrokeStyle(3, 0x93b7be);
    this.rect(layer, 316, 143, 648, 5, event.kind === 'scandal' ? 0xf47761 : gold);
    this.text(layer, event.title, 640, 164, event.title.length > 27 ? 21 : 27, '#fff2cc', true).setWordWrapWidth(616);
    this.text(layer, event.detail, 640, 504, 17, '#d3e3e0', true).setWordWrapWidth(606);
    const beam = this.add.graphics();
    beam.fillStyle(gold, 0.13);
    beam.fillTriangle(640, 180, 420, 488, 860, 488);
    layer.add(beam);
    const lamp = this.add.circle(640, 216, 10, 0xff8466).setVisible(false);
    layer.add(lamp);
    const multiple = event.kind === 'brawl' || event.kind === 'alliance';
    const actors: StoryActor[] = event.actors.slice(0, multiple ? 2 : 1).map((id, index) => {
      const candidate = state.candidates.find(item => item.id === id) ?? state.candidates[index];
      const side = index ? 1 : -1;
      const scale = multiple ? 3.9 : 4.25;
      const x = multiple ? 640 + side * 166 : 640;
      const citizen = this.citizen(layer, candidate, state.candidates.findIndex(item => item.id === candidate.id), x, 446, scale);
      citizen.pose = 'nervous';
      if (index) citizen.root.setScale(-scale, scale);
      const name = this.text(layer, candidate.name, x, 465, candidate.name.length > 12 ? 13 : 17, '#f8efda', true).setWordWrapWidth(multiple ? 228 : 330);
      return { candidate, citizen, name, side, scale };
    });
    const props = Array.from({ length: event.kind === 'scandal' ? 8 : event.kind === 'comeback' ? 6 : 2 }, (_, index) =>
      this.storyProp(layer, event.prop, 640 + (index % 2 ? 1 : -1) * 36, 370, [gold, 0x6dd0c2, 0xec8068][index % 3]).setVisible(false));
    const stamp = this.text(layer, event.kind === 'scandal' ? '후보 탈락' : event.kind === 'alliance' ? '손을 맞잡다!' : event.kind === 'blackout' ? '비상 개표!' : event.kind === 'comeback' ? '맹추격!' : event.kind === 'mishap' ? '앗…!' : '쿵!', 640, 310, event.kind === 'scandal' ? 58 : 45, event.kind === 'scandal' ? '#ef705d' : '#fbd975', true).setStroke('#1a3043', 5).setAlpha(0);
    this.storyActive = { event, startedAt: time, duration: 2300, layer, actors, props, stamp, lamp, darkness, beam, impactFired: false };
    this.countingCalloutUntil = 0;
    this.countingHeadline?.setAlpha(0);
    if (!state.reducedMotion) {
      layer.setAlpha(0);
      this.tweens.add({ targets: layer, alpha: 1, duration: 180, ease: 'Cubic.out' });
    }
    this.root.sort('depth');
  }

  private updateStory(state: StageState, time: number) {
    (state.events ?? []).forEach(event => {
      if (event.progress > state.progress || this.storySeen.has(event.id)) return;
      this.storySeen.add(event.id);
      this.storyQueue.push(event);
      if (event.eliminatedId) this.storyEliminated.add(event.eliminatedId);
    });
    if (!this.storyActive && this.storyQueue.length) this.startStory(state, this.storyQueue.shift()!, time);
    const cut = this.storyActive;
    if (!cut) return;
    const local = time - cut.startedAt;
    const t = Phaser.Math.Clamp(local / cut.duration, 0, 1);
    const motion = (from: number, to: number, start: number, end: number) => Phaser.Math.Linear(from, to, Phaser.Math.Easing.Cubic.InOut(Phaser.Math.Clamp((local - start) / (end - start), 0, 1)));
    const body = cut.actors[0];
    if (state.reducedMotion) {
      cut.actors.forEach(actor => { actor.citizen.pose = cut.event.kind === 'alliance' || cut.event.kind === 'comeback' ? 'cheer' : 'surprised'; });
      cut.stamp.setAlpha(1);
      cut.props.forEach((prop, index) => prop.setVisible(true).setPosition(578 + index % 4 * 39, 435 + Math.floor(index / 4) * 28));
    } else if (cut.event.kind === 'brawl') {
      cut.actors.forEach(actor => {
        const approach = motion(166, 33, 300, 840);
        const recoil = motion(0, 128, 1040, 1900);
        actor.citizen.root.setX(640 + actor.side * (approach + recoil));
        actor.citizen.pose = local < 300 ? 'nervous' : local < 840 ? 'run' : local < 1500 ? 'surprised' : 'nervous';
        actor.citizen.root.setAngle(actor.side * (local > 840 && local < 1720 ? Math.sin((local - 840) / 880 * Math.PI) * 17 : 0));
        actor.name.setX(640 + actor.side * 166);
      });
      cut.stamp.setAlpha(local >= 840 && local < 1470 ? 1 : 0).setScale(1 + Math.max(0, 1 - Math.abs(local - 870) / 220) * 0.35).setAngle(-7);
      cut.props.forEach((prop, index) => prop.setVisible(local > 845 && local < 1680).setPosition(640 + (index ? 1 : -1) * motion(35, 120, 845, 1550), 385 - Math.sin(Phaser.Math.Clamp((local - 845) / 840, 0, 1) * Math.PI) * 78).setAngle((local - 845) * (index ? 0.16 : -0.16)));
    } else if (cut.event.kind === 'scandal') {
      cut.props.forEach((prop, index) => {
        const p = Phaser.Math.Clamp((local - 260 - index * 76) / 760, 0, 1);
        prop.setVisible(local > 260 + index * 76).setPosition(675 + (index % 2 ? 1 : -1) * p * (62 + index * 9), 364 - Math.sin(p * Math.PI) * 54 + p * 101).setAngle((index % 2 ? 1 : -1) * p * 63);
      });
      if (body) {
        const exit = Phaser.Math.Clamp((local - 1320) / 780, 0, 1);
        body.citizen.pose = local < 900 ? 'nervous' : 'surprised';
        body.citizen.root.setPosition(640 + Phaser.Math.Easing.Cubic.In(exit) * 234, 446 + exit * 64).setAngle(exit * 48).setAlpha(1 - exit * 0.8);
        body.name.setX(body.citizen.root.x).setAlpha(1 - exit);
      }
      const stamp = Phaser.Math.Clamp((local - 1050) / 250, 0, 1);
      cut.stamp.setAlpha(stamp).setScale(2.2 - Phaser.Math.Easing.Cubic.In(stamp) * 1.2).setAngle(-9);
    } else if (cut.event.kind === 'mishap') {
      if (body) {
        const slip = motion(0, 1, 300, 900);
        const stand = motion(0, 1, 1310, 1940);
        body.citizen.root.setPosition(540 + slip * 154, 446 + slip * 19 - stand * 19).setAngle(slip * (1 - stand) * 62);
        body.citizen.pose = local < 300 ? 'walk' : local < 1460 ? 'surprised' : 'bow';
        body.name.setX(body.citizen.root.x);
      }
      cut.props.forEach((prop, index) => prop.setVisible(local > 230).setPosition(index ? motion(576, 784, 550, 1220) : 612, index ? 375 - Math.sin(Phaser.Math.Clamp((local - 550) / 800, 0, 1) * Math.PI) * 93 + motion(0, 67, 550, 1300) : 451).setAngle(index ? motion(0, 163, 550, 1350) : -8));
      cut.stamp.setAlpha(local > 700 && local < 1420 ? 1 : 0).setAngle(-10);
    } else if (cut.event.kind === 'alliance') {
      cut.actors.forEach(actor => {
        const distance = motion(166, 47, 220, 840);
        actor.citizen.root.setX(640 + actor.side * distance);
        actor.citizen.pose = local < 840 ? 'walk' : local < 1590 ? 'vote' : 'wave';
        actor.citizen.gestureProgress = 0.65;
        actor.name.setX(640 + actor.side * 151);
      });
      cut.props.forEach((prop, index) => prop.setVisible(local > 930).setPosition(640 + (index ? 1 : -1) * 37, 380 - Math.sin((local - 930) / 440) * 4).setScale(0.6));
      cut.stamp.setAlpha(Phaser.Math.Clamp((local - 1030) / 300, 0, 1)).setFontSize(34).setY(252);
    } else if (cut.event.kind === 'blackout') {
      cut.darkness.setFillStyle(0x020713).setAlpha(local < 310 ? 1 - local / 310 * 0.65 : local < 1620 ? 0.96 : 0.96 - (local - 1620) / 600 * 0.25);
      cut.beam.setAlpha(local < 450 ? 0 : local < 1670 ? 0.28 + Math.sin(local / 135) * 0.12 : 1);
      cut.lamp.setVisible(local > 310).setAlpha(0.55 + Math.sin(local / 120) * 0.35);
      cut.stamp.setAlpha(local > 550 ? 1 : 0).setFontSize(36).setY(265);
      if (body) { body.citizen.pose = 'surprised'; body.citizen.root.setAngle(Math.sin(local / 250) * 4); }
      cut.props.forEach((prop, index) => prop.setVisible(local > 630).setPosition(605 + index * 78, 390).setAngle(-19 + index * 20));
    } else if (cut.event.kind === 'comeback') {
      if (body) {
        body.citizen.root.setX(motion(447, 788, 240, 1520)).setAngle(local < 1540 ? 7 : 0);
        body.citizen.pose = local < 1540 ? 'run' : 'cheer';
        body.name.setX(body.citizen.root.x);
      }
      cut.props.forEach((prop, index) => prop.setVisible(local > 300 + index * 100).setPosition(396 + index * 86, 454 + Math.sin(local / 240 + index) * 11).setAngle(Math.sin(local / 190 + index) * 10).setScale(0.8));
      cut.stamp.setAlpha(Phaser.Math.Clamp((local - 700) / 350, 0, 1)).setY(275).setFontSize(43);
    }
    const impactAt = cut.event.kind === 'scandal' ? 1260 : cut.event.kind === 'brawl' ? 845 : 920;
    if (!cut.impactFired && local > impactAt) {
      cut.impactFired = true;
      this.storyBurst(cut.layer, 640, cut.event.kind === 'scandal' ? 353 : 402, cut.event.kind === 'scandal' ? 0xef705d : gold, cut.event.kind === 'blackout' ? 8 : 22);
    }
    if (t > 0.9) cut.layer.setAlpha(Math.max(0, (1 - t) / 0.1));
    if (local >= cut.duration) {
      this.citizens = this.citizens.filter(citizen => citizen.root.parentContainer !== cut.layer);
      this.sparks = this.sparks.filter(spark => spark.rectangle.parentContainer !== cut.layer);
      this.destroyPhase(cut.layer);
      this.storyActive = undefined;
    }
  }

  private updateCounting(state: StageState, time: number, delta: number) {
    this.updateStory(state, time);
    const beat = countBeat(state.elapsed);
    const key = `${beat.id}:${beat.state}`;
    const ranked = [...state.candidates].filter(candidate => !this.storyEliminated.has(candidate.id)).sort((a, b) => (state.percentages[b.id] ?? 0) - (state.percentages[a.id] ?? 0));
    const leader = ranked.find(candidate => !this.storyEliminated.has(candidate.id)) ?? ranked[0];
    if (this.countingLastLeader && leader.id !== this.countingLastLeader) this.countReaction(state, leader, this.countingLastLeader, time);
    this.countingLastLeader = leader.id;
    if (key !== this.countingBeatKey) { this.countingBeatKey = key; this.countingTitle?.setText(beat.box === 3 ? '마지막 지역 · 끝까지 추격' : `${beat.location} · 실시간 집계`); }
    const survivors = state.candidates.filter(candidate => !this.storyEliminated.has(candidate.id));
    const active = Math.max(2, survivors.length);
    const activeAverage = survivors.reduce((sum, candidate) => sum + (state.percentages[candidate.id] ?? 0), 0) / active;
    this.countingAverage = Phaser.Math.Linear(this.countingAverage, activeAverage, state.reducedMotion ? 1 : 1 - Math.exp(-delta / 650));
    const minimum = Math.max(0, this.countingAverage - 2);
    const maximum = this.countingAverage + 2;
    this.countingAxis.forEach((axis, index) => axis.setText(index === 1 ? `${this.countingAverage.toFixed(1)}%` : `${(index ? maximum : minimum).toFixed(1)}%`));
    const finalists = ranked.filter(candidate => !this.storyEliminated.has(candidate.id)).slice(0, 2);
    const gap = finalists.length > 1 ? Math.max(0, (state.percentages[finalists[0].id] ?? 0) - (state.percentages[finalists[1].id] ?? 0)) : 0;
    const counted = state.totalVotes * state.progress / 100;
    const gapVotes = Math.max(0, Math.round(counted * gap / 100));
    this.marginText?.setText(`${format.format(gapVotes)}표`);
    this.countdownLabel?.setText(state.progress >= 90 ? `${gap.toFixed(2)}%p · 끝까지 초접전` : `${gap.toFixed(2)}%p 차이`);
    this.countingLocation?.setText(`개표 ${state.progress.toFixed(1)}% · ${active}명 경쟁 중`);
    const late = state.elapsed > 23000;
    const finalSlow = state.elapsed > 25200;
    this.countingCue?.setText(beat.state === 'sealed' ? '남은 지역의 표가 들어옵니다…' : finalSlow ? '마지막 한 표까지…' : late ? '상위권이 붙었습니다. 결승선은 아직입니다' : '득표율과 캐릭터의 움직임을 함께 지켜보세요');
    if (this.storyActive) this.countingHeadline?.setAlpha(0);
    else if (time > this.countingCalloutUntil) this.countingHeadline?.setText(late ? `막판 추격 · 단 ${format.format(gapVotes)}표 차!` : '모든 후보에게 남아 있는 한 표').setFontSize(late ? 32 : 28).setColor(late ? '#fbd975' : '#d6e6e3').setAlpha(1);
    this.countingProfiles(state, ranked);
    const gaining = state.progress > this.countingLastProgress + 0.0001;
    this.race.forEach((slot, index) => {
      const raw = state.percentages[slot.candidate.id] ?? 0;
      const rank = ranked.findIndex(candidate => candidate.id === slot.candidate.id);
      const eliminated = this.storyEliminated.has(slot.candidate.id);
      if (eliminated && slot.eliminationShare === undefined) {
        slot.eliminationShare = Math.max(0.001, slot.displayed);
        slot.eliminationWidth = slot.bar.displayWidth;
      }
      const growth = raw - slot.previous;
      if (rank <= slot.previousRank - 2 && !eliminated && time - slot.reactedAt > 1500) {
        slot.reactedAt = time;
        this.countingReactions.set(slot.candidate.id, { pose: index % 2 ? 'wave' : 'cheer', until: time + 850 });
      }
      slot.previous = raw;
      slot.previousRank = rank;
      slot.displayed = Phaser.Math.Linear(slot.displayed, raw, state.reducedMotion ? 1 : 1 - Math.exp(-delta / (finalSlow ? 170 : 110)));
      const width = eliminated ? (slot.eliminationWidth ?? 0) * Phaser.Math.Clamp(slot.displayed / (slot.eliminationShare ?? 1), 0, 1) : 556 * Phaser.Math.Clamp((slot.displayed - minimum) / (maximum - minimum), 0.012, 1);
      const barHeight = Math.min(24, slot.height * 0.38);
      slot.bar.setDisplaySize(Math.max(1, width), barHeight).setAlpha(eliminated ? 0.25 : 1);
      slot.cap.setX(252 + width - 4).setAlpha(eliminated ? 0 : 0.68);
      slot.citizen.root.setX(252 + width + 3).setAlpha(eliminated ? 0.23 : 1);
      slot.percentage.setText(`${raw.toFixed(2)}%`).setAlpha(eliminated ? 0.36 : 1);
      slot.position.setText(eliminated ? '×' : String(rank + 1)).setColor(rank === 0 ? '#fbd975' : '#a6c5cc');
      slot.badge.setText(eliminated ? '후보 탈락' : slot.height > 62 ? rank === 0 ? '선두' : growth > 0.001 ? '표가 몰립니다' : '추격 중' : '').setColor(eliminated ? '#e88073' : '#9cbdc8');
      const support = slot.candidate.id === state.cheeringId;
      slot.support.setVisible(support);
      slot.frame.setStrokeStyle(rank === 0 || support ? 2 : 1, rank === 0 ? colorOf(slot.candidate) : support ? 0xffaaae : 0x30495e);
      slot.glow.setAlpha(eliminated ? 0.012 : rank === 0 ? 0.08 + (state.reducedMotion ? 0 : Math.sin(time / 380) * 0.015) : support ? 0.06 : 0.028);
      const reaction = this.countingReactions.get(slot.candidate.id);
      slot.citizen.pose = eliminated ? 'bow' : reaction && reaction.until > time ? reaction.pose : growth > 0.003 ? index % 2 ? 'walk' : 'run' : late && rank < 3 ? rank ? 'run' : 'nervous' : index % 4 === 1 ? 'nervous' : 'idle';
      if (gaining && !eliminated && !state.reducedMotion && time - slot.voteAt > 460 + index * 29) {
        slot.voteAt = time;
        const startX = slot.panel.x + 252 + width - 61;
        const startY = slot.panel.y + slot.height / 2 - 12;
        const rectangle = this.add.rectangle(startX, startY, 6, 9, paper).setStrokeStyle(1, colorOf(slot.candidate)).setDepth(25);
        this.root.add(rectangle);
        this.countingVotes.push({ rectangle, candidateId: slot.candidate.id, age: 0, startX, startY, life: finalSlow ? 660 : 390 + index % 3 * 35 });
      }
    });
    this.countingLastProgress = state.progress;
    this.countingVotes = this.countingVotes.filter(mote => {
      const slot = this.race.find(item => item.candidate.id === mote.candidateId);
      mote.age += delta;
      if (!slot || mote.age >= mote.life) { mote.rectangle.destroy(); return false; }
      const p = mote.age / mote.life;
      const targetX = slot.panel.x + slot.citizen.root.x - 8;
      mote.rectangle.setPosition(Phaser.Math.Linear(mote.startX, targetX, p), mote.startY - Math.sin(p * Math.PI) * 9 + p * 11).setAngle(p * 27).setAlpha(1 - Math.max(0, p - 0.8) * 5);
      return true;
    });
    if (!state.reducedMotion) {
      this.screenWindows.forEach((window, index) => window.setAlpha(0.1 + Math.sin(time / 900 + index * 0.7) * 0.045));
      const camera = this.cameras.main;
      camera.setZoom(Phaser.Math.Linear(camera.zoom, late ? 1.012 : 1, 1 - Math.exp(-delta / 750)));
      camera.centerOn(640, 356);
    }
  }
  private victory(state: StageState) {
    this.background(0x23213f);
    this.victoryPayoffStarted = false;
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
    this.victoryPayoffTitle = title;
    this.rect(this.root, 389, 484, 502, 89, colorOf(candidate));
    this.rect(this.root, 329, 552, 622, 63, gold);
    this.rect(this.root, 279, 613, 722, 37, 0xe6bc58);
    this.text(this.root, candidate.name, 640, 565, candidate.name.length > 10 ? 33 : 45, '#14223b', true);
    this.winner = this.citizen(this.root, candidate, state.candidates.indexOf(candidate), 640, 480, 5.9);
    this.winner.pose = 'cheer';
    // The celebration has a second beat: a wonderfully serious prop arrives to claim the promise.
    const prop = this.add.container(state.reducedMotion ? 943 : 1460, 486).setVisible(false);
    this.root.add(prop);
    this.victoryPayoffProp = prop;
    this.victoryPayoffPose = /커피|점심|벌칙|청소/.test(state.topic) ? 'nervous' : 'surprised';
    let payoff = '축하합니다.\n이제 임무를 시작해 주세요.';
    if (state.topic.includes('커피')) {
      this.rect(prop, 57, -139, 63, 91, paper).setStrokeStyle(3, 0xc6b896);
      this.rect(prop, 71, -122, 34, 56, 0x23213f);
      this.rect(prop, -78, -169, 152, 165, paper).setStrokeStyle(3, 0xc6b896);
      this.rect(prop, -82, -181, 164, 18, 0xa57e61);
      this.rect(prop, -87, -188, 174, 10, gold);
      this.rect(prop, -78, -108, 152, 57, 0x61aaa1);
      this.text(prop, 'COFFEE', -2, -99, 24, '#153b3d', true);
      this.text(prop, `× ${state.candidates.length}`, -2, -59, 37, '#544f42', true);
      for (let i = 0; i < 3; i++) this.rect(prop, -41 + i * 34, -219 - i % 2 * 10, 9, 24, paper, 0.7);
      payoff = '축하합니다.\n이제 커피를 사 주세요.';
    } else if (state.topic.includes('점심')) {
      const plate = this.add.ellipse(0, -79, 238, 163, paper).setStrokeStyle(4, 0xc5c4ad);
      prop.add(plate);
      const rice = this.add.ellipse(-36, -87, 83, 57, 0xfef9e8);
      prop.add(rice);
      this.rect(prop, 22, -115, 61, 32, 0xc96546).setStrokeStyle(3, 0x9c513d);
      this.rect(prop, 21, -69, 43, 24, 0x76a871);
      this.rect(prop, -87, -14, 173, 10, 0xd3b55b);
      this.rect(prop, 116, -160, 7, 160, gold).setAngle(11);
      this.rect(prop, 135, -156, 7, 156, gold).setAngle(11);
      this.text(prop, '점 심 당 번', 0, 5, 25, '#fbd975', true);
      payoff = '당선 축하드립니다.\n오늘 점심은 잘 먹겠습니다.';
    } else if (state.topic.includes('벌칙')) {
      prop.setAngle(-8);
      this.rect(prop, -100, -206, 200, 198, 0xf5d267).setStrokeStyle(5, 0x9f6d45);
      this.rect(prop, -84, -188, 168, 145, 0x172a40);
      this.text(prop, '!', 0, -186, 96, '#ff7957', true);
      this.text(prop, '벌 칙 집 행', 0, -71, 25, '#f5d267', true);
      this.text(prop, '당 선 자 전 용', 0, -33, 17, '#6f543b', true);
      payoff = '국민이 지켜보고 있습니다.\n벌칙을 이행해 주세요.';
    } else if (state.topic.includes('청소')) {
      prop.setAngle(11);
      this.rect(prop, -8, -239, 16, 194, 0xb4885b).setStrokeStyle(2, 0x6d533e);
      this.rect(prop, -59, -51, 118, 47, gold).setStrokeStyle(3, 0xb48c4e);
      for (let i = 0; i < 9; i++) this.rect(prop, -53 + i * 13, -39, 5, 35, 0xb9914e);
      this.rect(prop, 75, -92, 83, 88, 0x6fbdc3).setStrokeStyle(3, 0x316e7c);
      this.rect(prop, 79, -97, 75, 14, 0xd8e7df);
      this.rect(prop, 111, -126, 7, 35, paper);
      this.text(prop, '청소 시작', 54, 7, 25, '#fbd975', true);
      payoff = '깨끗한 미래가 기다립니다.\n빗자루도 기다립니다.';
    } else if (state.topic.includes('발표')) {
      this.rect(prop, -5, -173, 10, 169, 0xb5c8c9);
      this.rect(prop, -65, -7, 130, 15, gold);
      this.rect(prop, -27, -244, 54, 76, 0xa3bbc4).setStrokeStyle(4, 0x40556b);
      this.rect(prop, -21, -241, 42, 44, 0xdde3d8);
      for (let i = 0; i < 5; i++) this.rect(prop, -21, -233 + i * 8, 42, 3, 0x627b87);
      this.rect(prop, -33, -190, 8, 23, gold);
      this.rect(prop, 25, -190, 8, 23, gold);
      this.text(prop, 'ON AIR', 0, 17, 29, '#ffb493', true);
      payoff = '무대는 준비됐습니다.\n첫 문장을 기다립니다.';
    } else {
      this.rect(prop, -93, -180, 186, 175, paper).setStrokeStyle(4, 0xc3b394);
      this.rect(prop, -73, -160, 146, 49, gold);
      this.text(prop, '임명장', 0, -153, 27, '#544f42', true);
      this.text(prop, '✓', 0, -103, 65, '#61aaa1', true);
      this.text(prop, '업 무 개 시', 0, -36, 20, '#544f42', true);
    }
    const caption = this.add.container(300, 286).setAlpha(0);
    this.root.add(caption);
    this.victoryPayoffCaption = caption;
    this.rect(caption, -177, -16, 354, 105, paper).setStrokeStyle(3, 0xc4b591);
    this.text(caption, '공약 이행 안내', 0, -2, 15, '#a16b48', true);
    this.text(caption, payoff, 0, 24, 22, '#2b3a47', true).setAlign('center');
    const sweat = this.add.container(702, 208).setVisible(false);
    this.root.add(sweat);
    this.victoryPayoffSweat = sweat;
    this.rect(sweat, 3, 0, 7, 15, 0xa7e1e5);
    this.rect(sweat, 0, 7, 13, 14, 0xa7e1e5);
    this.rect(sweat, 2, 18, 9, 5, 0x6bb6cc);
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
      const payoffAt = 2100;
      const payoffTime = local - payoffAt;
      if ((state.reducedMotion || local >= payoffAt) && !this.victoryPayoffStarted) {
        this.victoryPayoffStarted = true;
        this.victoryPayoffTitle?.setText('공약 이행 시작').setFontSize(52);
        this.victoryPayoffProp?.setVisible(true);
        this.victoryPayoffSweat?.setVisible(true);
        if (state.reducedMotion) {
          this.victoryPayoffProp?.setX(943);
          this.victoryPayoffCaption?.setAlpha(1);
        } else {
          if (this.victoryPayoffProp) this.tweens.add({ targets: this.victoryPayoffProp, x: 943, duration: 570, ease: 'Cubic.out', onComplete: () => this.burst(943, 485, gold, 10, 90) });
          if (this.victoryPayoffCaption) this.tweens.add({ targets: this.victoryPayoffCaption, alpha: 1, duration: 400, delay: 220, ease: 'Cubic.out' });
          if (this.victoryPayoffTitle) {
            this.tweens.killTweensOf(this.victoryPayoffTitle);
            this.victoryPayoffTitle.setScale(0.94);
            this.tweens.add({ targets: this.victoryPayoffTitle, scaleX: 1, scaleY: 1, duration: 400, ease: 'Cubic.out' });
          }
        }
      }
      if (this.winner) this.winner.pose = state.reducedMotion ? this.victoryPayoffPose : local < 1080 ? 'run' : local < 1580 ? 'bow' : local < payoffAt ? 'cheer' : payoffTime < 620 ? 'surprised' : this.victoryPayoffPose;
      if (this.victoryPayoffStarted && this.victoryPayoffSweat && !state.reducedMotion) {
        const drop = Math.max(0, payoffTime) % 1100 / 1100;
        this.victoryPayoffSweat.setY(208 + drop * 19).setAlpha(1 - drop * 0.65);
      }
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

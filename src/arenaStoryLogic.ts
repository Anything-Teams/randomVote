import { arenaAction, arenaBeat, arenaCatchTargets, arenaChargeState, arenaDoubleShoveTargets, arenaEdgeTargets, arenaRamTargets, arenaShoveTargets, arenaSpinTargets, arenaTechniqueTargets, arenaWrestlingPresentation, type ArenaRound } from './arenaLogic';
import { arenaPairRushTargets } from './arenaPairRush';
import { arenaEscapeTargets } from './arenaEscape';
import { arenaRecoveryTargets } from './arenaRecovery';
import { arenaRimTargets } from './arenaRimEvent';
import { arenaRimChargeTargets } from './arenaRimCharge';
import { arenaFloorExitTiming } from './arenaTechniques';
import { arenaPairDodgeTargets } from './arenaPairDodge';
import { ARENA_PASSING_TRIP_TIMING } from './arenaPassingTrip';
import { arenaSlideTripTargets } from './arenaSlideTrip';
import { arenaSupermanPunchTargets } from './arenaSupermanPunch';
import { arenaKickCatchTargets } from './arenaKickCatch';

export type ArenaStoryState = {
  kind: string;
  label: string;
  action: string;
  left: string[];
  right: string[];
  relation: string;
  relationLabel: string;
  leftLabel?: string;
  rightLabel?: string;
  intruderLabel?: string;
  intruderId?: string;
  steps: string[];
  step: number;
};

/** The same beat drives the bodies and the explanation of their relationship. */
export function arenaStoryState(round: ArenaRound, elapsed: number): ArenaStoryState {
  if (round.wrestlingMove && elapsed >= round.wrestlingMove.start && elapsed < round.resolve) {
    const beat = arenaWrestlingPresentation(round, elapsed);
    return { kind: `wrestling-${round.wrestlingMove.kind}`, label: beat.title, action: beat.detail,
      left: [round.aggressor], right: [round.victim], relation: beat.reverse && beat.step < 3 ? '←' : '→', relationLabel: beat.label,
      leftLabel: beat.reverse ? '돌진을 받아내는 선수' : '기술을 거는 선수', rightLabel: beat.reverse && beat.step < 3 ? '달려오는 선수' : '기술을 받는 선수', steps: beat.steps, step: beat.step };
  }
  if (round.kickCatch && elapsed >= round.kickCatch.start && elapsed < round.resolve) {
    const frame = arenaKickCatchTargets(round.kickCatch, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    const steps = ['달려들기', '발 딛고 도약', '옆차기', '발목 잡기', '한 바퀴 회전', '손 놓아 던지기'];
    const step = frame.stage === 'approach' ? 0 : frame.stage === 'load' || frame.stage === 'jump' ? 1 : frame.stage === 'kick' ? 2 : frame.stage === 'catch' ? 3 : frame.stage === 'spin' ? 4 : 5;
    return { kind: 'kick-catch', label: step < 3 ? '도약해 옆차기!' : step === 3 ? '킥 캐치! 발목을 잡았다' : step === 4 ? '발목 잡고 한 바퀴!' : '회전 끝에서 던지기!',
      action: ['현재 위치에서 상대를 향해 속도를 붙입니다.', '발을 딛고 도약해 옆차기할 다리를 준비합니다.', '공중에서 한 발을 상대에게 뻗습니다. 상대는 발목을 잡을 틈을 봅니다.', '두 손이 실제 발목에 닿았습니다. 잡은 발을 놓지 않고 몸을 틀 준비를 합니다.', '발을 고쳐 딛으며 정확히 한 바퀴 돕니다. 잡힌 선수의 몸이 발목을 중심으로 돌아갑니다.', '회전의 힘을 실어 손을 놓습니다. 발목이 잡혔던 선수만 장외로 날아갑니다.'][step],
      left: [round.aggressor], right: [round.victim], relation: step < 3 ? '←' : step < 5 ? '↶' : '→', relationLabel: step < 3 ? '상대의 옆차기' : step < 5 ? '발목 잡아 회전 반격' : '회전 던지기 · 상대만 장외', leftLabel: '발목을 잡아 반격하는 선수', rightLabel: step < 3 ? '옆차기를 하는 선수' : '발목이 잡힌 선수', steps, step };
  }
  if (round.supermanPunch && elapsed >= round.supermanPunch.start && elapsed < round.resolve) {
    const frame = arenaSupermanPunchTargets(round.supermanPunch, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    const hit = round.supermanPunch.hitAt != null && elapsed >= round.supermanPunch.hitAt;
    const steps = ['속도 붙여 달리기', '발을 딛고 힘 모으기', '무릎 접어 도약', '한쪽 주먹 뻗기', '공격자 두 발 착지', hit ? '맞은 선수만 장외' : '다시 자세 고치기'];
    const step = Math.max(0, ['approach', 'load', 'jump', 'punch', 'land', 'recover'].indexOf(frame.stage));
    return { kind: 'superman-punch', label: step < 2 ? '달려들어 발을 딛는다' : step < 4 ? '도약 · 슈퍼맨 펀치!' : hit ? '공격자는 착지 · 상대만 장외' : '두 발로 착지해 중심을 잡는다',
      action: [
        '상대의 얼굴 앞을 보며 현재 위치에서 발을 박차 속도를 붙입니다.',
        '앞발을 모래에 딛고 무릎을 굽힙니다. 한 손은 당기고 반대팔로 몸의 균형을 잡습니다.',
        '모래를 박차고 뛰어올라 무릎을 접습니다. 상대를 보며 몸을 틀어 주먹을 준비합니다.',
        hit ? '공중에서 뻗은 주먹이 상대의 턱 부근에 닿았습니다! 맞은 선수만 타격 방향으로 날아갑니다.' : '공중에서 한쪽 주먹을 상대의 얼굴 앞으로 뻗습니다. 반대팔은 접어 몸의 균형을 잡습니다.',
        hit ? '공격한 선수는 발을 내밀어 모래판 안에 두 발로 착지합니다. 주먹을 맞은 상대만 바깥으로 날아갑니다.' : '공격한 선수는 발을 내려 모래판 안에 착지합니다. 무릎을 굽혀 착지의 힘을 받습니다.',
        hit ? '주먹을 맞은 상대만 모래판 밖으로 나갑니다. 공격한 선수는 안쪽에서 주먹을 거두고 다음 상대를 봅니다.' : '착지한 자리에서 주먹을 거두고 중심을 바로잡습니다. 상대를 보며 다음 공방을 준비합니다.',
      ][step], left: [round.aggressor], right: [round.victim], relation: step < 2 ? '→' : '↗',
      relationLabel: step < 2 ? '달리기 · 발 딛기' : step < 4 ? hit ? '공중 펀치 적중' : '도약 · 한쪽 주먹 뻗기' : hit ? '공격자는 착지 · 맞은 상대 장외' : '모래판 안에 착지',
      leftLabel: '도약해 주먹을 뻗는 선수', rightLabel: hit ? '주먹을 맞아 장외로 날아가는 선수' : '달려오는 상대를 보는 선수', steps, step };
  }
  if (round.slideTrip && elapsed >= round.slideTrip.start && elapsed < round.resolve) {
    const frame = arenaSlideTripTargets(round.slideTrip, elapsed, { x: 500, y: 416 }, undefined, round.contactSide);
    if (round.slideTrip.evade) {
      const steps = ['거리 두고 달리기', '발부터 슬라이딩', '두 발로 뛰어오르기', '발 아래로 빗나갔다', '모래판 안에 착지', '일어서서 다시 겨루기'];
      const step = Math.max(0, ['approach', 'slide', 'jump', 'pass', 'land', 'recover'].indexOf(frame.stage));
      return { kind: 'slide-trip', label: step < 2 ? '거리를 두고 슬라이딩!' : step < 4 ? '두 발 점프로 피했다!' : '안에 착지하고 다시 겨룬다',
        action: [
          '상대와 벌어진 거리에서 발을 박차 속도를 붙입니다. 지금 선 자리부터 달려듭니다.',
          '발을 먼저 뻗고 모래 위로 미끄러집니다. 상대는 다가오는 발을 보며 뛰어오를 타이밍을 잡습니다.',
          '두 발로 모래를 박차고 두 무릎을 접어 뛰어오릅니다. 슬라이딩한 발이 두 발 아래로 들어옵니다.',
          '떠 있는 두 발 아래로 태클이 지나갑니다. 발목에 걸리지 않아 누구도 넘어지지 않았습니다.',
          '피한 선수는 모래판 안에 두 발로 착지합니다. 태클한 선수는 손과 발로 몸을 일으킵니다.',
          '둘 다 모래판 안에 남았습니다. 공격한 선수도 자세를 바로잡고 다음 공방을 이어갑니다.',
        ][step], left: [round.aggressor], right: [round.victim], relation: step < 2 ? '→' : '↗',
        relationLabel: step < 2 ? '벌어진 거리에서 접근' : step < 4 ? '두 발 점프 · 태클 회피' : '두 선수 모두 안쪽 · 다음 공방',
        leftLabel: '슬라이딩하고 일어서는 선수', rightLabel: '두 발로 뛰어 피하는 선수', steps, step };
    }
    const steps = ['달려들기', '모래 위 슬라이딩', '지지발 걸기', '뒤로 넘어졌다', '바로 일어서기', '몸통 발차기', '차인 선수 장외'];
    const step = Math.max(0, ['approach', 'slide', 'hook', 'fall', 'rise', 'kick', 'release'].indexOf(frame.stage));
    const hooked = round.slideTrip.hookAt != null && elapsed >= round.slideTrip.hookAt;
    return { kind: 'slide-trip', label: step === 0 ? '낮게 달려들 틈을 노린다' : step < 3 ? '슬라이딩 발걸기!' : step < 5 ? '걸어 넘어뜨리고 바로 일어서기' : '일어서며 몸통을 찬다!',
      action: [
        '상대의 지지발을 보고 발을 박차 속도를 붙입니다. 미끄러져 들어갈 거리를 살핍니다.',
        '발을 앞으로 뻗고 몸을 낮춰 모래 위로 미끄러집니다. 상대의 지지발에 가까워집니다.',
        hooked ? '뻗은 발이 상대의 발목에 닿았습니다! 지지발이 풀리고 몸의 중심이 뒤로 무너집니다.' : '뻗은 발로 상대의 지지발을 노립니다. 아직 몸이 넘어지지는 않았습니다.',
        '발목에 걸린 선수가 뒤로 넘어집니다. 슬라이딩한 선수는 모래에 손을 짚고 속도를 멈춥니다.',
        '손과 지지발로 모래를 밀고 바로 몸을 일으킵니다. 상대는 누운 자리에서 중심을 고칩니다.',
        '한 발로 단단히 서서 다른 발바닥을 넘어진 상대의 몸통으로 뻗어 찹니다.',
        '몸통에 발차기를 맞은 선수만 차인 방향으로 장외로 나갑니다. 공격한 선수는 모래판 안에 남습니다.',
      ][step], left: [round.aggressor], right: [round.victim], relation: step < 4 ? '↘' : '→',
      relationLabel: step < 3 ? '모래 위로 접근 · 발목 걸기' : step < 5 ? '넘어뜨리고 일어서기' : '몸통 발차기 · 상대만 장외',
      leftLabel: '슬라이딩하고 일어서서 차는 선수', rightLabel: '지지발이 걸린 선수', steps, step };
  }
  if (round.linkedRush && round.helper && elapsed >= round.linkedRush.start && elapsed < round.resolve) {
    const launched = round.linkedRush.launchAt != null && elapsed >= round.linkedRush.launchAt;
    const contacted = round.rushContactAt !== undefined && elapsed >= round.rushContactAt;
    const shared = contacted ? arenaPairRushTargets(round, elapsed, { x: 500, y: 416 }) : undefined;
    const step = !launched ? 0 : !contacted ? 1 : shared!.stage === 'contact' || shared!.stage === 'rebound' ? 2 : shared!.stage === 'groggy' ? 3 : shared!.stage === 'grip' ? 4 : shared!.stage === 'lift' || shared!.stage === 'overhead' ? 5 : 6;
    const steps = ['나란히 팔 뻗기', '둘이 함께 달리기', '목 · 가슴에 팔 충돌', '넘어져 그로기', '어깨 · 발끝 잡기', '둘이 함께 머리 위로', '붙잡힌 선수만 장외'];
    return { kind: 'linked-rush', label: step < 2 ? '둘이 함께 돌진!' : step < 4 ? '두 팔로 목 · 가슴을 가격!' : '둘이 어깨 · 발끝 잡아 던지기!',
      action: [
        '두 선수가 나란히 서서 각자 한 팔을 옆으로 뻗습니다. 상대의 목과 윗가슴을 보며 달릴 발을 맞춥니다.',
        '두 선수가 함께 발을 박차 달립니다. 각자 뻗은 팔로 상대의 목과 윗가슴을 향해 들어갑니다.',
        '각자 뻗은 두 팔이 상대의 목과 윗가슴에 닿았습니다! 상대가 뒤로 넘어지고 두 선수는 안쪽에 발을 딛습니다.',
        '두 팔에 맞은 선수가 모래 위에 누워 그로기 상태입니다. 두 선수가 어깨와 발끝으로 나눠 접근합니다.',
        '한 선수는 양쪽 어깨를, 다른 선수는 두 발끝을 잡았습니다. 같은 박자로 들어 올릴 힘을 모읍니다.',
        '어깨와 발끝을 놓지 않고 둘이 무릎을 펴며 머리 위로 함께 들어 올립니다.',
        '둘이 동시에 손을 놓아 붙잡힌 상대만 모래판 밖으로 던집니다. 두 공격자는 안에 남습니다.',
      ][step], left: [round.aggressor, round.helper], right: [round.victim], relation: '→',
      relationLabel: step < 2 ? '각자 팔 뻗어 공동 돌진' : step < 4 ? '목 · 가슴에 두 팔 충돌' : step < 6 ? '어깨 · 발끝 나눠 잡아 들기' : '함께 던지기 · 상대만 장외',
      leftLabel: '팔을 뻗어 함께 달려드는 두 선수', rightLabel: step < 2 ? '두 선수의 앞에서 버티는 선수' : '두 팔에 맞아 넘어진 선수', steps, step };
  }
  const pairWindow = round.pairDodge;
  if (pairWindow && elapsed >= pairWindow.start && (elapsed < pairWindow.end || pairWindow.outcome === 'out' && elapsed < round.resolve)) {
    const actual = { ...pairWindow, launchAt: pairWindow.launchAt ?? null };
    const dodge = arenaPairDodgeTargets(actual, elapsed, { x: 500, y: 416 }, undefined, round.timeScale ?? 1);
    const out = actual.launchAt !== null && actual.outcome === 'out' && elapsed >= round.impact;
    const steps = ['둘이 힘겨루기', '세 번째 선수 돌진', '둘이 뛰어 회피', '빈 공간으로 통과', '두 발 착지', out ? '돌진한 선수 장외' : '다시 자세 고치기'];
    const step = Math.max(0, ['wrestle', 'charge', 'jump', 'pass', 'land', 'recover', 'release'].indexOf(dodge.stage));
    const current = Math.min(5, step);
    const action = out ? '두 선수는 모래판 안에 착지했습니다. 멈추지 못한 돌진 선수만 경계를 넘어 아래로 떨어집니다.' : [
      '두 선수가 맞잡고 공방을 이어갑니다. 옆의 선수는 지금 선 자리에서 빈틈을 봅니다.',
      '세 번째 선수가 발을 박차고 달려옵니다. 싸우던 두 사람은 가까워지는 어깨를 봅니다.',
      '두 선수가 발을 접고 뛰어올라 돌진을 피합니다. 서로의 손도 놓고 몸을 비켜 냅니다.',
      '돌진한 선수가 두 사람의 발 아래 빈 공간을 지나갑니다. 뛰어오른 둘은 착지를 준비합니다.',
      '피한 두 선수가 두 발로 모래판 안에 착지합니다. 달려온 선수는 지나간 방향으로 계속 움직입니다.',
      actual.outcome === 'escape' ? '세 선수 모두 모래판 안에 남았습니다. 돌진한 선수도 발을 고쳐 딛고 다시 상대를 살핍니다.' : '피한 두 선수가 자세를 고칩니다. 돌진한 선수는 아직 달리던 방향으로 움직입니다.',
    ][current];
    return { kind: 'pair-dodge', label: out ? '둘이 피했다 · 돌진 선수만 장외!' : current === 0 ? '두 선수가 맞잡고 힘겨루기' : current === 1 ? '몸싸움 사이로 돌진!' : '둘이 뛰어 돌진 회피!', action,
      left: [round.aggressor, pairWindow.partnerId], right: [round.victim], relation: current < 2 ? '←' : '↗',
      relationLabel: out ? '점프 회피 · 돌진 선수만 장외' : current < 2 ? '몸싸움 사이로 돌진' : current < 4 ? '둘이 점프 회피 · 아래로 통과' : '두 선수 모래판 안에 착지',
      leftLabel: '맞잡고 싸우다 함께 피하는 두 선수', rightLabel: '사이로 돌진하는 선수', steps, step: out ? 5 : current };
  }
  const passing = round.passingTrip;
  if (passing && (passing.joined || passing.hookAt !== undefined || passing.launchAt != null) && elapsed >= passing.start && elapsed < round.resolve) {
    const hookAt = passing.hookAt, loadedAt = passing.launchAt;
    const timing = ARENA_PASSING_TRIP_TIMING;
    const releaseAt = loadedAt == null ? Infinity : loadedAt + timing.grip + timing.lift + timing.toss;
    const step = hookAt === undefined || elapsed < hookAt ? 0 : elapsed < hookAt + timing.hook ? 1 : elapsed < hookAt + timing.hook + timing.fall ? 2 : loadedAt == null || elapsed < loadedAt ? 3 : elapsed < loadedAt + timing.grip ? 4 : elapsed < loadedAt + timing.grip + timing.lift ? 5 : elapsed < releaseAt ? 6 : elapsed < releaseAt + 880 * (round.timeScale ?? 1) ? 7 : 8;
    const steps = ['근처를 지나가기', '지지발에 발걸기', '뒤로 넘어졌다', '발끝으로 접근', '두 발끝 잡기', '한 번 들어 올리기', '옆으로 던지기', '상대만 날아간다', '장외 착지'];
    return { kind: 'passing-trip', label: step === 0 ? '몸싸움 옆을 지나가는 선수' : step === 1 ? '지나가던 선수가 발을 걸었다!' : step < 5 ? '넘어진 상대의 두 발끝을 잡는다' : '두 발끝 잡아 한 번 던지기!',
      action: [
        '두 선수가 싸우는 사이, 다른 선수가 가까운 옆을 지나갑니다.',
        '지나가던 선수의 발이 지지발에 걸렸습니다! 발을 건 선수는 멈추지 않고 계속 지나갑니다.',
        '지지발이 풀린 선수가 뒤로 넘어집니다. 싸우던 상대는 발끝으로 움직일 준비를 합니다.',
        '쓰러진 몸은 모래에 그대로 누워 있습니다. 싸우던 상대가 두 발끝까지 걸어갑니다.',
        '양손으로 두 발끝을 잡았습니다. 발을 딛고 무릎을 굽혀 들어 올릴 힘을 모읍니다.',
        '두 발끝을 놓지 않고 한 번 들어 올립니다. 지나가던 선수는 이미 옆을 지나 모래판 안에서 움직입니다.',
        '들고 있던 두 발끝을 옆으로 힘껏 넘깁니다. 잡은 손을 풀어 한 번만 던집니다.',
        '두 발끝이 손에서 풀렸습니다! 쓰러졌던 상대만 장외로 날아가고 두 선수는 모래판 안에 남습니다.',
        '던져진 상대가 모래판 밖에 착지했습니다. 발을 건 선수와 던진 선수는 안에서 다음 상대를 살핍니다.',
      ][step],
      left: [round.aggressor], right: [round.victim], relation: step < 3 ? '↘' : '→',
      relationLabel: step === 0 ? '두 선수 공방 · 옆을 지나가기' : step === 1 ? '지나가던 선수의 발걸기' : step < 4 ? '넘어짐 · 발끝으로 접근' : step < 7 ? '두 발끝 잡고 한 번 던지기' : '던져진 선수만 장외',
      leftLabel: step < 3 ? '상대와 싸우는 선수' : '넘어진 상대의 발끝을 잡는 선수', rightLabel: step === 0 ? '상대와 싸우는 선수' : step === 1 ? '지지발이 걸린 선수' : '발이 걸려 넘어진 선수', intruderId: passing.passerId,
      intruderLabel: step === 0 ? '옆을 지나가는 선수' : step === 1 ? '지나가며 발을 거는 선수' : '발을 걸고 계속 지나가는 선수', steps, step };
  }
  const rimCharge = arenaRimChargeTargets(round, elapsed, { x: 500, y: 416 });
  if (rimCharge && (elapsed < round.rimCharge!.end || rimCharge.outcome === 'dodge' && elapsed < round.resolve)) {
    const resisting = rimCharge.outcome === 'resist', steps = resisting ? ['지금 자리에서 준비', '발 박차고 돌진', '두 발로 버티기', '그 자리에서 맞잡기'] : ['지금 자리에서 준비', '발 박차고 돌진', '옆으로 회피', '관성으로 장외'];
    const step = rimCharge.stage === 'approach' ? 0 : rimCharge.stage === 'charge' ? 1 : rimCharge.stage === 'dodge' || rimCharge.stage === 'brace' ? 2 : 3;
    return { kind: 'rim-charge', label: step === 0 ? '외곽에서 돌진을 준비한다' : step === 1 ? '어깨를 낮추고 돌진!' : resisting ? '두 발로 돌진을 막았다!' : '옆으로 피했다!', action: resisting ? ['지금 선 자리에서 몸을 낮춥니다. 상대는 발을 넓혀 돌진을 살핍니다.', '발을 박차고 가속합니다. 상대는 두 발로 버틸 준비를 합니다.', '어깨가 부딪쳤습니다! 두 발을 모래에 박아 돌진을 받아냈습니다.', '돌진이 멈췄습니다. 두 선수가 그 자리에서 맞잡고 공방을 이어갑니다.'][step] : ['지금 선 자리에서 몸을 낮춥니다. 상대는 가까워질 어깨를 끝까지 봅니다.', '발을 박차고 점점 빨라집니다. 상대의 빈틈으로 달려갑니다.', '가까워진 순간 옆으로 피했습니다! 돌진하는 어깨가 빈 공간을 지나갑니다.', '멈추지 못한 돌진이 경계를 넘었습니다. 피한 선수만 모래판 안에 남습니다.'][step], left: [rimCharge.chargerId], right: [rimCharge.defenderId], relation: resisting && step >= 2 ? '↔' : step >= 2 ? '↗' : '→', relationLabel: step < 2 ? '외곽에서 돌진' : resisting ? '돌진 막기 · 둘 다 생존' : '옆으로 회피 · 돌진 장외', leftLabel: '돌진하는 선수', rightLabel: resisting ? '두 발로 버티는 선수' : '옆으로 피하는 선수', steps, step };
  }
  const rim = arenaRimTargets(round, elapsed, { x: 500, y: 416 });
  if (rim?.active) {
    const step = rim.stage === 'approach' ? 0 : rim.stage === 'pressure' ? 1 : rim.stage === 'brace' ? 2 : 3;
    const resisted = rim.stage === 'brace' || rim.stage === 'release';
    return { kind: 'rim', label: resisted ? '가장자리 밀기를 버텼다!' : '가장자리에서 밀어붙인다',
      action: ['경계를 살피던 상대의 앞으로 다가갑니다. 두 선수 모두 발을 고쳐 딛습니다.', '앞발을 박고 두 손으로 밀어붙입니다. 상대가 뒷발로 모래를 밀며 버팁니다.', '두 발을 넓게 딛고 중심을 낮췄습니다! 밀기가 막혀 둘 다 모래판에 남았습니다.', '손을 놓고 한 발 물러납니다. 방금 밀린 자리에서 다시 상대를 마주 봅니다.'][step],
      left: [round.aggressor], right: [round.victim], relation: resisted ? '↔' : '→', relationLabel: resisted ? '밀기 실패 · 둘 다 생존' : '경계에서 밀기 시도', leftLabel: '미는 선수', rightLabel: '두 발로 버티는 선수', steps: ['가장자리 접근', '발을 딛고 밀기', '두 발로 버티기', '손 풀고 다음 승부'], step };
  }
  const recovery = arenaRecoveryTargets(round, elapsed, { x: 500, y: 416 });
  if (recovery?.active) {
    const thrower = round.recovery?.throwerId ?? round.aggressor;
    if (recovery.kind === 'overhead-escape') {
      const steps = ['몸통 맞잡기', '두 발로 힘겨루기', '머리 위로 들기', '높이 들렸다!', '무릎 접고 점프 탈출', '두 발 착지', '원래 상대와 거리 벌리기', '다음 공방'];
      const step = Math.max(0, ['approach', 'hold', 'lift', 'overhead', 'jump', 'land', 'separate', 'release'].indexOf(recovery.stage));
      return { kind: 'overhead-escape', label: step < 3 ? '맞잡고 머리 위로 들어 올린다' : step === 3 ? '내리찍기 직전 · 탈출할 수 있을까?' : step === 4 ? '머리 위에서 점프 탈출!' : step === 6 ? '살아남았다! 원래 상대와 거리를 벌린다' : step === 7 ? '거리 두고 다음 공방을 본다' : '두 발로 착지 · 살아남았다!', action: ['서로 몸통을 잡으려고 파고듭니다. 발을 고쳐 딛으며 상대를 살핍니다.', '몸통을 맞잡고 두 발로 버팁니다. 무릎에 힘을 실어 들어 올릴 틈을 노립니다.', '무릎을 펴며 상대를 머리 위로 들어 올립니다. 붙잡힌 두 발이 모래판을 떠납니다.', '머리 위에 들렸습니다. 내리찍기 직전, 들린 선수가 손에서 빠져나갈 틈을 찾습니다.', '무릎을 모아 손에서 튀어나왔습니다! 뒤로 점프하고, 놓친 선수는 균형을 바로잡습니다.', '두 발을 펴 모래판 안에 착지했습니다. 내리찍기를 피하고 살아남았습니다.', '착지한 선수는 달려 나가 자신을 들어 올렸던 상대와 거리를 벌립니다. 원래 상대는 손을 놓고 뒤로 물러납니다.', '손이 닿지 않는 거리에서 자세를 바로잡고 다른 빈틈을 살핍니다.'][step], left: [thrower], right: [round.victim], relation: step < 4 ? '→' : '↗', relationLabel: step < 3 ? '힘겨루기 · 머리 위로 들기' : step === 3 ? '머리 위에서 탈출 준비' : '점프 탈출 · 둘 다 생존', leftLabel: '들어 올리는 선수', rightLabel: step < 4 ? '들린 선수' : '점프로 빠져나온 선수', steps, step };
    }
    const step = ['approach', 'hold', 'lift', 'somersault', 'land', 'separate', 'release'].indexOf(recovery.stage);
    return { kind: 'recovery', label: step < 2 ? '몸통을 잡고 힘을 겨룬다' : step === 2 ? '던지기! 몸통을 들어 올린다!' : step === 3 ? '공중 한 바퀴 · 착지를 노린다!' : '던져졌지만 살아남았다!', action: ['몸통을 잡으려고 가까이 파고듭니다. 두 선수 모두 발을 고쳐 딛습니다.', '허리를 맞잡았습니다. 아직 두 발로 버티며 들어 올릴 틈을 봅니다.', '잡은 몸통을 들어 올립니다. 붙잡힌 선수의 두 발이 모래판을 떠납니다.', '손이 풀린 순간 공중에서 한 바퀴 돕니다! 경계 안쪽 모래를 향해 발을 내립니다.', '두 발로 모래판 안에 착지했습니다! 장외를 피했습니다.', '착지한 선수가 달려 나가 방금 자신을 던진 상대와 거리를 벌립니다. 상대도 뒤로 발을 고쳐 딛습니다.', '손이 닿지 않는 거리에서 자세를 바로잡습니다. 두 선수 모두 살아남아 다음 빈틈을 봅니다.'][step], left: [thrower], right: [round.victim], relation: step < 3 ? '→' : '↶', relationLabel: step < 2 ? '몸통 맞잡기' : step === 2 ? '발 딛고 던지기' : step === 3 ? '공중 회전 · 착지 시도' : '장외 회피', leftLabel: '던지는 선수', rightLabel: step < 3 ? '붙잡힌 선수' : step === 3 ? '공중에서 도는 선수' : '착지해 살아남은 선수', steps: ['몸통 접근', '맞잡고 버티기', '발 딛고 들기', '공중 한 바퀴', '두 발 착지', '상대와 거리 벌리기', '다음 공방'], step };
  }
  if (round.escape && elapsed >= round.escape.start && elapsed < (round.escape.releasedUntil ?? round.escape.end)) {
    const escape = arenaEscapeTargets(round, elapsed, { x: 500, y: 416 })!;
    const stages = ['approach', 'grip', 'break', 'flee', 'chase', 'rejoin'];
    const step = Math.max(0, stages.indexOf(escape.stage));
    const ungripped = round.escape.ungripped;
    if (escape.released || escape.stage === 'separate') return { kind: 'escape', label: '완전히 빠져나왔다!', action: '추격자의 손이 닿지 않는 거리까지 벌어졌습니다. 첫 공방은 결판 없이 끝났고 두 선수 모두 모래판에 남았습니다.', left: [escape.runnerId], right: [escape.chaserId], relation: '↔', relationLabel: '도망 성공 · 대결 종료', leftLabel: '빠져나간 선수', rightLabel: '상대를 놓친 선수', steps: ['접근', '손 빼기', '도망', '추격', '놓쳤다', '둘 다 생존'], step: escape.released ? 5 : 4 };
    return { kind: 'escape', label: ungripped ? '잡히기 전에 피해서 도망!' : '손을 빼고 도망!', action: ['서로 거리를 좁히며 빈틈을 봅니다.', ungripped ? '상대가 손을 뻗습니다. 잡히기 전에 몸을 틉니다.' : '손을 맞잡았습니다. 한 선수가 몸을 낮춥니다.', ungripped ? '뻗은 손을 피했습니다! 첫 공방은 결판이 나지 않았습니다.' : '잡힌 손을 비틀어 빼냈습니다! 첫 공방은 결판이 나지 않았습니다.', '방향을 틀어 모래판 안쪽으로 달아납니다.', '상대가 뒤쫓습니다! 달아난 선수도 뒤를 살피며 방향을 바꿉니다.', '다른 자리에서 다시 맞붙습니다. 다음 승부수를 노립니다.'][step], left: [escape.runnerId], right: [escape.chaserId], relation: step < 2 ? '↔' : '→', relationLabel: step < 2 ? '첫 공방' : step < 5 ? '탈출 · 추격' : '새 접점에서 재대결', leftLabel: '빠져나가는 선수', rightLabel: '뒤쫓는 선수', steps: ['접근', ungripped ? '손 뻗기' : '맞잡기', ungripped ? '견제 회피' : '손 빼기', '도망', '추격', '재대결'], step };
  }
  const frame = arenaBeat(round, elapsed), action = arenaAction(round, elapsed);
  const beat = frame.stage;
  const step = beat === 'approach' ? 0 : beat === 'hold' ? 1 : 2;
  const turned = step === 2;
  const result = beat === 'result';
  const a = round.aggressor, v = round.victim, h = round.helper;
  const kinds = { team: '협공', betrayal: '배신', bait: '돌진 회피', catch: '돌진 받아 던지기', ram: '정면 돌진 · 어깨 충돌', spin: '한 바퀴 회전 되치기', shove: '몸싸움에 끼어 밀기', 'double-shove': '빈틈 밀기 · 두 명 장외', edge: '가장자리 밀기', counter: '역습', brace: '버티기', lift: '들배지기', final: '마지막 승부', armspin: '팔 잡고 회전 던지기', trip: '발목 걸기 · 굴려 장외로', suplex: '머리 위에서 내리찍기', sidekick: '점프 옆차기', elbow: '들린 상태에서 엘보우 반격' };
  const state: ArenaStoryState = {
    kind: round.tactic, label: kinds[round.tactic], action: '', left: [a], right: [v],
    relation: '↔', relationLabel: '힘겨루기', steps: ['접근', '맞잡기', '승부수'], step,
  };
  if (round.rushOutcome && h) {
    const rush = arenaPairRushTargets(round, elapsed, { x: 675, y: 430 });
    state.left = [...rush.pairIds]; state.right = [rush.chargerId];
    state.leftLabel = '맞잡고 싸우던 두 선수'; state.rightLabel = '끼어들어 돌진한 선수';
    state.relation = '←';
    if (rush.outcome === 'counter-throw') {
      state.label = '돌진 실패 · 둘이 잡아 던지기'; state.relationLabel = '어깨와 다리를 받쳐 드는 반격';
      state.steps = ['둘이 힘겨루기', '뒤에서 달려와 충돌', '튕겨 나가 그로기', '어깨 · 발끝 잡기', '머리 위로 들기', '함께 던지기'];
      state.step = rush.stage === 'wrestle' ? 0 : rush.stage === 'charge' || rush.stage === 'contact' ? 1 : rush.stage === 'rebound' || rush.stage === 'groggy' ? 2 : rush.stage === 'grip' ? 3 : rush.stage === 'lift' || rush.stage === 'overhead' ? 4 : 5;
      state.action = ['두 선수가 맞잡고 싸웁니다. 뒤의 선수가 틈을 노립니다.', '뒤에서 속도를 붙여 두 사람에게 어깨로 부딪칩니다!', '둘이 버텼습니다! 돌진한 선수가 튕겨 나가 쓰러집니다.', '한 명은 양쪽 어깨를 받치고, 다른 한 명은 두 발끝을 잡았습니다. 쓰러진 선수의 팔은 몸 옆에 자연스럽게 놓입니다.', '어깨와 발끝을 잡은 채 둘이 머리 위로 높이 들어 올립니다!', '함께 힘을 실어 던집니다. 붙잡힌 선수만 장외로 날아갑니다.'][state.step];
    } else {
      state.label = '돌진 충돌 · 두 명 장외'; state.relationLabel = '충돌 뒤 경계까지 밀어붙이기';
      state.steps = ['둘이 힘겨루기', '세 번째 선수 돌진', '어깨 정면 충돌', '경계까지 밀어붙이기', '충돌로 두 명 장외'];
      state.step = rush.stage === 'wrestle' ? 0 : rush.stage === 'charge' ? 1 : rush.stage === 'contact' ? 2 : rush.stage === 'push' ? 3 : 4;
      state.action = ['두 선수가 가장자리에서 맞잡고 버팁니다.', '옆의 선수가 빈틈을 향해 속도를 붙여 달려듭니다.', '어깨가 부딪쳤습니다! 두 사람이 뒤로 젖혀지며 중심이 함께 무너집니다.', '앞발을 박고 두 손으로 밀어붙입니다! 두 사람의 뒷발이 함께 경계로 밀립니다.', '미는 선수는 모래판 안에 발을 딛습니다. 밀린 두 사람만 경계 아래로 떨어집니다.'][state.step];
    }
    return state;
  }
  switch (round.tactic) {
    case 'elbow': {
      const technique = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
      state.leftLabel = '들린 뒤 반격하는 선수'; state.rightLabel = '먼저 들어 올린 선수'; state.relation = '↶'; state.relationLabel = '엘보우 역습 · 발끝 잡아 끌기';
      state.steps = ['몸통 맞잡기', '들렸다!', '머리에 엘보우', '풀리며 쓰러졌다', '그로기', '발끝으로 접근', '두 발끝 잡기', '모래 위로 끌기', '끝에서 던지기', '장외 착지', '몸 일으키기'];
      const stages = ['approach', 'lift-counter', 'elbow', 'elbow-impact', 'groggy', 'ankle-approach', 'ankle-grip'];
      const age = elapsed - round.impact, timing = arenaFloorExitTiming(round);
      state.step = elapsed >= round.impact ? age < timing.stunnedUntil ? 6 : age < timing.dragUntil ? 7 : age < timing.tossUntil ? 8 : age < timing.landUntil ? 9 : 10 : Math.max(0, stages.indexOf(technique.stage));
      state.action = ['서로 거리를 좁히며 몸통을 맞잡을 틈을 봅니다.', '상대가 허리를 잡아 들어 올립니다. 들린 선수가 팔꿈치를 접어 반격을 준비합니다.', '공중에서 팔꿈치를 내리찍습니다! 상대의 머리에 정확히 닿습니다.', '머리에 충격을 받은 상대가 손을 놓고 쓰러집니다. 들렸던 선수는 착지합니다.', '상대가 그로기 상태로 누웠습니다. 별이 맴돌고 팔과 다리에 힘이 풀립니다.', '착지한 선수가 옆으로 돌아 누운 상대의 발끝에 접근합니다.', '두 발끝을 양손으로 잡았습니다. 몸은 모래 위에 누운 채 끌기를 준비합니다.', '발끝을 놓지 않고 한 발씩 뒤로 디딥니다. 상대가 모래 위를 따라 경계까지 끌려갑니다.', '모래판 안에 발을 딛고 두 발끝을 놓아 넘깁니다! 쓰러진 상대만 장외로 날아갑니다.', '던져진 상대가 모래판 밖에 떨어졌습니다. 공격한 선수는 안에서 자세를 고칩니다.', '장외에 누운 선수가 몸을 일으킵니다. 자세를 회복한 뒤 시상 자리로 이동합니다.'][state.step];
      if (elapsed >= round.impact && age < timing.recoverUntil) return state;
      break;
    }
    case 'armspin':
    case 'trip':
    case 'suplex':
    case 'sidekick': {
      const technique = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
      const opening = technique.stage === 'approach' || technique.stage === 'probe' || technique.stage === 'reset';
      state.leftLabel = '기술을 거는 선수'; state.rightLabel = '기술을 막는 선수';
      state.relation = round.tactic === 'armspin' ? '↶' : '→'; state.relationLabel = opening ? '밀기를 막고 다시 접근' : kinds[round.tactic];
      if (round.tactic === 'armspin') {
        state.steps = ['견제 · 회피', '두 손 붙잡기', '몸 띄워 회전', '손 놓아 던지기'];
        state.step = opening ? 0 : technique.stage === 'wrist' ? 1 : technique.stage === 'pivot' ? 2 : 3;
        state.action = ['가볍게 밀어 봅니다. 상대가 버티며 손을 풀어 다시 거리를 잽니다.', '양쪽 손목을 잡았습니다! 두 손을 놓지 않고 회전을 준비합니다.', '발을 바꿔 디디며 두 바퀴 돌립니다. 상대는 몸과 다리를 바깥으로 뻗은 채 공중에 매달립니다.', '회전이 붙은 순간 손을 놓았습니다! 상대가 장외로 날아갑니다.'][state.step];
      } else if (round.tactic === 'trip') {
        state.steps = ['견제 · 회피', '몸통 맞잡기', '발목 걸기', '넘어졌다', '몸통 발차기', '뒤구르기 · 장외'];
        state.step = opening ? 0 : technique.stage === 'grip' ? 1 : technique.stage === 'hook' ? 2 : technique.stage === 'fall' || technique.stage === 'stunned' ? 3 : technique.stage === 'kick' ? 4 : 5;
        state.action = ['첫 밀기를 버텼습니다. 손을 풀고 다시 파고듭니다.', '몸통을 잡고 한 발 가까이 들어갑니다. 상대는 뒤로 버팁니다.', '뻗은 발이 상대 발목에 걸렸습니다! 지지발이 흔들립니다.', '걸린 발이 떠서 뒤로 넘어졌습니다. 공격한 선수는 발을 고쳐 디딥니다.', '넘어진 상대의 몸통을 발로 찹니다. 뻗은 발바닥이 몸에 닿습니다.', '발차기를 받은 상대가 차인 방향으로 뒤구르며 경계 밖으로 떨어집니다.'][state.step];
        if (round.tripCounter) {
          state.label = '발걸기 되치기'; state.relation = '↶';
          state.left = opening ? [v] : [a]; state.right = opening ? [a] : [v];
          state.leftLabel = opening ? '먼저 밀어붙이는 선수' : '밀기를 버텨 발을 거는 선수';
          state.rightLabel = opening ? '두 발로 버티며 되치는 선수' : '먼저 밀다 발이 걸린 선수';
          state.relationLabel = opening ? '먼저 밀기 · 두 발로 버티기' : '밀기를 받아 발걸기 되치기';
          state.steps = ['밀기 받아 버티기', '몸통 잡아 힘 돌리기', '발걸기 되치기', '먼저 민 선수가 넘어졌다', '몸통 발차기', '뒤구르기 · 장외'];
          state.action = [
            technique.stage === 'approach' ? '상대가 먼저 밀며 파고듭니다. 받는 선수는 두 발을 넓혀 중심을 낮춥니다.' : technique.stage === 'probe' ? '밀어오는 힘을 두 발로 받습니다. 뒤로 버티며 상대가 내민 발을 살핍니다.' : '밀기를 버텼습니다. 상대가 몸을 내민 틈으로 다시 파고듭니다.',
            '먼저 밀어온 상대의 몸통을 붙잡았습니다. 발을 고쳐 딛고 들어온 힘을 옆으로 돌립니다.',
            '밀어오던 힘을 받아 발목을 걸었습니다! 먼저 공격한 상대의 지지발이 흔들립니다.',
            '먼저 밀던 선수가 걸린 발을 빼지 못해 뒤로 넘어집니다. 버텼던 선수는 발을 딛고 중심을 지킵니다.',
            '발걸기 뒤 넘어진 상대의 몸통을 발바닥으로 찹니다. 되친 선수의 지지발은 모래에 남습니다.',
            '먼저 공격하던 선수가 차인 방향으로 뒤구르며 경계 밖으로 떨어집니다.',
          ][state.step];
        }
      } else if (round.tactic === 'suplex') {
        const timing = arenaFloorExitTiming(round), age = elapsed - round.impact;
        state.steps = ['견제 · 회피', '허리 잡아 들기', '머리 위로!', '내리찍기', '등 · 어깨 충돌', '기절', '발끝 잡아 끌기', '끝에서 던지기', '장외 착지', '몸 일으키기'];
        state.step = opening ? 0 : technique.stage === 'grip' || technique.stage === 'lift' ? 1 : technique.stage === 'overhead' ? 2 : technique.stage === 'slam' ? technique.slamImpact > 0 ? 4 : 3 : age < timing.stunnedUntil ? 5 : age < timing.dragUntil ? 6 : age < timing.tossUntil ? 7 : age < timing.landUntil ? 8 : 9;
        state.action = ['밀기를 막았습니다. 자세를 낮춰 상대의 허리를 노립니다.', '허리를 양팔로 감싸고 발을 딛어 머리 위로 들어 올립니다.', '상대를 머리 위에 높이 들었습니다! 정점에서 몸을 고정합니다.', '잡고 있던 상대를 아래로 힘껏 내리찍습니다!', '쾅! 등과 어깨가 모래판에 부딪쳤습니다. 충격으로 팔과 다리의 힘이 풀립니다.', '바닥에 쓰러진 상대가 잠깐 기절합니다. 공격한 선수는 발끝으로 이동합니다.', '양손으로 발끝을 잡고 장외 방향으로 끕니다. 공격하는 선수는 모래판 안에 남습니다.', '발을 디딘 채 잡은 발끝을 놓아 넘깁니다. 상대만 모래판 밖으로 떨어집니다.', '넘겨진 상대가 모래판 밖에 떨어졌습니다. 안의 선수는 자세를 고칩니다.', '장외에 누운 선수가 몸을 일으킵니다. 자세를 회복한 뒤 시상 자리로 이동합니다.'][state.step];
        if (technique.aggressorEffort !== undefined) {
          state.relationLabel = '허리 맞잡고 힘겨루기';
          state.action = '허리를 맞잡고 서로 버팁니다. 무릎을 굽혀 체중을 실은 뒤 들어 올릴 틈을 만듭니다.';
        }
        if (elapsed >= round.impact && age < timing.recoverUntil) return state;
      } else {
        state.steps = ['견제 · 준비', '한 번 도약', '공중 옆차기', '발끝 충돌 · 장외'];
        state.step = opening || technique.stage === 'plant' ? 0 : technique.stage === 'jump' ? 1 : technique.stage === 'kick' ? 2 : 3;
        state.action = ['상대의 밀기를 피하고 발을 고쳐 디딥니다.', '지지발로 힘껏 한 번 도약합니다.', '공중에서 몸을 옆으로 틀어 한 발을 길게 뻗습니다.', '뻗은 발바닥이 몸통에 닿았습니다! 상대가 충격으로 장외로 날아갑니다.'][state.step];
      }
      break;
    }
    case 'team':
      state.left = h ? [a, h] : [a];
      state.relation = '→'; state.relationLabel = result && round.exchange ? '공동공격을 버텨냄' : '둘이 한 명을 함께 공격';
      state.steps = ['양쪽 포위', '함께 잡기', '동시에 들기'];
      state.action = ['두 선수가 양쪽으로 돌아서 퇴로를 막습니다.', '양쪽에서 붙잡았습니다. 한 선수가 신호를 보냅니다.', '같은 순간 몸을 낮추고 함께 들어 올립니다.'][step];
      if (beat === 'turn' && frame.liftProgress === 0) state.action = '신호에 맞춰 두 선수가 함께 무릎을 굽힙니다.';
      break;
    case 'betrayal':
      state.step = action.stage === 'joint-attack' ? 1 : action.stage === 'resist' ? 2 : action.stage === 'betrayal' ? 3 : action.stage === 'counter' || action.stage === 'throw' || action.stage === 'release' ? 4 : 0;
      state.left = action.betrayed ? h ? [h] : [a] : h ? [v, h] : [v]; state.right = action.betrayed ? [v] : [a];
      state.leftLabel = action.betrayed ? '손을 놓은 동료' : '함께 공격하는 동맹';
      state.rightLabel = action.betrayed ? '혼자 대응' : '공동공격을 버티는 선수';
      state.relation = action.betrayed ? '×' : '→'; state.relationLabel = action.betrayed ? '동맹 파기 · 역습 시작' : action.stage === 'resist' ? '공격이 막혔습니다' : '동맹의 실제 공동공격';
      state.steps = ['동맹', '공동공격', '저항', '배신', '역습'];
      state.action = ['둘이 함께 상대의 양쪽으로 접근합니다.', '동맹 둘이 양쪽에서 붙잡아 상대를 함께 들어 올립니다.', '상대가 발을 딛어 버팁니다. 동맹의 첫 공격이 막혔습니다.', '동료가 손을 놓습니다! 함께 공격하던 선수가 혼자 남았습니다.', `버티던 상대가 ${round.counterSide === 'back' ? '뒤쪽' : '앞쪽'} 공격자를 다시 붙잡아 역습합니다.`][state.step];
      if (action.betrayed) state.intruderLabel = round.counterSide === 'back' ? '뒤쪽으로 역습' : '앞쪽으로 역습';
      if (round.counterFailed) {
        state.steps = ['동맹', '공동공격', '저항', '배신', '역습 시도', '막혔다', '재접근', '다시 승부'];
        if (action.stage === 'failed-counter') { state.step = 5; state.relationLabel = '역습도 막혔습니다'; state.action = '되치기를 시도했지만 상대가 발을 딛어 버텼습니다. 아직 누구도 모래판을 떠나지 않았습니다.'; }
        else if (action.stage === 'reset') { state.step = 6; state.relationLabel = '손을 풀고 재접근'; state.action = '역습이 실패했습니다. 서로 손을 풀고 거리를 바꿔 다시 맞붙습니다.'; }
        else if (action.stage === 'lift' || action.stage === 'throw') { state.step = 7; state.relationLabel = '새로운 맞잡기'; state.action = '첫 역습을 막았지만 새 맞잡기에서 중심을 잃었습니다. 다음 힘겨루기에서 승부가 납니다.'; }
      }
      break;
    case 'bait': {
      const charge = arenaChargeState(round, elapsed);
      state.step = charge.stage === 'prepare' ? 0 : charge.stage === 'charge' ? 1 : charge.stage === 'dodge' ? 2 : 3;
      state.relation = state.step >= 2 ? '↗' : '←'; state.relationLabel = state.step >= 2 ? '돌진 옆으로 회피' : '돌진 유도';
      state.leftLabel = '피하는 선수'; state.rightLabel = '돌진하는 선수';
      state.steps = ['무게 낮추기', '가속 돌진', '옆으로 회피', round.exchange ? '발 고쳐 딛기' : '관성으로 장외'];
      state.action = ['빈틈을 보입니다. 상대는 무게를 낮추고 첫발을 준비합니다.', '발을 박차고 점점 빨라집니다. 피할 선수는 상대를 끝까지 봅니다.', '가까워진 순간 옆으로 빠집니다! 돌진은 빈 공간을 지나갑니다.', round.exchange ? '발을 고쳐 딛고 모래판 끝에서 급히 멈춥니다.' : '돌진을 멈추지 못했습니다. 경계선을 넘어 아래로 굴러떨어집니다.'][state.step];
      break;
    }
    case 'catch': {
      const caught = arenaCatchTargets(round, elapsed, { x: 675, y: 430 });
      state.step = caught.stage === 'prepare' ? 0 : caught.gripStrength === 0 ? 1 : caught.stage === 'catch' || caught.stage === 'load' ? 2 : 3;
      state.leftLabel = '받아내는 선수'; state.rightLabel = '돌진하는 선수';
      state.relation = state.step >= 2 ? '↶' : '←'; state.relationLabel = state.step >= 2 ? '몸통을 잡고 힘 돌리기' : '돌진 받아내기';
      state.steps = ['자세 낮추기', '돌진', '몸통 붙잡기', '발 디뎌 되치기'];
      state.action = ['돌진을 기다리며 발을 넓혀 중심을 낮춥니다.', '상대가 몸을 숙이고 달려듭니다. 두 팔을 앞으로 내밀어 받습니다.', '몸통과 팔을 잡았습니다! 뒤로 한 발 물러나 충격을 받아냅니다.', '손을 놓지 않고 골반을 돌립니다. 달려온 힘으로 상대를 들어 날립니다.'][state.step];
      break;
    }
    case 'spin': {
      const spin = arenaSpinTargets(round, elapsed, { x: 500, y: 416 });
      state.step = spin.stage === 'approach' || spin.stage === 'grip' ? 0 : spin.stage === 'lift' || spin.stage === 'plant' ? 1 : spin.stage === 'reverse' ? 2 : spin.stage === 'spin' ? 3 : 4;
      state.left = state.step < 2 ? [v] : [a]; state.right = state.step < 2 ? [a] : [v];
      state.leftLabel = state.step < 2 ? '먼저 들어 올리는 선수' : '발을 딛고 되치는 선수';
      state.rightLabel = state.step < 2 ? '들기를 버티는 선수' : '역으로 붙잡힌 선수';
      state.relation = state.step < 2 ? '→' : '↶'; state.relationLabel = state.step < 2 ? '들기 시도' : '한 바퀴 회전 되치기';
      state.steps = ['몸통 붙잡기', '들렸다가 발 딛기', '역으로 잡기', '축 잡고 한 바퀴', '손 놓아 던지기'];
      state.action = ['상대가 먼저 몸통을 잡고 들어 올릴 준비를 합니다.', '잠깐 들렸습니다! 손을 놓지 않고 발을 내려 중심을 되찾습니다.', '몸통과 팔을 다시 잡았습니다. 잡힌 쪽이 힘을 되돌립니다.', '발을 바꿔 디디며 한 바퀴 돕니다. 붙잡힌 상대도 함께 회전합니다.', '회전을 마친 순간 손을 놓았습니다! 처음 공격한 선수가 장외로 날아갑니다.'][state.step];
      break;
    }
    case 'ram': {
      const ram = arenaRamTargets(round, elapsed, { x: 500, y: 416 });
      state.step = ram.stage === 'prepare' ? 0 : ram.stage === 'charge' ? 1 : ram.stage === 'contact' ? 2 : 3;
      state.leftLabel = '어깨로 돌진하는 선수'; state.rightLabel = '앞에서 막는 선수';
      state.relation = '→'; state.relationLabel = state.step < 2 ? '정면 돌진' : '어깨 충돌 · 장외로';
      state.steps = ['앞발에 체중 싣기', '가속 돌진', '어깨 정면 충돌', '상대가 장외로'];
      state.action = ['앞발을 딛고 몸을 낮춥니다. 상대의 빈틈을 노립니다.', '어깨를 앞으로 숙이고 가속합니다. 상대는 앞에서 버티며 막습니다.', '몸통에 어깨가 부딪쳤습니다! 막던 상대의 발이 모래판을 떠납니다.', '돌진한 선수는 발을 고쳐 딛습니다. 충돌한 상대가 장외로 날아갑니다.'][state.step];
      break;
    }
    case 'double-shove':
    case 'shove': {
      const shove = round.tactic === 'double-shove' ? arenaDoubleShoveTargets(round, elapsed, { x: 675, y: 430 }) : arenaShoveTargets(round, elapsed, { x: 675, y: 430 });
      state.step = shove.stage === 'wrestle' ? 0 : shove.stage === 'approach' ? 1 : shove.stage === 'contact' ? 2 : 3;
      state.left = h ? [h, v] : [v]; state.right = [a];
      state.leftLabel = '맞잡고 싸우는 두 선수'; state.rightLabel = '옆에서 끼어드는 선수';
      state.relation = '←'; state.relationLabel = '몸싸움 틈에 어깨 밀기';
      state.steps = ['둘이 힘겨루기', '옆으로 접근', '어깨 맞대 밀기', round.secondaryVictim ? elapsed >= round.impact ? '맞잡은 둘이 장외' : '함께 밀린다' : '한 명은 버티고 장외'];
      state.action = ['두 선수가 손을 맞잡고 버팁니다. 옆의 선수는 빈틈을 봅니다.', '손을 잡고 싸우는 두 선수의 옆으로 접근합니다.', '어깨와 두 손으로 밀었습니다! 두 선수의 중심이 함께 흔들립니다.', '한 선수는 손을 풀고 발을 고쳐 딛습니다. 다른 선수는 경계 밖으로 밀려 떨어집니다.'][state.step];
      if (round.secondaryVictim && state.step === 3) state.action = elapsed >= round.impact ? '맞잡은 두 선수가 함께 밀립니다. 끼어든 선수는 모래판 안에 발을 딛고, 싸우던 두 선수만 경계 밖으로 떨어집니다.' : '맞잡은 두 선수의 뒷발이 함께 밀립니다. 옆에서 끼어든 선수는 모래판 안에 발을 딛고 계속 밀어붙입니다.';
      break;
    }
    case 'edge': {
      const edge = arenaEdgeTargets(round, elapsed, { x: 675, y: 490 });
      state.step = edge.stage === 'approach' ? 0 : edge.stage === 'contest' ? 1 : edge.stage === 'push' ? 2 : 3;
      state.relation = '→'; state.relationLabel = '경계로 밀어내기';
      state.leftLabel = '미는 선수'; state.rightLabel = '끝에서 버티는 선수';
      state.steps = ['가장자리 견제', '맞잡고 버티기', '발을 딛고 밀기', '뒷발이 장외로'];
      state.action = ['경계 가까이에서 서로를 살피며 퇴로를 좁힙니다.', '손을 맞잡고 발을 바꿔 딛습니다. 끝의 선수는 중심을 뒤로 낮춰 버팁니다.', '앞발을 단단히 딛고 밀어붙입니다. 상대가 한 발씩 경계로 밀립니다.', '버티던 뒷발이 경계를 넘었습니다! 모래판 아래로 넘어집니다.'][state.step];
      break;
    }
    case 'counter':
      state.relationLabel = turned ? '되치기' : '밀기를 받아냄';
      state.steps = ['밀려나기', '중심 낮추기', '되치기'];
      state.action = ['밀어오는 상대를 향해 자세를 낮춥니다.', '발을 고정하고 몸을 낮춰 힘을 받아냅니다.', '잡은 손을 놓지 않고 상대의 힘을 거꾸로 돌립니다.'][step];
      break;
    case 'brace':
      state.steps = ['힘겨루기', '두 발 고정', '힘 되돌리기'];
      state.action = ['서로를 살피며 거리를 좁힙니다.', '보폭을 넓혀 두 발로 버팁니다.', '상대가 힘을 빼는 순간, 앞으로 힘을 되돌립니다.'][step];
      break;
    case 'lift':
    case 'final':
      state.steps = ['샅바 접근', '낮게 잡기', '들어 뒤집기'];
      state.action = ['샅바를 잡기 위해 가까이 파고듭니다.', '무릎을 굽혀 상대의 몸 아래로 중심을 낮춥니다.', '발을 딛고 일어납니다. 상대의 두 발이 모래판을 떠납니다.'][step];
      if (beat === 'turn' && frame.liftProgress === 0) state.action = '잡은 손에 힘을 주고, 무릎을 굽혀 들어 올릴 준비를 합니다.';
      break;
  }
  if (beat === 'impact' && !['bait', 'edge', 'shove', 'double-shove', 'spin', 'ram', 'armspin', 'trip', 'suplex', 'sidekick', 'elbow'].includes(round.tactic)) state.action = round.tactic === 'catch' ? '돌진한 몸을 잡은 채 발을 돌렸습니다! 상대가 장외로 날아갑니다.' : '중심이 무너졌습니다! 모래판 밖으로 넘어갑니다.';
  if (result) state.action = round.exchange ? round.tactic === 'team' ? '공동공격 실패! 상대가 버텨 빠져나옵니다. 동맹도 함께 물러나 다시 빈틈을 봅니다.' : round.tactic === 'betrayal' ? '배신 뒤의 역습도 버텼습니다! 서로 손을 풀고 모두 모래판을 지켰습니다.' : round.tactic === 'bait' ? '돌진을 멈춰 세웠습니다! 서로 거리를 벌리고 다음 빈틈을 봅니다.' : '버텼습니다! 서로 손을 풀고 다시 빈틈을 봅니다.' : round.final ? '마지막 상대가 장외에 착지했습니다. 우승 확정!' : '장외에 착지했습니다. 순위가 확정되고 난투는 계속됩니다.';
  return state;
}

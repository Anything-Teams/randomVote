import { arenaAction, arenaBeat, arenaCatchTargets, arenaChargeState, arenaEdgeTargets, arenaShoveTargets, arenaSpinTargets, type ArenaRound } from './arenaLogic';

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
  steps: string[];
  step: number;
};

/** The same beat drives the bodies and the explanation of their relationship. */
export function arenaStoryState(round: ArenaRound, elapsed: number): ArenaStoryState {
  const frame = arenaBeat(round, elapsed), action = arenaAction(round, elapsed);
  const beat = frame.stage;
  const step = beat === 'approach' ? 0 : beat === 'hold' ? 1 : 2;
  const turned = step === 2;
  const result = beat === 'result';
  const a = round.aggressor, v = round.victim, h = round.helper;
  const kinds = { team: '협공', betrayal: '배신', bait: '돌진 회피', catch: '돌진 받아 던지기', spin: '한 바퀴 회전 되치기', shove: '몸싸움에 끼어 밀기', edge: '가장자리 밀기', counter: '역습', brace: '버티기', lift: '들배지기', final: '마지막 승부' };
  const state: ArenaStoryState = {
    kind: round.tactic, label: kinds[round.tactic], action: '', left: [a], right: [v],
    relation: '↔', relationLabel: '힘겨루기', steps: ['접근', '맞잡기', '승부수'], step,
  };
  switch (round.tactic) {
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
      state.action = ['둘이 함께 상대의 양쪽으로 접근합니다.', '동맹 둘이 양쪽에서 붙잡아 상대를 함께 들어 올립니다.', '상대가 발을 딛어 버팁니다. 동맹의 첫 공격이 막혔습니다.', '동료가 손을 놓습니다! 함께 공격하던 선수가 혼자 남았습니다.', '버티던 상대가 앞에서 다시 붙잡아 역습합니다.'][state.step];
      if (action.betrayed) state.intruderLabel = '앞에서 역습';
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
      state.step = caught.stage === 'prepare' ? 0 : caught.stage === 'charge' ? 1 : caught.stage === 'catch' ? 2 : 3;
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
    case 'shove': {
      const shove = arenaShoveTargets(round, elapsed, { x: 675, y: 430 });
      state.step = shove.stage === 'wrestle' ? 0 : shove.stage === 'approach' ? 1 : shove.stage === 'contact' ? 2 : 3;
      state.left = h ? [h, v] : [v]; state.right = [a];
      state.leftLabel = '맞잡고 싸우는 두 선수'; state.rightLabel = '옆에서 끼어드는 선수';
      state.relation = '←'; state.relationLabel = '몸싸움 틈에 어깨 밀기';
      state.steps = ['둘이 힘겨루기', '옆으로 접근', '어깨 맞대 밀기', '한 명은 버티고 장외'];
      state.action = ['두 선수가 손을 맞잡고 버팁니다. 옆의 선수는 빈틈을 봅니다.', '손을 잡고 싸우는 두 선수의 옆으로 접근합니다.', '어깨와 두 손으로 밀었습니다! 두 선수의 중심이 함께 흔들립니다.', '한 선수는 손을 풀고 발을 고쳐 딛습니다. 다른 선수는 경계 밖으로 밀려 떨어집니다.'][state.step];
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
  if (beat === 'impact' && round.tactic !== 'bait' && round.tactic !== 'edge' && round.tactic !== 'shove' && round.tactic !== 'spin') state.action = round.tactic === 'catch' ? '돌진한 몸을 잡은 채 발을 돌렸습니다! 상대가 장외로 날아갑니다.' : '중심이 무너졌습니다! 모래판 밖으로 넘어갑니다.';
  if (result) state.action = round.exchange ? round.tactic === 'team' ? '공동공격 실패! 상대가 버텨 빠져나옵니다. 동맹도 함께 물러나 다시 빈틈을 봅니다.' : round.tactic === 'betrayal' ? '배신 뒤의 역습도 버텼습니다! 서로 손을 풀고 모두 모래판을 지켰습니다.' : round.tactic === 'bait' ? '돌진을 멈춰 세웠습니다! 서로 거리를 벌리고 다음 빈틈을 봅니다.' : '버텼습니다! 서로 손을 풀고 다시 빈틈을 봅니다.' : round.final ? '마지막 상대가 장외에 착지했습니다. 우승 확정!' : '장외에 착지했습니다. 순위가 확정되고 난투는 계속됩니다.';
  return state;
}

import { arenaBeat, type ArenaRound } from './arenaLogic';

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
  steps: string[];
  step: number;
};

/** The same beat drives the bodies and the explanation of their relationship. */
export function arenaStoryState(round: ArenaRound, elapsed: number): ArenaStoryState {
  const frame = arenaBeat(round, elapsed);
  const beat = frame.stage;
  const step = beat === 'approach' ? 0 : beat === 'hold' ? 1 : 2;
  const turned = step === 2;
  const result = beat === 'result';
  const a = round.aggressor, v = round.victim, h = round.helper;
  const kinds = { team: '협공', betrayal: '배신', bait: '유인', counter: '역습', brace: '버티기', lift: '들배지기', final: '마지막 승부' };
  const state: ArenaStoryState = {
    kind: round.tactic, label: kinds[round.tactic], action: '', left: [a], right: [v],
    relation: '↔', relationLabel: '힘겨루기', steps: ['접근', '맞잡기', '승부수'], step,
  };
  switch (round.tactic) {
    case 'team':
      state.left = h ? [a, h] : [a];
      state.relation = '→'; state.relationLabel = '둘이 한 명을 공격';
      state.steps = ['양쪽 포위', '함께 잡기', '동시에 들기'];
      state.action = ['두 선수가 양쪽으로 돌아서 퇴로를 막습니다.', '양쪽에서 붙잡았습니다. 한 선수가 신호를 보냅니다.', '같은 순간 몸을 낮추고 함께 들어 올립니다.'][step];
      if (beat === 'turn' && frame.liftProgress === 0) state.action = '신호에 맞춰 두 선수가 함께 무릎을 굽힙니다.';
      break;
    case 'betrayal':
      state.left = h ? [h] : [a]; state.right = [v];
      state.leftLabel = turned ? '배신한 선수' : '동료';
      state.rightLabel = turned ? '버려진 선수' : '도움받는 선수';
      state.relation = turned ? '×' : '↔'; state.relationLabel = turned ? '동맹 파기 · 손을 놓음' : '임시 동맹 · 함께 버팀';
      state.steps = ['동맹 접근', '서로 지지', '손을 놓음'];
      state.action = ['서로 손을 잡고 임시 동맹을 맺습니다.', '동료를 믿고 버팁니다. 다른 선수가 빈틈을 살핍니다.', '동료가 갑자기 손을 놓습니다! 지켜보던 선수가 빈틈으로 들어옵니다.'][step];
      break;
    case 'bait':
      state.relation = turned ? '↗' : '←'; state.relationLabel = turned ? '옆으로 회피' : '돌진 유도';
      state.steps = ['빈틈 보이기', '돌진 기다리기', '옆으로 피하기'];
      state.action = ['일부러 길을 열고 돌진을 유도합니다.', '상대가 무게를 앞으로 싣습니다.', '옆으로 빠집니다. 돌진한 상대는 중심을 잃습니다.'][step];
      break;
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
  if (beat === 'impact') state.action = '중심이 무너졌습니다! 모래판 밖으로 넘어갑니다.';
  if (result) state.action = round.exchange ? '버텼습니다! 서로 손을 풀고 다시 빈틈을 봅니다.' : round.final ? '마지막 상대가 장외에 착지했습니다. 우승 확정!' : '장외에 착지했습니다. 순위가 확정되고 난투는 계속됩니다.';
  return state;
}

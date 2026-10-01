import { arenaAction, arenaBeat, arenaChargeState, type ArenaRound } from './arenaLogic';

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
  const kinds = { team: '협공', betrayal: '배신', bait: '돌진 회피', counter: '역습', brace: '버티기', lift: '들배지기', final: '마지막 승부' };
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
  if (beat === 'impact' && round.tactic !== 'bait') state.action = '중심이 무너졌습니다! 모래판 밖으로 넘어갑니다.';
  if (result) state.action = round.exchange ? round.tactic === 'team' ? '공동공격 실패! 상대가 버텨 빠져나옵니다. 동맹도 함께 물러나 다시 빈틈을 봅니다.' : round.tactic === 'betrayal' ? '배신 뒤의 역습도 버텼습니다! 서로 손을 풀고 모두 모래판을 지켰습니다.' : round.tactic === 'bait' ? '돌진을 멈춰 세웠습니다! 서로 거리를 벌리고 다음 빈틈을 봅니다.' : '버텼습니다! 서로 손을 풀고 다시 빈틈을 봅니다.' : round.final ? '마지막 상대가 장외에 착지했습니다. 우승 확정!' : '장외에 착지했습니다. 순위가 확정되고 난투는 계속됩니다.';
  return state;
}

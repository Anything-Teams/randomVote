import { arenaAction, arenaBeat, arenaCatchTargets, arenaChargeState, arenaDoubleShoveTargets, arenaEdgeTargets, arenaRamTargets, arenaShoveTargets, arenaSpinTargets, arenaTechniqueTargets, type ArenaRound } from './arenaLogic';
import { arenaPairRushTargets } from './arenaPairRush';
import { arenaEscapeTargets } from './arenaEscape';

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
  if (round.escape && elapsed >= round.escape.start && elapsed < (round.escape.releasedUntil ?? round.escape.end)) {
    const escape = arenaEscapeTargets(round, elapsed, { x: 500, y: 416 })!;
    const stages = ['approach', 'grip', 'break', 'flee', 'chase', 'rejoin'];
    const step = Math.max(0, stages.indexOf(escape.stage));
    const ungripped = round.escape.ungripped;
    if (escape.released || escape.stage === 'separate') return { kind: 'escape', label: '완전히 빠져나왔다!', action: '추격자가 쫓기를 포기했습니다. 손을 놓고 서로 다른 방향으로 움직이며 다음 상대를 찾습니다.', left: [escape.runnerId], right: [escape.chaserId], relation: '↔', relationLabel: '도망 성공 · 대결 종료', leftLabel: '빠져나간 선수', rightLabel: '추격을 포기한 선수', steps: ['접근', '손 빼기', '도망', '추격', '추격 포기', '자유 이동'], step: escape.released ? 5 : 4 };
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
      state.label = '돌진 실패 · 둘이 잡아 던지기'; state.relationLabel = '팔과 다리를 나눠 잡는 반격';
      state.steps = ['둘이 힘겨루기', '뒤에서 달려와 충돌', '튕겨 나가 그로기', '손끝 · 발끝 잡기', '머리 위로 들기', '함께 던지기'];
      state.step = rush.stage === 'wrestle' ? 0 : rush.stage === 'charge' || rush.stage === 'contact' ? 1 : rush.stage === 'rebound' || rush.stage === 'groggy' ? 2 : rush.stage === 'grip' ? 3 : rush.stage === 'lift' || rush.stage === 'overhead' ? 4 : 5;
      state.action = ['두 선수가 맞잡고 싸웁니다. 뒤의 선수가 틈을 노립니다.', '뒤에서 속도를 붙여 두 사람에게 어깨로 부딪칩니다!', '둘이 버텼습니다! 돌진한 선수가 튕겨 나가 쓰러집니다.', '팔을 만세 자세로 폅니다. 한 명은 두 손끝을, 다른 한 명은 두 발끝을 잡았습니다.', '손끝과 발끝을 잡은 채 둘이 머리 위로 높이 들어 올립니다!', '함께 힘을 실어 던집니다. 붙잡힌 선수만 장외로 날아갑니다.'][state.step];
    } else {
      state.label = '돌진 성공 · 두 명 장외'; state.relationLabel = '맞잡은 둘을 함께 밀어내기';
      state.steps = ['둘이 힘겨루기', '세 번째 선수 돌진', '어깨 정면 충돌', '맞잡은 둘이 장외'];
      state.step = rush.stage === 'wrestle' ? 0 : rush.stage === 'charge' ? 1 : rush.stage === 'contact' ? 2 : 3;
      state.action = ['두 선수가 가장자리에서 맞잡고 버팁니다.', '옆의 선수가 빈틈을 향해 달려듭니다.', '어깨가 부딪쳤습니다! 맞잡은 두 사람의 발이 함께 밀립니다.', '두 사람만 경계를 넘고 돌진한 선수는 모래판 안에 남습니다.'][state.step];
    }
    return state;
  }
  switch (round.tactic) {
    case 'elbow': {
      const technique = arenaTechniqueTargets(round, elapsed, { x: 500, y: 416 });
      state.leftLabel = '들린 뒤 반격하는 선수'; state.rightLabel = '먼저 들어 올린 선수'; state.relation = '↶'; state.relationLabel = '엘보우로 역습 · 발끝 잡아 던지기';
      state.steps = ['들렸다!', '머리에 엘보우', '풀리며 쓰러졌다', '그로기', '발끝으로 접근', '두 발끝 잡기', '잡아 던지기'];
      const stages = ['lift-counter', 'elbow', 'elbow-impact', 'groggy', 'ankle-approach', 'ankle-grip', 'release'];
      state.step = Math.max(0, stages.indexOf(technique.stage));
      state.action = ['상대가 허리를 잡아 들어 올립니다. 들린 선수가 팔꿈치를 접어 반격을 준비합니다.', '공중에서 팔꿈치를 내리찍습니다! 상대의 머리에 정확히 닿습니다.', '머리에 충격을 받은 상대가 손을 놓고 쓰러집니다. 들렸던 선수는 착지합니다.', '상대가 그로기 상태로 누웠습니다. 별이 맴돌고 팔과 다리에 힘이 풀립니다.', '착지한 선수가 옆으로 돌아 누운 상대의 발끝에 접근합니다.', '두 발끝을 양손으로 잡았습니다. 발을 딛고 상대 몸을 끌어 올립니다.', '발끝을 잡아 힘껏 던집니다! 처음 들어 올렸던 선수만 장외로 날아갑니다.'][state.step];
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
      } else if (round.tactic === 'suplex') {
        state.steps = ['견제 · 회피', '허리 잡아 들기', '머리 위로!', '내리찍기', '등 · 어깨 충돌', '기절', '경계까지 끌기', '안에서 던지기'];
        state.step = opening ? 0 : technique.stage === 'grip' || technique.stage === 'lift' ? 1 : technique.stage === 'overhead' ? 2 : technique.stage === 'slam' ? technique.slamImpact > 0 ? 4 : 3 : elapsed < round.impact + 300 * (round.timeScale ?? round.end / 44000) ? 5 : elapsed < round.impact + 2600 * (round.timeScale ?? round.end / 44000) ? 6 : 7;
        state.action = ['밀기를 막았습니다. 자세를 낮춰 상대의 허리를 노립니다.', '허리를 양팔로 감싸고 발을 딛어 머리 위로 들어 올립니다.', '상대를 머리 위에 높이 들었습니다! 정점에서 몸을 고정합니다.', '잡고 있던 상대를 아래로 힘껏 내리찍습니다!', '쾅! 등과 어깨가 모래판에 부딪쳤습니다. 충격으로 팔과 다리의 힘이 풀립니다.', '바닥에 쓰러진 상대가 잠깐 기절합니다. 공격한 선수는 다시 발을 딛습니다.', '발목을 잡고 모래판 안쪽 경계까지 끕니다. 공격하는 선수는 모래판 안에 남습니다.', '경계 안에 발을 디딘 채 잡은 발목을 놓아 넘깁니다. 상대만 모래판 밖으로 떨어집니다.'][state.step];
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

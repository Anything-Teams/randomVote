import type { CSSProperties } from 'react';
import type { Candidate } from './election';
import type { ArenaRound } from './arenaLogic';
import { arenaStoryState } from './arenaStoryLogic';

type Props = { round?: ArenaRound; candidates: Candidate[]; elapsed: number; preview: boolean; finished: boolean; title: string; detail: string };

export default function ArenaStory({ round, candidates, elapsed, preview, finished, title, detail }: Props) {
  const story = !preview && round ? arenaStoryState(round, elapsed) : undefined;
  const chip = (id: string) => {
    const index = candidates.findIndex(candidate => candidate.id === id);
    const candidate = candidates[index];
    if (!candidate) return null;
    return <span key={id} className="arena-story-person" style={{ '--person-color': candidate.color } as CSSProperties} title={`${index + 1}번 ${candidate.name}`}>
      <b>{index + 1}</b><span>{candidate.name}</span>
    </span>;
  };
  return <div className={`arena-callout${finished ? ' arena-callout-winner' : ''}${story ? ` arena-story-${story.kind}` : ''}`} aria-label="현재 난투 사건">
    {story && !finished ? <>
      <div className="arena-story-heading"><strong>{story.label}</strong><ol className="arena-story-steps" aria-label="사건 진행 단계">{story.steps.map((label, index) => <li key={label} className={index === story.step ? 'is-current' : index < story.step ? 'is-done' : ''} aria-current={index === story.step ? 'step' : undefined}>{label}</li>)}</ol></div>
      <div className="arena-story-relationship">
        <div className="arena-story-side">{story.left.map(chip)}{story.leftLabel && <small>{story.leftLabel}</small>}</div>
        <div className="arena-story-link"><b aria-hidden="true">{story.relation}</b><span>{story.relationLabel}</span></div>
        <div className="arena-story-side">{story.right.map(chip)}{story.rightLabel && <small>{story.rightLabel}</small>}</div>
        {story.kind === 'betrayal' && round && <div className="arena-story-intruder">{chip(round.aggressor)}<span>{story.step < 2 ? '빈틈을 기다림' : '빈틈으로 공격'}</span></div>}
      </div>
      <p className="arena-story-action">{story.action}</p>
    </> : <><strong>{title}</strong><span>{detail}</span></>}
  </div>;
}

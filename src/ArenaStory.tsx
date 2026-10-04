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
      <b>{index + 1}</b>
    </span>;
  };
  return <div className={`arena-callout${finished ? ' arena-callout-winner' : ''}${story ? ` arena-story-${story.kind}` : ''}`} aria-label="현재 난투 사건">
    {story && !finished ? <>
      <div className="arena-story-heading"><strong>{story.label}</strong><span className="arena-current-step">{story.steps[story.step] ?? story.steps[0]}</span></div>
      <div className="arena-story-relationship">
        <div className="arena-story-side" aria-label={story.leftLabel}>{story.left.map(chip)}</div>
        <div className="arena-story-link"><b aria-hidden="true">{story.relation}</b><span>{story.relationLabel}</span></div>
        <div className="arena-story-side" aria-label={story.rightLabel}>{story.right.map(chip)}</div>
        {story.intruderLabel && round && <div className="arena-story-intruder">{chip(story.intruderId ?? round.aggressor)}<span>{story.intruderLabel}</span></div>}
      </div>
      <p className="arena-story-accessible">{story.action}</p>
    </> : <><strong>{title}</strong><span>{detail}</span></>}
  </div>;
}

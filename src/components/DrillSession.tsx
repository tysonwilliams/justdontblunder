import { DrillDone, DrillRunSummary } from '@/src/components/drills/DrillScore';
import { DrillPlay } from '@/src/components/drills/DrillPlay';
import { useDrillSession, type DrillPlayMode } from '@/src/components/drills/useDrillSession';
import { DrillToolbar } from '@/src/components/DrillToolbar';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { ChessBoard } from '@/src/components/Board/ChessBoard';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { useLayout } from '@/src/components/ui/useLayout';
import { sessionForTheme, type DrillMode, type ThemeFilter } from '@/src/logic/drillLink';

type Props = {
  mode: DrillPlayMode;
  theme: ThemeFilter;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
};

export function DrillSession({ mode, theme, onMode, onTheme }: Props) {
  const session = useDrillSession(mode, theme);
  const { split, phone } = useLayout();
  const toolbar = { mode, theme, onMode, onTheme };

  if (session.runSummary) {
    return (
      <DrillRunSummary
        summary={session.runSummary}
        toolbar={toolbar}
        onAgain={() => session.begin(sessionForTheme(theme))}
      />
    );
  }

  if (session.reviewing && !session.hydrated) {
    return (
      <PlayFrame
        intro={
          <BoardLead>
            <DrillToolbar {...toolbar} />
          </BoardLead>
        }
        board={<ChessBoard interactive={false} hideTurn />}
      />
    );
  }

  if (session.done) {
    return (
      <DrillDone
        toolbar={toolbar}
        reviewing={session.reviewing}
        streak={mode === 'streak'}
        emptyReview={session.reviewing && session.session.positions.length === 0}
        correct={session.score.correct}
        total={session.score.total}
        best={Math.max(session.bestPuzzleStreak, session.score.correct)}
        onRestart={session.restart}
      />
    );
  }

  return <DrillPlay session={session} onMode={onMode} onTheme={onTheme} split={split} phone={phone} />;
}

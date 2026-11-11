import { View } from 'react-native';

import { DrillDone, DrillRunSummary } from '@/src/components/drills/DrillScore';
import { DrillPlay } from '@/src/components/drills/DrillPlay';
import { useDrillSession, type DrillPlayMode } from '@/src/components/drills/useDrillSession';
import { DrillToolbar } from '@/src/components/DrillToolbar';
import { BoardLead } from '@/src/components/ui/BoardLead';
import { Bone, BoardSkeleton } from '@/src/components/ui/Skeleton';
import { forceSkeleton } from '@/src/components/ui/skeletonMode';
import { PlayFrame } from '@/src/components/ui/PlayFrame';
import { play } from '@/src/components/ui/playStyles';
import { useLayout } from '@/src/components/ui/useLayout';
import { radii } from '@/src/theme';
import { type DrillMode, type ThemeFilter } from '@/src/logic/drillLink';

type Props = {
  mode: DrillPlayMode;
  theme: ThemeFilter;
  streak: boolean;
  onMode: (mode: DrillMode) => void;
  onTheme: (theme: ThemeFilter) => void;
  onStreak: (streak: boolean) => void;
};

export function DrillSession({ mode, theme, streak, onMode, onTheme, onStreak }: Props) {
  const session = useDrillSession(mode, theme, streak);
  const { phone } = useLayout();
  const toolbar = { mode, theme, streak, onMode, onTheme, onStreak };

  if (session.runSummary) {
    return (
      <DrillRunSummary
        summary={session.runSummary}
        toolbar={toolbar}
        onAgain={() => session.restart()}
      />
    );
  }

  if (forceSkeleton() || (session.reviewing && !session.hydrated)) {
    return (
      <PlayFrame
        intro={
          <BoardLead>
            <DrillToolbar {...toolbar} />
            <Bone width="70%" height={phone ? 20 : 26} />
            <Bone height={phone ? 4 : 6} radius={radii.track} />
          </BoardLead>
        }
        board={<BoardSkeleton hideTurn={phone} />}
        aside={
          phone ? null : (
            <View style={play.guide}>
              <Bone height={16} />
              <Bone width="76%" height={16} />
            </View>
          )
        }
      />
    );
  }

  if (session.done) {
    return (
      <DrillDone
        toolbar={toolbar}
        reviewing={session.reviewing}
        streak={streak}
        emptyReview={session.reviewing && session.session.positions.length === 0}
        correct={session.score.correct}
        total={session.score.total}
        best={Math.max(session.bestPuzzleStreak, session.score.correct)}
        onRestart={session.restart}
      />
    );
  }

  return <DrillPlay session={session} onMode={onMode} onTheme={onTheme} onStreak={onStreak} phone={phone} />;
}

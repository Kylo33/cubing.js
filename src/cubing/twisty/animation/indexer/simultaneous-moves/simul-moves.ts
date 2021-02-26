import {
  LineComment,
  Commutator,
  Conjugate,
  Pause,
  TraversalUp,
  Turn,
  Alg,
  Grouping,
  Newline,
} from "../../../../alg";
import { MillisecondTimestamp } from "../../cursor/CursorTypes";
import { defaultDurationForAmount } from "../AlgDuration";

export interface LocalMoveWithRange {
  move: Turn;
  msUntilNext: MillisecondTimestamp;
  duration: MillisecondTimestamp;
}

export interface MoveWithRange {
  move: Turn;
  start: MillisecondTimestamp;
  end: MillisecondTimestamp;
}

const axisLookup: Record<string, "x" | "y" | "z"> = {
  u: "y",
  l: "x",
  f: "z",
  r: "x",
  b: "z",
  d: "y",
  m: "x",
  e: "y",
  s: "z",
  x: "x",
  y: "y",
  z: "z",
};

function isSameAxis(move1: Turn, move2: Turn): boolean {
  return (
    axisLookup[move1.family[0].toLowerCase()] ===
    axisLookup[move2.family[0].toLowerCase()]
  );
}

// TODO: Replace this with an optimized implementation.
// TODO: Consider `(x U)` and `(U x F)` to be simultaneous.
export class LocalSimulMoves extends TraversalUp<LocalMoveWithRange[]> {
  public traverseAlg(alg: Alg): LocalMoveWithRange[] {
    const processed: LocalMoveWithRange[][] = [];
    for (const nestedUnit of alg.units()) {
      processed.push(this.traverseUnit(nestedUnit));
    }
    return Array.prototype.concat(...processed);
  }

  public traverseGroupingOnce(alg: Alg): LocalMoveWithRange[] {
    if (alg.experimentalIsEmpty()) {
      return [];
    }

    for (const unit of alg.units()) {
      if (!unit.is(Turn))
        // TODO: define the type statically on the class?
        return this.traverseAlg(alg);
    }

    const moves = Array.from(alg.units()) as Turn[];
    let maxSimulDur = defaultDurationForAmount(moves[0].effectiveAmount);
    for (let i = 0; i < moves.length - 1; i++) {
      for (let j = 1; j < moves.length; j++) {
        if (!isSameAxis(moves[i], moves[j])) {
          return this.traverseAlg(alg);
        }
      }
      maxSimulDur = Math.max(
        maxSimulDur,
        defaultDurationForAmount(moves[i].effectiveAmount),
      );
    }

    const localMovesWithRange: LocalMoveWithRange[] = moves.map(
      (blockMove): LocalMoveWithRange => {
        return {
          move: blockMove,
          msUntilNext: 0,
          duration: maxSimulDur,
        };
      },
    );
    localMovesWithRange[
      localMovesWithRange.length - 1
    ].msUntilNext = maxSimulDur;
    return localMovesWithRange;
  }

  public traverseGrouping(grouping: Grouping): LocalMoveWithRange[] {
    const processed: LocalMoveWithRange[][] = [];

    const segmentOnce: Alg =
      grouping.experimentalEffectiveAmount > 0
        ? grouping.experimentalAlg
        : grouping.experimentalAlg.inverse();
    for (let i = 0; i < Math.abs(grouping.experimentalEffectiveAmount); i++) {
      processed.push(this.traverseGroupingOnce(segmentOnce));
    }
    return Array.prototype.concat(...processed);
  }

  public traverseMove(move: Turn): LocalMoveWithRange[] {
    const duration = defaultDurationForAmount(move.effectiveAmount);
    return [
      {
        move: move,
        msUntilNext: duration,
        duration,
      },
    ];
  }

  public traverseCommutator(commutator: Commutator): LocalMoveWithRange[] {
    const processed: LocalMoveWithRange[][] = [];
    const segmentsOnce: Alg[] =
      commutator.experimentalEffectiveAmount > 0
        ? [
            commutator.A,
            commutator.B,
            commutator.A.inverse(),
            commutator.B.inverse(),
          ]
        : [
            commutator.B,
            commutator.A,
            commutator.B.inverse(),
            commutator.A.inverse(),
          ];
    for (let i = 0; i < Math.abs(commutator.experimentalEffectiveAmount); i++) {
      for (const segment of segmentsOnce) {
        processed.push(this.traverseGroupingOnce(segment));
      }
    }
    return Array.prototype.concat(...processed);
  }

  public traverseConjugate(conjugate: Conjugate): LocalMoveWithRange[] {
    const processed: LocalMoveWithRange[][] = [];
    const segmentsOnce: Alg[] =
      conjugate.experimentalEffectiveAmount > 0
        ? [conjugate.A, conjugate.B, conjugate.A.inverse()]
        : [conjugate.A, conjugate.B.inverse(), conjugate.A.inverse()];
    for (let i = 0; i < Math.abs(conjugate.experimentalEffectiveAmount); i++) {
      for (const segment of segmentsOnce) {
        processed.push(this.traverseGroupingOnce(segment));
      }
    }
    return Array.prototype.concat(...processed);
  }

  public traversePause(_pause: Pause): LocalMoveWithRange[] {
    return [];
  }

  public traverseNewline(_newline: Newline): LocalMoveWithRange[] {
    return [];
  }

  public traverseLineComment(_comment: LineComment): LocalMoveWithRange[] {
    return [];
  }
}

const localSimulMovesInstance = new LocalSimulMoves();

const localSimulMoves = localSimulMovesInstance.traverseAlg.bind(
  localSimulMovesInstance,
) as (a: Alg) => LocalMoveWithRange[];

export function simulMoves(a: Alg): MoveWithRange[] {
  let timestamp = 0;
  const l = localSimulMoves(a).map(
    (localSimulMove: LocalMoveWithRange): MoveWithRange => {
      const moveWithRange = {
        move: localSimulMove.move,
        start: timestamp,
        end: timestamp + localSimulMove.duration,
      };
      timestamp += localSimulMove.msUntilNext;
      return moveWithRange;
    },
  );
  return l;
}

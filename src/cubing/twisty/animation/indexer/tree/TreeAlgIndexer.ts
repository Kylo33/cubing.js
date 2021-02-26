import { Alg, Turn } from "../../../../alg";
import { PuzzleWrapper, State } from "../../../3D/puzzles/KPuzzleWrapper";
import { Duration, Timestamp } from "../../cursor/CursorTypes";
import { AlgIndexer } from "../AlgIndexer";
import { AlgPartDecoration, AlgWalker, DecoratorConstructor } from "./walker";

export class TreeAlgIndexer implements AlgIndexer<PuzzleWrapper> {
  private decoration: AlgPartDecoration<PuzzleWrapper>;
  private walker: AlgWalker<PuzzleWrapper>;
  constructor(private puzzle: PuzzleWrapper, alg: Alg) {
    const deccon = new DecoratorConstructor<PuzzleWrapper>(this.puzzle);
    this.decoration = deccon.traverseAlg(alg);
    this.walker = new AlgWalker<PuzzleWrapper>(
      this.puzzle,
      alg,
      this.decoration,
    );
  }

  public getMove(index: number): Turn | null {
    // FIXME need to support Pause
    if (this.walker.moveByIndex(index)) {
      if (!this.walker.move) {
        throw new Error("`this.walker.mv` missing");
      }
      const move = this.walker.move as Turn;
      // TODO: this type of negation needs to be in alg
      if (this.walker.back) {
        return move.inverse();
      }
      return move;
    }
    return null;
  }

  public indexToMoveStartTimestamp(index: number): Timestamp {
    if (this.walker.moveByIndex(index) || this.walker.i === index) {
      return this.walker.dur;
    }
    throw new Error("Out of algorithm: index " + index);
  }

  public indexToMovesInProgress(index: number): Timestamp {
    if (this.walker.moveByIndex(index) || this.walker.i === index) {
      return this.walker.dur;
    }
    throw new Error("Out of algorithm: index " + index);
  }

  public stateAtIndex(
    index: number,
    startTransformation?: State<PuzzleWrapper>,
  ): State<PuzzleWrapper> {
    this.walker.moveByIndex(index);
    return this.puzzle.combine(
      startTransformation ?? this.puzzle.startState(),
      this.walker.st,
    );
  }

  // TransformAtIndex does not reflect the start state; it only reflects
  // the change from the start state to the current move index.  If you
  // want the actual state, use stateAtIndex.
  public transformAtIndex(index: number): State<PuzzleWrapper> {
    this.walker.moveByIndex(index);
    return this.walker.st;
  }

  public numMoves(): number {
    return this.decoration.moveCount;
  }

  public timestampToIndex(timestamp: Timestamp): number {
    this.walker.moveByDuration(timestamp);
    return this.walker.i;
  }

  public algDuration(): Duration {
    return this.decoration.duration;
  }

  public moveDuration(index: number): number {
    this.walker.moveByIndex(index);
    return this.walker.moveDuration;
  }
}

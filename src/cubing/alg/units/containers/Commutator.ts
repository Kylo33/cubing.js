import { Alg, FlexibleAlgSource } from "../../Alg";
import { AlgCommon, Comparable } from "../../common";
import { IterationDirection } from "../../iteration";
import { Repetition, RepetitionInfo } from "../Repetition";
import { LeafUnit } from "../Unit";

export class QuantumCommutator extends Comparable {
  constructor(public A: Alg, public B: Alg) {
    super();
    Object.freeze(this);
  }

  isIdentical(other: Comparable): boolean {
    const otherAsCommutatorQuantum = other as QuantumCommutator;
    return (
      other.is(QuantumCommutator) &&
      this.A.isIdentical(otherAsCommutatorQuantum.A) &&
      this.B.isIdentical(otherAsCommutatorQuantum.B)
    );
  }

  toString(): string {
    return `[${this.A}, ${this.B}]`;
  }

  // TODO: use a common composite iterator helper.
  *experimentalExpand(
    iterDir: IterationDirection = IterationDirection.Forwards,
  ): Generator<LeafUnit> {
    if (iterDir === IterationDirection.Forwards) {
      yield* this.A.experimentalExpand(IterationDirection.Forwards);
      yield* this.B.experimentalExpand(IterationDirection.Forwards);
      yield* this.A.experimentalExpand(IterationDirection.Backwards);
      yield* this.B.experimentalExpand(IterationDirection.Backwards);
    } else {
      yield* this.B.experimentalExpand(IterationDirection.Forwards);
      yield* this.A.experimentalExpand(IterationDirection.Forwards);
      yield* this.B.experimentalExpand(IterationDirection.Backwards);
      yield* this.A.experimentalExpand(IterationDirection.Backwards);
    }
  }
}

export class Commutator extends AlgCommon<Commutator> {
  readonly #repetition: Repetition<QuantumCommutator>;

  constructor(
    aSource: FlexibleAlgSource,
    bSource: FlexibleAlgSource,
    repetitionInfo?: RepetitionInfo,
  ) {
    super();
    this.#repetition = new Repetition<QuantumCommutator>(
      new QuantumCommutator(new Alg(aSource), new Alg(bSource)), // TODO
      repetitionInfo,
    );
  }

  get A(): Alg {
    return this.#repetition.quantum.A;
  }

  get B(): Alg {
    return this.#repetition.quantum.B;
  }

  /** @deprecated */
  get experimentalEffectiveAmount(): number {
    return this.#repetition.experimentalEffectiveAmount();
  }

  /** @deprecated */
  get experimentalRepetitionSuffix(): string {
    return this.#repetition.suffix();
  }

  isIdentical(other: Comparable): boolean {
    const otherAsCommutator = other as Commutator;
    return (
      other.is(Commutator) &&
      this.#repetition.isIdentical(otherAsCommutator.#repetition)
    );
  }

  inverse(): Commutator {
    return new Commutator(
      this.#repetition.quantum.B,
      this.#repetition.quantum.A,
      this.#repetition.inverseInfo(),
    );
  }

  *experimentalExpand(
    iterDir: IterationDirection = IterationDirection.Forwards,
    depth: number = Infinity,
  ): Generator<LeafUnit> {
    if (depth === 0) {
      yield iterDir === IterationDirection.Forwards ? this : this.inverse();
    } else {
      yield* this.#repetition.experimentalExpand(iterDir, depth);
    }
  }

  toString(): string {
    return `${this.#repetition.quantum.toString()}${this.#repetition.suffix()}`;
  }

  // toJSON(): CommutatorJSON {
  //   return {
  //     type: "commutator",
  //     A: this.#quanta.quantum.A.toJSON(),
  //     B: this.#quanta.quantum.B.toJSON(),
  //     amount: this.a
  //   };
  // }
}

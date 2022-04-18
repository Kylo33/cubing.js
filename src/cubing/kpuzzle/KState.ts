import type { Alg, Move } from "../alg";
import { experimentalIs3x3x3Solved } from "./3x3x3/puzzle-orientation";
import { applyTransformationDataToStateData } from "./combine";
import type { KPuzzle, KTransformationSource } from "./KPuzzle";
import type {
  KStateData,
  KTransformationData,
  KTransformationOrbitData,
} from "./KPuzzleDefinition";
import { KTransformation } from "./KTransformation";

export class KState {
  constructor(
    public readonly kpuzzle: KPuzzle,
    public readonly stateData: KStateData,
  ) {}

  toJSON(): any {
    return {
      experimentalPuzzleName: this.kpuzzle.name(),
      stateData: this.stateData,
    };
  }

  static fromTransformation(transformation: KTransformation): KState {
    const newStateData = applyTransformationDataToStateData(
      transformation.kpuzzle.definition,
      transformation.kpuzzle.definition.startStateData,
      transformation.transformationData,
    );
    return new KState(transformation.kpuzzle, newStateData);
  }

  // Convenience function
  /** @deprecated */
  apply(source: KTransformationSource): KState {
    return this.applyTransformation(this.kpuzzle.toTransformation(source));
  }

  applyTransformation(transformation: KTransformation): KState {
    if (transformation.isIdentityTransformation()) {
      return new KState(this.kpuzzle, this.stateData);
    }
    const newStateData = applyTransformationDataToStateData(
      this.kpuzzle.definition,
      this.stateData,
      transformation.transformationData,
    );
    return new KState(this.kpuzzle, newStateData);
  }

  applyMove(move: Move | string): KState {
    return this.applyTransformation(this.kpuzzle.moveToTransformation(move));
  }

  applyAlg(alg: Alg | string): KState {
    return this.applyTransformation(this.kpuzzle.algToTransformation(alg));
  }

  /** @deprecated */
  experimentalToTransformation(): KTransformation | null {
    if (!this.kpuzzle.canConvertStateToUniqueTransformation()) {
      return null;
    }
    const transformationData: KTransformationData = {};
    for (const [orbitName, stateOrbitData] of Object.entries(this.stateData)) {
      const transformationOrbit: KTransformationOrbitData = {
        permutation: stateOrbitData.pieces,
        orientation: stateOrbitData.orientation,
      };
      transformationData[orbitName] = transformationOrbit;
    }
    return new KTransformation(this.kpuzzle, transformationData);
  }

  experimentalIs3x3x3Solved(options: {
    ignorePuzzleOrientation: boolean;
    ignoreCenterOrientation: boolean;
  }): boolean {
    if (this.kpuzzle.name() !== "3x3x3") {
      throw new Error(
        "`KState.experimentalIs3x3x3Solved()` only supports 3x3x3 states.",
      );
    }
    return experimentalIs3x3x3Solved(this, options);
  }
}

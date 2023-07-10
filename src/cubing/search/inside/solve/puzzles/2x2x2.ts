import { Alg, Move } from "../../../../alg";
import type { KPuzzle } from "../../../../kpuzzle";
import { KState } from "../../../../kpuzzle";
import { cube2x2x2, puzzles } from "../../../../puzzles";
import { randomPermuteInPlace, randomUIntBelow } from "random-uint-below";
import { mustBeInsideWorker } from "../../inside-worker";
import type { SGSCachedData } from "../parseSGS";
import { TrembleSolver } from "../tremble";
import { searchDynamicSideEvents } from "./dynamic/sgs-side-events";
import { solveTwsearch, twsearchPromise } from "../twsearch";
import { experimentalNormalize2x2x2Orientation } from "../../../../puzzles/cubing-private";

let cachedTrembleSolver: Promise<TrembleSolver> | null = null;
async function getCachedTrembleSolver(): Promise<TrembleSolver> {
  return (
    cachedTrembleSolver ||
    (cachedTrembleSolver = (async (): Promise<TrembleSolver> => {
      const sgsCachedData: SGSCachedData = await (
        await searchDynamicSideEvents
      ).cachedData222();
      return new TrembleSolver(
        await puzzles["2x2x2"].kpuzzle(),
        sgsCachedData,
        "URFLBD".split(""),
      );
    })())
  );
}

export async function preInitialize222(): Promise<void> {
  await getCachedTrembleSolver();
}

export async function solve222HTMSubOptimal(
  state: KState,
  maxDepth: number = 11,
): Promise<Alg> {
  mustBeInsideWorker();
  return await solveTwsearch(
    (
      await cube2x2x2.kpuzzle()
    ).definition,
    state.stateData,
    {
      moveSubset: "UFLR".split(""), // TODO: <U, F, R>
      maxDepth,
    },
  );
}

// TODO: fix def consistency.
// TODO: why is this ending up with the wrong rotation sometimes?
export async function solve222HTMOptimal(
  state: KState,
  maxDepth: number = 11,
): Promise<Alg> {
  mustBeInsideWorker();
  const { normalizedState, normalizationAlg } =
    experimentalNormalize2x2x2Orientation(state);
  const orientedResult = await solveTwsearch(
    (
      await cube2x2x2.kpuzzle()
    ).definition,
    normalizedState.stateData,
    {
      moveSubset: "UFLR".split(""), // TODO: <U, F, R>
      maxDepth,
    },
  );
  return normalizationAlg.concat(orientedResult);
}

async function hasHTMSolutionWithFewerMoves(
  state: KState,
  filterMin: number,
): Promise<boolean> {
  try {
    (await solve222HTMOptimal(state, filterMin - 1)).log();
    return true;
  } catch (e) {
    if (e instanceof (await twsearchPromise).NoSolutionError) {
      return false;
    }
    throw e;
  }
}

function isCancelling(alg: Alg): boolean {
  let lastFamily: undefined | string;
  for (const node of alg.childAlgNodes()) {
    const move = node.as(Move);
    if (!move) {
      throw new Error("Unexpected solution with a non-move node!");
    }
    const { family } = move;
    if (
      lastFamily &&
      ((lastFamily === "L" && family === "R") ||
        (lastFamily === "R" && family === "L"))
    ) {
      return true;
    }
    lastFamily = family;
  }
  return false;
}

// TODO: fix def consistency.
export async function solve222ForScramble(state: KState): Promise<Alg> {
  mustBeInsideWorker();
  return solveTwsearch(
    (await cube2x2x2.kpuzzle()).definition,
    state.stateData,
    {
      moveSubset: "UFLR".split(""),
      minDepth: 11,
    },
  );
}

// TODO: factor out and test.
function mutatingRandomizeOrbit(
  state: KState,
  orbitName: string,
  options?: { orientationSum?: number },
): void {
  const orbitView = state.orbitView(orbitName, true);
  const orbitPieces = [...orbitView.getPieces()];
  randomPermuteInPlace(orbitPieces);
  orbitView.setPiecesRaw(orbitPieces);

  const { orbitDefinition } = orbitView;

  let sum = 0;
  for (let i = 0; i < orbitDefinition.numPieces; i++) {
    const o = randomUIntBelow(orbitDefinition.numOrientations);
    orbitView.setOrientationAt(i, o);
    sum += o;
  }

  // console.log("aaaa", options && "orientationSum" in options);
  if (options && "orientationSum" in options) {
    orbitView.setOrientationDeltaAt(0, options.orientationSum! - sum);
  }
}

// TODO: Use SGS?
export async function random222State(): Promise<KState> {
  const kpuzzle = await puzzles["2x2x2"].kpuzzle();
  const stateCopy: KState = new KState(
    kpuzzle,
    structuredClone(kpuzzle.startState().stateData),
  ); // TODO
  mutatingRandomizeOrbit(stateCopy, "CORNERS", {
    orientationSum: 0,
  });
  return stateCopy;
}

export async function random222Scramble(): Promise<Alg> {
  let state = await random222State();
  while (await hasHTMSolutionWithFewerMoves(state, 4)) {
    console.info("Filtered out a 2x2x2 state!");
    state = await random222State();
  }
  const inverseState = state
    .experimentalToTransformation()!
    .invert()
    .toKState(); // Note: Inversion is not needed for randomness, but it is more consistent with other code.
  let sol = await solve222ForScramble(inverseState);
  while (isCancelling(sol)) {
    // Rely on `--randomstart` to find us a non-cancelling with ≈2/3 probability.
    // TODO: Check that this works for 100% of states.
    sol = await solve222ForScramble(inverseState);
  }

  return sol;
}

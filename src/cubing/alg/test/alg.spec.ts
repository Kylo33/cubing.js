import { Alg } from "../Alg";
import { setAlgPartTypeMismatchReportingLevel } from "../debug";
import { Example as Ex } from "../example";
import { Commutator, Grouping, Turn, QuantumTurn, Pause } from "../units";
import "./alg-comparison";

setAlgPartTypeMismatchReportingLevel("error");

const UU = new Alg([new Turn("U", 1), new Turn("U", 1)]);
const U2 = new Alg([new Turn("U", 2)]);

describe("Alg", () => {
  it("allows an empty Alg", () => {
    expect(() => new Alg()).not.toThrow();
    expect(() => new Alg([])).not.toThrow();
    expect(() => new Commutator(new Alg(), new Alg([]))).not.toThrow();
  });

  it("throws an error for a nested Alg", () => {
    expect(() => new Alg([new Alg([new Turn("R", 1)])])).toThrowError(
      /An alg can only contain units./,
    );
  });
});

describe("BlockMove", () => {
  it("allows constructing: x, U, u", () => {
    expect(new Turn("x", 1).toString()).toBe("x");
    expect(new Turn("U", 1).toString()).toBe("U");
    expect(new Turn("u", 1).toString()).toBe("u");
  });

  it("allows constructing: 2U, 2u", () => {
    expect(new Turn(new QuantumTurn("U", 2), 1).toString()).toBe("2U");
    expect(new Turn("2U", 1).toString()).toBe("2U");
    expect(new Turn(new QuantumTurn("u", 2), 1).toString()).toBe("2u");
    expect(new Turn("2u", 1).toString()).toBe("2u");
  });

  it("prevents constructing: [-2]U, [-2]u", () => {
    expect(() => new QuantumTurn("U", -2)).toThrowError(
      /MoveQuantum inner layer must be a positive integer/,
    );
  });

  it("allows constructing: 2-3u", () => {
    expect(new Turn(new QuantumTurn("u", 3, 2), 1).toString()).toBe("2-3u");
  });

  it("prevents constructing: 2-3x, 2-3U, [-2]-3u, 4-3u", () => {
    // expect(() =>
    //   validateSiGNMoves(new Alg([new Turn(new MoveQuantum("x",  3, 2, 1)])),
    // ).toThrowError(/cannot have an outer and inner layer/);
    // expect(() =>
    //   validateSiGNMoves(new Alg([new Turn(new MoveQuantum("U",  3, 2, 1)])),
    // ).toThrowError(/cannot have an outer and inner layer/);
    // expect(() =>
    //   validateSiGNMoves(new Alg([new Turn(new MoveQuantum("u", 3, -2), 1)])),
    // ).toThrowError(/Cannot have an outer layer of 0 or less/);
    // expect(() =>
    //   validateSiGNMoves(new Alg([new Turn(new MoveQuantum("u", 3, 4), 1)])),
    // ).toThrowError(/The outer layer must be less than the inner layer/);
  });

  it("prevents constructing: w, 2T, 2-3q", () => {
    // expect(() =>algPartToStringForTesting(new Turn("w", 1))).toThrowError(/Invalid SiGN plain move family: w/);
    // expect(() =>algPartToStringForTesting(new Turn(new MoveQuantum("T", 2), 1))).toThrowError(/The provided SiGN move family is invalid, or cannot have an inner slice: T/);
    // expect(() =>algPartToStringForTesting(new Turn(new MoveQuantum("q",  3, 2, 1))).toThrowError(/The provided SiGN move family is invalid, or cannot have an outer and inner layer: q/);
  });

  it("supports a default amount of 1.", () => {
    expect(new Alg([new Turn("U")])).toBeIdentical(new Alg([new Turn("U", 1)]));
  });

  it("throws an error for an invalid family", () => {
    // expect(() => new Turn("Q", 1)).toThrowError(/Invalid SiGN plain move family/);
  });

  it("has a default amount of 1", () => {
    expect(new Turn("x").effectiveAmount).toBe(1);
    expect(new Turn("R").effectiveAmount).toBe(1);
    expect(new Turn("u").effectiveAmount).toBe(1);
    expect(new Turn(new QuantumTurn("R", 2)).effectiveAmount).toBe(1);
    expect(new Turn(new QuantumTurn("u", 3)).effectiveAmount).toBe(1);
    expect(new Turn(new QuantumTurn("u", 3, 2)).effectiveAmount).toBe(1);
  });

  it("allows different amounts 1", () => {
    expect(new Turn("x", 2).effectiveAmount).toBe(2);
    expect(new Turn("R", 3).effectiveAmount).toBe(3);
    expect(new Turn("u", -5).effectiveAmount).toBe(-5);
    expect(new Turn(new QuantumTurn("R", 2), 10).effectiveAmount).toBe(10);
    expect(new Turn(new QuantumTurn("L", 3), -13).effectiveAmount).toBe(-13);
    expect(new Turn(new QuantumTurn("u", 12, 2), 15).effectiveAmount).toBe(15);
  });

  it("catches invalid moves with parseSiGN().", () => {
    // expect(() => parseSiGN("R")).not.toThrowError();
    // expect(() => parseSiGN("g")).toThrowError(/Invalid SiGN plain move family/);
    // expect(() => parseSiGN("2Ww")).toThrowError(
    //   /The provided SiGN move family is invalid/,
    // );
    // expect(() => parseSiGN("2-3T")).toThrowError(
    //   /The provided SiGN move family is invalid/,
    // );
    // expect(() => parseSiGN("2-3UF")).toThrowError(
    //   /The provided SiGN move family is invalid/,
    // );
    // expect(() => parseSiGN("4TEST_Hello")).toThrowError(
    //   /The provided SiGN move family is invalid/,
    // );
    // expect(() => parseSiGN("_R")).toThrowError(
    //   /Invalid SiGN plain move family/,
    // );
  });

  it("prevents construction a move quantum with only outer layer", () => {
    expect(() => new QuantumTurn("R", undefined, 1)).toThrow();
  });
});

describe("algToString()", () => {
  it("converts all move types correctly", () => {
    expect(new Turn("x", 2).toString()).toBe("x2");
    expect(new Turn("R", 3).toString()).toBe("R3");
    expect(new Turn("u", -5).toString()).toBe("u5'");
    expect(new Turn(new QuantumTurn("R", 2), 10).toString()).toBe("2R10");
    expect(new Turn(new QuantumTurn("L", 3), -13).toString()).toBe("3L13'");
    expect(new Turn(new QuantumTurn("u", 12, 2), 15).toString()).toBe(
      "2-12u15",
    );
  });

  it("distinguishes between 1R and R", () => {
    expect(new Turn(new QuantumTurn("R", 1)).toString()).toBe("1R");
    expect(new Turn("R").toString()).toBe("R");
  });

  it("handles empty Algs", () => {
    expect(new Alg().toString()).toBe("");
    expect(new Alg([]).toString()).toBe("");
    expect(new Grouping(new Alg([])).toString()).toBe("()");
    // TODO: Should this be "[,]"
    expect(new Alg([new Commutator(new Alg([]), new Alg([]))]).toString()).toBe(
      "[, ]",
    );
  });

  it("converts Sune to string", () => {
    expect(Ex.Sune.toString()).toBe("R U R' U R U2' R'");
  });

  it("converts U U to string", () => {
    expect(UU.toString()).toBe("U U");
  });

  it("converts E-Perm to string", () => {
    expect(Ex.EPerm.toString()).toBe("x' [[R: U'], D] [[R: U], D] x");
  });

  it("converts triple pause to ... (without spaces)", () => {
    expect(Ex.TriplePause.toString()).toBe("...");
  });
});

describe("invert()", () => {
  it("correctly inverts", () => {
    expect(Ex.Sune.inverse()).toBeIdentical(Ex.AntiSune);
    expect(Ex.Sune.inverse().inverse()).toBeIdentical(Ex.Sune);
    expect(Ex.Sune.inverse().inverse()).not.toBeIdentical(Ex.AntiSune);
  });
});

describe("expand()", () => {
  it("correctly expands", () => {
    expect(Ex.FURURFCompact.expand()).toBeIdentical(Ex.FURURFMoves);
    expect(Ex.Sune.expand()).toBeIdentical(Ex.Sune);
    expect(Ex.SuneCommutator.expand()).not.toBeIdentical(Ex.Sune);
    expect(Ex.FURURFCompact.expand()).not.toBeIdentical(Ex.SuneCommutator);
  });

  it("correctly expands a group with two units", () => {
    expect(new Alg("(R U)2").expand()).toBeIdentical(new Alg("R U R U"));
  });

  it("correctly expands an E-Perm", () => {
    expect(Ex.EPerm.expand()).toBeIdentical(
      new Alg("x' R U' R' D R U R' D' R U R' D R U' R' D' x"),
    );
  });
});

describe("structureEquals", () => {
  it("correctly compares algs", () => {
    expect(Ex.FURURFCompact).not.toBeIdentical(Ex.FURURFMoves);
    expect(Ex.FURURFMoves).not.toBeIdentical(Ex.FURURFCompact);
    expect(Ex.FURURFMoves).toBeIdentical(Ex.FURURFMoves);
    expect(Ex.FURURFCompact).toBeIdentical(Ex.FURURFCompact);
  });
});

describe("move collapsing ()", () => {
  it("coalesces U U to U2", () => {
    expect(UU.simplify({ collapseMoves: true })).toBeIdentical(U2);
  });

  it("coalesces expanded commutator Sune corectly", () => {
    expect(
      Ex.SuneCommutator.expand().simplify({ collapseMoves: true }),
    ).toBeIdentical(Ex.Sune);
  });
});

describe("JSON", () => {
  // it("round-trips an alg through JSON stringification", () => {
  //   e(
  //     fromJSON(JSON.parse(JSON.stringify(Ex.FURURFCompact))),
  //     Ex.FURURFCompact,
  //   ).toBe(true);
  // });
});

describe("Object Freezing", () => {
  it("freezes all example alg types", () => {
    // // Update this based on the length of AllAlgParts.
    // expect(Ex.AllAlgParts.length).toBe(8);
    // for (const a of Ex.AllAlgParts) {
    //   expect(Object.isFrozen(a)).toBe(true);
    // }
  });

  it("freezes `nestedUnits` list on Alg", () => {
    // // Update this based on the length of AllAlgParts.
    // expect(Object.isFrozen(new Alg([new Turn("R", 1)]).nestedUnits)).toBe(true);
  });

  // it("makes it impossible to modify a BaseMove", () => {
  //   const b = new Turn("R", 4);
  //   let caughtErr: Error | undefined;
  //   try {
  //     b.effectiveAmount = 2;
  //   } catch (err) {
  //     caughtErr = err;
  //   }
  //   expect(caughtErr instanceof TypeError).toBe(true);
  // });
});

describe("Parser", () => {
  it("parses an empty Alg", () => {
    expect(new Alg("")).toBeIdentical(new Alg());
    expect(Alg.fromString("()")).toBeIdentical(
      new Alg([new Grouping(new Alg([]))]),
    );
    expect(new Alg("")).toBeIdentical(new Alg());
    expect(Alg.fromString("()")).toBeIdentical(
      new Alg([new Grouping(new Alg([]))]),
    );
  });

  it("parses a Sune", () => {
    expect(new Alg("R U R' U R U2' R'")).toBeIdentical(Ex.Sune);
    expect(Alg.fromString("R U R' U R U2' R'")).toBeIdentical(Ex.Sune);
    expect(new Alg("R U R' U R U2' R'")).toBeIdentical(
      Alg.fromString("R U R' U R U2' R'"),
    );
  });

  it("parses U u Uw x 2U 2u 2Uw 2-3u 2-3Uw", () => {
    const s = "U u Uw x 2U 2u 2Uw 2-3u 2-3Uw";
    expect(new Alg(s).toString()).toBe(s);
  });

  it("parses ...", () => {
    const p = new Pause();
    expect(new Alg("...")).toBeIdentical(new Alg([p, p, p]));
  });

  // TODO: Should these be parsed differently?
  it("parses R and R1 as the same (for now)", () => {
    expect(new Alg("R")).toBeIdentical(new Alg("R1"));
  });

  it("round-trips algs through a string", () => {
    expect(new Alg(Ex.SuneCommutator.toString())).toBeIdentical(
      Ex.SuneCommutator,
    );
    expect(new Alg(Ex.Niklas.toString())).toBeIdentical(Ex.Niklas);
    expect(new Alg(Ex.FURURFCompact.toString())).toBeIdentical(
      Ex.FURURFCompact,
    );
    expect(new Alg(Ex.APermCompact.toString())).toBeIdentical(Ex.APermCompact);
    expect(new Alg(Ex.TPerm.toString())).toBeIdentical(Ex.TPerm);
    expect(new Alg(Ex.HeadlightSwaps.toString())).toBeIdentical(
      Ex.HeadlightSwaps,
    );
    expect(new Alg(Ex.TriplePause.toString())).toBeIdentical(Ex.TriplePause);
  });

  // it("round-trips all alg types through a string", () => {
  //   // Update this based on the length of AllAlgParts.
  //   for (const a of Ex.AllAlgParts) {
  //     const seq = matchesAlgType(a, "Alg") ? (a as Alg) : new Alg([a]);
  //     expect(new Alg(algToString(seq))).toBeIdentical(seq);
  //   }
  // });
});

describe("Validator", () => {
  // it("can validate flat algs", () => {
  //   expect(
  //     () => new Alg("(R)", { validators: [validateFlatAlg] }),
  //   ).toThrowError(/cannot contain a group/); // toThrowError(ValidationError, /cannot contain a group/);
  //   expect(
  //     () => new Alg("Qw", { validators: [validateFlatAlg] }),
  //   ).not.toThrow(); // not.toThrowError();
  //   expect(
  //     () => new Alg("(Qw)", { validators: [validateFlatAlg] }),
  //   ).toThrowError(/cannot contain a group/); // toThrowError(ValidationError, );
  // });
  // it("can validate cube base moves alg", () => {
  //   expect(
  //     () => new Alg("(R)", { validators: [validateSiGNMoves] }),
  //   ).not.toThrowError();
  //   expect(
  //     () => new Alg("Qw", { validators: [validateSiGNMoves] }),
  //   ).toThrowError(/Invalid SiGN plain move family/);
  //   expect(
  //     () => new Alg("(Qw)", { validators: [validateSiGNMoves] }),
  //   ).toThrowError(/Invalid SiGN plain move family/);
  // });
  // it("can validate cube algs", () => {
  //   expect(
  //     () => new Alg("(R)", { validators: [validateSiGNAlg] }),
  //   ).toThrowError(/cannot contain a group/);
  //   expect(() => new Alg("Qw", { validators: [validateSiGNAlg] })).toThrowError(
  //     /Invalid SiGN plain move family/,
  //   );
  //   expect(
  //     () => new Alg("(Qw)", { validators: [validateSiGNAlg] }),
  //   ).toThrowError(ValidationError);
  // });
  // it("throws ValidationError", () => {
  //   expect(
  //     () => new Alg("(R)", { validators: [validateFlatAlg] }),
  //   ).toThrowError(ValidationError);
  // });
});

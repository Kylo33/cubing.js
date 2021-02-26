/* tslint:disable no-bitwise */
/* tslint:disable prefer-for-of */ // TODO
/* tslint:disable only-arrow-functions */ // TODO
/* tslint:disable typedef */ // TODO

import { FaceNameSwizzler } from "./FaceNameSwizzler";
import {
  PGVendoredKPuzzleDefinition,
  PGVendoredTurn,
  PGVendoredTurnNotation,
  PGVendoredQuantumTurn,
  Transformation as KTransformation,
} from "./interfaces";
import {
  FaceRenamingMapper,
  MegaminxScramblingNotationMapper,
  NotationMapper,
  NullMapper,
  NxNxNCubeMapper,
  PyraminxNotationMapper,
  SkewbNotationMapper,
} from "./NotationMapper";
import { iota, Perm, zeros } from "./Perm";
import {
  Orbit,
  OrbitDef,
  OrbitsDef,
  showcanon,
  Transformation,
  VisibleState,
} from "./PermOriSet";
import { PGPuzzles, PuzzleDescriptionString, PuzzleName } from "./PGPuzzles";
import {
  closure,
  cube,
  dodecahedron,
  getface,
  icosahedron,
  octahedron,
  tetrahedron,
  uniqueplanes,
} from "./PlatonicGenerator";
import { centermassface, expandfaces, Quat } from "./Quat";

const DEFAULT_COLOR_FRACTION = 0.77;

export interface StickerDatSticker {
  coords: number[][];
  color: string;
  orbit: string;
  ord: number;
  ori: number;
}

export interface StickerDatFace {
  coords: number[][];
  name: string;
}

export type StickerDatAxis = [number[], string, number];

export interface StickerDat {
  stickers: StickerDatSticker[];
  foundations: StickerDatSticker[];
  faces: StickerDatFace[];
  axis: StickerDatAxis[];
  unswizzle(mv: PGVendoredTurn): string;
  notationMapper: NotationMapper;
}

// TODO: Return this once we no longer have prefix restrictions.
let NEW_FACE_NAMES = true;
export function useNewFaceNames(use: boolean): void {
  NEW_FACE_NAMES = use;
}

//  Now we have a geometry class that does the 3D goemetry to calculate
//  individual sticker information from a Platonic solid and a set of
//  cuts.  The cuts must have the same symmetry as the Platonic solid;
//  we even restrict them further to be either vertex-normal,
//  edge-normal, or face-parallel cuts.  Right now our constructor takes
//  a character solid indicator (one of c(ube), o(ctahedron), i(cosahedron),
//  t(etradron), or d(odecahedron), followed by an array of cuts.
//  Each cut is a character normal indicator that is either f(ace),
//  e(dge), or v(ertex), followed by a floating point value that gives
//  the depth of the cut where 0 is the center and 1 is the outside
//  border of the shape in that direction.

//  This is a heavyweight class with lots of members and construction
//  is slow.  Be gentle.

//  Everything except a very few methods should be considered private.

const eps: number = 1e-9;
const copyright = "PuzzleGeometry 0.1 Copyright 2018 Tomas Rokicki.";
const permissivieTurnParsing = false;

// This is a description of the nets and the external names we give each
// face.  The names should be a set of prefix-free upper-case alphabetics
// so
// we can easily also name and distinguish vertices and edges, but we
// may change this in the future.  The nets consist of a list of lists.
// Each list gives the name of a face, and then the names of the
// faces connected to that face (in the net) in clockwise order.
// The length of each list should be one more than the number of
// edges in the regular polygon for that face.  All polygons must
// have the same number of edges.
// The first two faces in the first list must describe a horizontal edge
// that is at the bottom of a regular polygon.  The first two faces in
// every subsequent list for a given polytope must describe a edge that
// is directly connected in the net and has already been described (this
// sets the location and orientation of the polygon for that face.
// Any edge that is not directly connected in the net should be given
// the empty string as the other face.  All faces do not need to have
// a list starting with that face; just enough to describe the full
// connectivity of the net.
//
// TODO: change this back to a const JSON definition.
function defaultnets(): any {
  return {
    // four faces: tetrahedron
    4: [["F", "D", "L", "R"]],
    // six faces: cube
    6: [
      ["F", "D", "L", "U", "R"],
      ["R", "F", "", "B", ""],
    ],
    // eight faces: octahedron
    8: [
      ["F", "D", "L", "R"],
      ["D", "F", "BR", ""],
      ["BR", "D", "", "BB"],
      ["BB", "BR", "U", "BL"],
    ],
    // twelve faces:  dodecahedron; U/F/R/F/BL/BR from megaminx
    12: [
      ["U", "F", "", "", "", ""],
      ["F", "U", "R", "C", "A", "L"],
      ["R", "F", "", "", "E", ""],
      ["E", "R", "", "BF", "", ""],
      ["BF", "E", "BR", "BL", "I", "D"],
    ],
    // twenty faces: icosahedron
    20: [
      ["R", "C", "F", "E"],
      ["F", "R", "L", "U"],
      ["L", "F", "A", ""],
      ["E", "R", "G", "I"],
      ["I", "E", "S", "H"],
      ["S", "I", "J", "B"],
      ["B", "S", "K", "D"],
      ["K", "B", "M", "O"],
      ["O", "K", "P", "N"],
      ["P", "O", "Q", ""],
    ],
  };
}

// TODO: change this back to a const JSON definition.
function defaultcolors(): any {
  return {
    // the colors should use the same naming convention as the nets, above.
    4: { F: "#00ff00", D: "#ffff00", L: "#ff0000", R: "#0000ff" },
    6: {
      U: "#ffffff",
      F: "#00ff00",
      R: "#ff0000",
      D: "#ffff00",
      B: "#0000ff",
      L: "#ff8000",
    },
    8: {
      U: "#ffffff",
      F: "#ff0000",
      R: "#00bb00",
      D: "#ffff00",
      BB: "#1122ff",
      L: "#9524c5",
      BL: "#ff8800",
      BR: "#aaaaaa",
    },
    12: {
      U: "#ffffff",
      F: "#006633",
      R: "#ff0000",
      C: "#ffffd0",
      A: "#3399ff",
      L: "#660099",
      E: "#ff66cc",
      BF: "#99ff00",
      BR: "#0000ff",
      BL: "#ffff00",
      I: "#ff6633",
      D: "#999999",
    },
    20: {
      R: "#db69f0",
      C: "#178fde",
      F: "#23238b",
      E: "#9cc726",
      L: "#2c212d",
      U: "#177fa7",
      A: "#e0de7f",
      G: "#2b57c0",
      I: "#41126b",
      S: "#4b8c28",
      H: "#7c098d",
      J: "#7fe7b4",
      B: "#85fb74",
      K: "#3f4bc3",
      D: "#0ff555",
      M: "#f1c2c8",
      O: "#58d340",
      P: "#c514f2",
      N: "#14494e",
      Q: "#8b1be1",
    },
  };
}

// the default precedence of the faces is given here.  This permits
// the orientations to be reasonably predictable.  There are tradeoffs;
// some face precedence orders do better things to the edge orientations
// than the corner orientations and some are the opposite.
// TODO: change this back to a const JSON definition.
function defaultfaceorders(): any {
  return {
    4: ["F", "D", "L", "R"],
    6: ["U", "D", "F", "B", "L", "R"],
    8: ["F", "BB", "D", "U", "BR", "L", "R", "BL"],
    12: ["L", "E", "F", "BF", "R", "I", "U", "D", "BR", "A", "BL", "C"],
    20: [
      "L",
      "S",
      "E",
      "O",
      "F",
      "B",
      "I",
      "P",
      "R",
      "K",
      "U",
      "D",
      "J",
      "A",
      "Q",
      "H",
      "G",
      "N",
      "M",
      "C",
    ],
  };
}

/*
 *  Default orientations for the puzzles in 3D space.  Can be overridden
 *  by puzzleOrientation or puzzleOrientations options.
 *
 *  These are defined to have a strong intuitive vertical (y) direction
 *  since 3D orbital controls need this.  In comments, we list the
 *  preferred initial camera orientation for each puzzle for twizzle;
 *  this information is explicitly given in the twizzle app file.
 */
// TODO: change this back to a const JSON definition.
function defaultOrientations(): any {
  return {
    4: ["FLR", [0, 1, 0], "F", [0, 0, 1]], // FLR towards viewer
    6: ["U", [0, 1, 0], "F", [0, 0, 1]], // URF towards viewer
    8: ["U", [0, 1, 0], "F", [0, 0, 1]], // FLUR towards viewer
    12: ["U", [0, 1, 0], "F", [0, 0, 1]], // F towards viewer
    20: ["GUQMJ", [0, 1, 0], "F", [0, 0, 1]], // F towards viewer
  };
}

function findelement(a: any[], p: Quat): number {
  // find something in facenames, vertexnames, edgenames
  for (let i = 0; i < a.length; i++) {
    if (a[i][0].dist(p) < eps) {
      return i;
    }
  }
  throw new Error("Element not found");
}

export function getpuzzles(): { [s: string]: PuzzleDescriptionString } {
  // get some simple definitions of basic puzzles
  return PGPuzzles;
}

export function getpuzzle(puzzleName: PuzzleName): PuzzleDescriptionString {
  // get some simple definitions of basic puzzles
  return PGPuzzles[puzzleName];
}

export function parsedesc(s: string): any {
  // parse a text description
  const a = s.split(/ /).filter(Boolean);
  if (a.length % 2 === 0) {
    return false;
  }
  if (
    a[0] !== "o" &&
    a[0] !== "c" &&
    a[0] !== "i" &&
    a[0] !== "d" &&
    a[0] !== "t"
  ) {
    return false;
  }
  const r = [];
  for (let i = 1; i < a.length; i += 2) {
    if (a[i] !== "f" && a[i] !== "v" && a[i] !== "e") {
      return false;
    }
    r.push([a[i], a[i + 1]]);
  }
  return [a[0], r];
}

export function getPuzzleGeometryByDesc(
  desc: string,
  options: string[] = [],
): PuzzleGeometry {
  const [shape, cuts] = parsedesc(desc);
  const pg = new PuzzleGeometry(
    shape,
    cuts,
    ["allmoves", "true"].concat(options),
  );
  pg.allstickers();
  pg.genperms();
  return pg;
}

export function getPuzzleGeometryByName(
  puzzleName: PuzzleName,
  options: string[] = [],
): PuzzleGeometry {
  return getPuzzleGeometryByDesc(PGPuzzles[puzzleName], options);
}

function getturnname(geo: any, bits: number, slices: number): any {
  // generate a turn name based on bits, slice, and geo
  // if the turn name is from the opposite face, say so.
  // find the face that's turned.
  let nbits = 0;
  let inverted = false;
  for (let i = 0; i <= slices; i++) {
    if ((bits >> i) & 1) {
      nbits |= 1 << (slices - i);
    }
  }
  if (nbits < bits) {
    // flip if most of the turn is on the other side
    geo = [geo[2], geo[3], geo[0], geo[1]];
    bits = nbits;
    inverted = true;
  }
  let turnnameFamily = geo[0];
  let turnnamePrefix = "";
  let hibit = 0;
  while (bits >> (1 + hibit)) {
    hibit++;
  }
  if (bits === (2 << slices) - 1) {
    turnnameFamily = turnnameFamily + "v";
  } else if (bits === 1 << hibit) {
    if (hibit > 0) {
      turnnamePrefix = String(hibit + 1);
    }
  } else if (bits === (2 << hibit) - 1) {
    turnnameFamily = turnnameFamily.toLowerCase();
    if (hibit > 1) {
      turnnamePrefix = String(hibit + 1);
    }
  } else {
    turnnamePrefix = "_" + bits + "_";
    //       throw "We only support slice and outer block turns right now. " + bits ;
  }
  return [turnnamePrefix + turnnameFamily, inverted];
}

// split a geometrical element into face names.  Do greedy match.
// Permit underscores between names.
function splitByFaceNames(s: string, facenames: any[]): string[] {
  const r: string[] = [];
  let at = 0;
  while (at < s.length) {
    if (at > 0 && at < s.length && s[at] === "_") {
      at++;
    }
    let currentMatch = "";
    for (let i = 0; i < facenames.length; i++) {
      if (
        s.substr(at).startsWith(facenames[i][1]) &&
        facenames[i][1].length > currentMatch.length
      ) {
        currentMatch = facenames[i][1];
      }
    }
    if (currentMatch !== "") {
      r.push(currentMatch);
      at += currentMatch.length;
    } else {
      throw new Error("Could not split " + s + " into face names.");
    }
  }
  return r;
}

function toCoords(q: Quat, maxdist: number): number[] {
  return [q.b / maxdist, -q.c / maxdist, q.d / maxdist];
}

function toFaceCoords(q: Quat[], maxdist: number): number[][] {
  const r = [];
  const n = q.length;
  for (let i = 0; i < n; i++) {
    r[n - i - 1] = toCoords(q[i], maxdist);
  }
  return r;
}

function trimEdges(face: Quat[], tr: number): Quat[] {
  const r: Quat[] = [];
  for (let iter = 1; iter < 10; iter++) {
    for (let i = 0; i < face.length; i++) {
      const pi = (i + face.length - 1) % face.length;
      const ni = (i + 1) % face.length;
      const A = face[pi].sub(face[i]).normalize();
      const B = face[ni].sub(face[i]).normalize();
      const d = A.dot(B);
      const m = tr / Math.sqrt(1 - d * d);
      r[i] = face[i].sum(A.sum(B).smul(m));
    }
    let good = true;
    for (let i = 0; good && i < r.length; i++) {
      const pi = (i + face.length - 1) % face.length;
      const ni = (i + 1) % face.length;
      if (r[pi].sub(r[i]).cross(r[ni].sub(r[i])).dot(r[i]) >= 0) {
        good = false;
      }
    }
    if (good) {
      return r;
    }
    tr /= 2;
  }
  return face;
}

export class PuzzleGeometry {
  public args: string = "";
  public rotations: Quat[]; // all members of the rotation group
  public baseplanerot: Quat[]; // unique rotations of the baseplane
  public baseplanes: Quat[]; // planes, corresponding to faces
  public facenames: any[]; // face names
  public faceplanes: any; // face planes
  public edgenames: any[]; // edge names
  public vertexnames: any[]; // vertexnames
  public geonormals: any[]; // all geometric directions, with names and types
  public turnplanes: Quat[]; // the planes that split turns
  public turnplanes2: Quat[]; // the planes that split turns, filtered
  public turnplanesets: any[]; // the turn planes, in parallel sets
  public turnplanenormals: Quat[]; // one turn plane
  public turnsetorders: any[]; // the order of rotations for each turn set
  public turnsetgeos: any[]; // geometric feature information for turn sets
  public basefaces: Quat[][]; // polytope faces before cuts
  public faces: Quat[][]; // all the stickers
  public basefacecount: number; // number of base faces
  public stickersperface: number; // number of stickers per face
  public cornerfaces: number; // number of faces that meet at a corner
  public cubies: any[]; // the cubies
  public shortedge: number; // shortest edge
  public vertexdistance: number; // vertex distance
  public edgedistance: number; // edge distance
  public orbits: number; // count of cubie orbits
  public facetocubies: any[]; // map a face to a cubie index and offset
  public turnrotations: Quat[][]; // turn rotations
  public cubiekey: any; // cubie locator
  public cubiekeys: string[]; // cubie keys
  public facelisthash: any; // face list by key
  public cubiesetnames: any[]; // cubie set names
  public cubieords: number[]; // the size of each orbit
  public cubiesetnums: number[];
  public cubieordnums: number[];
  public orbitoris: number[]; // the orientation size of each orbit
  public cubievaluemap: number[]; // the map for identical cubies
  public cubiesetcubies: number[][]; // cubies in each cubie set
  public cturnsbyslice: number[][][] = []; // cturns as perms by slice
  // options
  public verbose: number = 0; // verbosity (console.log)
  public allmoves: boolean = false; // generate all slice turns in ksolve
  public outerblockturns: boolean; // generate outer block turns
  public vertexturns: boolean; // generate vertex turns
  public addrotations: boolean; // add symmetry information to ksolve output
  public turnlist: any; // turn list to generate
  public parsedturnlist: any; // parsed turn list
  public puzzleOrientation: any; // single puzzle orientation from options
  public puzzleOrientations: any; // puzzle orientation override list from options
  public cornersets: boolean = true; // include corner sets
  public centersets: boolean = true; // include center sets
  public edgesets: boolean = true; // include edge sets
  public graycorners: boolean = false; // make corner sets gray
  public graycenters: boolean = false; // make center sets gray
  public grayedges: boolean = false; // make edge sets gray
  public killorientation: boolean = false; // eliminate any orientations
  public optimize: boolean = false; // optimize PermOri
  public scramble: number = 0; // scramble?
  public ksolveturnnames: string[]; // turn names from ksolve
  public fixPiece: string = ""; // fix a piece?
  public orientCenters: boolean = false; // orient centers?
  public duplicatedFaces: number[] = []; // which faces are duplicated
  public duplicatedCubies: number[] = []; // which cubies are duplicated
  public fixedCubie: number = -1; // fixed cubie, if any
  public svggrips: any[]; // grips from svg generation by svg coordinate
  public net: any = [];
  public colors: any = [];
  public faceorder: any = [];
  public faceprecedence: number[] = [];
  public swizzler: FaceNameSwizzler;
  public notationMapper: NotationMapper = new NullMapper();
  public addNotationMapper: string = "";
  constructor(shape: string, cuts: string[][], optionlist: any[] | undefined) {
    function asstructured(v: any): any {
      if (typeof v === "string") {
        return JSON.parse(v);
      }
      return v;
    }
    function asboolean(v: any): boolean {
      if (typeof v === "string") {
        if (v === "false") {
          return false;
        }
        return true;
      } else {
        return v ? true : false;
      }
    }
    if (optionlist !== undefined) {
      if (optionlist.length % 2 !== 0) {
        throw new Error("Odd length in option list?");
      }
      for (let i = 0; i < optionlist.length; i += 2) {
        if (optionlist[i] === "verbose") {
          this.verbose++;
        } else if (optionlist[i] === "quiet") {
          this.verbose = 0;
        } else if (optionlist[i] === "allmoves") {
          this.allmoves = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "outerblockturns") {
          this.outerblockturns = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "vertexturns") {
          this.vertexturns = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "rotations") {
          this.addrotations = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "cornersets") {
          this.cornersets = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "centersets") {
          this.centersets = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "edgesets") {
          this.edgesets = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "graycorners") {
          this.graycorners = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "graycenters") {
          this.graycenters = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "grayedges") {
          this.grayedges = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "turnlist") {
          this.turnlist = asstructured(optionlist[i + 1]);
        } else if (optionlist[i] === "killorientation") {
          this.killorientation = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "optimize") {
          this.optimize = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "scramble") {
          this.scramble = optionlist[i + 1];
        } else if (optionlist[i] === "fix") {
          this.fixPiece = optionlist[i + 1];
        } else if (optionlist[i] === "orientcenters") {
          this.orientCenters = asboolean(optionlist[i + 1]);
        } else if (optionlist[i] === "puzzleorientation") {
          this.puzzleOrientation = asstructured(optionlist[i + 1]);
        } else if (optionlist[i] === "puzzleorientations") {
          this.puzzleOrientations = asstructured(optionlist[i + 1]);
        } else {
          throw new Error(
            "Bad option while processing option list " + optionlist[i],
          );
        }
      }
    }
    this.args = shape + " " + cuts.map((_) => _.join(" ")).join(" ");
    if (optionlist) {
      this.args += " " + optionlist.join(" ");
    }
    if (this.verbose > 0) {
      console.log(this.header("# "));
    }
    this.create(shape, cuts);
  }

  public create(shape: string, cuts: any[]): void {
    // create the shape, doing all the essential geometry
    // create only goes far enough to figure out how many stickers per
    // face, and what the short edge is.  If the short edge is too short,
    // we probably don't want to display or manipulate this one.  How
    // short is too short is hard to say.
    // var that = this ; // TODO
    this.turnplanes = [];
    this.turnplanes2 = [];
    this.faces = [];
    this.cubies = [];
    let g = null;
    switch (shape) {
      case "c":
        g = cube();
        break;
      case "o":
        g = octahedron();
        break;
      case "i":
        g = icosahedron();
        break;
      case "t":
        g = tetrahedron();
        break;
      case "d":
        g = dodecahedron();
        break;
      default:
        throw new Error("Bad shape argument: " + shape);
    }
    this.rotations = closure(g);
    if (this.verbose) {
      console.log("# Rotations: " + this.rotations.length);
    }
    const baseplane = g[0];
    this.baseplanerot = uniqueplanes(baseplane, this.rotations);
    const baseplanes = this.baseplanerot.map((_) => baseplane.rotateplane(_));
    this.baseplanes = baseplanes;
    this.basefacecount = baseplanes.length;
    const net = defaultnets()[baseplanes.length];
    this.net = net;
    this.colors = defaultcolors()[baseplanes.length];
    this.faceorder = defaultfaceorders()[baseplanes.length];
    if (this.verbose) {
      console.log("# Base planes: " + baseplanes.length);
    }
    const baseface = getface(baseplanes);
    const zero = new Quat(0, 0, 0, 0);
    if (this.verbose) {
      console.log("# Face vertices: " + baseface.length);
    }
    const facenormal = baseplanes[0].makenormal();
    const edgenormal = baseface[0].sum(baseface[1]).makenormal();
    const vertexnormal = baseface[0].makenormal();
    const boundary = new Quat(1, facenormal.b, facenormal.c, facenormal.d);
    if (this.verbose) {
      console.log("# Boundary is " + boundary);
    }
    const planerot = uniqueplanes(boundary, this.rotations);
    const planes = planerot.map((_) => boundary.rotateplane(_));
    let faces = [getface(planes)];
    this.edgedistance = faces[0][0].sum(faces[0][1]).smul(0.5).dist(zero);
    this.vertexdistance = faces[0][0].dist(zero);
    const cutplanes = [];
    const intersects = [];
    let sawface = false; // what cuts did we see?
    let sawedge = false;
    let sawvertex = false;
    for (let i = 0; i < cuts.length; i++) {
      let normal = null;
      let distance = 0;
      switch (cuts[i][0]) {
        case "f":
          normal = facenormal;
          distance = 1;
          sawface = true;
          break;
        case "v":
          normal = vertexnormal;
          distance = this.vertexdistance;
          sawvertex = true;
          break;
        case "e":
          normal = edgenormal;
          distance = this.edgedistance;
          sawedge = true;
          break;
        default:
          throw new Error("Bad cut argument: " + cuts[i][0]);
      }
      cutplanes.push(normal.makecut(Number(cuts[i][1])));
      intersects.push(cuts[i][1] < distance);
    }
    if (this.addrotations) {
      if (!sawface) {
        cutplanes.push(facenormal.makecut(10));
      }
      if (!sawvertex) {
        cutplanes.push(vertexnormal.makecut(10));
      }
      if (!sawedge) {
        cutplanes.push(edgenormal.makecut(10));
      }
    }
    this.basefaces = [];
    for (let i = 0; i < this.baseplanerot.length; i++) {
      const face = this.baseplanerot[i].rotateface(faces[0]);
      this.basefaces.push(face);
    }
    //
    //   Determine names for edges, vertices, and planes.  Planes are defined
    //   by the plane normal/distance; edges are defined by the midpoint;
    //   vertices are defined by actual point.  In each case we define a name.
    //   Note that edges have two potential names, and corners have n where
    //   n planes meet at a vertex.  We arbitrarily choose the one that is
    //   alphabetically first (and we will probably want to change this).
    //
    const facenames: any[] = [];
    const faceplanes = [];
    const vertexnames: any[] = [];
    const edgenames: any[] = [];
    const edgesperface = faces[0].length;
    function searchaddelement(a: any[], p: Quat, name: any): void {
      for (let i = 0; i < a.length; i++) {
        if (a[i][0].dist(p) < eps) {
          a[i].push(name);
          return;
        }
      }
      a.push([p, name]);
    }
    for (let i = 0; i < this.baseplanerot.length; i++) {
      const face = this.baseplanerot[i].rotateface(faces[0]);
      for (let j = 0; j < face.length; j++) {
        const jj = (j + 1) % face.length;
        const midpoint = face[j].sum(face[jj]).smul(0.5);
        searchaddelement(edgenames, midpoint, i);
      }
    }
    const otherfaces = [];
    for (let i = 0; i < this.baseplanerot.length; i++) {
      const face = this.baseplanerot[i].rotateface(faces[0]);
      const facelist = [];
      for (let j = 0; j < face.length; j++) {
        const jj = (j + 1) % face.length;
        const midpoint = face[j].sum(face[jj]).smul(0.5);
        const el = edgenames[findelement(edgenames, midpoint)];
        if (i === el[1]) {
          facelist.push(el[2]);
        } else if (i === el[2]) {
          facelist.push(el[1]);
        } else {
          throw new Error("Could not find edge");
        }
      }
      otherfaces.push(facelist);
    }
    const facenametoindex: any = {};
    const faceindextoname: any = [];
    faceindextoname.push(net[0][0]);
    facenametoindex[net[0][0]] = 0;
    faceindextoname[otherfaces[0][0]] = net[0][1];
    facenametoindex[net[0][1]] = otherfaces[0][0];
    for (let i = 0; i < net.length; i++) {
      const f0 = net[i][0];
      const fi = facenametoindex[f0];
      if (fi === undefined) {
        throw new Error("Bad edge description; first edge not connected");
      }
      let ii = -1;
      for (let j = 0; j < otherfaces[fi].length; j++) {
        const fn2 = faceindextoname[otherfaces[fi][j]];
        if (fn2 !== undefined && fn2 === net[i][1]) {
          ii = j;
          break;
        }
      }
      if (ii < 0) {
        throw new Error("First element of a net not known");
      }
      for (let j = 2; j < net[i].length; j++) {
        if (net[i][j] === "") {
          continue;
        }
        const of = otherfaces[fi][(j + ii - 1) % edgesperface];
        const fn2 = faceindextoname[of];
        if (fn2 !== undefined && fn2 !== net[i][j]) {
          throw new Error("Face mismatch in net");
        }
        faceindextoname[of] = net[i][j];
        facenametoindex[net[i][j]] = of;
      }
    }
    for (let i = 0; i < faceindextoname.length; i++) {
      let found = false;
      for (let j = 0; j < this.faceorder.length; j++) {
        if (faceindextoname[i] === this.faceorder[j]) {
          this.faceprecedence[i] = j;
          found = true;
          break;
        }
      }
      if (!found) {
        throw new Error(
          "Could not find face " +
            faceindextoname[i] +
            " in face order list " +
            this.faceorder,
        );
      }
    }
    for (let i = 0; i < this.baseplanerot.length; i++) {
      const face = this.baseplanerot[i].rotateface(faces[0]);
      const faceplane = boundary.rotateplane(this.baseplanerot[i]);
      const facename = faceindextoname[i];
      facenames.push([face, facename]);
      faceplanes.push([faceplane, facename]);
    }
    for (let i = 0; i < this.baseplanerot.length; i++) {
      const face = this.baseplanerot[i].rotateface(faces[0]);
      const facename = faceindextoname[i];
      for (let j = 0; j < face.length; j++) {
        const jj = (j + 1) % face.length;
        const midpoint = face[j].sum(face[jj]).smul(0.5);
        const jjj = (j + 2) % face.length;
        const midpoint2 = face[jj].sum(face[jjj]).smul(0.5);
        const e1 = findelement(edgenames, midpoint);
        const e2 = findelement(edgenames, midpoint2);
        searchaddelement(vertexnames, face[jj], [facename, e2, e1]);
      }
    }
    this.swizzler = new FaceNameSwizzler(facenames.map((_: any) => _[1]));
    const sep = this.swizzler.prefixFree ? "" : "_";
    // fix the edge names; use face precedence order
    for (let i = 0; i < edgenames.length; i++) {
      if (edgenames[i].length !== 3) {
        throw new Error("Bad length in edge names " + edgenames[i]);
      }
      let c1 = faceindextoname[edgenames[i][1]];
      const c2 = faceindextoname[edgenames[i][2]];
      if (
        this.faceprecedence[edgenames[i][1]] <
        this.faceprecedence[edgenames[i][2]]
      ) {
        c1 = c1 + sep + c2;
      } else {
        c1 = c2 + sep + c1;
      }
      edgenames[i] = [edgenames[i][0], c1];
    }
    // fix the vertex names; clockwise rotations; low face first.
    this.cornerfaces = vertexnames[0].length - 1;
    for (let i = 0; i < vertexnames.length; i++) {
      if (vertexnames[i].length < 4) {
        throw new Error("Bad length in vertex names");
      }
      let st = 1;
      for (let j = 2; j < vertexnames[i].length; j++) {
        if (
          this.faceprecedence[facenametoindex[vertexnames[i][j][0]]] <
          this.faceprecedence[facenametoindex[vertexnames[i][st][0]]]
        ) {
          st = j;
        }
      }
      let r = "";
      for (let j = 1; j < vertexnames[i].length; j++) {
        if (j === 1) {
          r = vertexnames[i][st][0];
        } else {
          r = r + sep + vertexnames[i][st][0];
        }
        for (let k = 1; k < vertexnames[i].length; k++) {
          if (vertexnames[i][st][2] === vertexnames[i][k][1]) {
            st = k;
            break;
          }
        }
      }
      vertexnames[i] = [vertexnames[i][0], r];
    }
    if (this.verbose > 1) {
      console.log("Face precedence list: " + this.faceorder.join(" "));
      console.log("Face names: " + facenames.map((_: any) => _[1]).join(" "));
      console.log("Edge names: " + edgenames.map((_: any) => _[1]).join(" "));
      console.log(
        "Vertex names: " + vertexnames.map((_: any) => _[1]).join(" "),
      );
    }
    const geonormals = [];
    for (let i = 0; i < faceplanes.length; i++) {
      geonormals.push([faceplanes[i][0].makenormal(), faceplanes[i][1], "f"]);
    }
    for (let i = 0; i < edgenames.length; i++) {
      geonormals.push([edgenames[i][0].makenormal(), edgenames[i][1], "e"]);
    }
    for (let i = 0; i < vertexnames.length; i++) {
      geonormals.push([vertexnames[i][0].makenormal(), vertexnames[i][1], "v"]);
    }
    this.facenames = facenames;
    this.faceplanes = faceplanes;
    this.edgenames = edgenames;
    this.vertexnames = vertexnames;
    this.geonormals = geonormals;
    const geonormalnames = geonormals.map((_: any) => _[1]);
    this.swizzler.setGripNames(geonormalnames);
    if (this.verbose) {
      console.log(
        "# Distances: face " +
          1 +
          " edge " +
          this.edgedistance +
          " vertex " +
          this.vertexdistance,
      );
    }
    // expand cutplanes by rotations.  We only work with one face here.
    for (let c = 0; c < cutplanes.length; c++) {
      for (let i = 0; i < this.rotations.length; i++) {
        const q = cutplanes[c].rotateplane(this.rotations[i]);
        let wasseen = false;
        for (let j = 0; j < this.turnplanes.length; j++) {
          if (q.sameplane(this.turnplanes[j])) {
            wasseen = true;
            break;
          }
        }
        if (!wasseen) {
          this.turnplanes.push(q);
          faces = q.cutfaces(faces);
          if (intersects[c]) {
            this.turnplanes2.push(q);
          }
        }
      }
    }
    this.faces = faces;
    if (this.verbose) {
      console.log("# Faces is now " + faces.length);
    }
    this.stickersperface = faces.length;
    //  Find and report the shortest edge in any of the faces.  If this
    //  is small the puzzle is probably not practical or displayable.
    let shortedge = 1e99;
    for (let i = 0; i < faces.length; i++) {
      for (let j = 0; j < faces[i].length; j++) {
        const k = (j + 1) % faces[i].length;
        const t = faces[i][j].dist(faces[i][k]);
        if (t < shortedge) {
          shortedge = t;
        }
      }
    }
    this.shortedge = shortedge;
    if (this.verbose) {
      console.log("# Short edge is " + shortedge);
    }
    // add nxnxn cube notation if it has cube face turns
    if (shape === "c" && sawface && !sawedge && !sawvertex) {
      // In this case the mapper adding is deferred until we
      // know the number of slices.
      this.addNotationMapper = "NxNxNCubeMapper";
    }
    if (shape === "c" && sawvertex && !sawface && !sawedge) {
      this.addNotationMapper = "SkewbMapper";
    }
    if (shape === "t" && (sawvertex || sawface) && !sawedge) {
      this.addNotationMapper = "PyraminxMapper";
    }
    if (shape === "o" && sawface && NEW_FACE_NAMES) {
      this.notationMapper = new FaceRenamingMapper(
        this.swizzler,
        new FaceNameSwizzler(["F", "D", "L", "BL", "R", "U", "BR", "B"]),
      );
    }
    if (shape === "d" && sawface && NEW_FACE_NAMES) {
      this.addNotationMapper = "Megaminx";
      this.notationMapper = new FaceRenamingMapper(
        this.swizzler,
        new FaceNameSwizzler([
          "U",
          "F",
          "L",
          "BL",
          "BR",
          "R",
          "FR",
          "FL",
          "DL",
          "B",
          "DR",
          "D",
        ]),
      );
    }
  }

  public keyface(face: Quat[]): string {
    return this.keyface2(centermassface(face));
  }

  public keyface2(cm: Quat): string {
    // take a face and figure out the sides of each turn plane
    let s = "";
    for (let i = 0; i < this.turnplanesets.length; i++) {
      if (this.turnplanesets[i].length > 0) {
        const dv = cm.dot(this.turnplanesets[i][0]);
        let t = 0;
        let b = 1;
        while (b * 2 <= this.turnplanesets[i].length) {
          b *= 2;
        }
        for (; b > 0; b >>= 1) {
          if (
            t + b <= this.turnplanesets[i].length &&
            dv > this.turnplanesets[i][t + b - 1].a
          ) {
            t += b;
          }
        }
        s = s + " " + t;
      }
    }
    return s;
  }

  public findcubie(face: Quat[]): number {
    return this.facetocubies[this.findface(face)][0];
  }

  public findface(face: Quat[]): number {
    const cm = centermassface(face);
    const key = this.keyface2(cm);
    const arr = this.facelisthash[key];
    if (arr.length === 1) {
      return arr[0];
    }
    for (let i = 0; i + 1 < arr.length; i++) {
      const face2 = this.facelisthash[key][i];
      if (Math.abs(cm.dist(centermassface(this.faces[face2]))) < eps) {
        return face2;
      }
    }
    return arr[arr.length - 1];
  }

  public project2d(facen: number, edgen: number, targvec: Quat[]): any {
    // calculate geometry to map a particular edge of a particular
    //  face to a given 2D vector.  The face is given as an index into the
    //  facenames/baseplane arrays, and the edge is given as an offset into
    //  the vertices.
    const face = this.facenames[facen][0];
    const edgen2 = (edgen + 1) % face.length;
    const plane = this.baseplanes[facen];
    let x0 = face[edgen2].sub(face[edgen]);
    const olen = x0.len();
    x0 = x0.normalize();
    const y0 = x0.cross(plane).normalize();
    let delta = targvec[1].sub(targvec[0]);
    const len = delta.len() / olen;
    delta = delta.normalize();
    const cosr = delta.b;
    const sinr = delta.c;
    const x1 = x0.smul(cosr).sub(y0.smul(sinr)).smul(len);
    const y1 = y0.smul(cosr).sum(x0.smul(sinr)).smul(len);
    const off = new Quat(
      0,
      targvec[0].b - x1.dot(face[edgen]),
      targvec[0].c - y1.dot(face[edgen]),
      0,
    );
    return [x1, y1, off];
  }

  public allstickers(): void {
    // next step is to calculate all the stickers and orbits
    // We do enough work here to display the cube on the screen.
    // take our newly split base face and expand it by the rotation matrix.
    // this generates our full set of "stickers".
    this.faces = expandfaces(this.baseplanerot, this.faces);
    if (this.verbose) {
      console.log("# Total stickers is now " + this.faces.length);
    }
    // Split turnplanes into a list of parallel planes.
    const turnplanesets: Quat[][] = [];
    const turnplanenormals: Quat[] = [];
    // get the normals, first, from unfiltered turnplanes.
    for (let i = 0; i < this.turnplanes.length; i++) {
      const q = this.turnplanes[i];
      const qnormal = q.makenormal();
      let wasseen = false;
      for (let j = 0; j < turnplanenormals.length; j++) {
        if (qnormal.sameplane(turnplanenormals[j].makenormal())) {
          wasseen = true;
        }
      }
      if (!wasseen) {
        turnplanenormals.push(qnormal);
        turnplanesets.push([]);
      }
    }
    for (let i = 0; i < this.turnplanes2.length; i++) {
      const q = this.turnplanes2[i];
      const qnormal = q.makenormal();
      for (let j = 0; j < turnplanenormals.length; j++) {
        if (qnormal.sameplane(turnplanenormals[j])) {
          turnplanesets[j].push(q);
          break;
        }
      }
    }
    // make the normals all face the same way in each set.
    for (let i = 0; i < turnplanesets.length; i++) {
      const q: Quat[] = turnplanesets[i].map((_) => _.normalizeplane());
      const goodnormal = turnplanenormals[i];
      for (let j = 0; j < q.length; j++) {
        if (q[j].makenormal().dist(goodnormal) > eps) {
          q[j] = q[j].smul(-1);
        }
      }
      q.sort((a, b) => a.a - b.a);
      turnplanesets[i] = q;
    }
    this.turnplanesets = turnplanesets;
    this.turnplanenormals = turnplanenormals;
    const sizes = turnplanesets.map((_) => _.length);
    if (this.verbose) {
      console.log("# Turn plane sets: " + sizes);
    }
    // for each of the turn planes, find the rotations that are relevant
    const turnrotations: Quat[][] = [];
    for (let i = 0; i < turnplanesets.length; i++) {
      turnrotations.push([]);
    }
    for (let i = 0; i < this.rotations.length; i++) {
      const q: Quat = this.rotations[i];
      if (Math.abs(Math.abs(q.a) - 1) < eps) {
        continue;
      }
      const qnormal = q.makenormal();
      for (let j = 0; j < turnplanesets.length; j++) {
        if (qnormal.sameplane(turnplanenormals[j])) {
          turnrotations[j].push(q);
          break;
        }
      }
    }
    this.turnrotations = turnrotations;
    //  Sort the rotations by the angle of rotation.  A bit tricky because
    //  while the norms should be the same, they need not be.  So we start
    //  by making the norms the same, and then sorting.
    for (let i = 0; i < turnrotations.length; i++) {
      const r = turnrotations[i];
      const goodnormal = r[0].makenormal();
      for (let j = 0; j < r.length; j++) {
        if (goodnormal.dist(r[j].makenormal()) > eps) {
          r[j] = r[j].smul(-1);
        }
      }
      r.sort((a, b) => a.angle() - b.angle());
      if (turnrotations[i][0].dot(turnplanenormals[i]) < 0) {
        r.reverse();
      }
    }
    const sizes2 = turnrotations.map((_) => 1 + _.length);
    this.turnsetorders = sizes2;
    const turnsetgeos = [];
    let gtype = "?";
    for (let i = 0; i < turnplanesets.length; i++) {
      const p0 = turnplanenormals[i];
      let neg = null;
      let pos = null;
      for (let j = 0; j < this.geonormals.length; j++) {
        const d = p0.dot(this.geonormals[j][0]);
        if (Math.abs(d - 1) < eps) {
          pos = [this.geonormals[j][1], this.geonormals[j][2]];
          gtype = this.geonormals[j][2];
        } else if (Math.abs(d + 1) < eps) {
          neg = [this.geonormals[j][1], this.geonormals[j][2]];
          gtype = this.geonormals[j][2];
        }
      }
      if (pos === null || neg === null) {
        throw new Error("Saw positive or negative sides as null");
      }
      turnsetgeos.push([
        pos[0],
        pos[1],
        neg[0],
        neg[1],
        1 + turnplanesets[i].length,
      ]);
      if (this.addNotationMapper === "NxNxNCubeMapper" && gtype === "f") {
        this.notationMapper = new NxNxNCubeMapper(1 + turnplanesets[i].length);
        this.addNotationMapper = "";
      }
      if (
        this.addNotationMapper === "SkewbMapper---DISABLED" &&
        turnplanesets[0].length === 1
      ) {
        this.notationMapper = new SkewbNotationMapper(this.swizzler);
        this.addNotationMapper = "";
      }
      if (
        this.addNotationMapper === "PyraminxMapper---DISABLED" &&
        turnplanesets[0].length === 2
      ) {
        this.notationMapper = new PyraminxNotationMapper(this.swizzler);
        this.addNotationMapper = "";
      }
      if (this.addNotationMapper === "Megaminx" && gtype === "f") {
        if (1 + turnplanesets[i].length === 3) {
          this.notationMapper = new MegaminxScramblingNotationMapper(
            this.notationMapper,
          );
        }
        this.addNotationMapper = "";
      }
    }
    this.turnsetgeos = turnsetgeos;
    //  Cubies are split by turn plane sets.  For each cubie we can
    //  average its points to find a point on the interior of that
    //  cubie.  We can then check that point against all the turn
    //  planes and from that derive a coordinate for the cubie.
    //  This also works for faces; no face should ever lie on a turn
    //  plane.  This allows us to take a set of stickers and break
    //  them up into cubie sets.
    const cubiehash: any = {};
    const facelisthash: any = {};
    const cubiekey: any = {};
    const cubiekeys = [];
    const cubies: Quat[][][] = [];
    const faces = this.faces;
    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      const s = this.keyface(face);
      if (!cubiehash[s]) {
        cubiekey[s] = cubies.length;
        cubiekeys.push(s);
        cubiehash[s] = [];
        facelisthash[s] = [];
        cubies.push(cubiehash[s]);
      }
      facelisthash[s].push(i);
      cubiehash[s].push(face);
      //  If we find a core cubie, split it up into multiple cubies,
      //  because ksolve doesn't handle orientations that are not
      //  cyclic, and the rotation group of the core is not cyclic.
      if (facelisthash[s].length === this.basefacecount) {
        if (this.verbose) {
          console.log("# Splitting core.");
        }
        for (let suff = 0; suff < this.basefacecount; suff++) {
          const s2 = s + " " + suff;
          facelisthash[s2] = [facelisthash[s][suff]];
          cubiehash[s2] = [cubiehash[s][suff]];
          cubiekeys.push(s2);
          cubiekey[s2] = cubies.length;
          cubies.push(cubiehash[s2]);
        }
        cubiehash[s] = [];
        cubies[cubiekey[s]] = [];
      }
    }
    this.cubiekey = cubiekey;
    this.facelisthash = facelisthash;
    this.cubiekeys = cubiekeys;
    if (this.verbose) {
      console.log("# Cubies: " + Object.keys(cubiehash).length);
    }
    //  Sort the faces around each corner so they are clockwise.  Only
    //  relevant for cubies that actually are corners (three or more
    //  faces).  In general cubies might have many faces; for icosohedrons
    //  there are five faces on the corner cubies.
    this.cubies = cubies;
    for (let k = 0; k < cubies.length; k++) {
      const cubie = cubies[k];
      if (cubie.length < 2) {
        continue;
      }
      if (cubie.length === this.basefacecount) {
        // looks like core?  don't sort
        continue;
      }
      if (cubie.length > 5) {
        throw new Error(
          "Bad math; too many faces on this cubie " + cubie.length,
        );
      }
      const cm = cubie.map((_) => centermassface(_));
      const s = this.keyface2(cm[0]);
      const facelist = facelisthash[s];
      const cmall = centermassface(cm);
      for (let looplimit = 0; cubie.length > 2; looplimit++) {
        let changed = false;
        for (let i = 0; i < cubie.length; i++) {
          const j = (i + 1) % cubie.length;
          // var ttt = cmall.dot(cm[i].cross(cm[j])) ; // TODO
          if (cmall.dot(cm[i].cross(cm[j])) < 0) {
            const t = cubie[i];
            cubie[i] = cubie[j];
            cubie[j] = t;
            const u = cm[i];
            cm[i] = cm[j];
            cm[j] = u;
            const v = facelist[i];
            facelist[i] = facelist[j];
            facelist[j] = v;
            changed = true;
          }
        }
        if (!changed) {
          break;
        }
        if (looplimit > 1000) {
          throw new Error("Bad epsilon math; too close to border");
        }
      }
      let mini = 0;
      let minf = this.findface(cubie[mini]);
      for (let i = 1; i < cubie.length; i++) {
        const temp = this.findface(cubie[i]);
        if (
          this.faceprecedence[this.getfaceindex(temp)] <
          this.faceprecedence[this.getfaceindex(minf)]
        ) {
          mini = i;
          minf = temp;
        }
      }
      if (mini !== 0) {
        const ocubie = cubie.slice();
        const ofacelist = facelist.slice();
        for (let i = 0; i < cubie.length; i++) {
          cubie[i] = ocubie[(mini + i) % cubie.length];
          facelist[i] = ofacelist[(mini + i) % cubie.length];
        }
      }
    }
    //  Build an array that takes each face to a cubie ordinal and a
    //  face number.
    const facetocubies = [];
    for (let i = 0; i < cubies.length; i++) {
      const facelist = facelisthash[cubiekeys[i]];
      for (let j = 0; j < facelist.length; j++) {
        facetocubies[facelist[j]] = [i, j];
      }
    }
    this.facetocubies = facetocubies;
    //  Calculate the orbits of each cubie.  Assumes we do all turns.
    //  Also calculates which cubies are identical.
    const typenames = ["?", "CENTERS", "EDGES", "CORNERS", "C4RNER", "C5RNER"];
    const cubiesetnames = [];
    const cubietypecounts = [0, 0, 0, 0, 0, 0];
    const orbitoris = [];
    const seen = [];
    let cubiesetnum = 0;
    const cubiesetnums = [];
    const cubieordnums = [];
    const cubieords = [];
    // var cubiesetnumhash = {} ; // TODO
    const cubievaluemap = [];
    // Later we will make this smarter to use a get color for face function
    // so we support puzzles with multiple faces the same color
    const getcolorkey = (cubienum: number): string => {
      return cubies[cubienum]
        .map((_) => this.getfaceindex(this.findface(_)))
        .join(" ");
    };
    const cubiesetcubies: any = [];
    for (let i = 0; i < cubies.length; i++) {
      if (seen[i]) {
        continue;
      }
      const cubie = cubies[i];
      if (cubie.length === 0) {
        continue;
      }
      const cubiekeymap: any = {};
      let cubievalueid = 0;
      cubieords.push(0);
      cubiesetcubies.push([]);
      const facecnt = cubie.length;
      const typectr = cubietypecounts[facecnt]++;
      let typename = typenames[facecnt];
      if (typename === undefined || facecnt === this.basefacecount) {
        typename = "CORE";
      }
      typename = typename + (typectr === 0 ? "" : typectr + 1);
      cubiesetnames[cubiesetnum] = typename;
      orbitoris[cubiesetnum] = facecnt;
      const queue = [i];
      let qg = 0;
      seen[i] = true;
      while (qg < queue.length) {
        const cind = queue[qg++];
        const cubiecolorkey = getcolorkey(cind);
        if (cubie.length > 1 || cubiekeymap[cubiecolorkey] === undefined) {
          cubiekeymap[cubiecolorkey] = cubievalueid++;
        }
        cubievaluemap[cind] = cubiekeymap[cubiecolorkey];
        cubiesetnums[cind] = cubiesetnum;
        cubiesetcubies[cubiesetnum].push(cind);
        cubieordnums[cind] = cubieords[cubiesetnum]++;
        for (let j = 0; j < turnrotations.length; j++) {
          const tq = this.findcubie(
            turnrotations[j][0].rotateface(cubies[cind][0]),
          );
          if (!seen[tq]) {
            queue.push(tq);
            seen[tq] = true;
          }
        }
      }
      cubiesetnum++;
    }
    this.orbits = cubieords.length;
    this.cubiesetnums = cubiesetnums;
    this.cubieordnums = cubieordnums;
    this.cubiesetnames = cubiesetnames;
    this.cubieords = cubieords;
    this.orbitoris = orbitoris;
    this.cubievaluemap = cubievaluemap;
    this.cubiesetcubies = cubiesetcubies;
    // if we fix a cubie, find a cubie to fix
    if (this.fixPiece !== "") {
      for (let i = 0; i < cubies.length; i++) {
        if (
          (this.fixPiece === "v" && cubies[i].length > 2) ||
          (this.fixPiece === "e" && cubies[i].length === 2) ||
          (this.fixPiece === "f" && cubies[i].length === 1)
        ) {
          this.fixedCubie = i;
          break;
        }
      }
      if (this.fixedCubie < 0) {
        throw new Error(
          "Could not find a cubie of type " + this.fixPiece + " to fix.",
        );
      }
    }
    // show the orbits
    if (this.verbose) {
      console.log("# Cubie orbit sizes " + cubieords);
    }
  }

  public unswizzle(mv: PGVendoredTurn): string {
    const newmv = this.notationMapper.notationToInternal(mv);
    if (newmv === null) {
      return "";
    }
    return this.swizzler.unswizzle(newmv.family);
  }

  // We use an extremely permissive parse here; any character but
  // digits are allowed in a family name.
  public stringToBlockTurn(mv: string): PGVendoredTurn {
    // parse a turn from the command line
    const re = RegExp("^(([0-9]+)-)?([0-9]+)?([^0-9]+)([0-9]+'?)?$");
    const p = mv.match(re);
    if (p === null) {
      throw new Error("Bad turn passed " + mv);
    }
    const grip = p[4];
    let loslice = undefined;
    let hislice = undefined;
    if (p[2] !== undefined) {
      if (p[3] === undefined) {
        throw new Error("Missing second number in range");
      }
      loslice = parseInt(p[2], 10);
    }
    if (p[3] !== undefined) {
      hislice = parseInt(p[3], 10);
    }
    let amountstr = "1";
    let amount = 1;
    if (p[5] !== undefined) {
      amountstr = p[5];
      if (amountstr[0] === "'") {
        amountstr = "-" + amountstr.substring(1);
      }
      amount = parseInt(amountstr, 10);
    }
    return new PGVendoredTurn(
      new PGVendoredQuantumTurn(grip, hislice, loslice),
      amount,
    );
  }

  public parseTurn(turn: PGVendoredTurn): any {
    const bm = this.notationMapper.notationToInternal(turn); // pluggable notation
    if (bm === null) {
      throw new Error("Bad turn " + turn.family);
    }
    turn = bm;
    let grip = turn.family;
    let fullrotation = false;
    if (grip.endsWith("v") && grip[0] <= "Z") {
      if (turn.innerLayer !== undefined || turn.outerLayer !== undefined) {
        throw new Error("Cannot use a prefix with full cube rotations");
      }
      grip = grip.slice(0, -1);
      fullrotation = true;
    }
    if (grip.endsWith("w") && grip[0] <= "Z") {
      grip = grip.slice(0, -1).toLowerCase();
    }
    let geo;
    let msi = -1;
    const geoname = this.swizzler.unswizzle(grip);
    let firstgrip = false;
    for (let i = 0; i < this.turnsetgeos.length; i++) {
      const g = this.turnsetgeos[i];
      if (geoname === g[0]) {
        firstgrip = true;
        geo = g;
        msi = i;
      }
      if (geoname === g[2]) {
        firstgrip = false;
        geo = g;
        msi = i;
      }
    }
    let loslice = 1;
    let hislice = 1;
    if (grip.toUpperCase() !== grip) {
      hislice = 2;
    }
    if (geo === undefined) {
      throw new Error("Bad grip in turn " + turn.family);
    }
    if (turn.outerLayer !== undefined) {
      loslice = turn.outerLayer;
    }
    if (turn.innerLayer !== undefined) {
      if (turn.outerLayer === undefined) {
        hislice = turn.innerLayer;
        if (geoname === grip) {
          loslice = hislice;
        } else {
          loslice = 1;
        }
      } else {
        hislice = turn.innerLayer;
      }
    }
    loslice--;
    hislice--;
    if (fullrotation) {
      loslice = 0;
      hislice = this.turnplanesets[msi].length;
    }
    if (
      loslice < 0 ||
      loslice > this.turnplanesets[msi].length ||
      hislice < 0 ||
      hislice > this.turnplanesets[msi].length
    ) {
      throw new Error("Bad slice spec " + loslice + " " + hislice);
    }
    if (
      !permissivieTurnParsing &&
      loslice === 0 &&
      hislice === this.turnplanesets[msi].length &&
      !fullrotation
    ) {
      throw new Error(
        "! full puzzle rotations must be specified with v suffix.",
      );
    }
    const r = [
      undefined,
      msi,
      loslice,
      hislice,
      firstgrip,
      turn.effectiveAmount,
    ];
    return r;
  }

  public parseturn(mv: string): any {
    const r = this.parseTurn(this.stringToBlockTurn(mv));
    r[0] = mv;
    return r;
  }

  public genperms(): void {
    // generate permutations for turns
    if (this.cturnsbyslice.length > 0) {
      // did this already?
      return;
    }
    const cturnsbyslice = [];
    // if orientCenters is set, we find all cubies that have only one
    // sticker and that sticker is in the center of a face, and we
    // introduce duplicate stickers so we can orient them properly.
    if (this.orientCenters) {
      for (let k = 0; k < this.cubies.length; k++) {
        if (this.cubies[k].length === 1) {
          const kk = this.findface(this.cubies[k][0]);
          const i = this.getfaceindex(kk);
          if (
            centermassface(this.basefaces[i]).dist(
              centermassface(this.faces[kk]),
            ) < eps
          ) {
            const o = this.basefaces[i].length;
            for (let m = 0; m < o; m++) {
              this.cubies[k].push(this.cubies[k][0]);
            }
            this.duplicatedFaces[kk] = o;
            this.duplicatedCubies[k] = o;
            this.orbitoris[this.cubiesetnums[k]] = o;
          }
        }
      }
    }
    for (let k = 0; k < this.turnplanesets.length; k++) {
      const turnplaneset = this.turnplanesets[k];
      const slicenum = [];
      const slicecnts = [];
      for (let i = 0; i < this.faces.length; i++) {
        const face = this.faces[i];
        let t = 0;
        for (let j = 0; j < turnplaneset.length; j++) {
          if (turnplaneset[j].faceside(face) < 0) {
            t++;
          }
        }
        slicenum.push(t);
        while (slicecnts.length <= t) {
          slicecnts.push(0);
        }
        slicecnts[t]++;
      }
      const axiscturns = [];
      for (let sc = 0; sc < slicecnts.length; sc++) {
        const slicecturns = [];
        const cubiedone = [];
        for (let i = 0; i < this.faces.length; i++) {
          if (slicenum[i] !== sc) {
            continue;
          }
          const b = this.facetocubies[i].slice();
          let face = this.faces[i];
          let fi2 = i;
          for (;;) {
            slicenum[fi2] = -1;
            const face2 = this.turnrotations[k][0].rotateface(face);
            fi2 = this.findface(face2);
            if (slicenum[fi2] < 0) {
              break;
            }
            if (slicenum[fi2] !== sc) {
              throw new Error("Bad turnment?");
            }
            const c = this.facetocubies[fi2];
            b.push(c[0], c[1]);
            face = face2;
          }
          // If an oriented center is moving, we need to figure out
          // the appropriate new orientation.  Normally we use the cubie
          // sticker identity to locate, but this doesn't work here.
          // Instead we need to redo the geometry of the sticker itself
          // rotating and figure out how that maps to the destination
          // sticker.
          //
          // We only need to do this for central center stickers: those
          // where the face vertex goes through the center.  The others
          // don't actually need orientation because they can only be
          // in one orientation by physical constraints.  (You can't spin
          // a point or cross sticker on the 5x5x5, for example.)
          //
          // This also simplifies things because it means the actual
          // remapping has the same order as the turns themselves.
          //
          // The center may or may not have been duplicated at this point.
          //
          // The turn moving the center might not be the same modulo as the
          // center itself.
          if (
            b.length > 2 &&
            this.orientCenters &&
            (this.cubies[b[0]].length === 1 ||
              this.cubies[b[0]][0] === this.cubies[b[0]][1])
          ) {
            // is this a real center cubie, around an axis?
            if (
              centermassface(this.faces[i]).dist(
                centermassface(this.basefaces[this.getfaceindex(i)]),
              ) < eps
            ) {
              // how does remapping of the face/point set map to the original?
              let face1 = this.cubies[b[0]][0];
              for (let ii = 0; ii < b.length; ii += 2) {
                const face0 = this.cubies[b[ii]][0];
                let o = -1;
                for (let jj = 0; jj < face1.length; jj++) {
                  if (face0[jj].dist(face1[0]) < eps) {
                    o = jj;
                    break;
                  }
                }
                if (o < 0) {
                  throw new Error(
                    "Couldn't find rotation of center faces; ignoring for now.",
                  );
                } else {
                  b[ii + 1] = o;
                  face1 = this.turnrotations[k][0].rotateface(face1);
                }
              }
            }
          }
          // b.length == 2 means a sticker is spinning in place.
          // in this case we add duplicate stickers
          // so that we can make it animate properly in a 3D world.
          if (b.length === 2 && this.orientCenters) {
            for (let ii = 1; ii < this.turnsetorders[k]; ii++) {
              if (sc === 0) {
                b.push(b[0], ii);
              } else {
                b.push(
                  b[0],
                  (this.turnsetorders[k] - ii) % this.turnsetorders[k],
                );
              }
            }
          }
          if (b.length > 2 && !cubiedone[b[0]]) {
            if (b.length !== 2 * this.turnsetorders[k]) {
              throw new Error("Bad length in perm gen");
            }
            for (let j = 0; j < b.length; j++) {
              slicecturns.push(b[j]);
            }
          }
          for (let j = 0; j < b.length; j += 2) {
            cubiedone[b[j]] = true;
          }
        }
        axiscturns.push(slicecturns);
      }
      cturnsbyslice.push(axiscturns);
    }
    this.cturnsbyslice = cturnsbyslice;
    if (this.turnlist !== undefined) {
      const parsedturnlist: any[] = [];
      // make sure the turnlist makes sense based on the geos.
      for (let i = 0; i < this.turnlist.length; i++) {
        parsedturnlist.push(this.parseturn(this.turnlist[i]));
      }
      this.parsedturnlist = parsedturnlist;
    }
  }

  public getfaces(): number[][][] {
    // get the faces for 3d.
    return this.faces.map((_) => {
      return _.map((__) => [__.b, __.c, __.d]);
    });
  }

  public getboundarygeometry(): any {
    // get the boundary geometry
    return {
      baseplanes: this.baseplanes,
      facenames: this.facenames,
      faceplanes: this.faceplanes,
      vertexnames: this.vertexnames,
      edgenames: this.edgenames,
      geonormals: this.geonormals,
    };
  }

  public getturnsets(k: number): any {
    // get the turn sets we support based on slices
    // for even values we omit the middle "slice".  This isn't perfect
    // but it is what we do for now.
    // if there was a turn list specified, pull values from that
    const slices = this.turnplanesets[k].length;
    if (slices > 30) {
      throw new Error("Too many slices for getturnsets bitmasks");
    }
    let r = [];
    if (this.parsedturnlist !== undefined) {
      for (let i = 0; i < this.parsedturnlist.length; i++) {
        const parsedturn = this.parsedturnlist[i];
        if (parsedturn[1] !== k) {
          continue;
        }
        if (parsedturn[4]) {
          r.push((2 << parsedturn[3]) - (1 << parsedturn[2]));
        } else {
          r.push(
            (2 << (slices - parsedturn[2])) - (1 << (slices - parsedturn[3])),
          );
        }
        r.push(parsedturn[5]);
      }
    } else if (this.vertexturns && !this.allmoves) {
      const msg = this.turnsetgeos[k];
      if (msg[1] !== msg[3]) {
        for (let i = 0; i < slices; i++) {
          if (msg[1] !== "v") {
            if (this.outerblockturns) {
              r.push((2 << slices) - (2 << i));
            } else {
              r.push(2 << i);
            }
            r.push(1);
          } else {
            if (this.outerblockturns) {
              r.push((2 << i) - 1);
            } else {
              r.push(1 << i);
            }
            r.push(1);
          }
        }
      }
    } else {
      for (let i = 0; i <= slices; i++) {
        if (!this.allmoves && i + i === slices) {
          continue;
        }
        if (this.outerblockturns) {
          if (i + i > slices) {
            r.push((2 << slices) - (1 << i));
          } else {
            r.push((2 << i) - 1);
          }
        } else {
          r.push(1 << i);
        }
        r.push(1);
      }
    }
    if (this.addrotations && !this.allmoves) {
      r.push((2 << slices) - 1);
      r.push(1);
    }
    if (this.fixedCubie >= 0) {
      const dep = 1 << +this.cubiekeys[this.fixedCubie].trim().split(" ")[k];
      const newr = [];
      for (let i = 0; i < r.length; i += 2) {
        let o = r[i];
        if (o & dep) {
          o = (2 << slices) - 1 - o;
        }
        let found = false;
        for (let j = 0; j < newr.length; j += 2) {
          if (newr[j] === o && newr[j + 1] === r[i + 1]) {
            found = true;
            break;
          }
        }
        if (!found) {
          newr.push(o);
          newr.push(r[i + 1]);
        }
      }
      r = newr;
    }
    return r;
  }

  public graybyori(cubie: number): boolean {
    let ori = this.cubies[cubie].length;
    if (this.duplicatedCubies[cubie]) {
      ori = 1;
    }
    return (
      (ori === 1 && (this.graycenters || !this.centersets)) ||
      (ori === 2 && (this.grayedges || !this.edgesets)) ||
      (ori > 2 && (this.graycorners || !this.cornersets))
    );
  }

  public skipbyori(cubie: number): boolean {
    let ori = this.cubies[cubie].length;
    if (this.duplicatedCubies[cubie]) {
      ori = 1;
    }
    return (
      (ori === 1 && !this.centersets) ||
      (ori === 2 && !this.edgesets) ||
      (ori > 2 && !this.cornersets)
    );
  }

  public skipcubie(fi: number): boolean {
    return this.skipbyori(fi);
  }

  public skipset(set: number[]): boolean {
    if (set.length === 0) {
      return true;
    }
    const fi = set[0];
    return this.skipbyori(this.facetocubies[fi][0]);
  }

  public header(comment: string): string {
    return comment + copyright + "\n" + comment + this.args + "\n";
  }

  public writegap(): string {
    // write out a gap set of generators
    const os = this.getOrbitsDef(false);
    const r = [];
    const mvs = [];
    for (let i = 0; i < os.turnops.length; i++) {
      const turnname = "M_" + os.turnnames[i];
      // gap doesn't like angle brackets in IDs
      mvs.push(turnname);
      r.push(turnname + ":=" + os.turnops[i].toPerm().toGap() + ";");
    }
    r.push("Gen:=[");
    r.push(mvs.join(","));
    r.push("];");
    const ip = os.solved.identicalPieces();
    r.push(
      "ip:=[" +
        ip.map((_) => "[" + _.map((__) => __ + 1).join(",") + "]").join(",") +
        "];",
    );
    r.push("");
    return this.header("# ") + r.join("\n");
  }

  public writeksolve(
    name: string = "PuzzleGeometryPuzzle",
    fortwisty: boolean = false,
  ): string {
    const od = this.getOrbitsDef(fortwisty);
    if (fortwisty) {
      return od.toKsolve(name, fortwisty).join("\n");
    } else {
      return this.header("# ") + od.toKsolve(name, fortwisty).join("\n");
    }
  }

  public writekpuzzle(fortwisty: boolean = true): PGVendoredKPuzzleDefinition {
    const od = this.getOrbitsDef(fortwisty);
    const r = od.toKpuzzle() as PGVendoredKPuzzleDefinition;
    r.turnNotation = new PGNotation(this, od);
    return r;
  }

  public getTurnFromBits(
    turnbits: number,
    amount: number,
    inverted: boolean,
    axiscturns: number[][],
    setturns: number[] | undefined,
    turnsetorder: number,
  ): Transformation {
    const turnorbits: Orbit[] = [];
    const perms = [];
    const oris = [];
    for (let ii = 0; ii < this.cubiesetnames.length; ii++) {
      perms.push(iota(this.cubieords[ii]));
      oris.push(zeros(this.cubieords[ii]));
    }
    for (let m = 0; m < axiscturns.length; m++) {
      if (((turnbits >> m) & 1) === 0) {
        continue;
      }
      const slicecturns = axiscturns[m];
      for (let j = 0; j < slicecturns.length; j += 2 * turnsetorder) {
        const mperm = slicecturns.slice(j, j + 2 * turnsetorder);
        const setnum = this.cubiesetnums[mperm[0]];
        for (let ii = 0; ii < mperm.length; ii += 2) {
          mperm[ii] = this.cubieordnums[mperm[ii]];
        }
        let inc = 2;
        let oinc = 3;
        if (inverted) {
          inc = mperm.length - 2;
          oinc = mperm.length - 1;
        }
        if (perms[setnum] === iota(this.cubieords[setnum])) {
          perms[setnum] = perms[setnum].slice();
          if (this.orbitoris[setnum] > 1 && !this.killorientation) {
            oris[setnum] = oris[setnum].slice();
          }
        }
        for (let ii = 0; ii < mperm.length; ii += 2) {
          perms[setnum][mperm[(ii + inc) % mperm.length]] = mperm[ii];
          if (this.orbitoris[setnum] > 1 && !this.killorientation) {
            oris[setnum][mperm[ii]] =
              (mperm[(ii + oinc) % mperm.length] -
                mperm[(ii + 1) % mperm.length] +
                2 * this.orbitoris[setnum]) %
              this.orbitoris[setnum];
          }
        }
      }
    }
    for (let ii = 0; ii < this.cubiesetnames.length; ii++) {
      if (setturns && !setturns[ii]) {
        continue;
      }
      if (this.orbitoris[ii] === 1 || this.killorientation) {
        turnorbits.push(new Orbit(perms[ii], oris[ii], 1));
      } else {
        const no = new Array<number>(oris[ii].length);
        // convert ksolve oris to our internal ori rep
        for (let jj = 0; jj < perms[ii].length; jj++) {
          no[jj] = oris[ii][perms[ii][jj]];
        }
        turnorbits.push(new Orbit(perms[ii], no, this.orbitoris[ii]));
      }
    }
    let mv = new Transformation(turnorbits);
    if (amount !== 1) {
      mv = mv.mulScalar(amount);
    }
    return mv;
  }

  public getOrbitsDef(fortwisty: boolean): OrbitsDef {
    // generate a representation of the puzzle
    const setturns = [];
    const setnames: string[] = [];
    const setdefs: OrbitDef[] = [];
    for (let k = 0; k < this.turnplanesets.length; k++) {
      const turnset = this.getturnsets(k);
      const turnsetorder = this.turnsetorders[k];
      // check there's no redundancy in turnset.
      for (let i = 0; i < turnset.length; i += 2) {
        for (let j = 0; j < i; j += 2) {
          if (turnset[i] === turnset[j] && turnset[i + 1] === turnset[j + 1]) {
            throw new Error("Redundant turns in turnset.");
          }
        }
      }
      let allbits = 0;
      for (let i = 0; i < turnset.length; i += 2) {
        allbits |= turnset[i];
      }
      const axiscturns = this.cturnsbyslice[k];
      for (let i = 0; i < axiscturns.length; i++) {
        if (((allbits >> i) & 1) === 0) {
          continue;
        }
        const slicecturns = axiscturns[i];
        for (let j = 0; j < slicecturns.length; j += 2 * turnsetorder) {
          if (this.skipcubie(slicecturns[j])) {
            continue;
          }
          const ind = this.cubiesetnums[slicecturns[j]];
          setturns[ind] = 1;
        }
      }
    }
    for (let i = 0; i < this.cubiesetnames.length; i++) {
      if (!setturns[i]) {
        continue;
      }
      setnames.push(this.cubiesetnames[i]);
      setdefs.push(
        new OrbitDef(
          this.cubieords[i],
          this.killorientation ? 1 : this.orbitoris[i],
        ),
      );
    }
    const solved: Orbit[] = [];
    for (let i = 0; i < this.cubiesetnames.length; i++) {
      if (!setturns[i]) {
        continue;
      }
      const p = [];
      const o = [];
      for (let j = 0; j < this.cubieords[i]; j++) {
        if (fortwisty) {
          p.push(j);
        } else {
          const cubie = this.cubiesetcubies[i][j];
          p.push(this.cubievaluemap[cubie]);
        }
        o.push(0);
      }
      solved.push(
        new Orbit(p, o, this.killorientation ? 1 : this.orbitoris[i]),
      );
    }
    const turnnames: string[] = [];
    const turns: Transformation[] = [];
    for (let k = 0; k < this.turnplanesets.length; k++) {
      const turnplaneset = this.turnplanesets[k];
      const slices = turnplaneset.length;
      const turnset = this.getturnsets(k);
      const turnsetgeo = this.turnsetgeos[k];
      for (let i = 0; i < turnset.length; i += 2) {
        const turnbits = turnset[i];
        const mna = getturnname(turnsetgeo, turnbits, slices);
        const turnname = mna[0];
        const inverted = mna[1];
        if (turnset[i + 1] === 1) {
          turnnames.push(turnname);
        } else {
          turnnames.push(turnname + turnset[i + 1]);
        }
        const mv = this.getTurnFromBits(
          turnbits,
          turnset[i + 1],
          inverted,
          this.cturnsbyslice[k],
          setturns,
          this.turnsetorders[k],
        );
        turns.push(mv);
      }
    }
    this.ksolveturnnames = turnnames; // hack!
    let r = new OrbitsDef(
      setnames,
      setdefs,
      new VisibleState(solved),
      turnnames,
      turns,
    );
    if (this.optimize) {
      r = r.optimize();
    }
    if (this.scramble !== 0) {
      r.scramble(this.scramble);
    }
    return r;
  }

  public getTurnsAsPerms(): Perm[] {
    return this.getOrbitsDef(false).turnops.map((_: Transformation) =>
      _.toPerm(),
    );
  }

  public showcanon(disp: (s: string) => void): void {
    // show information for canonical turn derivation
    showcanon(this.getOrbitsDef(false), disp);
  }

  public getsolved(): Perm {
    // get a solved position
    const r = [];
    for (let i = 0; i < this.basefacecount; i++) {
      for (let j = 0; j < this.stickersperface; j++) {
        r.push(i);
      }
    }
    return new Perm(r);
  }

  // Given a rotation description that says to align feature1
  // with a given vector, and then as much as possible feature2
  // with another given vector, return a Quaternion that
  // performs this rotation.
  public getOrientationRotation(desiredRotation: any[]): Quat {
    const feature1name = desiredRotation[0];
    const direction1 = new Quat(
      0,
      desiredRotation[1][0],
      -desiredRotation[1][1],
      desiredRotation[1][2],
    );
    const feature2name = desiredRotation[2];
    const direction2 = new Quat(
      0,
      desiredRotation[3][0],
      -desiredRotation[3][1],
      desiredRotation[3][2],
    );
    let feature1: Quat | null = null;
    let feature2: Quat | null = null;
    const feature1geoname = this.swizzler.unswizzle(feature1name);
    const feature2geoname = this.swizzler.unswizzle(feature2name);
    for (const gn of this.geonormals) {
      if (feature1geoname === gn[1]) {
        feature1 = gn[0];
      }
      if (feature2geoname === gn[1]) {
        feature2 = gn[0];
      }
    }
    if (!feature1) {
      throw new Error("Could not find feature " + feature1name);
    }
    if (!feature2) {
      throw new Error("Could not find feature " + feature2name);
    }
    const r1 = feature1.pointrotation(direction1);
    const feature2rot = feature2.rotatepoint(r1);
    const r2 = feature2rot
      .unproject(direction1)
      .pointrotation(direction2.unproject(direction1));
    return r2.mul(r1);
  }

  public getInitial3DRotation(): Quat {
    const basefacecount = this.basefacecount;
    let rotDesc: any = null;
    if (this.puzzleOrientation) {
      rotDesc = this.puzzleOrientation;
    } else if (this.puzzleOrientations) {
      rotDesc = this.puzzleOrientations[basefacecount];
    }
    // either no option specified or no matching key in
    // puzzleOrientations.
    if (!rotDesc) {
      rotDesc = defaultOrientations()[basefacecount];
    }
    if (!rotDesc) {
      throw new Error("No default orientation?");
    }
    return this.getOrientationRotation(rotDesc);
  }

  public generatesvg(
    w: number = 800,
    h: number = 500,
    trim: number = 10,
    threed: boolean = false,
  ): string {
    // generate svg to interoperate with Lucas twistysim
    w -= 2 * trim;
    h -= 2 * trim;
    function extendedges(a: number[][], n: number): void {
      let dx = a[1][0] - a[0][0];
      let dy = a[1][1] - a[0][1];
      const ang = (2 * Math.PI) / n;
      const cosa = Math.cos(ang);
      const sina = Math.sin(ang);
      for (let i = 2; i < n; i++) {
        const ndx = dx * cosa + dy * sina;
        dy = dy * cosa - dx * sina;
        dx = ndx;
        a.push([a[i - 1][0] + dx, a[i - 1][1] + dy]);
      }
    }
    // if we don't add this noise to coordinate values, then Safari
    // doesn't render our polygons correctly.  What a hack.
    function noise(c: number): number {
      return c + 0 * (Math.random() - 0.5);
    }
    function drawedges(id: string, pts: number[][], color: string): string {
      return (
        '<polygon id="' +
        id +
        '" class="sticker" style="fill: ' +
        color +
        '" points="' +
        pts.map((p) => noise(p[0]) + " " + noise(p[1])).join(" ") +
        '"/>\n'
      );
    }
    // What grips do we need?  if rotations, add all grips.
    let needvertexgrips = this.addrotations;
    let neededgegrips = this.addrotations;
    let needfacegrips = this.addrotations;
    for (let i = 0; i < this.turnsetgeos.length; i++) {
      const msg = this.turnsetgeos[i];
      for (let j = 1; j <= 3; j += 2) {
        if (msg[j] === "v") {
          needvertexgrips = true;
        }
        if (msg[j] === "f") {
          needfacegrips = true;
        }
        if (msg[j] === "e") {
          neededgegrips = true;
        }
      }
    }
    // Find a net from a given face count.  Walk it, assuming we locate
    // the first edge from (0,0) to (1,1) and compute the minimum and
    // maximum vertex locations from this.  Then do a second walk, and
    // assign the actual geometry.
    this.genperms();
    const boundarygeo = this.getboundarygeometry();
    const face0 = boundarygeo.facenames[0][0];
    const polyn = face0.length; // number of vertices; 3, 4, or 5
    const net = this.net;
    if (net === null) {
      throw new Error("No net?");
    }
    const edges: any = {};
    let minx = 0;
    let miny = 0;
    let maxx = 1;
    let maxy = 0;
    edges[net[0][0]] = [
      [1, 0],
      [0, 0],
    ];
    extendedges(edges[net[0][0]], polyn);
    for (let i = 0; i < net.length; i++) {
      const f0 = net[i][0];
      if (!edges[f0]) {
        throw new Error("Bad edge description; first edge not connected.");
      }
      for (let j = 1; j < net[i].length; j++) {
        const f1 = net[i][j];
        if (f1 === "" || edges[f1]) {
          continue;
        }
        edges[f1] = [edges[f0][j % polyn], edges[f0][(j + polyn - 1) % polyn]];
        extendedges(edges[f1], polyn);
      }
    }
    for (const f in edges) {
      const es = edges[f];
      for (let i = 0; i < es.length; i++) {
        minx = Math.min(minx, es[i][0]);
        maxx = Math.max(maxx, es[i][0]);
        miny = Math.min(miny, es[i][1]);
        maxy = Math.max(maxy, es[i][1]);
      }
    }
    const sc = Math.min(w / (maxx - minx), h / (maxy - miny));
    const xoff = 0.5 * (w - sc * (maxx + minx));
    const yoff = 0.5 * (h - sc * (maxy + miny));
    const geos: any = {};
    const bg = this.getboundarygeometry();
    const edges2: any = {};
    const initv = [
      [sc + xoff, yoff],
      [xoff, yoff],
    ];
    edges2[net[0][0]] = initv;
    extendedges(edges2[net[0][0]], polyn);
    geos[this.facenames[0][1]] = this.project2d(0, 0, [
      new Quat(0, initv[0][0], initv[0][1], 0),
      new Quat(0, initv[1][0], initv[1][1], 0),
    ]);
    const connectat = [];
    connectat[0] = 0;
    for (let i = 0; i < net.length; i++) {
      const f0 = net[i][0];
      if (!edges2[f0]) {
        throw new Error("Bad edge description; first edge not connected.");
      }
      let gfi = -1;
      for (let j = 0; j < bg.facenames.length; j++) {
        if (f0 === bg.facenames[j][1]) {
          gfi = j;
          break;
        }
      }
      if (gfi < 0) {
        throw new Error("Could not find first face name " + f0);
      }
      const thisface = bg.facenames[gfi][0];
      for (let j = 1; j < net[i].length; j++) {
        const f1 = net[i][j];
        if (f1 === "" || edges2[f1]) {
          continue;
        }
        edges2[f1] = [
          edges2[f0][j % polyn],
          edges2[f0][(j + polyn - 1) % polyn],
        ];
        extendedges(edges2[f1], polyn);
        // what edge are we at?
        const caf0 = connectat[gfi];
        const mp = thisface[(caf0 + j) % polyn]
          .sum(thisface[(caf0 + j + polyn - 1) % polyn])
          .smul(0.5);
        const epi = findelement(bg.edgenames, mp);
        const edgename = bg.edgenames[epi][1];
        const el = splitByFaceNames(edgename, this.facenames);
        const gf1 = el[f0 === el[0] ? 1 : 0];
        let gf1i = -1;
        for (let k = 0; k < bg.facenames.length; k++) {
          if (gf1 === bg.facenames[k][1]) {
            gf1i = k;
            break;
          }
        }
        if (gf1i < 0) {
          throw new Error("Could not find second face name");
        }
        const otherface = bg.facenames[gf1i][0];
        for (let k = 0; k < otherface.length; k++) {
          const mp2 = otherface[k].sum(otherface[(k + 1) % polyn]).smul(0.5);
          if (mp2.dist(mp) <= eps) {
            const p1 = edges2[f0][(j + polyn - 1) % polyn];
            const p2 = edges2[f0][j % polyn];
            connectat[gf1i] = k;
            geos[gf1] = this.project2d(gf1i, k, [
              new Quat(0, p2[0], p2[1], 0),
              new Quat(0, p1[0], p1[1], 0),
            ]);
            break;
          }
        }
      }
    }
    // Let's build arrays for faster rendering.  We want to map from geo
    // base face number to color, and we want to map from geo face number
    // to 2D geometry.  These can be reused as long as the puzzle overall
    // orientation and canvas size remains unchanged.
    const pos = this.getsolved();
    const colormap = [];
    const facegeo = [];
    for (let i = 0; i < this.basefacecount; i++) {
      colormap[i] = this.colors[this.facenames[i][1]];
    }
    let hix = 0;
    let hiy = 0;
    const rot = this.getInitial3DRotation();
    for (let i = 0; i < this.faces.length; i++) {
      let face = this.faces[i];
      face = rot.rotateface(face);
      for (let j = 0; j < face.length; j++) {
        hix = Math.max(hix, Math.abs(face[j].b));
        hiy = Math.max(hiy, Math.abs(face[j].c));
      }
    }
    const sc2 = Math.min(h / hiy / 2, (w - trim) / hix / 4);
    const mappt2d = (fn: number, q: Quat): number[] => {
      if (threed) {
        const xoff2 = 0.5 * trim + 0.25 * w;
        const xmul = this.baseplanes[fn].rotateplane(rot).d < 0 ? 1 : -1;
        return [
          trim + w * 0.5 + xmul * (xoff2 - q.b * sc2),
          trim + h * 0.5 + q.c * sc2,
        ];
      } else {
        const g = geos[this.facenames[fn][1]];
        return [trim + q.dot(g[0]) + g[2].b, trim + h - q.dot(g[1]) - g[2].c];
      }
    };
    for (let i = 0; i < this.faces.length; i++) {
      let face = this.faces[i];
      const facenum = Math.floor(i / this.stickersperface);
      if (threed) {
        face = rot.rotateface(face);
      }
      facegeo.push(face.map((_: Quat) => mappt2d(facenum, _)));
    }
    const svg = [];
    // group each base face so we can add a hover element
    for (let j = 0; j < this.basefacecount; j++) {
      svg.push("<g>");
      svg.push("<title>" + this.facenames[j][1] + "</title>\n");
      for (let ii = 0; ii < this.stickersperface; ii++) {
        const i = j * this.stickersperface + ii;
        const cubie = this.facetocubies[i][0];
        const cubieori = this.facetocubies[i][1];
        const cubiesetnum = this.cubiesetnums[cubie];
        const cubieord = this.cubieordnums[cubie];
        const color = this.graybyori(cubie) ? "#808080" : colormap[pos.p[i]];
        let id =
          this.cubiesetnames[cubiesetnum] + "-l" + cubieord + "-o" + cubieori;
        svg.push(drawedges(id, facegeo[i], color));
        if (this.duplicatedFaces[i]) {
          for (let jj = 1; jj < this.duplicatedFaces[i]; jj++) {
            id = this.cubiesetnames[cubiesetnum] + "-l" + cubieord + "-o" + jj;
            svg.push(drawedges(id, facegeo[i], color));
          }
        }
      }
      svg.push("</g>");
    }
    const svggrips: any[] = [];
    function addgrip(
      onface: number,
      name: string,
      pt: Quat,
      order: number,
    ): void {
      const pt2 = mappt2d(onface, pt);
      for (let i = 0; i < svggrips.length; i++) {
        if (
          Math.hypot(pt2[0] - svggrips[i][0], pt2[1] - svggrips[i][1]) < eps
        ) {
          return;
        }
      }
      svggrips.push([pt2[0], pt2[1], name, order]);
    }
    for (let i = 0; i < this.faceplanes.length; i++) {
      const baseface = this.facenames[i][0];
      let facecoords = baseface;
      if (threed) {
        facecoords = rot.rotateface(facecoords);
      }
      if (needfacegrips) {
        let pt = this.faceplanes[i][0];
        if (threed) {
          pt = pt.rotatepoint(rot);
        }
        addgrip(i, this.faceplanes[i][1], pt, polyn);
      }
      for (let j = 0; j < baseface.length; j++) {
        if (neededgegrips) {
          const mp = baseface[j]
            .sum(baseface[(j + 1) % baseface.length])
            .smul(0.5);
          const ep = findelement(this.edgenames, mp);
          const mpc = facecoords[j]
            .sum(facecoords[(j + 1) % baseface.length])
            .smul(0.5);
          addgrip(i, this.edgenames[ep][1], mpc, 2);
        }
        if (needvertexgrips) {
          const vp = findelement(this.vertexnames, baseface[j]);
          addgrip(i, this.vertexnames[vp][1], facecoords[j], this.cornerfaces);
        }
      }
    }
    const html =
      '<svg id="svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 800 500">\n' +
      '<style type="text/css"><![CDATA[' +
      ".sticker { stroke: #000000; stroke-width: 1px; }" +
      "]]></style>\n" +
      svg.join("") +
      "</svg>";
    this.svggrips = svggrips;
    return html;
  }

  public dist(a: number[], b: number[]): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  public triarea(a: number[], b: number[], c: number[]): number {
    const ab = this.dist(a, b);
    const bc = this.dist(b, c);
    const ac = this.dist(a, c);
    const p = (ab + bc + ac) / 2;
    return Math.sqrt(p * (p - ab) * (p - bc) * (p - ac));
  }

  public polyarea(coords: number[][]): number {
    let sum = 0;
    for (let i = 2; i < coords.length; i++) {
      sum += this.triarea(coords[0], coords[1], coords[i]);
    }
    return sum;
  }

  // The colorfrac parameter says how much of the face should be
  // colored (vs dividing lines); we default to 0.77 which seems
  // to work pretty well.  It should be a number between probably
  // 0.4 and 0.9.
  public get3d(
    colorfrac: number = DEFAULT_COLOR_FRACTION,
    options?: {
      stickerColors?: string[];
    },
  ): StickerDat {
    const stickers: any = [];
    const foundations: any = [];
    const rot = this.getInitial3DRotation();
    const faces: any = [];
    const maxdist: number = 0.52 * this.basefaces[0][0].len();
    let avgstickerarea = 0;
    for (let i = 0; i < this.basefaces.length; i++) {
      const coords = rot.rotateface(this.basefaces[i]);
      const name = this.facenames[i][1];
      faces.push({ coords: toFaceCoords(coords, maxdist), name });
      avgstickerarea += this.polyarea(faces[i].coords);
    }
    avgstickerarea /= this.faces.length;
    const trim = (Math.sqrt(avgstickerarea) * (1 - Math.sqrt(colorfrac))) / 2;
    for (let i = 0; i < this.faces.length; i++) {
      const facenum = Math.floor(i / this.stickersperface);
      const cubie = this.facetocubies[i][0];
      const cubieori = this.facetocubies[i][1];
      const cubiesetnum = this.cubiesetnums[cubie];
      const cubieord = this.cubieordnums[cubie];
      let color = this.graybyori(cubie)
        ? "#808080"
        : this.colors[this.facenames[facenum][1]];
      if (options?.stickerColors) {
        color = options.stickerColors[i];
      }
      let coords = rot.rotateface(this.faces[i]);
      foundations.push({
        coords: toFaceCoords(coords, maxdist),
        color,
        orbit: this.cubiesetnames[cubiesetnum],
        ord: cubieord,
        ori: cubieori,
      });
      const fcoords = coords;
      if (trim && trim > 0) {
        coords = trimEdges(coords, trim);
      }
      stickers.push({
        coords: toFaceCoords(coords, maxdist),
        color,
        orbit: this.cubiesetnames[cubiesetnum],
        ord: cubieord,
        ori: cubieori,
      });
      if (this.duplicatedFaces[i]) {
        for (let jj = 1; jj < this.duplicatedFaces[i]; jj++) {
          stickers.push({
            coords: toFaceCoords(coords, maxdist),
            color,
            orbit: this.cubiesetnames[cubiesetnum],
            ord: cubieord,
            ori: jj,
          });
          foundations.push({
            coords: toFaceCoords(fcoords, maxdist),
            color,
            orbit: this.cubiesetnames[cubiesetnum],
            ord: cubieord,
            ori: jj,
          });
        }
      }
    }
    const grips: StickerDatAxis[] = [];
    for (let i = 0; i < this.turnsetgeos.length; i++) {
      const msg = this.turnsetgeos[i];
      const order = this.turnsetorders[i];
      for (let j = 0; j < this.geonormals.length; j++) {
        const gn = this.geonormals[j];
        if (msg[0] === gn[1] && msg[1] === gn[2]) {
          grips.push([toCoords(gn[0].rotatepoint(rot), 1), msg[0], order]);
          grips.push([
            toCoords(gn[0].rotatepoint(rot).smul(-1), 1),
            msg[2],
            order,
          ]);
        }
      }
    }
    const f = (function () {
      return function (mv: PGVendoredTurn): string {
        return this.unswizzle(mv);
      };
    })().bind(this);
    return {
      stickers,
      foundations,
      faces,
      axis: grips,
      unswizzle: f,
      notationMapper: this.notationMapper,
    };
  }

  //  From the name of a geometric element (face, vertex, edge), get a
  //  normal vector respecting the default orientation.  This is useful
  //  to define the initial position of the camera in a 3D scene.  The
  //  return value is normalized, so multiply it by the camera distance.
  //  Returns undefined if no such geometric element.
  public getGeoNormal(geoname: string): number[] | undefined {
    const rot = this.getInitial3DRotation();
    const grip = this.swizzler.unswizzle(geoname);
    for (let j = 0; j < this.geonormals.length; j++) {
      const gn = this.geonormals[j];
      if (grip === gn[1]) {
        const r = toCoords(gn[0].rotatepoint(rot), 1);
        //  This routine is intended to use for the camera location.
        //  If the camera location is vertical, and we give some
        //  near-zero values for x and z, then the rotation in the
        //  X/Z plane will be somewhat arbitrary.  So we clean up the
        //  returned vector here.  We give a very slight positive
        //  z value.
        if (Math.abs(r[0]) < eps && Math.abs(r[2]) < eps) {
          r[0] = 0.0;
          r[2] = 1e-6;
        }
        return r;
      }
    }
    return undefined;
  }

  private getfaceindex(facenum: number): number {
    const divid = this.stickersperface;
    return Math.floor(facenum / divid);
  }
}

class PGNotation implements PGVendoredTurnNotation {
  private cache: { [key: string]: KTransformation } = {};
  constructor(public pg: PuzzleGeometry, public od: OrbitsDef) {}

  public lookupTurn(turn: PGVendoredTurn): KTransformation | undefined {
    const key = this.turnToKeyString(turn);
    if (key in this.cache) {
      return this.cache[key];
    }
    const mv = this.pg.parseTurn(turn);
    let bits = (2 << mv[3]) - (1 << mv[2]);
    if (!mv[4]) {
      const slices = this.pg.turnplanesets[mv[1]].length;
      bits = (2 << (slices - mv[2])) - (1 << (slices - mv[3]));
    }
    const pgmv = this.pg.getTurnFromBits(
      bits,
      mv[5],
      !mv[4],
      this.pg.cturnsbyslice[mv[1]],
      undefined,
      this.pg.turnsetorders[mv[1]],
    );
    const r = this.od.transformToKPuzzle(pgmv);
    this.cache[key] = r;
    return r;
  }

  // This is only used to construct keys, so does not need to be beautiful.
  private turnToKeyString(turn: PGVendoredTurn): string {
    let r = "";
    if (turn.outerLayer) {
      r = r + turn.outerLayer + ",";
    }
    if (turn.innerLayer) {
      r = r + turn.innerLayer + ",";
    }
    r = r + turn.family + "," + turn.effectiveAmount;
    return r;
  }
}

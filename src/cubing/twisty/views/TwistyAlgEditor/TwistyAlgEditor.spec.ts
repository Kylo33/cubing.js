import { expect, test } from "bun:test";

import { TwistyPlayer } from "../TwistyPlayer";
import { TwistyAlgEditor } from "./TwistyAlgEditor";
import { Alg } from "cubing/alg";

class ResizeObserver {
  observe() {
    // do nothing
  }

  unobserve() {
    // do nothing
  }
}

if (globalThis.window) {
  (window as any).ResizeObserver = ResizeObserver;
}

test("TwistyAlgEditor can be constructed without arguments", () => {
  const twistyAlgEditor = new TwistyAlgEditor();
  expect(twistyAlgEditor.twistyPlayer).toBeNull;
});
test("TwistyAlgEditor can be constructed with a player", () => {
  const twistyPlayer = new TwistyPlayer();
  const twistyAlgEditor = new TwistyAlgEditor({ twistyPlayer });
  expect(twistyAlgEditor.twistyPlayer).not.toBeNull;
});
test("TwistyAlgEditor can have a player set as an attribute", () => {
  // TODO: 2D is to avoid WebGL error. Can we do this in another way?
  const twistyPlayer = new TwistyPlayer({ visualization: "2D" });
  twistyPlayer.id = "test-id-1";
  document.body.appendChild(twistyPlayer);
  const twistyAlgEditor = new TwistyAlgEditor();
  twistyAlgEditor.setAttribute("for-twisty-player", "test-id-1");
  expect(twistyAlgEditor.twistyPlayer).not.toBeNull;
});
test("TwistyAlgEditor sets timestamp from textarea", async () => {
  const twistyPlayer = new TwistyPlayer({ alg: "F2", visualization: "2D" });
  const alg = async () => (await twistyPlayer.experimentalModel.alg.get()).alg;
  document.body.appendChild(twistyPlayer);
  expect((await alg()).isIdentical(new Alg("F2"))).toBeTrue;
  const twistyAlgEditor = new TwistyAlgEditor({ twistyPlayer });
  twistyAlgEditor.algString = "R      U R' D2";
  expect((await alg()).isIdentical(new Alg("R U R' D2"))).toBeTrue;
  // TODO: get this working.
  // const textarea = TwistyAlgEditor.shadow.querySelector("textarea");
  // expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
  // textarea!.setSelectionRange(8, 8);
  // textarea!.dispatchEvent(new CustomEvent("input"));
  // expect(twistyPlayer.timeline.timestamp).toBe(2000);
});

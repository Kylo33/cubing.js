// Parcel-ism.
// Supercube arrow image from Ben Whitmore.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import supercubeSprite from "url:./supercube-arrows-sprite.png";
import { parseAlg } from "../../cubing/alg";
import {
  connect,
  debugKeyboardConnect,
  TurnEvent,
} from "../../cubing/bluetooth";
import {
  Cube3D,
  TimelineActionEvent,
  TimestampLocationType,
  TwistyPlayer,
} from "../../cubing/twisty";

const spriteURL =
  new URL(location.href).searchParams.get("sprite") ?? supercubeSprite;

const hintSpriteURL =
  new URL(location.href).searchParams.get("hint-sprite") ?? "";

// Common picture cube demo code.

let haveHadTurnInput = false;

const twistyPlayer = document.querySelector("twisty-player")! as TwistyPlayer;
twistyPlayer.timeline.jumpToStart();
twistyPlayer.timeline.play(); // TODO: add autoplay
twistyPlayer.timeline.addActionListener({
  onTimelineAction: (actionEvent: TimelineActionEvent) => {
    if (haveHadTurnInput) {
      return;
    }
    if (actionEvent.locationType === TimestampLocationType.EndOfTimeline) {
      twistyPlayer.timeline.jumpToStart();
      twistyPlayer.timeline.play();
    }
  },
});

(async () => {
  const kb = await debugKeyboardConnect();
  kb.addTurnListener((e: TurnEvent) => {
    if (!haveHadTurnInput) {
      twistyPlayer.timeline.pause();
      twistyPlayer.alg = parseAlg("");
      haveHadTurnInput = true;
    }
    twistyPlayer.experimentalAddTurn(e.latestTurn);
  });
})();

let lastTimestamp = performance.now();
const ROTATION_RATE = (2 * Math.PI) / 15;
let haveTriedToSetSpriteURL = false;
function rotate() {
  if (twistyPlayer.twisty3D && !haveTriedToSetSpriteURL) {
    haveTriedToSetSpriteURL = true;
    (twistyPlayer.twisty3D as Cube3D).experimentalSetStickerSpriteURL(
      spriteURL,
    );
    (twistyPlayer.twisty3D as Cube3D).experimentalSetHintStickerSpriteURL(
      hintSpriteURL,
    );
  }

  const newTimestamp = performance.now();
  twistyPlayer.twisty3D?.rotateY(
    ((newTimestamp - lastTimestamp) / 1000) * ROTATION_RATE,
  );
  if (
    !(twistyPlayer.viewerElems[0] as any)?.orbitControls
      .experimentalHasBeenTurnd
  ) {
    requestAnimationFrame(rotate);
    lastTimestamp = newTimestamp;
  }
}
requestAnimationFrame(rotate);

async function connectBluetooth(): Promise<void> {
  const bluetoothPuzzle = await connect();
  document.body.removeEventListener("click", connectBluetooth);
  bluetoothPuzzle.addTurnListener((e: TurnEvent) => {
    if (!haveHadTurnInput) {
      twistyPlayer.timeline.pause();
      twistyPlayer.alg = parseAlg("");
      haveHadTurnInput = true;
    }
    twistyPlayer.experimentalAddTurn(e.latestTurn);
  });
}
if (new URL(location.href).searchParams.get("bluetooth") === "true") {
  document.body.addEventListener("click", connectBluetooth);
}

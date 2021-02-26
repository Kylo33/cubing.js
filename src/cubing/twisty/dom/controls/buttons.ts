import { TimeRange } from "../../animation/cursor/AlgCursor";
import {
  BoundaryType,
  Direction,
  MillisecondTimestamp,
} from "../../animation/cursor/CursorTypes";
import {
  Timeline,
  TimelineAction,
  TimelineActionEvent,
  TimestampLocationType,
} from "../../animation/Timeline";
import { ClassListManager } from "../element/ClassListManager";
import { ManagedCustomElement } from "../element/ManagedCustomElement";
import { customElementsShim } from "../element/node-custom-element-shims";
import { ViewerLinkPage } from "../TwistyPlayerConfig";
import { buttonCSS, buttonGridCSS } from "./buttons.css";
import { TwistyControlElement } from "./TwistyControlElement.ts";

type TimelineCommand =
  | "fullscreen"
  | "jump-to-start"
  | "play-pause" // TODO: toggle-play?
  // | "play"
  // | "play-backwards"
  | "play-step-backwards"
  | "play-step"
  | "jump-to-end"
  | "twizzle-link";

// TODO: combine this with disabled status and label in a state machine?
type ButtonIconName =
  | "skip-to-start"
  | "skip-to-end"
  | "step-forward"
  | "step-backward"
  | "pause"
  | "play"
  | "enter-fullscreen"
  | "exit-fullscreen"
  | "twizzle-tw";

export class TwistyControlButton
  extends ManagedCustomElement
  implements TwistyControlElement {
  private timeline: Timeline;
  private timelineCommand: TimelineCommand;
  private currentIconName: string | null = null;
  protected button: HTMLButtonElement = document.createElement("button");
  private fullscreenElement: Element | null = null;
  private visitTwizzleLinkCallback: (() => void) | null = null;
  constructor(
    timeline?: Timeline,
    timelineCommand?: TimelineCommand,
    options?: {
      fullscreenElement?: Element; // TODO: reflect as an element attribute?
      visitTwizzleLinkCallback?: () => void;
    },
  ) {
    super();

    this.fullscreenElement = options?.fullscreenElement ?? null;
    this.visitTwizzleLinkCallback = options?.visitTwizzleLinkCallback ?? null;

    if (!timeline) {
      console.warn("Must have timeline!"); // TODO
    }
    this.timeline = timeline!;
    if (!timelineCommand) {
      console.warn("Must have timelineCommand!"); // TODO
    }
    this.timelineCommand = timelineCommand!;

    this.addCSS(buttonCSS);
    this.setIcon(this.initialIcon());
    this.setHoverTitle(this.initialHoverTitle());
    this.addElement(this.button);
    this.addEventListener("click", this.onPress.bind(this));

    switch (this.timelineCommand!) {
      case "fullscreen":
        if (!document.fullscreenEnabled) {
          this.button.disabled = true;
        }
        break;
      case "jump-to-start":
      case "play-step-backwards":
        this.button.disabled = true;
        break;
    }

    if (this.timeline) {
      // TODO
      this.timeline.addActionListener(this);
      switch (this.timelineCommand!) {
        case "play-pause":
        case "play-step-backwards":
        case "play-step":
          this.timeline.addTimestampListener(this);
          break;
      }

      this.autoSetTimelineBasedDisabled();
    }
  }

  // TODO: Can we avoid duplicate calculations?
  private autoSetTimelineBasedDisabled(): void {
    switch (this.timelineCommand!) {
      case "jump-to-start":
      case "play-pause":
      case "play-step-backwards":
      case "play-step":
      case "jump-to-end": {
        const timeRange = this.timeline.timeRange();
        if (timeRange.start === timeRange.end) {
          this.button.disabled = true;
          return;
        }
        switch (this.timelineCommand!) {
          case "jump-to-start":
          case "play-step-backwards":
            this.button.disabled =
              this.timeline.timestamp < this.timeline.maxTimestamp();
            break;
          case "jump-to-end":
          case "play-step":
            this.button.disabled =
              this.timeline.timestamp > this.timeline.minTimestamp();
            break;
          default:
            this.button.disabled = false;
        }
        break;
      }
    }
  }

  setIcon(buttonIconName: ButtonIconName): void {
    if (this.currentIconName === buttonIconName) {
      return;
    }
    if (this.currentIconName) {
      this.button.classList.remove(`svg-${this.currentIconName}`);
    }
    this.button.classList.add(`svg-${buttonIconName}`);
    this.currentIconName = buttonIconName;
  }

  private initialIcon(): ButtonIconName {
    const map: Record<TimelineCommand, ButtonIconName> = {
      "jump-to-start": "skip-to-start",
      "play-pause": "play",
      "play-step": "step-forward",
      "play-step-backwards": "step-backward",
      "jump-to-end": "skip-to-end",
      "fullscreen": "enter-fullscreen",
      "twizzle-link": "twizzle-tw",
    };
    return map[this.timelineCommand];
  }

  private initialHoverTitle(): string {
    const map: Record<TimelineCommand, string> = {
      "jump-to-start": "Restart",
      "play-pause": "Play",
      "play-step": "Step forward",
      "play-step-backwards": "Step backward",
      "jump-to-end": "Skip to End",
      "fullscreen": "Enter fullscreen",
      "twizzle-link": "View at Twizzle",
    };
    return map[this.timelineCommand];
  }

  private setHoverTitle(title: string): void {
    this.button.title = title;
  }

  onPress(): void {
    switch (this.timelineCommand!) {
      case "fullscreen":
        if (document.fullscreenElement === this.fullscreenElement) {
          document.exitFullscreen();
          // this.setIcon("enter-fullscreen");
        } else {
          this.setIcon("exit-fullscreen");
          this.fullscreenElement!.requestFullscreen().then(() => {
            const onFullscreen = (): void => {
              if (document.fullscreenElement !== this.fullscreenElement) {
                this.setIcon("enter-fullscreen");
                window.removeEventListener("fullscreenchange", onFullscreen);
              }
            };
            window.addEventListener("fullscreenchange", onFullscreen);
          });
        }
        break;
      case "jump-to-start":
        this.timeline.setTimestamp(0);
        break;
      case "jump-to-end":
        this.timeline.jumpToEnd();
        break;
      case "play-pause":
        this.timeline.playPause();
        break;
      case "play-step":
        this.timeline.experimentalPlay(Direction.Forwards, BoundaryType.Turn);
        break;
      case "play-step-backwards":
        this.timeline.experimentalPlay(Direction.Backwards, BoundaryType.Turn);
        break;
      case "twizzle-link":
        if (this.visitTwizzleLinkCallback) {
          this.visitTwizzleLinkCallback();
        }
        break;
    }
  }

  onTimelineAction(actionEvent: TimelineActionEvent): void {
    switch (this.timelineCommand!) {
      case "jump-to-start":
        // TODO: what if you're already playing?
        this.button.disabled =
          actionEvent.locationType === TimestampLocationType.StartOfTimeline &&
          actionEvent.action !== TimelineAction.StartingToPlay;
        break;
      case "jump-to-end":
        this.button.disabled =
          actionEvent.locationType === TimestampLocationType.EndOfTimeline &&
          actionEvent.action !== TimelineAction.StartingToPlay;
        break;
      case "play-pause":
        // Always enabled, since we will jump to the start if needed.
        switch (actionEvent.action) {
          case TimelineAction.Pausing:
            this.setIcon("play");
            this.setHoverTitle("Play");
            break;
          case TimelineAction.StartingToPlay:
            this.setIcon("pause");
            this.setHoverTitle("Pause");
            break;
          // TODO: does jumping mean pause?
        }
        break;
      case "play-step":
        // TODO: refine this
        this.button.disabled =
          actionEvent.locationType === TimestampLocationType.EndOfTimeline &&
          actionEvent.action !== TimelineAction.StartingToPlay;
        break;
      case "play-step-backwards":
        // TODO: refine this
        this.button.disabled =
          actionEvent.locationType === TimestampLocationType.StartOfTimeline &&
          actionEvent.action !== TimelineAction.StartingToPlay;
        break;
    }
  }

  onTimelineTimestampChange(_timestamp: MillisecondTimestamp): void {
    // Nothing
  }

  onTimeRangeChange(_timeRange: TimeRange): void {
    // TODO
    this.autoSetTimelineBasedDisabled();
  }
}

customElementsShim.define("twisty-control-button", TwistyControlButton);

// <twisty-control-button-grid>
// Usually a horizontal line.
export class TwistyControlButtonPanel
  extends ManagedCustomElement
  implements TwistyControlElement {
  #viewerLinkClassListManager: ClassListManager<
    ViewerLinkPage
  > = new ClassListManager(this, "viewer-link-", ["none", "twizzle"]);

  constructor(
    timeline?: Timeline,
    options?: {
      fullscreenElement?: Element;
      viewerLinkCallback?: () => void;
      viewerLink?: ViewerLinkPage;
    },
  ) {
    super();
    this.addCSS(buttonGridCSS);

    this.#viewerLinkClassListManager.setValue(options?.viewerLink ?? "none");

    // this.addElement(new TwistyControlButton(timeline!, fullscreenElement!));
    this.addElement(
      new TwistyControlButton(timeline!, "fullscreen", {
        fullscreenElement: options?.fullscreenElement,
      }),
    );
    this.addElement(new TwistyControlButton(timeline!, "jump-to-start"));
    this.addElement(new TwistyControlButton(timeline!, "play-step-backwards"));
    this.addElement(new TwistyControlButton(timeline!, "play-pause"));
    this.addElement(new TwistyControlButton(timeline!, "play-step"));
    this.addElement(new TwistyControlButton(timeline!, "jump-to-end"));
    this.addElement(
      new TwistyControlButton(timeline!, "twizzle-link", {
        visitTwizzleLinkCallback: options?.viewerLinkCallback,
      }),
    ).classList.add("twizzle-link-button");
    /*...*/
  }

  setViewerLink(viewerLink: ViewerLinkPage): void {
    this.#viewerLinkClassListManager.setValue(viewerLink);
  }
}

customElementsShim.define(
  "twisty-control-button-panel",
  TwistyControlButtonPanel,
);

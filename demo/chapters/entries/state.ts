// @ts-expect-error Generated PTSX module.
import { StateCounter } from "../../.generated/components/StateCounter.js";
import domSource from "../../.generated/components/StateCounter.js?raw";
import source from "../../examples/components/StateCounter.ptsx?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";
import "../../.generated/components/StateCounter.behavior.js";

setupWalkthrough({ Component: StateCounter, source, domSource, stateLesson: true });

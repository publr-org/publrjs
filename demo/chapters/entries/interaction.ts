// @ts-expect-error Generated PTSX module.
import { Hello } from "../../.generated/components/Hello.js";
import domSource from "../../.generated/components/Hello.js?raw";
import source from "../../examples/components/Hello.ptsx?raw";
import companion from "../../.generated/components/Hello.behavior.js?raw";
import "../../.generated/components/Hello.behavior.js";
import { setupWalkthrough } from "../../app/walkthrough/mount";

setupWalkthrough({ Component: Hello, source, domSource, companion });

// @ts-expect-error Generated PTSX module.
import { TemplateGreeting } from "../../.generated/components/TemplateGreeting.js";
import domSource from "../../.generated/components/TemplateGreeting.js?raw";
import source from "../../examples/components/TemplateGreeting.ptsx?raw";
import { setupWalkthrough } from "../../app/walkthrough/mount";

setupWalkthrough({ Component: TemplateGreeting, source, domSource, renderOnly: true });

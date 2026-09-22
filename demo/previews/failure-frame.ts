// @ts-expect-error Generated PTSX module.
import { ResilientSearch } from "../.generated/components/ResilientSearch.js";
import "../.generated/components/ResilientSearch.behavior.js";
import { setupPeopleFrame } from "./people-frame";

setupPeopleFrame(ResilientSearch, "failure");

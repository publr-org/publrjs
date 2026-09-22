// @ts-expect-error Generated PTSX module.
import { PeopleSearch } from "../.generated/components/PeopleSearch.js";
import "../.generated/components/PeopleSearch.behavior.js";
import { setupPeopleFrame } from "./people-frame";

setupPeopleFrame(PeopleSearch, "awaited");

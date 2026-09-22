// @ts-expect-error Generated PTSX module.
import { SharedPeople } from "../.generated/components/SharedPeople.js";
import "../.generated/components/SharedPeople.behavior.js";
import { setupPeopleFrame } from "./people-frame";

setupPeopleFrame(SharedPeople, "query");

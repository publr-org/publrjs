import { invalidate } from "publr/query";

export async function savePerson() {
  const response = await fetch("/learn/query/add", { method: "POST" });
  if (!response.ok) throw new Error("Could not add a person. Try again.");
  const person = await response.json();
  invalidate("people");
  return person;
}

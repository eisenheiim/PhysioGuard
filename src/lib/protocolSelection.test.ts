import { describe, expect, it } from "vitest";
import { CLINICAL_PROTOCOLS } from "../data/protocols";
import { initialProtocolSelectionState, protocolSelectionReducer } from "./protocolSelection";

describe("clinical protocol selection", () => {
  it("contains the two guided clinical protocols", () => {
    expect(CLINICAL_PROTOCOLS.length).toBeGreaterThanOrEqual(2);
    expect(CLINICAL_PROTOCOLS.map((protocol) => protocol.id)).toEqual(expect.arrayContaining(["heel_slides", "shoulder_abduction"]));
  });

  it("requires setup confirmation before starting", () => {
    const selected = protocolSelectionReducer(initialProtocolSelectionState(), {
      type: "SELECT_PROTOCOL",
      protocolId: "shoulder_abduction",
    });
    const blocked = protocolSelectionReducer(selected, { type: "START_EXERCISE" });
    expect(blocked.phase).toBe("SELECTED");
    expect(blocked.error).toMatch(/camera setup/i);
  });

  it("moves through selected, ready, and active phases", () => {
    let state = protocolSelectionReducer(initialProtocolSelectionState(), {
      type: "SELECT_PROTOCOL",
      protocolId: "heel_slides",
    });
    state = protocolSelectionReducer(state, { type: "CONFIRM_CAMERA_SETUP" });
    state = protocolSelectionReducer(state, { type: "START_EXERCISE" });
    expect(state).toMatchObject({ phase: "ACTIVE", setupConfirmed: true });
  });
});

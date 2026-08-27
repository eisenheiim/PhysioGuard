import { CLINICAL_PROTOCOLS, ExerciseProtocol, getClinicalProtocol } from "../data/protocols";

export type ProtocolSelectionPhase = "BROWSING" | "SELECTED" | "READY" | "ACTIVE";

export interface ProtocolSelectionState {
  phase: ProtocolSelectionPhase;
  selectedProtocolId: string | null;
  setupConfirmed: boolean;
  error: string | null;
}

export type ProtocolSelectionEvent =
  | { type: "SELECT_PROTOCOL"; protocolId: string }
  | { type: "CONFIRM_CAMERA_SETUP" }
  | { type: "START_EXERCISE" }
  | { type: "BACK_TO_PROTOCOLS" }
  | { type: "RESET" };

export const initialProtocolSelectionState = (): ProtocolSelectionState => ({
  phase: "BROWSING",
  selectedProtocolId: null,
  setupConfirmed: false,
  error: null,
});

export function getSelectedProtocol(state: ProtocolSelectionState): ExerciseProtocol | undefined {
  return state.selectedProtocolId ? getClinicalProtocol(state.selectedProtocolId) : undefined;
}

/** Pure reducer for React, server state, and deterministic tests. */
export function protocolSelectionReducer(
  state: ProtocolSelectionState,
  event: ProtocolSelectionEvent,
): ProtocolSelectionState {
  switch (event.type) {
    case "SELECT_PROTOCOL":
      return getClinicalProtocol(event.protocolId)
        ? { phase: "SELECTED", selectedProtocolId: event.protocolId, setupConfirmed: false, error: null }
        : { ...state, error: `Unknown clinical protocol: ${event.protocolId}` };
    case "CONFIRM_CAMERA_SETUP":
      if (!getSelectedProtocol(state)) return { ...state, error: "Select an exercise before confirming camera setup." };
      return { ...state, phase: "READY", setupConfirmed: true, error: null };
    case "START_EXERCISE":
      if (!getSelectedProtocol(state)) return { ...state, error: "Select an exercise before starting." };
      if (!state.setupConfirmed) return { ...state, error: "Confirm the required camera setup before starting." };
      return { ...state, phase: "ACTIVE", error: null };
    case "BACK_TO_PROTOCOLS":
      return { phase: "BROWSING", selectedProtocolId: null, setupConfirmed: false, error: null };
    case "RESET":
      return initialProtocolSelectionState();
  }
}

export class ProtocolSelectionEngine {
  private state = initialProtocolSelectionState();

  constructor(private readonly protocols: readonly ExerciseProtocol[] = CLINICAL_PROTOCOLS) {}

  getState(): ProtocolSelectionState {
    return { ...this.state };
  }

  getProtocols(): readonly ExerciseProtocol[] {
    return this.protocols;
  }

  dispatch(event: ProtocolSelectionEvent): ProtocolSelectionState {
    this.state = protocolSelectionReducer(this.state, event);
    return this.getState();
  }

  getSelectedProtocol(): ExerciseProtocol | undefined {
    return getSelectedProtocol(this.state);
  }
}

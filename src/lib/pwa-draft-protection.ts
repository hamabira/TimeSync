import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { normalizeParticipantName } from "./scheduling.ts";

export type PwaDraftState = {
  isDirty: boolean;
  isBusy: boolean;
};

export type PwaDraftProtectionStatus = {
  hasDirtyDraft: boolean;
  hasBusyForm: boolean;
};

export type ResponseDraftSlotSnapshot = {
  date: string;
  startTime: string;
  endTime: string;
};

export function createResponseDraftKey(name: string, slots: ResponseDraftSlotSnapshot[]) {
  const stableSlots = slots
    .map(({ date, startTime, endTime }) => [date, startTime, endTime] as const)
    .sort((left, right) => {
      const leftKey = left.join("\0");
      const rightKey = right.join("\0");
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  return JSON.stringify({ name: normalizeParticipantName(name), slots: stableSlots });
}

export function createEventDraftKey(
  name: string,
  description: string,
  startDate: string | null,
  endDate: string | null
) {
  return JSON.stringify({ name, description, startDate, endDate });
}

const drafts = new Map<symbol, PwaDraftState>();
const listeners = new Set<() => void>();
const CLEAN_STATUS: PwaDraftProtectionStatus = { hasDirtyDraft: false, hasBusyForm: false };
let protectionSnapshot = CLEAN_STATUS;

function notifyDraftChange() {
  let hasDirtyDraft = false;
  let hasBusyForm = false;
  for (const status of drafts.values()) {
    hasDirtyDraft ||= status.isDirty;
    hasBusyForm ||= status.isBusy;
    if (hasDirtyDraft && hasBusyForm) break;
  }
  if (protectionSnapshot.hasDirtyDraft === hasDirtyDraft && protectionSnapshot.hasBusyForm === hasBusyForm) return;
  protectionSnapshot = { hasDirtyDraft, hasBusyForm };
  listeners.forEach((listener) => listener());
}

export function setPwaDraftStatus(owner: symbol, status: PwaDraftState) {
  const previous = drafts.get(owner);
  if (previous?.isDirty === status.isDirty && previous?.isBusy === status.isBusy) return;
  drafts.set(owner, status);
  notifyDraftChange();
}

export function removePwaDraft(owner: symbol) {
  if (!drafts.delete(owner)) return;
  notifyDraftChange();
}

export function getPwaDraftProtectionStatus(): PwaDraftProtectionStatus {
  return protectionSnapshot;
}

export function subscribeToPwaDrafts(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerDraftProtectionStatus() {
  return CLEAN_STATUS;
}

export function usePwaDraft(isDirty: boolean, isBusy: boolean) {
  const [owner] = useState(() => Symbol("pwa-draft"));

  useLayoutEffect(() => {
    setPwaDraftStatus(owner, { isDirty, isBusy });
  }, [owner, isDirty, isBusy]);

  useLayoutEffect(() => () => removePwaDraft(owner), [owner]);
}

export function usePwaDraftProtectionStatus() {
  return useSyncExternalStore(
    subscribeToPwaDrafts,
    getPwaDraftProtectionStatus,
    getServerDraftProtectionStatus
  );
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  createEventDraftKey,
  createResponseDraftKey,
  getPwaDraftProtectionStatus,
  removePwaDraft,
  setPwaDraftStatus,
} from "../src/lib/pwa-draft-protection.ts";

test("response draft keys ignore participant whitespace and slot ordering", () => {
  const first = createResponseDraftKey("  さくら\t  はな  ", [
    { date: "2026-10-14", startTime: "19:00", endTime: "21:00" },
    { date: "2026-10-13", startTime: "18:00", endTime: "20:00" },
  ]);
  const reordered = createResponseDraftKey("さくら はな", [
    { date: "2026-10-13", startTime: "18:00", endTime: "20:00" },
    { date: "2026-10-14", startTime: "19:00", endTime: "21:00" },
  ]);

  assert.equal(first, reordered);
});

test("response keys change when a saved field or slot changes", () => {
  const baseline = createResponseDraftKey("さくら", [
    { date: "2026-10-14", startTime: "19:00", endTime: "21:00" },
  ]);
  assert.notEqual(
    createResponseDraftKey("さくら", [{ date: "2026-10-14", startTime: "20:00", endTime: "21:00" }]),
    baseline
  );
  assert.notEqual(
    createResponseDraftKey("はな", [{ date: "2026-10-14", startTime: "19:00", endTime: "21:00" }]),
    baseline
  );
});

test("event draft keys include name, description, and selected date range", () => {
  const baseline = createEventDraftKey("", "", "2026-10-12", "2026-10-18");
  assert.equal(createEventDraftKey("", "", "2026-10-12", "2026-10-18"), baseline);
  assert.notEqual(createEventDraftKey("", "ゼミ", "2026-10-12", "2026-10-18"), baseline);
  assert.notEqual(createEventDraftKey("", "", "2026-10-13", "2026-10-18"), baseline);
});

test("update protection aggregates dirty and busy state across multiple forms", () => {
  const responseForm = Symbol("response");
  const createForm = Symbol("create");
  try {
    setPwaDraftStatus(responseForm, { isDirty: true, isBusy: false });
    setPwaDraftStatus(createForm, { isDirty: false, isBusy: true });
    assert.deepEqual(getPwaDraftProtectionStatus(), { hasDirtyDraft: true, hasBusyForm: true });

    setPwaDraftStatus(responseForm, { isDirty: false, isBusy: false });
    assert.deepEqual(getPwaDraftProtectionStatus(), { hasDirtyDraft: false, hasBusyForm: true });
  } finally {
    removePwaDraft(responseForm);
    removePwaDraft(createForm);
  }
  assert.deepEqual(getPwaDraftProtectionStatus(), { hasDirtyDraft: false, hasBusyForm: false });
});


test("draft protection snapshots stay stable on no-op changes and preserve older immutable values", () => {
  const owner = Symbol("snapshot");
  const clean = getPwaDraftProtectionStatus();
  try {
    setPwaDraftStatus(owner, { isDirty: false, isBusy: false });
    assert.equal(getPwaDraftProtectionStatus(), clean);
    setPwaDraftStatus(owner, { isDirty: true, isBusy: false });
    const dirty = getPwaDraftProtectionStatus();
    assert.notEqual(dirty, clean);
    assert.equal(clean.hasDirtyDraft, false);
    setPwaDraftStatus(owner, { isDirty: true, isBusy: false });
    assert.equal(getPwaDraftProtectionStatus(), dirty);
  } finally {
    removePwaDraft(owner);
  }
  assert.equal(getPwaDraftProtectionStatus().hasDirtyDraft, false);
});

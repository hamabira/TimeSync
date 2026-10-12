"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowDown, Check, Clock3, Copy, RotateCcw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeBandHeatmap } from "@/components/time-band-heatmap";
import { CalendarAvailabilityHeatmap } from "@/components/calendar-availability-heatmap";
import { dateOnlyToDate, type DateOnly } from "@/lib/date-only";
import {
  buildTimeBandRows,
  buildTopSegments,
  formatHourRange,
  normalizeParticipantName,
  parseTimeRange,
  type ParticipantRecord,
  type TimeBandSegment,
} from "@/lib/scheduling";
import { fixtureEvent, fixtureParticipants } from "../fixtures";
import "./proposal.css";

type Draft = { id: string; date: DateOnly; startTime: string; endTime: string };
type Notice = { type: "success" | "error"; message: string } | null;
export type ProposalProps = {
  layout?: "same-page" | "separate-views";
  tone?: "blue" | "sage";
  scenario?: "populated" | "empty" | "returning" | "error";
};

const demoDates = Array.from({ length: 7 }, (_, index) => `2026-10-${12 + index}`);
const dateLabel = (date: DateOnly) => format(dateOnlyToDate(date), "M/d (E)", { locale: ja });

/** Review-only prototype. Uses local fixture state; never calls Server Actions. */
export function EventExperienceProposal({ layout = "same-page", tone = "blue", scenario = "populated" }: ProposalProps) {
  const prefix = useId();
  const [participants, setParticipants] = useState<ParticipantRecord[]>(scenario === "empty" ? [] : fixtureParticipants);
  const returning = fixtureParticipants.find((participant) => participant.name === "さくら");
  const [name, setName] = useState(scenario === "returning" ? "さくら" : scenario === "error" ? "あお" : "");
  const [drafts, setDrafts] = useState<Draft[]>(scenario === "error" ? [{ id: "error-example", date: "2026-10-14", startTime: "21:00", endTime: "19:00" }] : []);
  const [notice, setNotice] = useState<Notice>(scenario === "error" ? { type: "error", message: "10/14 の終了時刻を確認してください。" } : null);
  const [errors, setErrors] = useState<Record<string, string>>(scenario === "error" ? { "error-example": "終了時刻は開始時刻より後にしてください。" } : {});
  const [view, setView] = useState<"answer" | "results">(scenario === "empty" || scenario === "returning" || scenario === "error" ? "answer" : "results");
  const [selected, setSelected] = useState<TimeBandSegment | null>(null);
  const [copyNotice, setCopyNotice] = useState("");
  const [hasSaved, setHasSaved] = useState(false);
  const rows = useMemo(() => buildTimeBandRows(participants), [participants]);
  const candidates = useMemo(() => buildTopSegments(rows).slice(0, 3), [rows]);
  const existing = participants.find((participant) => participant.name === normalizeParticipantName(name));
  const selectedDates = [...new Set(drafts.map((draft) => draft.date))].sort();
  const best = candidates[0];
  const answerId = `${prefix}-answer`;
  const resultsId = `${prefix}-results`;
  const selectionId = `${prefix}-selected`;

  function showSection(next: "answer" | "results") {
    setView(next);
    if (layout === "same-page") document.getElementById(next === "answer" ? answerId : resultsId)?.scrollIntoView({ behavior: "auto", block: "start" });
  }
  function toggleDate(date: DateOnly) {
    setNotice(null);
    setErrors({});
    setDrafts((previous) => previous.some((draft) => draft.date === date)
      ? previous.filter((draft) => draft.date !== date)
      : [...previous, { id: crypto.randomUUID(), date, startTime: "19:00", endTime: "21:00" }]);
  }
  function loadPrevious() {
    const source = existing ?? returning;
    if (!source) return;
    setDrafts(source.timeSlots.map((slot) => ({ ...slot, id: crypto.randomUUID() })));
    setNotice({ type: "success", message: "前回の回答を読み込みました。変更したい時間帯を直してください。" });
    setErrors({});
    setHasSaved(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSaved(false);
    const normalized = normalizeParticipantName(name);
    const nextErrors = Object.fromEntries(drafts.filter((draft) => !parseTimeRange(draft.startTime, draft.endTime)).map((draft) => [draft.id, "終了時刻は開始時刻より後にしてください。"]));
    setErrors(nextErrors);
    if (!normalized || !drafts.length || Object.keys(nextErrors).length) {
      setNotice({ type: "error", message: !normalized ? "お名前を入力してください。" : !drafts.length ? "空いている日を1日以上選んでください。" : "赤く表示した時間帯を確認してください。" });
      return;
    }
    const record = { id: existing?.id ?? crypto.randomUUID(), name: normalized, timeSlots: drafts.map(({ date, startTime, endTime }) => ({ date, startTime, endTime })) };
    setParticipants((previous) => [...previous.filter((participant) => participant.name !== normalized), record]);
    setSelected(null);
    setHasSaved(true);
    setNotice({ type: "success", message: `${normalized}さんの回答を${existing ? "更新" : "保存"}しました。` });
  }
  function choose(band: TimeBandSegment | null) {
    if (!band) return;
    setSelected(band);
    setCopyNotice("");
    document.getElementById(selectionId)?.scrollIntoView({ behavior: "auto", block: "center" });
  }

  const candidateList = (
    <div className="proposal-candidates">
      {candidates.map((candidate, index) => (
        <button className="proposal-candidate" type="button" key={`${candidate.date}-${candidate.startHour}`} onClick={() => { choose(candidate); showSection("results"); }} aria-pressed={selected?.date === candidate.date && selected?.startHour === candidate.startHour}>
          <span className="proposal-kicker">第{index + 1}候補</span>
          <span className="proposal-candidate-line"><strong>{dateLabel(candidate.date)}</strong><span>{candidate.count}/{participants.length}人</span></span>
          <span className="proposal-candidate-line"><span>{formatHourRange(candidate.startHour, candidate.endHour)}</span><Clock3 size={16} aria-hidden="true" /></span>
        </button>
      ))}
    </div>
  );
  const form = (
    <section className="proposal-panel proposal-form" id={answerId} aria-labelledby={`${prefix}-answer-heading`}>
      <div className="proposal-section-heading"><div><span className="proposal-kicker">あなたの回答</span><h2 id={`${prefix}-answer-heading`}>空いている時間を教えてください</h2></div></div>
      <form onSubmit={submit} noValidate>
        <div className="proposal-field">
          <label htmlFor={`${prefix}-name`}>お名前 <span className="proposal-required">必須</span></label>
          <input id={`${prefix}-name`} value={name} maxLength={20} placeholder="グループで分かる名前" onChange={(event) => { setName(event.target.value); setNotice(null); }} aria-describedby={`${prefix}-name-hint`} aria-invalid={notice?.type === "error" && !normalizeParticipantName(name)} />
          <p id={`${prefix}-name-hint`} className="proposal-helper">同じ名前で送ると、前回の回答が置き換わります。</p>
        </div>
        {existing ? <div className="proposal-returning"><div><strong>この名前の回答があります</strong><p>前回の内容を読み込み、一部だけ変更できます。現在の入力は置き換わります。</p></div><Button type="button" variant="outline" className="h-11" onClick={loadPrevious}><RotateCcw aria-hidden="true" />前回の回答を読み込む</Button></div> : null}
        <fieldset className="proposal-dates"><legend>空いている日 <span className="proposal-required">複数選択可</span></legend><div className="proposal-date-grid">{demoDates.map((date) => <button type="button" key={date} aria-pressed={selectedDates.includes(date)} onClick={() => toggleDate(date)}><span>{format(dateOnlyToDate(date), "E", { locale: ja })}</span><strong>{date.slice(-2)}</strong></button>)}</div></fieldset>
        <p className="proposal-helper">1時間単位で集計します。終了の00:00は、その日の24:00です。</p>
        {selectedDates.length === 0 ? <p className="proposal-empty">上の日付を選ぶと、時間帯を入力できます。</p> : <div className="proposal-draft-list">{selectedDates.map((date) => <fieldset key={date} className="proposal-day"><legend>{dateLabel(date)}</legend>{drafts.filter((draft) => draft.date === date).map((draft, index) => <div key={draft.id} className="proposal-time-row"><div className="proposal-time-fields"><label><span>開始</span><input type="time" value={draft.startTime} aria-label={`${dateLabel(date)} 時間帯${index + 1} 開始時刻`} aria-invalid={Boolean(errors[draft.id])} aria-describedby={errors[draft.id] ? `${prefix}-${draft.id}-error` : undefined} onChange={(event) => { setDrafts((previous) => previous.map((item) => item.id === draft.id ? { ...item, startTime: event.target.value } : item)); setErrors({}); setNotice(null); }} /></label><span aria-hidden="true" className="proposal-time-separator">〜</span><label><span>終了</span><input type="time" value={draft.endTime} aria-label={`${dateLabel(date)} 時間帯${index + 1} 終了時刻`} aria-invalid={Boolean(errors[draft.id])} aria-describedby={errors[draft.id] ? `${prefix}-${draft.id}-error` : undefined} onChange={(event) => { setDrafts((previous) => previous.map((item) => item.id === draft.id ? { ...item, endTime: event.target.value } : item)); setErrors({}); setNotice(null); }} /></label><Button type="button" variant="ghost" size="icon" className="h-11 w-11 self-end" aria-label={`${dateLabel(date)} ${draft.startTime}から${draft.endTime}の時間帯を削除`} onClick={() => { setDrafts((previous) => previous.filter((item) => item.id !== draft.id)); setNotice(null); setErrors({}); }}><Trash2 aria-hidden="true" /></Button></div>{errors[draft.id] ? <p className="proposal-error-text" id={`${prefix}-${draft.id}-error`}>{errors[draft.id]}</p> : null}</div>)}<Button type="button" variant="ghost" className="h-11 proposal-add" onClick={() => setDrafts((previous) => [...previous, { id: crypto.randomUUID(), date, startTime: "19:00", endTime: "21:00" }])}>＋ この日に時間帯を追加</Button></fieldset>)}</div>}
        <div className="proposal-submit-area">
          <div aria-live="polite">{notice ? <div className={`proposal-notice ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.type === "success" ? <Check size={18} aria-hidden="true" /> : null}<span>{notice.message}</span></div> : null}</div>
          <Button type="submit" className="proposal-primary h-12 w-full">{existing ? "この内容で回答を更新する" : "この内容で回答する"}</Button>
          {hasSaved && notice?.type === "success" ? <Button type="button" variant="ghost" className="h-11 w-full" onClick={() => showSection("results")}>更新された結果を見る <ArrowDown aria-hidden="true" /></Button> : null}
          <p className="proposal-helper">お名前と空き時間は、このイベントURLを知る人に表示されます。</p>
          <p className="proposal-helper"><a href="/terms" onClick={(event) => event.preventDefault()}>利用規約</a>・<a href="/privacy" onClick={(event) => event.preventDefault()}>プライバシーポリシー</a></p>
        </div>
      </form>
    </section>
  );
  const result = (
    <section className="proposal-panel proposal-results" id={resultsId} aria-labelledby={`${prefix}-results-heading`}>
      <div className="proposal-section-heading"><div><span className="proposal-kicker">みんなの結果</span><h2 id={`${prefix}-results-heading`}>空き時間の重なり</h2></div><span className="proposal-count"><Users size={16} aria-hidden="true" />{participants.length}人が回答</span></div>
      {layout === "separate-views" && candidates.length > 0 ? candidateList : null}
      <div className="proposal-selection" id={selectionId} aria-live="polite">{selected ? <><div className="proposal-selection-heading"><div><span className="proposal-kicker">選択した時間帯</span><h3>{dateLabel(selected.date)} · {formatHourRange(selected.startHour, selected.endHour)}</h3></div><strong>{selected.count}/{participants.length}人</strong></div><p>{selected.attendeeNames.join("、")} が参加できます</p><div className="proposal-inline-actions"><Button type="button" variant="outline" className="h-11" onClick={() => setCopyNotice("候補文のコピーをプレビューしました。")}><Copy aria-hidden="true" />候補文をコピー</Button><Button type="button" variant="ghost" className="h-11" onClick={() => { setSelected(null); setCopyNotice(""); }}>選択を解除</Button></div>{copyNotice ? <p role="status" className="proposal-helper">{copyNotice}</p> : null}</> : <p className="proposal-helper">帯を選ぶと、ここで参加者を確認できます。</p>}</div>
      {participants.length === 0 ? <div className="proposal-empty"><strong>まだ回答がありません</strong><p>最初の回答が届くと、集まりやすい時間が表示されます。</p><Button type="button" className="proposal-primary h-11" onClick={() => showSection("answer")}>最初の回答をする</Button></div> : <TimeBandHeatmap rows={rows} participantCount={participants.length} highlightedKey={null} selectedBand={selected} onSelectBand={choose} />}
      <details className="proposal-calendar-view"><summary>カレンダーで日付ごとの重なりを見る</summary><CalendarAvailabilityHeatmap startDate={fixtureEvent.startDate} endDate={fixtureEvent.endDate} rows={rows} participantCount={participants.length} selectedBand={selected} onSelectBand={choose} /></details>
    </section>
  );

  return (
    <div className="proposal" data-tone={tone}>
      <header className="proposal-app-bar"><span className="proposal-logo">AkiMatch</span><span className="proposal-helper">空き時間から、予定を決める</span></header>
      <main className="proposal-main">
        <header className="proposal-event-heading"><div><p className="proposal-kicker">日程調整</p><h1>{fixtureEvent.name}</h1><p className="proposal-meta">10/12 (月) 〜 10/18 (日) · {participants.length}人が回答</p><p className="proposal-helper">{fixtureEvent.description}</p></div><Button type="button" variant="outline" className="h-11" onClick={() => setCopyNotice("共有URLのコピーをプレビューしました。")}>共有URL <Copy aria-hidden="true" /></Button></header>
        {copyNotice && !selected ? <p role="status" className="proposal-helper">{copyNotice}</p> : null}
        {layout === "same-page" && best ? <div className="proposal-best"><div><span className="proposal-kicker">いちばん集まりやすい時間</span><strong>{dateLabel(best.date)} · {formatHourRange(best.startHour, best.endHour)}</strong><span>{best.count}/{participants.length}人が参加可能</span></div><Button type="button" variant="outline" className="h-11" onClick={() => { choose(best); showSection("results"); }}>結果を見る <ArrowDown aria-hidden="true" /></Button></div> : null}
        <nav className={`proposal-view-switch ${layout === "separate-views" ? "proposal-tabs" : "proposal-anchors"}`} aria-label="回答と結果"><Button type="button" variant="ghost" className="h-12" aria-pressed={view === "answer"} onClick={() => showSection("answer")}>あなたの回答</Button><Button type="button" variant="ghost" className="h-12" aria-pressed={view === "results"} onClick={() => showSection("results")}>みんなの結果 <span>{participants.length}</span></Button></nav>
        {layout === "same-page" ? <><div className="proposal-existing-grid">{form}<aside className="proposal-panel proposal-shortlist"><span className="proposal-kicker">上位3件</span><h2>集まりやすい候補</h2>{candidates.length ? candidateList : <p className="proposal-helper">回答が届くと候補が表示されます。</p>}<Button type="button" variant="ghost" className="h-11" onClick={() => showSection("results")}>すべての空き時間を見る <ArrowDown aria-hidden="true" /></Button></aside></div>{result}</> : view === "answer" ? form : result}
      </main>
      <footer className="proposal-footer">AkiMatch · このイベントはURLを知る人が閲覧・回答できます</footer>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { BackButton } from "@/components/back-button";

export const metadata: Metadata = {
  title: "利用規約 | AkiMatch",
  description: "AkiMatch の利用条件、禁止事項、免責事項について説明します。",
};

const sections = [
  {
    title: "第1条（適用）",
    body: [
      "この利用規約は、AkiMatch（以下「本サービス」といいます）の利用条件を定めるものです。本サービスを利用する方は、本規約に同意したものとみなします。",
    ],
  },
  {
    title: "第2条（サービスの内容）",
    body: [
      "本サービスは、イベントの作成、共有 URL によるイベント閲覧、参加者による空き時間の回答、回答結果の集計を行う日程調整サービスです。",
      "本サービスは無料の MVP として提供されており、機能や提供内容は予告なく変更、停止、終了される場合があります。",
    ],
  },
  {
    title: "第3条（共有 URL と公開範囲）",
    body: [
      "イベント URL を知っている人は、認証なしでイベント内容、参加者名、回答された空き時間、集計結果を閲覧できます。",
      "イベント URL の共有範囲は、利用者自身の責任で管理してください。本名や公開したくない情報の入力は避け、必要に応じてニックネームを利用してください。",
    ],
  },
  {
    title: "第4条（回答の上書き）",
    body: [
      "同じイベント内で同じ名前が再度回答された場合、前回の回答は新しい回答で上書きされます。",
      "認証を行わないサービス仕様のため、名前だけで本人確認を行うものではありません。",
    ],
  },
  {
    title: "第5条（禁止事項）",
    body: [
      "利用者は、本サービスの利用にあたり、不正アクセス、過度な負荷をかける行為、第三者の権利を侵害する行為、虚偽または不適切な内容の投稿、迷惑行為、法令または公序良俗に反する行為を行ってはなりません。",
    ],
  },
  {
    title: "第6条（データの管理）",
    body: [
      "本サービスでは、イベントや回答の保存に合理的な注意を払いますが、データの永続的な保存を保証するものではありません。",
      "誤って入力した情報や削除が必要な情報がある場合の問い合わせ窓口は、現在準備中です。",
    ],
  },
  {
    title: "第7条（免責事項）",
    body: [
      "本サービスの利用により発生した予定調整上のトラブル、共有 URL の管理不備、入力内容の誤り、データの消失、サービス停止その他の損害について、運営者は法令上認められる範囲で責任を負いません。",
    ],
  },
  {
    title: "第8条（規約の変更）",
    body: [
      "運営者は、必要に応じて本規約を変更できます。変更後の規約は、本サービス上に掲載された時点で効力を生じます。",
    ],
  },
  {
    title: "第9条（お問い合わせ）",
    body: [
      "本サービスに関するお問い合わせ先は準備中です。正式な問い合わせ窓口を設置した場合、本ページまたは本サービス上で案内します。",
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 py-8">
      <BackButton />
      <header className="space-y-3">
        <p className="text-sm font-semibold text-blue-700">AkiMatch</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">利用規約</h1>
        <p className="text-sm text-slate-500">最終更新日: 2026年5月9日</p>
        <p className="leading-7 text-slate-600">
          このページでは、AkiMatch を利用するうえでの基本的なルールを定めています。
          個人情報の取り扱いについては{" "}
          <Link className="font-semibold text-blue-700 underline-offset-4 hover:underline" href="/privacy">
            プライバシーポリシー
          </Link>
          を確認してください。
        </p>
      </header>

      <div className="space-y-7 rounded-xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="leading-7 text-slate-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

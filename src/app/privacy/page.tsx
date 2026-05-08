import type { Metadata } from "next";
import Link from "next/link";

import { BackButton } from "@/components/back-button";

export const metadata: Metadata = {
  title: "プライバシーポリシー | AkiMatch",
  description: "AkiMatch における取得情報、利用目的、共有範囲について説明します。",
};

const sections = [
  {
    title: "1. 取得する情報",
    body: [
      "本サービスでは、イベント名、メモ・詳細、対象期間、参加者名、回答された空き時間、イベント作成日時など、日程調整機能の提供に必要な情報を取得します。",
      "また、不正利用対策、障害調査、サービス改善のため、アクセス日時、IP アドレス、ブラウザ情報などの技術的なログを取得する場合があります。",
    ],
  },
  {
    title: "2. 利用目的",
    body: [
      "取得した情報は、イベントの表示、回答の保存、候補時間の集計、共有 URL による閲覧、サービスの安定運用、不正利用対策、問い合わせ対応、サービス改善のために利用します。",
    ],
  },
  {
    title: "3. 共有範囲",
    body: [
      "イベント URL を知っている人は、認証なしでイベント内容、参加者名、回答された空き時間、集計結果を閲覧できます。",
      "公開したくない名前や個人情報は入力せず、必要に応じてニックネームを利用してください。",
    ],
  },
  {
    title: "4. 第三者提供",
    body: [
      "法令に基づく場合、本人の同意がある場合、またはサービス運営上必要な委託先に必要な範囲で取り扱いを委託する場合を除き、取得した情報を第三者に提供しません。",
    ],
  },
  {
    title: "5. 外部サービス・インフラ",
    body: [
      "本サービスは、ホスティング、データ保存、配信、ログ管理などのために Cloudflare などの外部サービスを利用する場合があります。",
      "これらのサービスでは、各提供事業者の規約やプライバシーポリシーに従って情報が取り扱われます。",
    ],
  },
  {
    title: "6. 保存期間と削除",
    body: [
      "本サービスでは、正式な自動削除機能はまだ提供していません。サービス運営上不要になった情報は、必要に応じて削除または整理する場合があります。",
      "削除依頼や問い合わせの窓口は現在準備中です。正式な問い合わせ窓口を設置した場合、本ページまたは本サービス上で案内します。",
    ],
  },
  {
    title: "7. 安全管理",
    body: [
      "本サービスでは、取得した情報の漏えい、滅失、毀損を防ぐため、合理的な範囲で安全管理措置を講じます。ただし、インターネット上のサービスである性質上、完全な安全性を保証するものではありません。",
    ],
  },
  {
    title: "8. ポリシーの変更",
    body: [
      "運営者は、必要に応じて本ポリシーを変更できます。変更後のポリシーは、本サービス上に掲載された時点で効力を生じます。",
    ],
  },
  {
    title: "9. お問い合わせ",
    body: [
      "本サービスに関するお問い合わせ先は準備中です。正式な問い合わせ窓口を設置した場合、本ページまたは本サービス上で案内します。",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 py-8">
      <BackButton />
      <header className="space-y-3">
        <p className="text-sm font-semibold text-blue-700">AkiMatch</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">プライバシーポリシー</h1>
        <p className="text-sm text-slate-500">最終更新日: 2026年5月9日</p>
        <p className="leading-7 text-slate-600">
          このページでは、AkiMatch における情報の取り扱いを説明します。
          サービスの利用条件については{" "}
          <Link className="font-semibold text-blue-700 underline-offset-4 hover:underline" href="/terms">
            利用規約
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

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, Clock, Users } from "lucide-react";

export default function Home() {
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [dates, setDates] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || !dates) return;
    // TODO: Supabase連携時に実装
    console.log({ eventName, description, dates });
    alert("イベント作成（モック）\n" + eventName + "\n" + dates);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-8">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
          みんなの予定を、もっと<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">美しく</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          TimeSyncは、圧倒的に見やすく使いやすい日程調整アプリです。
          ログイン不要、スマホでもサクサク動くモダンなUIで、煩わしいスケジュール調整を快適にします。
        </p>
      </section>

      {/* Features */}
      <section className="grid sm:grid-cols-3 gap-6 text-center">
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 flex flex-col items-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
            <CalendarDays size={24} />
          </div>
          <h3 className="font-semibold text-slate-900">直感的な入力</h3>
          <p className="text-sm text-slate-500 mt-1">候補日をテキストでサクッと入力。コピペにも対応。</p>
        </div>
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 flex flex-col items-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
            <Clock size={24} />
          </div>
          <h3 className="font-semibold text-slate-900">爆速作成</h3>
          <p className="text-sm text-slate-500 mt-1">会員登録は一切不要。思い立ったらすぐイベントを作れます。</p>
        </div>
        <div className="p-4 rounded-2xl bg-white shadow-sm border border-slate-100 flex flex-col items-center hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-3">
            <Users size={24} />
          </div>
          <h3 className="font-semibold text-slate-900">見やすい結果</h3>
          <p className="text-sm text-slate-500 mt-1">スマホでも崩れない美しい表で、最適な日が一目で分かります。</p>
        </div>
      </section>

      {/* Creation Form */}
      <Card className="shadow-lg border-0 ring-1 ring-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-6">
          <CardTitle className="text-2xl font-bold text-slate-800">新しくイベントを作る</CardTitle>
          <CardDescription className="text-base text-slate-500">
            イベント名と候補日程を入力して、「作成する」ボタンを押してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="eventName" className="text-base font-semibold text-slate-700">
                イベント名 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="eventName"
                placeholder="例: プロジェクトキックオフ、週末の飲み会"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                className="h-12 text-base transition-shadow focus-visible:ring-blue-500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold text-slate-700">
                メモ・詳細（任意）
              </Label>
              <Textarea
                id="description"
                placeholder="例: 場所は新宿周辺を予定しています。"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none h-24 transition-shadow focus-visible:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label htmlFor="dates" className="text-base font-semibold text-slate-700">
                  候補日程 <span className="text-red-500">*</span>
                </Label>
                <span className="text-xs text-slate-400 font-medium">改行で複数の日程を区切ります</span>
              </div>
              <Textarea
                id="dates"
                placeholder={"5/1(月) 19:00〜\n5/2(火) 19:00〜\n5/3(水) 19:00〜"}
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                required
                className="h-48 font-mono text-sm leading-relaxed transition-shadow focus-visible:ring-blue-500 p-4 bg-slate-50"
              />
              <p className="text-sm text-slate-500">
                テキストを貼り付けるだけで、自動で候補日が作成されます。
              </p>
            </div>
          </form>
        </CardContent>
        <CardFooter className="bg-slate-50/50 border-t border-slate-100 p-6 sm:p-8">
          <Button 
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={!eventName || !dates}
          >
            イベントを作成する
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

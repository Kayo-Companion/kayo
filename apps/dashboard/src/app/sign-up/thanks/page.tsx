import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

export default function ThanksPage() {
  return (
    <main className="min-h-screen bg-cream py-20">
      <div className="mx-auto max-w-xl px-4 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-coral to-warm-orange shadow-lg shadow-coral/40">
          <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown sm:text-4xl">
          ありがとうございます。
        </h1>
        <p className="mt-3 text-warm-brown/75">
          ご登録内容を承りました。Stripeの決済画面へお進みください。
        </p>

        <GlassCard className="mt-8 p-6 text-left">
          <h2 className="mb-2 font-serif text-lg font-medium text-warm-brown">
            次にすること
          </h2>
          <ol className="space-y-2 text-sm text-warm-brown/80">
            <li>1. メールに届く決済リンクから、お支払い情報を登録</li>
            <li>2. 翌日から、ご指定の時刻にカヨからお電話がはじまります</li>
            <li>3. ダッシュボードで通話履歴・要約をご確認いただけます</li>
          </ol>
        </GlassCard>

        <Link href="/" className="mt-8 inline-block">
          <Button variant="secondary">トップへ戻る</Button>
        </Link>
      </div>
    </main>
  );
}

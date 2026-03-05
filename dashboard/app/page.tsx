import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';

const tickerItems = ['npm install autotracesdk', '<100ms ingestion latency', '99.9% uptime SLA', 'MIT license', 'zero configuration', 'automatic anomaly detection', '30-day data retention', 'self-hostable', 'typescript native', 'express.js middleware', 'open source', 'persistent event queue',];

export default function LandingPage() {
  return (
    <div>
      <Hero />
      <div className="bg-[#0a0a0a]">
        <div
          className="border-t border-white/[0.06] py-3 overflow-hidden"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',}}>
          <div className="animate-marquee flex whitespace-nowrap">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex items-center flex-shrink-0">
                {tickerItems.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2.5 px-6 text-xs">
                    <span className="w-1 h-1 rounded-full bg-amber-500/50 flex-shrink-0" />
                    <span className="text-zinc-500 font-mono tracking-wide">{item}</span>
                  </span>))}
              </div>))}
          </div>
        </div>
      </div>

      <div className="h-28 bg-gradient-to-b from-[#0a0a0a] to-white" />
      <Features />
      <HowItWorks />

      <div className="h-24 bg-gradient-to-b from-zinc-50 to-zinc-900" />

      <CTA />
      <Footer />
    </div>
  );
}

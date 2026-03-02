import Link from 'next/link';

export default function Services() {
  return (
    <div className="flex flex-col w-full">
      {/* Intro */}
      <section className="px-6 pt-32 pb-24 max-w-[1200px] mx-auto w-full">
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight mb-8">Services</h1>
        <p className="text-xl md:text-2xl text-[#707070] leading-relaxed max-w-[800px]">
          We focus on small-team efficiency, not enterprise complexity. Everything we do is designed to get your product to market faster, with a stronger foundation.
        </p>
      </section>

      {/* Service Blocks */}
      <section className="px-6 py-24 border-t border-[#F5F5F5] bg-[#F9F9F9]">
        <div className="max-w-[1200px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="p-10 bg-white rounded-[32px] border border-[#E5E5E5] flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] mb-8 flex items-center justify-center">
              {/* Icon Placeholder */}
              <div className="w-6 h-6 bg-[#E5E5E5] rounded-sm" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Software Development</h2>
            <ul className="space-y-4 text-[#707070] mt-auto">
              <li>Marketing websites that convert.</li>
              <li>Web applications built with modern stacks.</li>
              <li>Full native mobile apps (iOS & Android).</li>
              <li>Scalable Product UI systems.</li>
            </ul>
          </div>

          <div className="p-10 bg-white rounded-[32px] border border-[#E5E5E5] flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] mb-8 flex items-center justify-center">
              {/* Icon Placeholder */}
              <div className="w-6 h-6 rounded-full bg-[#E5E5E5]" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Logo & Branding Design</h2>
            <ul className="space-y-4 text-[#707070] mt-auto">
              <li>Logo creation that stands the test of time.</li>
              <li>Identity systems that work across all touchpoints.</li>
              <li>Brand kits for internal teams.</li>
              <li>Launch assets for social and web.</li>
            </ul>
          </div>

          <div className="p-10 bg-white rounded-[32px] border border-[#E5E5E5] flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] mb-8 flex items-center justify-center">
              {/* Icon Placeholder */}
              <div className="w-6 h-6 border-2 border-[#E5E5E5] rounded-md" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Custom Visual Systems</h2>
            <ul className="space-y-4 text-[#707070] mt-auto">
              <li>UI visuals that feel premium.</li>
              <li>Product graphics and iconography.</li>
              <li>Visual direction for new ventures.</li>
              <li>Cohesive design languages for complex tools.</li>
            </ul>
          </div>

          <div className="p-10 bg-white rounded-[32px] border border-[#E5E5E5] flex flex-col h-full">
            <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] mb-8 flex items-center justify-center">
              {/* Icon Placeholder */}
              <div className="w-6 h-6 bg-[#E5E5E5] rounded-lg rotate-45" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">Practical AI Automations</h2>
            <ul className="space-y-4 text-[#707070] mt-auto">
              <li>Content workflows that save hours of manual work.</li>
              <li>Internal tools that connect your existing data.</li>
              <li>Automated publishing systems.</li>
            </ul>
          </div>

        </div>
      </section>

      {/* Engagement Models */}
      <section className="px-6 py-32 border-t border-[#F5F5F5]">
        <div className="max-w-[1200px] mx-auto w-full">
          <h2 className="text-3xl font-semibold tracking-tight mb-16">Engagement Models</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col border-t border-[#000000] pt-6">
              <h3 className="text-xl font-semibold mb-4">Project Sprint</h3>
              <p className="text-[#707070]">Fixed scope, high speed. Ideal for specific deliverables like a brand identity or a marketing site.</p>
            </div>
            <div className="flex flex-col border-t border-[#000000] pt-6">
              <h3 className="text-xl font-semibold mb-4">Build + Launch</h3>
              <p className="text-[#707070]">End-to-end product development. From initial concept to the final shipped application.</p>
            </div>
            <div className="flex flex-col border-t border-[#000000] pt-6">
              <h3 className="text-xl font-semibold mb-4">Ongoing Support</h3>
              <p className="text-[#707070]">Retained design and engineering to keep your product evolvable and maintained over time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Scenarios */}
      <section className="px-6 py-32 border-t border-[#F5F5F5] bg-[#000000] text-white overflow-hidden">
        <div className="max-w-[1200px] mx-auto w-full">
          <h2 className="text-3xl font-semibold tracking-tight mb-16">Example Scenarios</h2>
          <div className="flex overflow-x-auto pb-8 gap-6 snap-x snap-mandatory hide-scrollbar">
            
            <div className="min-w-[300px] md:min-w-[400px] p-8 rounded-2xl bg-[#111111] border border-[#222222] snap-start">
              <div className="text-sm font-medium text-[#888888] mb-4">Scenario 01</div>
              <h3 className="text-xl font-semibold mb-4">The Founder</h3>
              <p className="text-[#AAAAAA]">Needs a brand identity and a V1 mobile app to raise their first round.</p>
            </div>

            <div className="min-w-[300px] md:min-w-[400px] p-8 rounded-2xl bg-[#111111] border border-[#222222] snap-start">
              <div className="text-sm font-medium text-[#888888] mb-4">Scenario 02</div>
              <h3 className="text-xl font-semibold mb-4">The Scaling Team</h3>
              <p className="text-[#AAAAAA]">Needs to automate their content pipeline with a custom internal tool.</p>
            </div>

            <div className="min-w-[300px] md:min-w-[400px] p-8 rounded-2xl bg-[#111111] border border-[#222222] snap-start">
              <div className="text-sm font-medium text-[#888888] mb-4">Scenario 03</div>
              <h3 className="text-xl font-semibold mb-4">The Established Product</h3>
              <p className="text-[#AAAAAA]">Needs a complete UI system overhaul to improve user retention.</p>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-32 border-t border-[#F5F5F5]">
        <div className="max-w-[800px] mx-auto w-full">
          <h2 className="text-3xl font-semibold tracking-tight mb-16">Frequently Asked Questions</h2>
          <div className="space-y-8">
            
            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">What is your typical timeline?</h3>
              <p className="text-[#707070]">Most projects take 6–12 weeks from kickoff to launch.</p>
            </div>

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">Do you work with early-stage startups?</h3>
              <p className="text-[#707070]">Yes, we specialize in helping founders find their structure.</p>
            </div>

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">What is a "Practical AI Automation"?</h3>
              <p className="text-[#707070]">It’s a custom tool that handles repetitive tasks using LLMs, built specifically for your team's workflow.</p>
            </div>

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">Do you offer ongoing maintenance?</h3>
              <p className="text-[#707070]">Yes, for products we build, we offer support packages to ensure they stay evolvable.</p>
            </div>

            <div className="border-b border-[#F5F5F5] pb-8">
              <h3 className="text-lg font-semibold mb-4">How do we start?</h3>
              <p className="text-[#707070]">We begin with a 30-minute fit call to see if our principles align with your goals.</p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-32 border-t border-[#F5F5F5] bg-[#F9F9F9] text-center">
        <h2 className="text-4xl font-semibold tracking-tight mb-10">Ready to start?</h2>
        <Link href="/contact" className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform">
          Let’s Build Something Real
        </Link>
      </section>
    </div>
  );
}

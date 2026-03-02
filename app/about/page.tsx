import Link from 'next/link';

export default function About() {
  return (
    <div className="flex flex-col w-full">
      {/* Intro */}
      <section className="px-8 md:px-16 pt-32 pb-24 max-w-[1200px] mx-auto w-full">
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight mb-8">About Dreamable.studio</h1>
        <p className="text-xl md:text-2xl text-[#707070] leading-relaxed max-w-[800px]">
          We are a small, focused team of designers and engineers who believe that digital products should be as beautiful as they are functional. We don't do "digital transformation." We build software that works and brands that matter.
        </p>
      </section>

      {/* Principles Grid */}
      <section className="px-6 py-24 border-t border-[#F5F5F5] bg-[#F9F9F9]">
        <div className="max-w-[1200px] mx-auto w-full">
          <h2 className="text-3xl font-semibold tracking-tight mb-16">The Principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-8 bg-white rounded-2xl border border-[#E5E5E5]">
              <h3 className="text-xl font-semibold mb-3">Dreamable</h3>
              <p className="text-[#707070]">We define the vision.</p>
            </div>
            <div className="p-8 bg-white rounded-2xl border border-[#E5E5E5]">
              <h3 className="text-xl font-semibold mb-3">Buildable</h3>
              <p className="text-[#707070]">We respect the constraints.</p>
            </div>
            <div className="p-8 bg-white rounded-2xl border border-[#E5E5E5]">
              <h3 className="text-xl font-semibold mb-3">Launchable</h3>
              <p className="text-[#707070]">We cross the finish line.</p>
            </div>
            <div className="p-8 bg-white rounded-2xl border border-[#E5E5E5]">
              <h3 className="text-xl font-semibold mb-3">Memorable</h3>
              <p className="text-[#707070]">We design for impact.</p>
            </div>
            <div className="p-8 bg-white rounded-2xl border border-[#E5E5E5]">
              <h3 className="text-xl font-semibold mb-3">Evolvable</h3>
              <p className="text-[#707070]">We build for the future.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="px-6 py-32 border-t border-[#F5F5F5]">
        <div className="max-w-[1200px] mx-auto w-full flex flex-col lg:flex-row gap-16 lg:gap-24">
          <div className="w-full lg:w-1/2">
            <h2 className="text-3xl font-semibold tracking-tight mb-12">How We Work</h2>
            <div className="space-y-12">
              <div className="flex gap-6">
                <div className="text-sm font-medium text-[#707070] pt-1">01</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Definition</h3>
                  <p className="text-[#707070]">We strip the idea to its core logic.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-sm font-medium text-[#707070] pt-1">02</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Architecture</h3>
                  <p className="text-[#707070]">We map the system before we push pixels.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-sm font-medium text-[#707070] pt-1">03</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Creation</h3>
                  <p className="text-[#707070]">Design and development happen in parallel.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-sm font-medium text-[#707070] pt-1">04</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Refinement</h3>
                  <p className="text-[#707070]">We polish the friction points until they disappear.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-sm font-medium text-[#707070] pt-1">05</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Handover</h3>
                  <p className="text-[#707070]">We ship and set you up for the next phase.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2">
            <h2 className="text-3xl font-semibold tracking-tight mb-12">What You Can Expect</h2>
            <ul className="space-y-6 text-lg text-[#707070]">
              <li className="flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#000000] mt-2.5 shrink-0" />
                <span>Direct communication with the people doing the work.</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#000000] mt-2.5 shrink-0" />
                <span>Weekly progress that you can actually click and test.</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#000000] mt-2.5 shrink-0" />
                <span>Zero fluff. No unnecessary meetings.</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#000000] mt-2.5 shrink-0" />
                <span>A product that is ready for scale on day one.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Founder Note */}
      <section className="px-6 py-24 border-t border-[#F5F5F5]">
        <div className="max-w-[800px] mx-auto w-full">
          <div className="p-10 md:p-16 bg-[#F9F9F9] rounded-[32px] border border-[#E5E5E5]">
            <p className="text-xl md:text-2xl leading-relaxed font-medium mb-8">
              "I started Dreamable because I saw too many great ideas get lost in the gap between design and development. We exist to close that gap. We’re not here to be your 'agency.' We’re here to be the studio that finally gets your product out the door."
            </p>
            <div className="text-[#707070] font-medium">
              — Founder, Dreamable.studio
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-32 border-t border-[#F5F5F5] text-center">
        <h2 className="text-4xl font-semibold tracking-tight mb-10">Ready to start?</h2>
        <Link href="/contact" className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform">
          Let’s Build Something Real
        </Link>
      </section>
    </div>
  );
}

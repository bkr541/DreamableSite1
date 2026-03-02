'use client';

export default function Contact() {
  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-80px)]">
      <section className="flex-1 flex flex-col lg:flex-row max-w-[1200px] mx-auto w-full">
        
        {/* Left Side */}
        <div className="w-full lg:w-1/2 px-6 py-24 lg:py-32 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-[#F5F5F5]">
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight mb-8">Start Something Real.</h1>
          <p className="text-xl text-[#707070] leading-relaxed max-w-[480px]">
            We’re ready when you are. Tell us a little about what you’re building, and we’ll get back to you within 24 hours.
          </p>
        </div>

        {/* Right Side (Form) */}
        <div className="w-full lg:w-1/2 px-6 py-24 lg:py-32 flex flex-col justify-center bg-[#F9F9F9] lg:bg-transparent">
          <form className="w-full max-w-[480px] mx-auto lg:mx-0 space-y-10" onSubmit={(e) => e.preventDefault()}>
            
            <div className="flex flex-col">
              <label htmlFor="name" className="text-sm font-medium text-[#707070] mb-2">Name</label>
              <input 
                type="text" 
                id="name" 
                className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors"
                placeholder="Jane Doe"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="email" className="text-sm font-medium text-[#707070] mb-2">Email</label>
              <input 
                type="email" 
                id="email" 
                className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors"
                placeholder="jane@example.com"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="company" className="text-sm font-medium text-[#707070] mb-2">Company</label>
              <input 
                type="text" 
                id="company" 
                className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors"
                placeholder="Acme Corp"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="building" className="text-sm font-medium text-[#707070] mb-2">What are you building?</label>
              <textarea 
                id="building" 
                rows={3}
                className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#000000] transition-colors resize-none"
                placeholder="Tell us about your project..."
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="timeline" className="text-sm font-medium text-[#707070] mb-2">Timeline</label>
              <select 
                id="timeline" 
                className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] focus:outline-none focus:border-[#000000] transition-colors appearance-none cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>Select a timeline</option>
                <option value="asap">ASAP</option>
                <option value="1-3">1-3 Months</option>
                <option value="3-6">3-6 Months</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="budget" className="text-sm font-medium text-[#707070] mb-2">Budget range</label>
              <select 
                id="budget" 
                className="w-full bg-transparent border-b border-[#E5E5E5] py-3 text-[#000000] focus:outline-none focus:border-[#000000] transition-colors appearance-none cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>Select a budget</option>
                <option value="under-25k">Under $25k</option>
                <option value="25k-50k">$25k - $50k</option>
                <option value="50k-plus">$50k+</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="w-full h-14 rounded-full bg-[#000000] text-white text-base font-medium hover:-translate-y-1 transition-transform mt-4"
            >
              Send Inquiry
            </button>

          </form>
        </div>

      </section>
    </div>
  );
}

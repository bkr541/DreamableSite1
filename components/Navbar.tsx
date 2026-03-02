import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full px-4 pt-4">
      <div className="max-w-[1100px] mx-auto bg-white/80 backdrop-blur-md rounded-full shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-[#E8E8E8]/60 px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[#000000]">
          Dreamable<span className="text-[#999]">.</span>studio
        </Link>
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-6 text-sm font-medium text-[#707070] mr-4">
            <Link href="/about" className="hover:text-[#000000] transition-colors">About Us</Link>
            <Link href="/services" className="hover:text-[#000000] transition-colors">Services</Link>
          </div>
          <Link href="/#contact" className="inline-flex items-center justify-center h-9 px-5 rounded-full bg-[#F0F0F0] text-[#000000] text-sm font-medium hover:bg-[#E5E5E5] transition-colors border border-[#E0E0E0]/50">
            Start a Project
          </Link>
        </div>
      </div>
    </nav>
  );
}

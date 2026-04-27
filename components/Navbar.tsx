import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full px-4 pt-4">
      <div className="max-w-[1100px] mx-auto bg-white/80 backdrop-blur-md rounded-full shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-[#E8E8E8]/60 px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#000000]">
          <Image src="/images/logo_transparent.png" alt="Dreamable.studio logo" width={32} height={32} className="rounded-md" />
          <span className="hidden md:block">Dreamable<span className="text-[#999]">.</span>studio</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center gap-3 sm:gap-6 text-[12px] sm:text-sm font-medium text-[#707070] mr-2 sm:mr-4">
            <Link href="/about" className="hover:text-[#000000] transition-colors whitespace-nowrap">About Us</Link>
            <Link href="/services" className="hover:text-[#000000] transition-colors whitespace-nowrap">Services</Link>
            <Link href="/portal" className="hover:text-[#000000] transition-colors whitespace-nowrap">Client Portal</Link>
          </div>
          <Link href="/#contact" className="inline-flex items-center justify-center h-8 sm:h-9 px-3 sm:px-5 rounded-full bg-[#1a2030] text-white text-[12px] sm:text-sm font-medium hover:-translate-y-0.5 hover:shadow-lg transition-all whitespace-nowrap">
            Start a Project
          </Link>
        </div>
      </div>
    </nav>
  );
}

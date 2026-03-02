import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-[#F5F5F5]">
      <div className="max-w-[1200px] mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight text-[#000000]">
          Dreamable.studio
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#707070]">
          <Link href="/" className="hover:text-[#000000] transition-colors">Home</Link>
          <Link href="/about" className="hover:text-[#000000] transition-colors">About</Link>
          <Link href="/services" className="hover:text-[#000000] transition-colors">Services</Link>
          <Link href="/contact" className="hover:text-[#000000] transition-colors">Contact</Link>
        </div>
        <Link href="/contact" className="hidden md:inline-flex items-center justify-center h-10 px-6 rounded-full bg-[#000000] text-white text-sm font-medium hover:-translate-y-0.5 transition-transform">
          Start a Project
        </Link>
      </div>
    </nav>
  );
}

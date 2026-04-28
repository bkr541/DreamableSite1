import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full py-8 mt-auto flex justify-center px-4">
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 px-6 py-3 rounded-full bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm">
        <span className="text-xs font-medium text-[#555]">
          © {new Date().getFullYear()} Dreamable.studio
        </span>
        <div className="flex items-center gap-5 text-xs text-[#777]">
          <Link href="/" className="hover:text-[#000000] transition-colors">Home</Link>
          <Link href="/about" className="hover:text-[#000000] transition-colors">About</Link>
          <Link href="/services" className="hover:text-[#000000] transition-colors">Services</Link>
          <Link href="/contact" className="hover:text-[#000000] transition-colors">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

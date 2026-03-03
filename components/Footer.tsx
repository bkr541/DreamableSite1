import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#F5F5F5] py-12 mt-auto">
      <div className="max-w-[1100px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-sm font-medium text-[#000000]">
          © {new Date().getFullYear()} Dreamable.studio
        </div>
        <div className="flex items-center gap-6 text-sm text-[#707070]">
          <Link href="/" className="hover:text-[#000000] transition-colors">Home</Link>
          <Link href="/about" className="hover:text-[#000000] transition-colors">About</Link>
          <Link href="/services" className="hover:text-[#000000] transition-colors">Services</Link>
          <Link href="/contact" className="hover:text-[#000000] transition-colors">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

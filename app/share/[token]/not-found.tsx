import Link from 'next/link';

export default function SharedFolderNotFound() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 40%, #f0f4ff 100%)' }}
    >
      <div className="w-full max-w-[440px] rounded-3xl bg-white p-10 text-center shadow-lg border border-[#F0F0F0]">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">This link isn&apos;t available</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#707070]">
          The shared folder may have been made private or removed. Ask the person who sent it for an updated link.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex h-11 items-center rounded-full bg-[#1a2030] px-7 text-sm font-medium text-white hover:-translate-y-0.5 hover:shadow-lg transition-all"
        >
          Go to Dreamable.studio
        </Link>
      </div>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load auth state & keep it in sync
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserEmail(data.user?.email ?? null);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setOpen(false);
    router.push('/signin');
  }

  const linkClass = (href: string) =>
    `px-2 ${pathname === href ? 'font-semibold' : ''}`;

  return (
    <nav className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-bold">VeronaGrow</Link>
        <Link href="/" className={linkClass('/')}>Home</Link>
        <Link href="/plants" className={linkClass('/plants')}>Plants</Link>
        <Link href="/inventory" className={linkClass('/inventory')}>Inventory</Link>
      </div>

      {/* Profile menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label="Profile"
          onClick={() => setOpen((v) => !v)}
          className="h-8 w-8 rounded-full border flex items-center justify-center text-sm font-semibold"
          title={userEmail ?? 'Profile'}
        >
          VG
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 rounded border bg-white p-1 text-sm shadow">
            {userEmail ? (
              <>
                <div className="px-3 py-2 text-gray-600 truncate" title={userEmail}>
                  {userEmail}
                </div>
                <hr />
                <Link
                  href="/profile"
                  className="block rounded px-3 py-2 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  href="/account"
                  className="block rounded px-3 py-2 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                >
                  Account
                </Link>
                <Link
                  href="/settings"
                  className="block rounded px-3 py-2 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </Link>
                <button
                  onClick={signOut}
                  className="mt-1 w-full rounded px-3 py-2 text-left hover:bg-gray-100"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/signin"
                className="block rounded px-3 py-2 hover:bg-gray-100"
                onClick={() => setOpen(false)}
              >
                Sign in / Create account
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
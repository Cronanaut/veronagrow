'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [username, setUsername] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState<string>('');

  const load = useCallback(async () => {
    setError(null);
    const { data: ures, error: uerr } = await supabase.auth.getUser();
    if (uerr) {
      setError(uerr.message);
      setLoading(false);
      return;
    }
    const user = ures.user;
    if (!user) {
      router.push('/signin');
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('username, avatar_url, bio')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>();

    if (error) setError(error.message);
    else {
      setUsername(data?.username ?? '');
      setAvatarUrl(data?.avatar_url ?? null);
      setBio(data?.bio ?? '');
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session?.user) router.push('/signin');
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [load, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user?.id;
      if (!uid) {
        router.push('/signin');
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { id: uid, username: username || null, avatar_url: avatarUrl, bio: bio || null },
          { onConflict: 'id' }
        );
      if (error) setError(error.message);
      else setOk('Profile saved.');
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setOk(null);

    // Basic client-side guard
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }

    const { data: ures } = await supabase.auth.getUser();
    const uid = ures.user?.id;
    if (!uid) {
      router.push('/signin');
      return;
    }

    // Unique path: userId/timestamp.ext
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${uid}/${Date.now()}.${ext}`;

    // Upload to public bucket
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (upErr) {
      setError(upErr.message);
      return;
    }

    // Get a public URL for the file
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setOk('Avatar uploaded. Don’t forget to Save.');
  }

  async function removeAvatar() {
    setError(null);
    setOk(null);
    setAvatarUrl(null);
    setOk('Avatar cleared. Don’t forget to Save.');
  }

  if (loading) return <main className="mx-auto max-w-2xl p-6">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-8">
      <h1 className="text-2xl font-bold">Profile</h1>

      <section className="rounded border p-4">
        <form onSubmit={save} className="space-y-4">
          {/* Username (read/write mirror; you also keep it on Account for convenience) */}
          <label className="block">
            <span className="text-sm">Username</span>
            <input
              className="mt-1 w-full rounded border p-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your-handle"
            />
          </label>

          {/* Avatar */}
          <div className="space-y-2">
            <span className="text-sm block">Avatar</span>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border bg-gray-100 flex items-center justify-center">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-500">No image</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer rounded border px-3 py-2 text-sm">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onAvatarChange}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="rounded border px-3 py-2 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          <label className="block">
            <span className="text-sm">Bio</span>
            <textarea
              className="mt-1 w-full rounded border p-2"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about your grow, experience, equipment, etc."
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {ok && <p className="text-sm text-green-700">{ok}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
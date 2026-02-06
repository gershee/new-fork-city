"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

export default function EditProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setDisplayName(profileData.display_name || "");
        setUsername(profileData.username || "");
        setBio(profileData.bio || "");
        setAvatarUrl(profileData.avatar_url);
      }

      setIsLoading(false);
    };

    fetchProfile();
  }, [router]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setIsUploadingAvatar(true);
    setError(null);

    try {
      const supabase = createClient();

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error("Avatar upload error:", err);
      setError("Failed to upload avatar. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validate username
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();

      // Check if username is taken (if changed)
      if (username !== profile.username) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", username)
          .neq("id", profile.id)
          .single();

        if (existingUser) {
          setError("Username is already taken");
          setIsSaving(false);
          return;
        }
      }

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          username: username.trim(),
          bio: bio.trim() || null,
        })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        router.push("/profile");
      }, 1000);
    } catch (err) {
      console.error("Save error:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center hover:bg-surface-hover transition-colors"
          >
            <BackIcon />
          </button>
          <h1 className="text-lg font-semibold text-text-primary flex-1">
            Edit Profile
          </h1>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isSaving || isUploadingAvatar}
          >
            Save
          </Button>
        </div>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col items-center py-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <button
          onClick={handleAvatarClick}
          disabled={isUploadingAvatar}
          className="relative group"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-28 h-28 rounded-full bg-surface-elevated border-4 border-neon-pink/30 overflow-hidden"
          >
            {isUploadingAvatar ? (
              <div className="w-full h-full flex items-center justify-center bg-surface">
                <div className="w-6 h-6 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
              </div>
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-neon-pink/20 to-neon-purple/20">
                👤
              </div>
            )}
          </motion.div>
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <CameraIcon className="w-8 h-8 text-white" />
          </div>
        </button>
        <p className="text-sm text-text-muted mt-3">Tap to change photo</p>
      </div>

      {/* Form */}
      <div className="px-4 space-y-5">
        {/* Error/Success Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neon-green/10 border border-neon-green/30 rounded-xl p-4 text-neon-green text-sm"
          >
            Profile saved successfully!
          </motion.div>
        )}

        {/* Display Name */}
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={50}
            className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink"
          />
          <p className="text-xs text-text-muted mt-1">
            This is how your name appears to others
          </p>
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              @
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="username"
              maxLength={30}
              className="w-full bg-surface-elevated border border-border rounded-xl pl-8 pr-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink"
            />
          </div>
          <p className="text-xs text-text-muted mt-1">
            3-30 characters, letters, numbers, and underscores only
          </p>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            maxLength={160}
            rows={3}
            className="w-full bg-surface-elevated border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-pink resize-none"
          />
          <p className="text-xs text-text-muted mt-1">
            {bio.length}/160 characters
          </p>
        </div>
      </div>
    </div>
  );
}

// Icons
function BackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

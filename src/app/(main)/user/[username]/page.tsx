"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, useToast, getRandomToast } from "@/components/ui";
import { fireConfetti } from "@/components/effects";
import { triggerHaptic } from "@/lib/haptics";
import { createClient } from "@/lib/supabase/client";
import type { Profile, List } from "@/types";

interface UserProfile extends Profile {
  lists_count: number;
  pins_count: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_own_profile: boolean;
}

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lists, setLists] = useState<(List & { pins_count: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      // Fetch profile by username
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (error || !profileData) {
        router.push("/discover");
        return;
      }

      const isOwnProfile = currentUser?.id === profileData.id;

      // Fetch stats
      const [listsResult, pinsResult, followersResult, followingResult, isFollowingResult] =
        await Promise.all([
          supabase
            .from("lists")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profileData.id)
            .eq("is_public", true),
          supabase
            .from("pins")
            .select("*", { count: "exact", head: true })
            .eq("user_id", profileData.id),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", profileData.id),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", profileData.id),
          currentUser
            ? supabase
                .from("follows")
                .select("*")
                .eq("follower_id", currentUser.id)
                .eq("following_id", profileData.id)
                .single()
            : Promise.resolve({ data: null }),
        ]);

      setProfile({
        ...profileData,
        lists_count: listsResult.count || 0,
        pins_count: pinsResult.count || 0,
        followers_count: followersResult.count || 0,
        following_count: followingResult.count || 0,
        is_following: !!isFollowingResult.data,
        is_own_profile: isOwnProfile,
      });

      // Fetch public lists
      const { data: listsData } = await supabase
        .from("lists")
        .select(`
          *,
          pins:pins(count)
        `)
        .eq("user_id", profileData.id)
        .eq("is_public", true)
        .order("updated_at", { ascending: false });

      if (listsData) {
        const listsWithCount = listsData.map((list) => ({
          ...list,
          pins_count: list.pins?.[0]?.count || 0,
        }));
        setLists(listsWithCount);
      }

      setIsLoading(false);
    };

    fetchProfile();
  }, [username, router]);

  const handleFollow = async () => {
    if (!profile || profile.is_own_profile) return;

    setIsFollowLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    if (profile.is_following) {
      // Unfollow
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);

      triggerHaptic("light");
      setProfile({
        ...profile,
        is_following: false,
        followers_count: profile.followers_count - 1,
      });
    } else {
      // Follow
      await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: profile.id,
      });

      // Celebrate new follow!
      fireConfetti("follow");
      showToast(getRandomToast("follow"));
      setProfile({
        ...profile,
        is_following: true,
        followers_count: profile.followers_count + 1,
      });
    }

    setIsFollowLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

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
          <h1 className="font-semibold text-text-primary">@{profile.username}</h1>
        </div>
      </div>

      {/* Profile Header */}
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-surface-elevated overflow-hidden shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name || profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">
                👤
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-text-primary truncate">
              {profile.display_name || profile.username}
            </h2>
            <p className="text-text-muted">@{profile.username}</p>

            {profile.bio && (
              <p className="text-text-secondary mt-2 text-sm">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-6">
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">{profile.lists_count}</p>
            <p className="text-xs text-text-muted">Lists</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">{profile.pins_count}</p>
            <p className="text-xs text-text-muted">Spots</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">{profile.followers_count}</p>
            <p className="text-xs text-text-muted">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">{profile.following_count}</p>
            <p className="text-xs text-text-muted">Following</p>
          </div>
        </div>

        {/* Follow Button */}
        {!profile.is_own_profile && (
          <div className="mt-6">
            <Button
              variant={profile.is_following ? "secondary" : "primary"}
              className="w-full"
              onClick={handleFollow}
              isLoading={isFollowLoading}
            >
              {profile.is_following ? "Following" : "Follow"}
            </Button>
          </div>
        )}

        {profile.is_own_profile && (
          <div className="mt-6">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/profile")}
            >
              Edit Profile
            </Button>
          </div>
        )}
      </div>

      {/* Public Lists */}
      <div className="px-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">
          PUBLIC LISTS
        </h3>

        {lists.length === 0 ? (
          <div className="text-center py-12 bg-surface-elevated rounded-xl">
            <p className="text-text-muted">No public lists yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {lists.map((list, index) => (
                <motion.button
                  key={list.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => router.push(`/lists/${list.id}`)}
                  className="relative bg-surface-elevated rounded-2xl p-4 text-left hover:bg-surface-hover transition-colors overflow-hidden"
                >
                  {/* Color accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ backgroundColor: list.color }}
                  />

                  {/* Emoji */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                    style={{ backgroundColor: `${list.color}20` }}
                  >
                    <span className="text-xl">{list.emoji_icon}</span>
                  </div>

                  {/* Info */}
                  <h4 className="font-semibold text-text-primary text-sm truncate">
                    {list.name}
                  </h4>
                  <p className="text-xs text-text-muted">
                    {list.pins_count} {list.pins_count === 1 ? "spot" : "spots"}
                  </p>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

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

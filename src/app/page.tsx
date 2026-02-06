"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // User is logged in, redirect to main app
        router.replace("/explore");
      } else {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-neon-pink border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      {/* Animated background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-neon-pink/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-neon-cyan/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-purple/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <h1 className="text-6xl font-bold gradient-text mb-2">NYC.fun</h1>
          <p className="text-text-secondary text-lg">
            Your city. Your spots. Your people.
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-4 mb-12"
        >
          <FeatureItem
            emoji="📍"
            text="Save your favorite spots with personal notes & ratings"
          />
          <FeatureItem
            emoji="📋"
            text="Create custom lists like 'Best Pizza' or 'Date Night'"
          />
          <FeatureItem
            emoji="👥"
            text="Follow friends and overlay their lists on your map"
          />
          <FeatureItem
            emoji="🔥"
            text="Discover trending spots with real-time heatmaps"
          />
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => router.push("/login")}
          >
            Get Started
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={() => router.push("/login")}
          >
            I already have an account
          </Button>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-text-muted text-sm"
        >
          By continuing, you agree to our Terms & Privacy Policy
        </motion.p>
      </motion.div>
    </div>
  );
}

function FeatureItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span className="text-2xl">{emoji}</span>
      <span className="text-text-secondary">{text}</span>
    </div>
  );
}

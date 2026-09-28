"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { deleteMediaObject, uploadFileToR2 } from "@/lib/r2-client";

type FormState = {
  badge: string;
  title: string;
  description: string;
  button_one: string;
  button_two: string;
  video_url: string;
};


const defaults: FormState = {
  badge: "Alobaidi Group Painting",
  title: "Premium Painting. Built To Last.",
  description:
    "Transform your home or business with professional painting services built around quality craftsmanship, premium materials, and attention to every detail.",
  button_one: "Contact Us",
  button_two: "View Our Work",
  video_url: "",
};

export default function HomeAdmin() {
  const [form, setForm] = useState<FormState>(defaults);
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadHome() {
      const { data, error } = await db
        .from("home")
        .select("badge,title,description,button_one,button_two,image_url")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("HOME LOAD ERROR:", error);
        return;
      }

      if (data) {
        setForm({
          badge: data.badge || defaults.badge,
          title: data.title || defaults.title,
          description: data.description || "",
          button_one: data.button_one || defaults.button_one,
          button_two: data.button_two || defaults.button_two,
          video_url: data.image_url || "",
        });
      }
    }

    loadHome();
  }, []);

  function update(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveHome() {
    setLoading(true);

    const previousVideoUrl = form.video_url;
    let videoUrl = previousVideoUrl;
    let uploadedNewVideo = false;
    let uploadedVideoKey: string | null = null;

    try {

      if (video) {
        const uploaded = await uploadFileToR2(video, "hero");
        uploadedVideoKey = uploaded.key;
        videoUrl = uploaded.publicUrl;
        uploadedNewVideo = true;
      }

      const payload = {
        badge: form.badge,
        title: form.title,
        description: form.description,
        button_one: form.button_one,
        button_two: form.button_two,
        image_url: videoUrl,
      };

      const response = await fetch("/api/admin/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save homepage");
      }

      // The database now points at Cloudflare R2. Remove the previous object
      // only after the save succeeds so the live site can never lose its media.
      if (uploadedNewVideo && previousVideoUrl && previousVideoUrl !== videoUrl) {
        try {
          await deleteMediaObject({ url: previousVideoUrl });
        } catch (cleanupError) {
          console.warn("OLD HERO CLEANUP ERROR:", cleanupError);
        }
      }

      setForm((prev) => ({ ...prev, video_url: videoUrl }));
      setVideo(null);
      alert("Home saved!");
    } catch (error: unknown) {
      if (uploadedNewVideo && uploadedVideoKey) {
        try {
          await deleteMediaObject({ key: uploadedVideoKey });
        } catch (rollbackError) {
          console.warn("HERO ROLLBACK ERROR:", rollbackError);
        }
      }

      console.error("HOME ERROR:", error);
      alert(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10">
      <h1 className="text-3xl font-bold text-[#071D49] sm:text-4xl">Home Manager</h1>
      <p className="mt-3 max-w-2xl text-gray-500">
        Edit the homepage hero text and hero video. Text is stored in Cloudflare D1 and media uploads go directly to Cloudflare R2.
      </p>

      <div className="mt-8 max-w-3xl rounded-3xl bg-white p-5 shadow sm:mt-10 sm:p-8">
        <label className="font-semibold text-[#071D49]">Badge</label>
        <input value={form.badge} onChange={(e) => update("badge", e.target.value)} className="mt-2 w-full rounded-xl border p-4" />

        <label className="mt-5 block font-semibold text-[#071D49]">Title</label>
        <input value={form.title} onChange={(e) => update("title", e.target.value)} className="mt-2 w-full rounded-xl border p-4" />

        <label className="mt-5 block font-semibold text-[#071D49]">Description</label>
        <textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} className="mt-2 w-full rounded-xl border p-4" />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mt-5 block font-semibold text-[#071D49]">Button One</label>
            <input value={form.button_one} onChange={(e) => update("button_one", e.target.value)} className="mt-2 w-full rounded-xl border p-4" />
          </div>
          <div>
            <label className="mt-5 block font-semibold text-[#071D49]">Button Two</label>
            <input value={form.button_two} onChange={(e) => update("button_two", e.target.value)} className="mt-2 w-full rounded-xl border p-4" />
          </div>
        </div>

        <label className="mt-6 block font-semibold text-[#071D49]">Hero Video</label>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(e) => setVideo(e.target.files?.[0] || null)}
          className="mt-2 w-full rounded-xl border p-4"
        />

        {video && <p className="mt-3 text-sm text-gray-500">Selected: {video.name}</p>}

        {!video && form.video_url && (
          <video
            src={form.video_url}
            controls
            playsInline
            preload="metadata"
            className="mt-5 h-56 w-full rounded-2xl bg-black object-cover sm:h-80"
          />
        )}

        <button
          type="button"
          onClick={saveHome}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-[#1E5EFF] px-8 py-4 font-semibold text-white transition hover:bg-[#C9A227] disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Saving..." : "Save Home"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { deleteMediaObject, uploadFileToR2 } from "@/lib/r2-client";

type FormState = {
  business_name: string;
  phone: string;
  email: string;
  hours: string;
  instagram: string;
  facebook: string;
  description: string;
  about_title: string;
  about_description: string;
  about_image: string;
  footer_description: string;
};

type EditableKey = Exclude<keyof FormState, "about_image">;

const defaults: FormState = {
  business_name: "Alobaidi Group Painting",
  phone: "",
  email: "",
  hours: "",
  instagram: "",
  facebook: "",
  description: "",
  about_title: "About Alobaidi Group Painting",
  about_description:
    "Alobaidi Group Painting provides professional residential and commercial painting services built on quality craftsmanship, attention to detail, and customer satisfaction.",
  about_image: "",
  footer_description:
    "Premium residential and commercial painting services built with craftsmanship, quality materials, and attention to every detail.",
};

export default function SettingsAdmin() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(defaults);

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await db
        .from("settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("SETTINGS LOAD ERROR:", error);
        return;
      }

      if (!data) return;


      setForm((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.keys(current).map((key) => {
            const typedKey = key as keyof FormState;
            return [typedKey, data[typedKey] ?? current[typedKey]];
          }),
        ),
      } as FormState));
    }

    loadSettings();
  }, []);

  async function saveSettings() {
    setSaving(true);

    const previousAboutUrl = form.about_image;
    let nextForm = form;
    let uploadedNewImage = false;
    let uploadedImageKey: string | null = null;

    try {

      if (imageFile) {
        const uploaded = await uploadFileToR2(imageFile, "about");
        uploadedImageKey = uploaded.key;
        uploadedNewImage = true;
        nextForm = { ...form, about_image: uploaded.publicUrl };
      }

      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextForm),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save settings");
      }

      if (uploadedNewImage && previousAboutUrl && previousAboutUrl !== nextForm.about_image) {
        try {
          await deleteMediaObject({ url: previousAboutUrl });
        } catch (cleanupError) {
          console.warn("OLD ABOUT IMAGE CLEANUP ERROR:", cleanupError);
        }
      }

      setForm(nextForm);
      setImageFile(null);
      alert("Settings Saved!");
    } catch (error: unknown) {
      if (uploadedNewImage && uploadedImageKey) {
        try {
          await deleteMediaObject({ key: uploadedImageKey });
        } catch (rollbackError) {
          console.warn("ABOUT IMAGE ROLLBACK ERROR:", rollbackError);
        }
      }

      console.error("SETTINGS ERROR:", error);
      alert(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function update(key: EditableKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const fieldKeys = (Object.keys(form) as Array<keyof FormState>).filter(
    (key): key is EditableKey => key !== "about_image",
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10">
      <h1 className="text-3xl font-bold text-[#071D49] sm:text-4xl">Business Settings</h1>
      <p className="mt-3 max-w-2xl text-gray-500">
        Manage company information, contact details, footer copy, and the About section from one place. Text is stored in Cloudflare D1 and images are stored in Cloudflare R2.
      </p>

      <div className="mt-8 max-w-3xl rounded-3xl bg-white p-5 shadow sm:mt-10 sm:p-8">
        <h2 className="text-xl font-bold text-[#071D49]">Business Information</h2>

        <label className="mt-6 mb-2 block font-semibold text-[#071D49]">About Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          className="w-full rounded-xl border p-3"
        />
        {imageFile && (
          <p className="mt-3 text-sm text-gray-500">
            Selected: {imageFile.name}. It will upload when you save settings.
          </p>
        )}

        {form.about_image && !imageFile && (
          <img
            src={form.about_image}
            alt="About section preview"
            className="mt-6 h-56 w-full rounded-2xl object-cover sm:h-72"
          />
        )}

        {fieldKeys.map((key) => (
          <div key={key}>
            <label className="mt-5 mb-2 block font-semibold capitalize text-[#071D49]">
              {key.replaceAll("_", " ")}
            </label>
            {key.includes("description") ? (
              <textarea
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
                rows={5}
                className="w-full rounded-xl border p-4 outline-none focus:border-[#1E5EFF]"
              />
            ) : (
              <input
                type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={
                  key === "phone"
                    ? "+1 902 555 0123"
                    : key === "email"
                      ? "hello@example.com"
                      : undefined
                }
                className="w-full rounded-xl border p-4 outline-none focus:border-[#1E5EFF]"
              />
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="mt-8 w-full rounded-xl bg-[#1E5EFF] px-8 py-4 font-semibold text-white transition hover:bg-[#C9A227] disabled:opacity-60 sm:w-auto"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

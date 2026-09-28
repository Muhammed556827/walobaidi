"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { deleteMediaObject, uploadFileToR2 } from "@/lib/r2-client";

type MarqueeItem = {
  id: string;
  title: string;
  logo_url: string;
  logo_path: string;
};

export default function MarqueeAdmin() {
  const [title, setTitle] = useState("");
  const [logo, setLogo] = useState<File | null>(null);

  const [items, setItems] = useState<MarqueeItem[]>([]);

  const [loading, setLoading] = useState(false);

  async function loadItems() {
    const { data, error } = await db
      .from("marquee")
      .select("*")
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.log(error);
      return;
    }

    setItems(data || []);
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function addItem() {
    if (!title || !logo) {
      alert("Please enter a company name and choose a logo.");
      return;
    }

    let uploadedPath: string | null = null;

    try {
      setLoading(true);

      const uploaded = await uploadFileToR2(logo, "marquee");
      const fileName = uploaded.key;
      uploadedPath = fileName;

      const { error } = await db
        .from("marquee")
        .insert({
          title,
          logo_url: uploaded.publicUrl,
          logo_path: fileName,
        });

      if (error) {
        try {
          await deleteMediaObject({ key: fileName });
        } catch (rollbackError) {
          console.warn("MARQUEE UPLOAD ROLLBACK ERROR:", rollbackError);
        }

        uploadedPath = null;
        throw error;
      }

      uploadedPath = null;
      alert("Company Added!");

      setTitle("");
      setLogo(null);

      loadItems();
    } catch (error: unknown) {
      if (uploadedPath) {
        try {
          await deleteMediaObject({ key: uploadedPath });
        } catch (rollbackError) {
          console.warn("MARQUEE UPLOAD ROLLBACK ERROR:", rollbackError);
        }
      }

      console.log(error);
      alert(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(item: MarqueeItem) {
    if (!confirm("Delete this company?")) return;

    const { error } = await db
      .from("marquee")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.log(error);
      alert(error.message || "Delete failed");
      return;
    }

    if (item.logo_path || item.logo_url) {
      try {
        await deleteMediaObject({
          key: item.logo_path,
          url: item.logo_url,
        });
      } catch (storageError) {
        console.warn("MARQUEE OLD FILE CLEANUP ERROR:", storageError);
        alert("Removed from the website. The old logo could not be deleted right now; use Delete Old Data on the dashboard to clean it safely.");
        loadItems();
        return;
      }
    }

    loadItems();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10">

      <h1 className="text-3xl sm:text-4xl font-bold text-[#071D49]">
        Marquee Manager
      </h1>

      <p className="mt-3 text-gray-500">
        Manage the companies shown on the moving banner.
      </p>

      <div className="mt-10 max-w-xl bg-white rounded-3xl p-5 sm:p-8 shadow">

        <h2 className="text-xl font-bold text-[#071D49]">
          Add Company
        </h2>

        <input
          placeholder="Company Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-6 w-full p-4 border rounded-xl"
        />

        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setLogo(e.target.files?.[0] || null)
          }
          className="mt-4 w-full"
        />

        <button
          onClick={addItem}
          disabled={loading}
          className="
            mt-6
            px-8
            py-4
            rounded-xl
            bg-[#1E5EFF]
            text-white
            font-semibold
            hover:bg-[#C9A227]
            transition
          "
        >
          {loading ? "Uploading..." : "Add Company"}
        </button>

      </div>

      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6">

        {items.map((item) => (

          <div
            key={item.id}
            className="bg-white rounded-3xl shadow p-6"
          >

            {item.logo_url && (

              <img
                src={item.logo_url}
                alt={item.title}
                className="
                  w-20
                  h-20
                  object-contain
                  mx-auto
                  mb-5
                "
              />

            )}

            <h3 className="text-center font-bold text-[#071D49]">
              {item.title}
            </h3>

            <button
              onClick={() => deleteItem(item)}
              className="
                mt-6
                w-full
                py-3
                rounded-xl
                bg-red-600
                text-white
                font-semibold
                hover:bg-red-700
              "
            >
              Delete Company
            </button>

          </div>

        ))}

      </div>

    </div>
  );
}

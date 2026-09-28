"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { deleteMediaObject, uploadFileToR2 } from "@/lib/r2-client";

type Project = {
  id: string;
  title: string;
  category: string;
  image_url: string | null;
  image_path: string;
  video_url: string | null;
  media_type: string | null;
};

export default function GalleryAdmin() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Residential");
  const [mediaType, setMediaType] = useState("image");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadProjects() {
    const { data, error } = await db
      .from("gallery")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.log("GALLERY LOAD ERROR:", error);
      alert(error instanceof Error ? error.message : "Something went wrong");
      return;
    }

    setProjects(data || []);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function addProject() {
    if (!title || !image) {
      if (mediaType === "video") {
        alert("Please add title and video");
      } else {
        alert("Please add title and image");
      }

      return;
    }

    let uploadedPath: string | null = null;

    try {
      setLoading(true);

      const uploaded = await uploadFileToR2(image, "gallery");
      const fileName = uploaded.key;
      const publicUrl = uploaded.publicUrl;
      uploadedPath = fileName;

      const insertResult = await db
        .from("gallery")
        .insert({
          title: title,
          category: category,
          media_type: mediaType,
          image_url:
            mediaType === "image"
              ? publicUrl
              : null,
          image_path: fileName,
          video_url:
            mediaType === "video"
              ? publicUrl
              : null,
        });

      if (insertResult.error) {
        // The database row was not created, so remove the just-uploaded file
        // immediately instead of leaving an orphan in Storage.
        try {
          await deleteMediaObject({ key: fileName });
        } catch (rollbackError) {
          console.warn("GALLERY UPLOAD ROLLBACK ERROR:", rollbackError);
        }

        uploadedPath = null;
        throw insertResult.error;
      }

      uploadedPath = null;

      if (mediaType === "video") {
        alert("Video Added!");
      } else {
        alert("Project Added!");
      }

      setTitle("");
      setImage(null);
      setMediaType("image");

      await loadProjects();
    } catch (error: unknown) {
      // Covers unexpected errors after a successful upload but before the
      // database insert finished.
      if (uploadedPath) {
        try {
          await deleteMediaObject({ key: uploadedPath });
        } catch (rollbackError) {
          console.warn("GALLERY UPLOAD ROLLBACK ERROR:", rollbackError);
        }
      }

      console.log("UPLOAD ERROR:", error);

      alert(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(project: Project) {
    const confirmMessage = project.media_type === "video" ? "Delete this video?" : "Delete this image?";
    if (!window.confirm(confirmMessage)) return;

    try {
      const deleteResult = await db
        .from("gallery")
        .delete()
        .eq("id", project.id);

      if (deleteResult.error) throw deleteResult.error;

      const mediaUrl = project.media_type === "video" ? project.video_url : project.image_url;
      if (project.image_path || mediaUrl) {
        try {
          await deleteMediaObject({
            key: project.image_path,
            url: mediaUrl,
          });
        } catch (storageError) {
          console.warn("GALLERY OLD FILE CLEANUP ERROR:", storageError);
          alert("Removed from the website. The old media file could not be deleted right now; use Delete Old Data on the dashboard to clean it safely.");
          await loadProjects();
          return;
        }
      }

      alert(project.media_type === "video" ? "Video Deleted!" : "Image Deleted!");
      await loadProjects();
    } catch (error: unknown) {
      console.log("DELETE ERROR:", error);
      alert(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10">

      <h1 className="text-3xl sm:text-4xl font-bold text-[#071D49]">
        Gallery Manager
      </h1>

      <div className="mt-10 max-w-xl bg-white rounded-3xl p-5 sm:p-8 shadow">

        <input
          placeholder="Project Title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          className="w-full p-4 border rounded-xl"
        />

        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value)
          }
          className="mt-4 w-full p-4 border rounded-xl"
        >
          <option value="Residential">
            Residential
          </option>

          <option value="Commercial">
            Commercial
          </option>

          <option value="Interior">
            Interior
          </option>

          <option value="Exterior">
            Exterior
          </option>
        </select>

        <select
          value={mediaType}
          onChange={(e) => {
            setMediaType(e.target.value);
            setImage(null);
          }}
          className="mt-4 w-full p-4 border rounded-xl"
        >
          <option value="image">
            Photo
          </option>

          <option value="video">
            Video
          </option>
        </select>

        <input
          type="file"
          accept={
            mediaType === "video"
              ? "video/*"
              : "image/*"
          }
          onChange={(e) =>
            setImage(
              e.target.files?.[0] || null
            )
          }
          className="mt-4 w-full"
        />

        <button
          onClick={addProject}
          disabled={loading}
          className="mt-6 px-8 py-4 rounded-xl bg-[#1E5EFF] text-white font-semibold"
        >
          {loading
            ? "Uploading..."
            : mediaType === "video"
            ? "Add Video"
            : "Add Project"}
        </button>

      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-8">

        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-3xl overflow-hidden shadow"
          >

            {project.media_type === "video" &&
            project.video_url ? (
              <video
                src={project.video_url}
                controls
                playsInline
                preload="metadata"
                className="w-full h-56 object-cover"
              />
            ) : (
              <img
                src={project.image_url || ""}
                alt={project.title}
                className="w-full h-56 object-cover"
              />
            )}

            <div className="p-5">

              <h3 className="font-bold text-[#071D49]">
                {project.title}
              </h3>

              <p className="text-gray-500 mt-2 text-sm">
                {project.category}
              </p>

              <p className="text-gray-400 mt-1 text-xs uppercase">
                {project.media_type === "video"
                  ? "Video"
                  : "Photo"}
              </p>

              <button
                onClick={() =>
                  deleteProject(project)
                }
                className="mt-5 w-full py-3 rounded-xl bg-red-600 text-white font-semibold"
              >
                {project.media_type === "video"
                  ? "Delete Video"
                  : "Delete Image"}
              </button>

            </div>
          </div>
        ))}

      </div>

    </div>
  );
}


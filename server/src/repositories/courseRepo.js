import crypto from "crypto";

const coursesById = new Map();
const coursesBySlug = new Map();

export function createCourse({ name, slug, description = "" }) {
  const s = (slug || name?.toLowerCase().replace(/\s+/g, "-")).trim();
  if (coursesBySlug.has(s)) {
    const err = new Error("Course slug already exists");
    err.code = "SLUG_EXISTS";
    throw err;
  }

  const course = {
    id: crypto.randomUUID(),
    name: name.trim(),
    slug: s,
    description: (description || "").trim(),
    active: true,
    createdAt: new Date().toISOString(),
  };

  coursesById.set(course.id, course);
  coursesBySlug.set(course.slug, course);
  return { ...course };
}

export function findCourseById(id) {
  if (!id) return null;
  const c = coursesById.get(id);
  return c ? { ...c } : null;
}

export function findCourseBySlug(slug) {
  if (!slug) return null;
  const c = coursesBySlug.get(slug);
  return c ? { ...c } : null;
}

export function listCourses({ activeOnly = false } = {}) {
  const list = Array.from(coursesById.values());
  const filtered = activeOnly ? list.filter((c) => c.active) : list;
  return filtered.map((c) => ({ ...c })).sort((a, b) => a.name.localeCompare(b.name));
}

export function updateCourse(id, updates) {
  const course = coursesById.get(id);
  if (!course) return null;
  if (updates.name !== undefined) course.name = updates.name.trim();
  if (updates.slug !== undefined) {
    const oldSlug = course.slug;
    course.slug = updates.slug.trim();
    coursesBySlug.delete(oldSlug);
    coursesBySlug.set(course.slug, course);
  }
  if (updates.description !== undefined) course.description = updates.description.trim();
  if (updates.active !== undefined) course.active = !!updates.active;
  return { ...course };
}

export function deleteCourse(id) {
  const course = coursesById.get(id);
  if (!course) return false;
  coursesById.delete(id);
  coursesBySlug.delete(course.slug);
  return true;
}

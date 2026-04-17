/** Aligned with course slugs / tutor subjects. */
export const ALLOWED_SUBJECT_SLUGS = [
  "mathematics",
  "physics",
  "chemistry",
  "english",
  "computer-science",
  "biology",
];

export function normalizeSubjectSlugs(input) {
  const arr = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  return [
    ...new Set(
      arr
        .map((s) => String(s).trim().toLowerCase())
        .filter((s) => ALLOWED_SUBJECT_SLUGS.includes(s))
    ),
  ];
}

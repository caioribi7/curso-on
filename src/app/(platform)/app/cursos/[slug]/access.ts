import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { getCourseBySlug, isEnrolled } from "@/lib/queries";

/** Student area gate: enrolled students and the course owner only. */
export async function requireCourseAccess(slug: string, next: string) {
  const user = await requireUser(next);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const isOwner = course.owner_id === user.id;
  if (!isOwner && !(await isEnrolled(course.id))) redirect(`/cursos/${slug}`);
  return { user, course, isOwner };
}

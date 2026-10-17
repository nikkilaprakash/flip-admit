import { z } from "zod";
import { AREAS } from "./config";

export const CourseBody = z.object({
  name: z.string().trim().min(3, "Give the course a name, for example MSc Data Science."),
  subjectArea: z.string().refine((a) => AREAS.includes(a), "Choose a subject area from the list."),
  level: z.enum(["UG", "PGT", "PHD"]),
  tuitionFee: z.number().int().min(0, "Tuition can't be negative.").max(200000),
  durationYears: z.number().int().min(1).max(7),
  seats: z.number().int().min(1, "A course needs at least one seat.").max(10000),
  scholarshipFund: z.number().int().min(0).max(100_000_000),
  description: z.string().trim().max(8000),
});

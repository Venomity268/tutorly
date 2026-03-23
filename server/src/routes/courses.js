import express from "express";
import { listCourses } from "../repositories/courseRepo.js";

export const coursesRouter = express.Router();

coursesRouter.get("/", (req, res) => {
  const courses = listCourses({ activeOnly: true });
  return res.json({ courses });
});

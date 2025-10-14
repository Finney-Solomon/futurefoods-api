// src/utils/tokens.js
import jwt from "jsonwebtoken";

export const signAccess = (user) =>
 jwt.sign(
  { id: user._id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN }
 );
export const signRefresh = (user) =>
 jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, {
  expiresIn: process.env.REFRESH_EXPIRES_IN,
 });

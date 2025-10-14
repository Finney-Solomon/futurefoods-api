// src/middleware/requireRole.js
export const requireRole = (role) => (req, res, next) => {
  console.log(req?.user,"reqreqreq")
  if (!req?.user) return res?.status(401).json({ message: 'Unauthenticated' });
  if (req?.user?.role !== role) return res.status(403).json({ message: 'Forbidden' });
  next();
};
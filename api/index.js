import app from '../src/server.js';

import { connectDB } from '../src/config/db.js';

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
    console.log("isConnected")
  }
  return app(req, res);
}

import app from '../src/server.js';
// import { connectDB } from '../src/config/db.js';

// let isConnected = false;
// export default async function handler(req, res) {

//   if (!isConnected) {
//     await connectDB();
//     isConnected = true;
//   }
//   return app(req, res);
// }

// // ✅ Use "nodejs" here (no version)
// export const config = {
//   runtime: 'nodejs'
// };

// import app from '../server.js';
import { connectDB } from '../src/config/db.js';

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
  return app(req, res);
}

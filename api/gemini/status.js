import { key, cors } from './_proxy.js';

export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  cors(req, res);
  res.status(200).json({ available: !!key() });
}

import { key } from './_proxy.js';

export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({ available: !!key() });
}

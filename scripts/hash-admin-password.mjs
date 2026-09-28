import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv.slice(2).join(" ");
if (!password) {
  console.error('Usage: npm run auth:hash -- "your strong password"');
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
console.log(`scrypt$${salt}$${hash}`);

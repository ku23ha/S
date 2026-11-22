// Prints an ADMIN_PASSWORD_HASH value. Reads the password from stdin so it
// never lands in shell history:  npm run admin:hash   (then type it, Enter)
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
process.stderr.write("Admin password: ");
rl.once("line", (password) => {
  rl.close();
  if (password.length < 12) {
    console.error("\nUse at least 12 characters.");
    process.exit(1);
  }
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
  console.log(`\nscrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`);
});

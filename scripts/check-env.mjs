// Checks a production environment before deploying. Prints which variables
// are missing or look wrong; never prints values.
//   vercel env pull .env.production.local --environment=production
//   node --env-file=.env.production.local scripts/check-env.mjs
const env = process.env;
const problems = [];
const notes = [];

const need = (name, test, why) => {
  const v = env[name];
  if (!v) problems.push(`${name} is not set`);
  else if (test && !test(v)) problems.push(`${name}: ${why}`);
};

need("NEXT_PUBLIC_SITE_URL", (v) => /^https:\/\/[^/]+$/.test(v), "must be https://your-domain with no trailing slash");
need("DATABASE_URL", (v) => /^postgres(ql)?:\/\//.test(v), "must be a postgres:// connection string");
if (env.DATABASE_URL && !/:6543\//.test(env.DATABASE_URL)) {
  notes.push("DATABASE_URL is not on port 6543; Supabase recommends the transaction pooler for Vercel functions");
}
need("PAYMENTS_PROVIDER", (v) => v === "dodo", "must be dodo");
need("PAYMENTS_MODE", (v) => v === "live" || v === "test", "must be live or test");
need("DODO_API_KEY");
need("DODO_WEBHOOK_SECRET");
if (env.PAYMENTS_MODE === "live" && env.DODO_API_KEY?.startsWith("dodo_test_")) problems.push("PAYMENTS_MODE=live with a test DODO_API_KEY");
if (env.PAYMENTS_MODE !== "live") notes.push("PAYMENTS_MODE is not live: real cards won't work");
for (const n of ["DODO_PRODUCT_STANDARD", "DODO_PRODUCT_POPULAR", "DODO_PRODUCT_ICONIC", "DODO_PRODUCT_PRINT_ADDON"]) need(n);
need("RESEND_API_KEY");
need("EMAIL_FROM", (v) => !/resend\.dev/i.test(v), "must use your verified domain, not resend.dev");
need("ADMIN_PASSWORD_HASH", (v) => /^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/.test(v), "make it with npm run admin:hash");
need("SESSION_SECRET", (v) => v.length >= 32, "must be at least 32 characters");
need("VIEWER_HASH_SALT", (v) => v.length >= 32, "must be at least 32 characters");
need("NEXT_PUBLIC_POSTHOG_KEY");
need("NEXT_PUBLIC_POSTHOG_HOST", (v) => /^https:\/\//.test(v), "must be an https URL");
need("NEXT_PUBLIC_CONTACT_EMAIL", (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "must be an email address");
if (env.ANALYTICS_SERVER_DISABLED) problems.push("ANALYTICS_SERVER_DISABLED must not be set in production");
if (env.LOCAL_DB_DIR) problems.push("LOCAL_DB_DIR must not be set in production");

for (const n of notes) console.log(`note: ${n}`);
if (problems.length) {
  for (const p of problems) console.log(`problem: ${p}`);
  process.exit(1);
}
console.log("Environment looks complete.");

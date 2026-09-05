import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const email = process.argv[2] || process.env.FOUNDER_EMAIL || "founder@openriverstack.com";
  const password = process.argv[3];

  if (!password) {
    console.log(`
Usage: node --env-file=.env.local scripts/create-admin.mjs <email> <password>

Example:
  node --env-file=.env.local scripts/create-admin.mjs founder@openriverstack.com MySecretPassword123!
`);
    process.exit(1);
  }

  console.log(`Creating / configuring admin user for ${email}...`);

  // 1. Check if user already exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  let user = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Create new confirmed user in Supabase Auth
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "Founder",
      },
    });

    if (createError) {
      console.error("Failed to create user:", createError.message);
      process.exit(1);
    }
    user = createData.user;
    console.log(`✓ Created auth user in Supabase with ID: ${user.id}`);
  } else {
    // Update password & confirm email
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password,
        email_confirm: true,
      }
    );
    if (updateError) {
      console.error("Failed to update user password:", updateError.message);
      process.exit(1);
    }
    console.log(`✓ Updated password for existing user: ${user.id}`);
  }

  // 2. Ensure profiles record has role = 'admin'
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    role: "admin",
    full_name: "Founder",
    email,
    timezone: "Asia/Kolkata",
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    console.error("Note: Profile upsert warning:", profileError.message);
  } else {
    console.log(`✓ Verified profile record in 'profiles' table with role: 'admin'`);
  }

  console.log(`
============================================================
Admin User Ready!
Email:    ${email}
Password: ${"*".repeat(password.length)}
Role:     admin

You can now log in at http://localhost:3000/login
It will automatically redirect you to the Admin Portal (/admin).
============================================================
`);
}

main().catch(console.error);

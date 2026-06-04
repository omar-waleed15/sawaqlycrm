"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = require("./lib/supabase");
async function seed() {
    console.log('🌱 Starting database seeding...');
    const adminEmail = 'admin@sawaqly.com';
    const adminPassword = 'Admin@1234';
    const adminName = 'Sawaqly Admin';
    try {
        // 1. Check if user exists in auth.users by email
        console.log(`Checking if admin user ${adminEmail} exists...`);
        const { data: usersData, error: listError } = await supabase_1.supabaseAdmin.auth.admin.listUsers();
        if (listError) {
            console.error('Error listing users:', listError);
            process.exit(1);
        }
        let adminUser = usersData.users.find(u => u.email === adminEmail);
        if (!adminUser) {
            console.log('Admin user does not exist. Creating admin user in Supabase Auth...');
            const { data: authData, error: createError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
                email: adminEmail,
                password: adminPassword,
                email_confirm: true,
            });
            if (createError || !authData.user) {
                console.error('Error creating auth user:', createError);
                process.exit(1);
            }
            adminUser = authData.user;
            console.log('✓ Admin auth user created successfully.');
        }
        else {
            console.log('✓ Admin auth user already exists. Resetting/updating password to default...');
            const { error: updateAuthError } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
                password: adminPassword,
            });
            if (updateAuthError) {
                console.error('Error updating admin auth user password:', updateAuthError);
                process.exit(1);
            }
            console.log('✓ Admin auth user password updated successfully.');
        }
        // 2. Ensure profile exists for the admin user
        console.log('Ensuring admin profile exists in profiles table...');
        const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', adminUser.id)
            .maybeSingle();
        if (profileError) {
            console.error('Error fetching admin profile:', profileError);
            process.exit(1);
        }
        if (!profile) {
            console.log('Admin profile not found. Inserting profile...');
            const { error: insertError } = await supabase_1.supabaseAdmin
                .from('profiles')
                .insert({
                id: adminUser.id,
                name: adminName,
                email: adminEmail,
                role: 'owner',
            });
            if (insertError) {
                console.error('Error inserting admin profile:', insertError);
                process.exit(1);
            }
            console.log('✓ Admin profile inserted successfully.');
        }
        else {
            // Ensure the role is owner
            if (profile.role !== 'owner') {
                console.log('Admin profile exists but role is not owner. Updating to owner...');
                const { error: updateError } = await supabase_1.supabaseAdmin
                    .from('profiles')
                    .update({ role: 'owner' })
                    .eq('id', adminUser.id);
                if (updateError) {
                    console.error('Error updating admin profile role:', updateError);
                    process.exit(1);
                }
                console.log('✓ Admin profile role updated to owner.');
            }
            else {
                console.log('✓ Admin profile exists and is owner.');
            }
        }
        console.log('🎉 Seeding completed successfully!');
        process.exit(0);
    }
    catch (err) {
        console.error('Unexpected seeding error:', err);
        process.exit(1);
    }
}
seed();

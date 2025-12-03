/**
 * Script to create an admin user with 2FA enabled
 * 
 * Usage: node server/scripts/create-admin.js
 * 
 * Make sure to set MONGODB_URI and DB_NAME environment variables
 */

import bcrypt from 'bcryptjs';
import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Admin user configuration
const ADMIN_CONFIG = {
  name: 'Hai Dang',
  email: 'dangthhfct31147@gmail.com',
  password: 'Haidang@12',
  role: 'admin',
};

async function createAdminUser() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || 'blanc';

  if (!uri) {
    console.error('❌ MONGODB_URI is not set. Please set it in your environment variables.');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(dbName);
    const users = db.collection('users');

    // Check if user already exists
    const existingUser = await users.findOne({ email: ADMIN_CONFIG.email.toLowerCase() });
    
    if (existingUser) {
      console.log('⚠️  User already exists with email:', ADMIN_CONFIG.email);
      
      // Update to admin role and enable 2FA if not already
      const updateResult = await users.updateOne(
        { email: ADMIN_CONFIG.email.toLowerCase() },
        {
          $set: {
            role: 'admin',
            'security.twoFactorEnabled': true,
            'security.twoFactorUpdatedAt': new Date(),
            updatedAt: new Date(),
          }
        }
      );

      if (updateResult.modifiedCount > 0) {
        console.log('✅ Updated existing user to admin with 2FA enabled');
      } else {
        console.log('ℹ️  User is already an admin with 2FA enabled');
      }

      // Display user info
      const user = await users.findOne({ email: ADMIN_CONFIG.email.toLowerCase() });
      console.log('\n📋 User Info:');
      console.log('   - ID:', user._id.toString());
      console.log('   - Name:', user.name);
      console.log('   - Email:', user.email);
      console.log('   - Role:', user.role);
      console.log('   - 2FA Enabled:', user.security?.twoFactorEnabled === true);
      
      return;
    }

    // Hash password with bcrypt (12 rounds for security)
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, 12);

    // Create admin user document
    const adminUser = {
      name: ADMIN_CONFIG.name,
      email: ADMIN_CONFIG.email.toLowerCase().trim(),
      password: hashedPassword,
      role: ADMIN_CONFIG.role,
      avatar: '',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      security: {
        twoFactorEnabled: true,
        twoFactorUpdatedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert into database
    const result = await users.insertOne(adminUser);
    
    console.log('\n✅ Admin user created successfully!');
    console.log('\n📋 User Info:');
    console.log('   - ID:', result.insertedId.toString());
    console.log('   - Name:', adminUser.name);
    console.log('   - Email:', adminUser.email);
    console.log('   - Role:', adminUser.role);
    console.log('   - 2FA Enabled:', adminUser.security.twoFactorEnabled);
    console.log('\n🔑 Login Credentials:');
    console.log('   - Email:', ADMIN_CONFIG.email);
    console.log('   - Password:', ADMIN_CONFIG.password);
    console.log('\n⚠️  Note: 2FA is enabled. You will receive OTP via email when logging in.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
createAdminUser();



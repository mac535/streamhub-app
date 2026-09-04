const { db } = require('../../config/database');
const { env } = require('../../config/env');
const { hashPassword, comparePassword } = require('../../utils/password');
const { generateToken } = require('../../utils/token');

/**
 * Authenticate a user with email/username and password.
 * @param {string} identifier - Email or username
 * @param {string} password - Plain text password
 * @returns {{ user: object, token: string }}
 */
async function login(identifier, password) {
  // Find user by email or username
  const user = db.users.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: identifier },
      ],
    },
  });

  if (!user) {
    throw Object.assign(new Error('Invalid credentials. Please check your email/username and password.'), { statusCode: 401 });
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Your account has been deactivated. Contact an administrator.'), { statusCode: 403 });
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw Object.assign(new Error('Invalid credentials. Please check your email/username and password.'), { statusCode: 401 });
  }

  // Update last login timestamp
  db.users.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = generateToken({ id: user.id, role: user.role });

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token, mustChangePassword: !!user.mustChangePassword };
}

/**
 * Register a new user.
 * @param {object} data - User registration data
 * @returns {{ user: object, token: string }}
 */
async function register(data) {
  const hashedPassword = await hashPassword(data.password);

  const user = db.users.create({
    data: {
      name: data.name,
      email: data.email,
      username: data.username,
      password: hashedPassword,
      role: data.role || 'EXPERT',
    },
  });

  const token = generateToken({ id: user.id, role: user.role });

  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
}

/**
 * Get user profile by ID.
 * @param {string} userId
 * @returns {object} User data without password
 */
async function getProfile(userId) {
  const user = db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      avatar: true,
      phone: true,
      dob: true,
      address: true,
      assignedBrcs: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  }

  return user;
}

async function updateProfile(userId, data) {
  const allowedFields = ['name', 'phone', 'address'];
  const updateData = {};
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  const updatedUser = db.users.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      avatar: true,
      phone: true,
      address: true,
      assignedBrcs: true,
      isActive: true,
    },
  });

  if (!updatedUser) {
    throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  }

  // Persist to JSON based on role
  const fs = require('fs');
  const path = require('path');
  const dataDir = path.join(__dirname, '../../../data');
  let fileName = null;
  
  if (updatedUser.role === 'EXPERT') fileName = 'experts.json';
  else if (updatedUser.role === 'ADMIN' || updatedUser.role === 'MAIN_ADMIN') fileName = 'admins.json';
  else if (updatedUser.role === 'STREAM_LAB' || updatedUser.role === 'ILAB_SCHOOL' || updatedUser.role === 'CREATIVE_CORNER') fileName = 'brcs.json';
  
  if (fileName) {
    const filePath = path.join(dataDir, fileName);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const index = data.findIndex(u => u.id === userId);
      if (index !== -1) {
        data[index] = { ...data[index], ...updateData };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
    }
  }

  return updatedUser;
}

async function forgotPassword(email, origin) {
  const crypto = require('crypto');
  const mailer = require('../../utils/mailer');
  
  const user = db.users.findFirst({ where: { email } });
  if (!user) {
    throw Object.assign(new Error('This email address is not registered in our system.'), { statusCode: 404 });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

  db.users.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpires }
  });

  const resetLink = `${origin}/reset-password/${resetToken}`;
  
  let emailSent = true;
  try {
    await mailer.sendPasswordReset(user.email, user.name || user.username, resetLink);
  } catch (err) {
    emailSent = false;
  }
  
  // If no SMTP user is configured, we assume it's disabled
  if (!env.SMTP_USER) {
    emailSent = false;
  }
  
  return { success: true, emailSent, link: emailSent ? null : resetLink };
}

async function resetPassword(token, newPassword) {
  const fs = require('fs');
  const path = require('path');
  
  const user = db.users.findFirst({
    where: { resetToken: token }
  });

  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    throw Object.assign(new Error('Invalid or expired password reset token.'), { statusCode: 400 });
  }

  const hashedPassword = await hashPassword(newPassword);

  db.users.update({
    where: { id: user.id },
    data: { 
      password: hashedPassword,
      resetToken: null,
      resetTokenExpires: null
    }
  });

  const dataDir = path.join(__dirname, '../../../data');
  let fileName = null;
  
  if (user.role === 'EXPERT') fileName = 'experts.json';
  else if (user.role === 'ADMIN' || user.role === 'MAIN_ADMIN') fileName = 'admins.json';
  else if (user.role === 'STREAM_LAB' || user.role === 'ILAB_SCHOOL' || user.role === 'CREATIVE_CORNER') fileName = 'brcs.json';
  
  if (fileName) {
    const filePath = path.join(dataDir, fileName);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const index = data.findIndex(u => u.id === user.id);
      if (index !== -1) {
        data[index].password = hashedPassword;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
    }
  }

  return true;
}

/**
 * Change password (used for first-login forced change and voluntary changes).
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {boolean}
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = db.users.findUnique({ where: { id: userId } });
  if (!user) {
    throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  }

  const isPasswordValid = await comparePassword(currentPassword, user.password);
  if (!isPasswordValid) {
    throw Object.assign(new Error('Current password is incorrect.'), { statusCode: 401 });
  }

  const hashedPassword = await hashPassword(newPassword);

  db.users.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });

  // Persist to cc_users.json if this is a Creative Corner user
  const fs = require('fs');
  const path = require('path');
  const dataDir = path.join(__dirname, '../../../data');

  if (user.role === 'CREATIVE_CORNER') {
    const filePath = path.join(dataDir, 'cc_users.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const index = data.findIndex(u => u.id === userId);
      if (index !== -1) {
        data[index].password = hashedPassword;
        data[index].mustChangePassword = false;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
    }
  } else if (user.role === 'STREAM_LAB') {
    const filePath = path.join(dataDir, 'hub_users.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const index = data.findIndex(u => u.id === userId);
      if (index !== -1) {
        data[index].password = hashedPassword;
        data[index].mustChangePassword = false;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      }
    }
  } else {
    // For experts/admins, persist to the appropriate JSON
    let fileName = null;
    if (user.role === 'EXPERT') fileName = 'experts.json';
    else if (user.role === 'ADMIN' || user.role === 'MAIN_ADMIN') fileName = 'admins.json';

    if (fileName) {
      const filePath = path.join(dataDir, fileName);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const index = data.findIndex(u => u.id === userId);
        if (index !== -1) {
          data[index].password = hashedPassword;
          data[index].mustChangePassword = false;
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        }
      }
    }
  }

  return true;
}

module.exports = { login, register, getProfile, updateProfile, forgotPassword, resetPassword, changePassword };

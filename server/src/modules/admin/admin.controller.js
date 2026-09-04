const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mailer = require('../../utils/mailer');
const { db } = require('../../config/database');

const DATA_DIR = path.join(__dirname, '../../../data');

const getFilePath = (type, past = false) => {
  const prefix = past ? 'past_' : '';
  const validTypes = ['experts', 'labs', 'ilabs', 'creative_corners', 'admins'];
  if (!validTypes.includes(type)) return null;
  if (type === 'labs') {
    return past 
      ? path.join(__dirname, '../../../../server/data/past_brcs.json')
      : path.join(__dirname, '../../../../server/data/brcs.json');
  }
  return path.join(DATA_DIR, `${prefix}${type}.json`);
};

const getMessagesPath = () => path.join(DATA_DIR, 'messages.json');

const readData = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return [];
  }
};

const writeData = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

exports.getUsers = (req, res) => {
  const { type } = req.params;
  const filePath = getFilePath(type);
  if (!filePath) return res.status(400).json({ message: 'Invalid user type' });
  
  const data = readData(filePath);
  if (type === 'labs') {
    return res.json(data);
  }
  // Do not send passwords to the frontend
  const sanitized = data.map(u => {
    const { password, confirmPassword, ...rest } = u;
    return rest;
  });

  if (type === 'experts') {
    const eventsPath = path.join(DATA_DIR, 'events.json');
    const allEvents = readData(eventsPath).filter(e => e.status === 'SUBMITTED');
    sanitized.forEach(u => {
      const userEvents = allEvents.filter(e => e.createdBy === u.id);
      const uniqueDates = new Set(userEvents.map(e => {
        let timestamp = e.locationTimestamp || e.createdAt;
        if (timestamp && !isNaN(Number(timestamp))) timestamp = Number(timestamp);
        return new Date(timestamp).toLocaleDateString();
      }));
      u.attendanceCount = uniqueDates.size;
    });
  }

  res.json(sanitized);
};

exports.createUser = async (req, res) => {
  const { type } = req.params;
  
  if (type === 'experts' || type === 'admins') {
    const existingUser = await db.users.findFirst({
      where: { email: req.body.email }
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    const fileName = type === 'experts' ? 'pending_experts.json' : 'pending_admins.json';
    const filePath = path.join(DATA_DIR, fileName);
    let data = readData(filePath);
    
    // Remove any existing pending invites for this email to expire old links
    data = data.filter(u => u.email !== req.body.email);

    const token = crypto.randomBytes(16).toString('hex');
    const newUser = { id: crypto.randomBytes(16).toString('hex'), token, ...req.body, createdAt: new Date().toISOString() };
    data.push(newUser);
    writeData(filePath, data);
    
    const clientOrigin = req.headers.origin || 'http://localhost:5173';
    const inviteLink = `${clientOrigin}/onboard/${token}`;
    
    try {
      const previewUrl = await mailer.sendInvite(newUser.email, newUser.name, inviteLink);
      return res.status(201).json({ 
        message: `${type === 'experts' ? 'Expert' : 'Admin'} invited successfully.`,
        previewUrl: previewUrl || null,
        inviteLink 
      });
    } catch (err) {
      // If email fails, we might still want to return the link so the admin isn't completely blocked, or just fail.
      return res.status(201).json({ 
        message: `${type === 'experts' ? 'Expert' : 'Admin'} invited, but email failed to send.`, 
        inviteLink 
      });
    }
  }

  const filePath = getFilePath(type);
  if (!filePath) return res.status(400).json({ message: 'Invalid user type' });
  
  const data = readData(filePath);
  const newUser = { id: crypto.randomBytes(16).toString('hex'), ...req.body, createdAt: new Date().toISOString() };
  data.push(newUser);
  writeData(filePath, data);
  
  const { password, confirmPassword, ...safeUser } = newUser;
  res.status(201).json({ message: 'User created successfully', data: safeUser });
};

exports.softDeleteUser = async (req, res) => {
  const { type, id } = req.params;
  const activePath = getFilePath(type, false);
  const pastPath = getFilePath(type, true);
  if (!activePath) return res.status(400).json({ message: 'Invalid user type' });
  
  const activeData = readData(activePath);
  
  if (type === 'labs') {
    // For BRCs, we match by 'code' instead of 'id'
    const brcIndex = activeData.findIndex(u => u.code === id);
    if (brcIndex === -1) return res.status(404).json({ message: 'Hub not found' });
    
    const [brc] = activeData.splice(brcIndex, 1);
    brc.deletedAt = new Date().toISOString();
    writeData(activePath, activeData);
    
    const pastData = readData(pastPath);
    pastData.push(brc);
    writeData(pastPath, pastData);
    
    return res.json({ message: 'Hub soft deleted successfully' });
  }

  const userIndex = activeData.findIndex(u => u.id === id);
  
  if (userIndex === -1) return res.status(404).json({ message: 'User not found' });
  
  const [user] = activeData.splice(userIndex, 1);
  user.deletedAt = new Date().toISOString();
  writeData(activePath, activeData);
  
  const pastData = readData(pastPath);
  pastData.push(user);
  writeData(pastPath, pastData);
  
  // Free up the email in the Prisma database so the user can be re-registered
  if (user.email) {
    try {
      const dbUser = await db.users.findFirst({ where: { email: user.email } });
      if (dbUser) {
        await db.users.update({
          where: { id: dbUser.id },
          data: {
            email: `${user.email}_deleted_${Date.now()}`,
            username: `${user.username}_deleted_${Date.now()}`,
            isActive: false
          }
        });
      }
    } catch (err) {
      console.error('Failed to free up email in DB during soft delete:', err);
    }
  }

  res.json({ message: 'User soft deleted successfully' });
};

exports.broadcastMessage = (req, res) => {
  const messagesPath = getMessagesPath();
  const messages = readData(messagesPath);
  const newMessage = { id: crypto.randomBytes(16).toString('hex'), ...req.body, createdAt: new Date().toISOString() };
  messages.push(newMessage);
  writeData(messagesPath, messages);
  
  const io = req.app.get('io');
  if (io) {
    io.emit('new_broadcast_message', newMessage);
  }
  
  res.status(201).json({ message: 'Message broadcasted successfully', data: newMessage });
};

exports.getMessages = (req, res) => {
  const messagesPath = getMessagesPath();
  res.json(readData(messagesPath));
};

exports.validateInvite = (req, res) => {
  const { token } = req.params;
  
  const expertData = readData(path.join(DATA_DIR, 'pending_experts.json'));
  const adminData = readData(path.join(DATA_DIR, 'pending_admins.json'));
  
  const pendingUser = expertData.find(e => e.token === token) || adminData.find(a => a.token === token);
  
  if (!pendingUser) return res.status(404).json({ message: 'Invalid or expired invite link' });
  
  res.json({ name: pendingUser.name, email: pendingUser.email });
};

exports.completeOnboarding = async (req, res) => {
  const { token } = req.params;
  
  const pendingExpertsPath = path.join(DATA_DIR, 'pending_experts.json');
  const pendingAdminsPath = path.join(DATA_DIR, 'pending_admins.json');
  
  let pendingData = readData(pendingExpertsPath);
  let userIndex = pendingData.findIndex(e => e.token === token);
  let role = 'EXPERT';
  let pendingPath = pendingExpertsPath;
  let activeType = 'experts';
  
  if (userIndex === -1) {
    pendingData = readData(pendingAdminsPath);
    userIndex = pendingData.findIndex(e => e.token === token);
    role = 'ADMIN';
    pendingPath = pendingAdminsPath;
    activeType = 'admins';
  }
  
  if (userIndex === -1) return res.status(404).json({ message: 'Invalid invite token' });
  
  const [pendingUser] = pendingData.splice(userIndex, 1);
  writeData(pendingPath, pendingData);
  
  const activePath = getFilePath(activeType);
  const activeData = readData(activePath);
  
  const { token: _t, ...userBase } = pendingUser;
  const { password, dob, phone, address, username: submittedUsername, ...bodyRest } = req.body;
  
  // Hash password for persistent storage
  let hashedPassword = null;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 12);
  }

  // Generate username from email if not provided
  const email = userBase.email || '';
  const autoUsername = submittedUsername || email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || crypto.randomBytes(8).toString('hex');

  const newUser = { 
    ...userBase, 
    ...bodyRest, 
    username: autoUsername,
    password: hashedPassword,
    dob: dob || null,
    phone: phone || null,
    address: address || null,
    role: role,
    mustChangePassword: false, // Expert set their own password during registration
    isActive: true,
    activatedAt: new Date().toISOString() 
  };
  
  activeData.push(newUser);
  writeData(activePath, activeData);
  
  try {
    // Inject into in-memory DB immediately to allow login
    db.users.create({ data: newUser });
    res.json({ message: 'Onboarding complete', data: { ...newUser, password: undefined } });
  } catch (err) {
    if (err.code === 'P2002') {
      // Revert the file write since db injection failed
      const revertedData = activeData.filter(u => u.id !== newUser.id);
      writeData(activePath, revertedData);
      
      // Put the pending user back
      pendingData.push(pendingUser);
      writeData(pendingPath, pendingData);
      
      return res.status(400).json({ message: `Email or username already exists. Please choose a different username.` });
    }
    return res.status(500).json({ message: 'Failed to complete onboarding' });
  }
};

exports.updateExpertBrcs = (req, res) => {
  const { id } = req.params;
  const { brcCodes } = req.body;
  
  const activePath = getFilePath('experts');
  const activeData = readData(activePath);
  
  const expertIndex = activeData.findIndex(u => u.id === id);
  if (expertIndex === -1) return res.status(404).json({ message: 'Expert not found' });
  
  activeData[expertIndex].assignedBrcs = brcCodes;
  writeData(activePath, activeData);
  
  // Update in memory db as well
  db.users.update({
    where: { id },
    data: { assignedBrcs: brcCodes }
  });
  
  res.json({ message: 'Expert assignments updated successfully', data: activeData[expertIndex] });
};

exports.deleteMessage = (req, res) => {
  const { id } = req.params;
  const messagesPath = getMessagesPath();
  const messages = readData(messagesPath);
  const updated = messages.filter(m => m.id !== id);
  if (messages.length === updated.length) return res.status(404).json({ message: 'Message not found' });
  writeData(messagesPath, updated);
  res.json({ message: 'Message deleted' });
};

exports.markMessageRead = (req, res) => {
  const { id } = req.params;
  const messagesPath = getMessagesPath();
  const messages = readData(messagesPath);
  const index = messages.findIndex(m => m.id === id);
  if (index === -1) return res.status(404).json({ message: 'Message not found' });
  messages[index].read = true;
  writeData(messagesPath, messages);
  res.json({ message: 'Message marked as read', data: messages[index] });
};
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/civic_grievance");
  
  const db = mongoose.connection.db;
  let user = await db.collection('users').findOne({ role: { $in: ['admin', 'official'] } });

  const secret = process.env.JWT_SECRET || "unsafe-dev-secret";
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: '1h' });

  try {
    // Let's toggle the status to 'InProgress' to guarantee a status change trigger
    console.log("Sending PATCH request to update status to 'InProgress'...");
    const res1 = await fetch('http://localhost:5000/api/complaints/69fa25bcf53691d52a8bd7ec/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: "InProgress",
        note: "Retesting Twilio SMS Integration (Reset to InProgress)"
      })
    });

    console.log("First response status:", res1.status);

    // Give it a second
    await new Promise(r => setTimeout(r, 1000));

    // Now let's change it back to 'Resolved'
    console.log("Sending PATCH request to update status to 'Resolved'...");
    const res2 = await fetch('http://localhost:5000/api/complaints/69fa25bcf53691d52a8bd7ec/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: "Resolved",
        note: "Retesting Twilio SMS Integration (Resolved)"
      })
    });

    const text = await res2.text();
    console.log("Final response status:", res2.status);
    console.log("Check your server logs to see the Twilio SMS logs!");
  } catch (err) {
    console.error("Error making request:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();

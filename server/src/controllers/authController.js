import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { ApiError, asyncHandler } from "../utils/apiError.js";

import multer from "multer";
import xml2js from "xml2js";
import fs from "fs";
import path from "path";
import twilio from "twilio";
import Seven from "node-7z";
import sevenBin from "7zip-bin";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const upload = multer({ dest: "uploads/" });

export const verifyAadhaar = asyncHandler(async (req, res) => {
  const zipPath = req.file?.path;
  const { shareCode, phone } = req.body;

  if (!zipPath) throw new ApiError(400, "Aadhaar Zip required");
  if (!shareCode) throw new ApiError(400, "Share code required");
  if (!phone) throw new ApiError(400, "Phone number required");

  const extractPath = path.join(__dirname, "extracted");
  if (!fs.existsSync(extractPath)) {
    fs.mkdirSync(extractPath);
  }

  const oldFiles = fs.readdirSync(extractPath);
  for (const file of oldFiles) {
    fs.unlinkSync(path.join(extractPath, file));
  }

  // Fix for EACCES error on deployment environments like Render
  try {
    if (fs.existsSync(sevenBin.path7za)) {
      fs.chmodSync(sevenBin.path7za, 0o755);
    }
  } catch (err) {
    console.error("Could not set permissions for 7za:", err);
  }

  await new Promise((resolve, reject) => {
    const stream = Seven.extractFull(zipPath, extractPath, {
      password: shareCode,
      $bin: sevenBin.path7za,
    });
    stream.on("end", () => resolve());
    stream.on("error", (err) => reject(err));
  });

  const extractedFiles = fs.readdirSync(extractPath);
  const xmlFile = extractedFiles.find((file) => file.endsWith(".xml"));

  if (!xmlFile) throw new ApiError(400, "XML file not found");

  const xmlPath = path.join(extractPath, xmlFile);
  const xmlData = fs.readFileSync(xmlPath, "utf-8");

  await new Promise((resolve, reject) => {
    xml2js.parseString(xmlData, async (err, result) => {
      if (err) return reject(new ApiError(400, "Invalid XML"));

      try {
        const uidData = result?.OfflinePaperlessKyc?.UidData?.[0];
        if (!uidData) throw new ApiError(400, "UID data missing");

        const poi = uidData?.Poi?.[0]?.$;
        const poa = uidData?.Poa?.[0]?.$;

        if (!poi || !poa) throw new ApiError(400, "Invalid Aadhaar XML structure");

        const otp = generateOTP();
        otpStore[phone] = {
          otp,
          expiresAt: Date.now() + 5 * 60 * 1000,
          userData: {
            name: poi.name,
            gender: poi.gender,
            dob: poi.dob,
            state: poa.state,
            district: poa.dist,
          }
        };

        console.log(`OTP FOR ${phone} => ${otp}`);

        await client.messages.create({
          body: `Your verification OTP is ${otp}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phone,
        });

        fs.unlinkSync(zipPath);

        res.json({
          success: true,
          message: "OTP sent successfully",
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) throw new ApiError(400, "Phone and OTP required");

  const storedData = otpStore[phone];
  if (!storedData) throw new ApiError(400, "OTP expired or invalid");

  if (Date.now() > storedData.expiresAt) {
    delete otpStore[phone];
    throw new ApiError(400, "OTP expired");
  }

  if (storedData.otp !== otp) throw new ApiError(400, "Invalid OTP");

  const userData = storedData.userData;
  delete otpStore[phone];

  res.json({
    success: true,
    message: "Citizen verified successfully",
    user: userData
  });
});

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export const registerCitizen = asyncHandler(async (req, res) => {
  const { name, email, mobile, password } = req.body;

  if (!name || !email || !mobile || !password) {
    throw new ApiError(400, "name, email, mobile and password are required");
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, "User already exists with this email");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    mobile,
    passwordHash,
    role: "citizen",
  });

  const token = signToken(user);
  res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points,
      rank: user.rank,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, phone, mobile, loginId, password } = req.body;

  const id = loginId || email || phone || mobile;

  if (!id || !password) {
    throw new ApiError(400, "Phone number/email and password are required");
  }

  const user = await User.findOne({
    $or: [
      { email: id.toLowerCase() },
      { mobile: id }
    ]
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = signToken(user);

  res.status(200).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      points: user.points,
      rank: user.rank,
    },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("-passwordHash");
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  res.status(200).json({ user });
});


import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let client;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

export const sendSMS = async (to, body) => {
  console.log(`[Twilio SMS Init] Attempting to send SMS to: ${to}`);
  console.log(`[Twilio SMS Init] Message body: "${body}"`);

  if (!client) {
    console.warn("[Twilio SMS Error] Twilio client is not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your environment variables.");
    return;
  }
  
  if (!twilioPhoneNumber) {
    console.warn("[Twilio SMS Error] TWILIO_PHONE_NUMBER is not set in your environment variables.");
    return;
  }
  
  try {
    console.log(`[Twilio SMS Pending] Sending request to Twilio API...`);
    const message = await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    });
    console.log(`[Twilio SMS Success] SMS sent successfully to ${to}! Message SID: ${message.sid}`);
    return message;
  } catch (error) {
    console.error("[Twilio SMS Failed] Error encountered while sending SMS:", error.message || error);
    if (error.code) {
      console.error(`[Twilio SMS Failed] Twilio Error Code: ${error.code}`);
    }
  }
};

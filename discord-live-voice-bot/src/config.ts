import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  defaultBotToken: process.env.DISCORD_BOT_TOKEN || '',
};

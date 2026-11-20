import { Router } from 'express';
import { DiscordBotManager } from '../discord/botManager.js';

export function createApiRouter(botManager: DiscordBotManager): Router {
  const router = Router();

  // Get general system status & multi-account state
  router.get('/status', (req, res) => {
    const multiAccount = botManager.getMultiAccountState();
    const bot = botManager.getBotProfile();
    const voiceManager = botManager.getVoiceManager();
    const voice = voiceManager ? voiceManager.getState() : null;
    const stream = botManager.getAggregatedStreamStats();

    res.json({
      success: true,
      bot,
      voice,
      stream,
      multiAccount,
    });
  });

  // Get multi-account state
  router.get('/accounts', (req, res) => {
    res.json({
      success: true,
      ...botManager.getMultiAccountState(),
    });
  });

  // Add an account token (up to 5 accounts)
  router.post('/accounts/add', async (req, res) => {
    try {
      const { token, slot } = req.body;
      if (!token || typeof token !== 'string') {
        res.status(400).json({ success: false, error: 'Token string is required.' });
        return;
      }

      const account = await botManager.addAccount(token, slot);
      res.json({
        success: true,
        account,
        multiAccount: botManager.getMultiAccountState(),
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Remove / Disconnect a specific account
  router.delete('/accounts/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      await botManager.removeAccount(accountId);
      res.json({
        success: true,
        multiAccount: botManager.getMultiAccountState(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Set active target account for individual mode
  router.post('/accounts/:accountId/select', (req, res) => {
    try {
      const { accountId } = req.params;
      const state = botManager.setActiveAccount(accountId);
      res.json({ success: true, multiAccount: state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Switch broadcast mode: 'group' vs 'individual'
  router.post('/accounts/broadcast-mode', (req, res) => {
    try {
      const { mode, targetAccountId } = req.body;
      if (mode !== 'group' && mode !== 'individual') {
        res.status(400).json({ success: false, error: 'Mode must be group or individual.' });
        return;
      }
      const state = botManager.setBroadcastMode(mode, targetAccountId);
      res.json({ success: true, multiAccount: state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Toggle voice merge for an account
  router.post('/accounts/:accountId/merge-voice', (req, res) => {
    try {
      const { accountId } = req.params;
      const { merged } = req.body;
      const state = botManager.setAccountVoiceMerged(accountId, Boolean(merged));
      res.json({ success: true, multiAccount: state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Toggle voice merge for all accounts
  router.post('/accounts/merge-voice-all', (req, res) => {
    try {
      const { merged } = req.body;
      const state = botManager.setAllVoiceMerged(Boolean(merged));
      res.json({ success: true, multiAccount: state });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Join server via invite link/code
  router.post('/accounts/:accountId/join-invite', async (req, res) => {
    try {
      const { accountId } = req.params;
      const { invite } = req.body;
      if (!invite || typeof invite !== 'string') {
        res.status(400).json({ success: false, error: 'Invite link or code is required.' });
        return;
      }
      const result = await botManager.joinGuildViaInvite(accountId, invite);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Leave a specific server
  router.post('/accounts/:accountId/leave-guild', async (req, res) => {
    try {
      const { accountId } = req.params;
      const { guildId } = req.body;
      if (!guildId) {
        res.status(400).json({ success: false, error: 'guildId is required.' });
        return;
      }
      await botManager.leaveGuild(accountId, guildId);
      res.json({ success: true, message: 'Successfully left server.' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Backward compatibility: Login with token
  router.post('/auth/token', async (req, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        res.status(400).json({ success: false, error: 'Token string is required.' });
        return;
      }

      const account = await botManager.addAccount(token);
      res.json({ success: true, profile: account.profile, multiAccount: botManager.getMultiAccountState() });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message });
    }
  });

  // Disconnect all accounts
  router.post('/auth/disconnect', async (req, res) => {
    try {
      await botManager.disconnectAll();
      res.json({ success: true, message: 'All accounts disconnected.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get guilds for active (or specified) account
  router.get('/guilds', async (req, res) => {
    try {
      const accountId = req.query.accountId as string | undefined;
      const guilds = await botManager.getGuildsWithVoiceChannels(accountId);
      res.json({ success: true, guilds });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get single guild's voice channels on demand
  router.get('/guilds/:guildId/channels', async (req, res) => {
    try {
      const { guildId } = req.params;
      const accountId = req.query.accountId as string | undefined;
      const channels = await botManager.getGuildChannels(guildId, accountId);
      res.json({ success: true, channels });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Join a voice channel (individual account)
  router.post('/voice/join', async (req, res) => {
    try {
      const { guildId, channelId, accountId } = req.body;
      if (!guildId || !channelId) {
        res.status(400).json({ success: false, error: 'Both guildId and channelId are required.' });
        return;
      }

      const targetId = accountId || botManager.getActiveSession()?.id;
      if (!targetId) {
        res.status(400).json({ success: false, error: 'No account connected.' });
        return;
      }

      const voiceState = await botManager.joinChannel(targetId, guildId, channelId);
      res.json({ success: true, voiceState });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Join ALL accounts to the same voice channel
  router.post('/voice/join-all', async (req, res) => {
    try {
      const { guildId, channelId } = req.body;
      if (!guildId || !channelId) {
        res.status(400).json({ success: false, error: 'Both guildId and channelId are required.' });
        return;
      }

      const states = await botManager.joinAllToChannel(guildId, channelId);
      res.json({ success: true, states });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Leave voice channel (individual or all)
  router.post('/voice/leave', async (req, res) => {
    try {
      const { accountId } = req.body;
      if (accountId) {
        const voiceState = await botManager.leaveChannel(accountId);
        res.json({ success: true, voiceState });
      } else {
        await botManager.leaveAllChannels();
        res.json({ success: true, message: 'All accounts left voice.' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Set volume (0.1 to 5.0, where 1.0 = 100%, 3.0 = 300%)
  router.post('/audio/volume', (req, res) => {
    try {
      const { volume, accountId } = req.body;
      const volNum = parseFloat(volume);
      if (isNaN(volNum)) {
        res.status(400).json({ success: false, error: 'Valid volume number is required.' });
        return;
      }
      botManager.setOutputVolume(volNum, accountId);
      res.json({ success: true, volume: volNum });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Mute / Unmute
  router.post('/voice/mute', (req, res) => {
    try {
      const { mute, accountId } = req.body;
      if (accountId) {
        const state = botManager.setSelfMute(accountId, Boolean(mute));
        res.json({ success: true, voiceState: state });
      } else {
        const states = botManager.setAllSelfMute(Boolean(mute));
        res.json({ success: true, voiceStates: states });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Deafen / Undeafen
  router.post('/voice/deaf', (req, res) => {
    try {
      const { deaf, accountId } = req.body;
      if (accountId) {
        const state = botManager.setSelfDeaf(accountId, Boolean(deaf));
        res.json({ success: true, voiceState: state });
      } else {
        const states = botManager.setAllSelfDeaf(Boolean(deaf));
        res.json({ success: true, voiceStates: states });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

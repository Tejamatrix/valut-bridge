import React, { useState } from 'react';
import type { BotProfile } from '../types';
import { KeyRound, LogOut, CheckCircle2, ShieldAlert, UserCheck, Radio, Eye, EyeOff, HelpCircle } from 'lucide-react';

interface Props {
  botProfile: BotProfile | null;
  onLogin: (token: string) => Promise<any>;
  onDisconnect: () => void;
  isLoading: boolean;
  errorMessage: string | null;
}

export const TokenConnectCard: React.FC<Props> = ({
  botProfile,
  onLogin,
  onDisconnect,
  isLoading,
  errorMessage,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim();
    if (!clean) return;
    try {
      await onLogin(clean);
      setTokenInput('');
    } catch {
      // Handled by parent
    }
  };

  return (
    <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-5 shadow-lg relative overflow-hidden backdrop-blur-md">
      {/* Top Accent Gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-discord-brand to-purple-500" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Discord Account Authentication</h2>
            <p className="text-xs text-gray-400">Connect via User Account Token (Bluecord / Web / Mobile)</p>
          </div>
        </div>

        {botProfile ? (
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CONNECTED</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center space-x-1 text-xs text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Bluecord Guide</span>
          </button>
        )}
      </div>

      {/* Guide Panel */}
      {showHelp && !botProfile && (
        <div className="mb-4 p-3.5 bg-[#141518] border border-cyan-500/30 rounded-xl text-xs space-y-2">
          <div className="font-bold text-white">How to copy your Account Token from Bluecord:</div>
          <ol className="list-decimal list-inside space-y-1 text-gray-300">
            <li>Open <strong className="text-white">Bluecord</strong> on your device.</li>
            <li>Go to <strong className="text-white">User Settings</strong> (gear icon) ➔ <strong className="text-white">Bluecord Settings</strong>.</li>
            <li>Tap on <strong className="text-cyan-400">Account</strong> or <strong className="text-cyan-400">Copy Token</strong>.</li>
            <li>Paste your token below and click <strong className="text-white">Connect Account</strong>.</li>
          </ol>
          <div className="pt-1 text-[11px] text-gray-400">
            Also works with Discord Desktop/Browser tokens (DevTools ➔ Network header <code>authorization</code>).
          </div>
        </div>
      )}

      {botProfile ? (
        /* Authenticated User Account Profile View */
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#141518] rounded-xl border border-[#2b2d31]">
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <img
                src={botProfile.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                alt={botProfile.username}
                className="w-13 h-13 rounded-full border-2 border-cyan-400 object-cover shadow"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#141518]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white">{botProfile.username}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                  USER ACCOUNT
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">ID: {botProfile.id}</p>
              <div className="flex items-center space-x-3 mt-1 text-xs text-gray-400">
                <span className="flex items-center space-x-1">
                  <Radio className="w-3 h-3 text-cyan-400" />
                  <span>{botProfile.guildCount} Server{botProfile.guildCount === 1 ? '' : 's'}</span>
                </span>
                <span>•</span>
                <span>Gateway Ping: <strong className="text-emerald-400">{botProfile.ping}ms</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={onDisconnect}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnect</span>
          </button>
        </div>
      ) : (
        /* Token Input Form */
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste Bluecord / Discord Account Token"
              className="w-full pl-10 pr-10 py-2.5 bg-[#141518] border border-[#2b2d31] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-200"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errorMessage && (
            <div className="flex items-start space-x-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold">{errorMessage}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <p className="text-[11px] text-gray-500">
              Account tokens are processed securely in local server memory.
            </p>
            <button
              type="submit"
              disabled={isLoading || !tokenInput.trim()}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
            >
              {isLoading ? (
                <span>Connecting...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Connect Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

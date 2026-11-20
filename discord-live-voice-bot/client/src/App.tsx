import React, { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { useAudioCapture } from './hooks/useAudioCapture';
import { SlotTabBar } from './components/SlotTabBar';
import { SlotDetailsCard } from './components/SlotDetailsCard';
import { PushToTalkButton } from './components/PushToTalkButton';
import { AudioVisualizer } from './components/AudioVisualizer';
import { AudioSettings } from './components/AudioSettings';
import { LatencyStats } from './components/LatencyStats';
import { TestBeepCard } from './components/TestBeepCard';
import { Radio, ShieldCheck, AlertCircle, Users, User, Sparkles, Volume2, Flame } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedSlot, setSelectedSlot] = useState<number>(1);
  const [volumePercent, setVolumePercent] = useState<number>(200); // 200% loud default

  const {
    isConnected: socketConnected,
    latencyMs,
    accounts,
    broadcastMode,
    voiceState,
    streamStats,
    beepState,
    errorMessage,
    addAccount,
    removeAccount,
    setActiveAccount,
    setBroadcastMode,
    joinChannel,
    leaveChannel,
    setMute,
    setDeaf,
    setVolume,
    sendAudioChunk,
    sendPttState,
    startTestBeep,
    stopTestBeep,
  } = useSocket();

  const {
    audioDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    params,
    updateParam,
    applyPreset,
    speakMode,
    setSpeakMode,
    isSpeaking,
    setSpeaking,
    toggleSpeaking,
    micActive,
    audioLevel,
    decibels,
    micError,
    startMic,
    stopMic,
    analyserNode,
    setVolumeMultiplier,
  } = useAudioCapture({
    onAudioChunk: sendAudioChunk,
    onPttStateChange: sendPttState,
  });

  const handleVolumeChange = (newVal: number) => {
    const clamped = Math.max(10, Math.min(500, newVal));
    setVolumePercent(clamped);
    setVolumeMultiplier(clamped / 100);
    setVolume(clamped / 100);
  };

  // Sync initial volume on mount
  useEffect(() => {
    setVolumeMultiplier(volumePercent / 100);
    setVolume(volumePercent / 100);
  }, [setVolumeMultiplier, setVolume]);

  // Account corresponding to the currently selected slot tab
  const selectedSlotAccount = accounts.find((a) => a.slot === selectedSlot);

  // When switching slots in Individual mode, auto-target that slot's account
  const handleSelectSlot = (slotNum: number) => {
    setSelectedSlot(slotNum);
    const targetAcc = accounts.find((a) => a.slot === slotNum);
    if (targetAcc && broadcastMode === 'individual') {
      setActiveAccount(targetAcc.id);
    }
  };

  // Sync active account if selected slot changes
  useEffect(() => {
    if (selectedSlotAccount && broadcastMode === 'individual') {
      setActiveAccount(selectedSlotAccount.id);
    }
  }, [selectedSlotAccount, broadcastMode, setActiveAccount]);

  const channelConnected =
    broadcastMode === 'group'
      ? accounts.some((a) => a.voiceState?.isConnected)
      : (selectedSlotAccount?.voiceState?.isConnected ?? false);

  return (
    <div className="min-h-screen bg-[#111214] text-gray-200 flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-[#1f2024] bg-[#18191c]/95 backdrop-blur-md sticky top-0 z-50 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/20 text-black font-black">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-black text-white tracking-wide">
                DISCORD LIVE VOICE BOT
              </h1>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase">
                5 SLOTS • JOINT SYNC
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Direct Browser-to-Discord PCM Mic Broadcaster • Individual & Combine Play
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {/* Active Mode Pill */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-black ${
              broadcastMode === 'group'
                ? 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            }`}
          >
            {broadcastMode === 'group' ? (
              <>
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>JOINT SYNC ({accounts.length} BOTS COMBINED)</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>INDIVIDUAL: SLOT 0{selectedSlot}</span>
              </>
            )}
          </div>

          {/* DAVE Protocol Badge */}
          <div className="hidden md:flex items-center space-x-1 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>DAVE E2EE</span>
          </div>

          {/* WebSocket Status */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#141518] border border-[#2b2d31]">
            <span
              className={`w-2 h-2 rounded-full ${
                socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-300 font-mono text-[11px]">
              {socketConnected ? `WS: ${latencyMs}ms` : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="flex items-center space-x-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs shadow-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {/* 1. TOP SLOT TAB BAR (Slots 01 to 05 + INDIVIDUAL / JOINT SYNC Mode Switch) */}
        <SlotTabBar
          selectedSlot={selectedSlot}
          onSelectSlot={handleSelectSlot}
          accounts={accounts}
          broadcastMode={broadcastMode}
          onSetBroadcastMode={setBroadcastMode}
          maxSlots={5}
        />

        {/* 2. MAIN WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (5 Cols): Selected Slot's Details & Channel Controls */}
          <div className="lg:col-span-5 space-y-5">
            <SlotDetailsCard
              slotNumber={selectedSlot}
              account={selectedSlotAccount}
              onAddAccount={addAccount}
              onRemoveAccount={removeAccount}
              onJoinChannel={(gId, chId, accId) => joinChannel(gId, chId, accId)}
              onLeaveChannel={(accId) => leaveChannel(accId)}
              onSetMute={(mute, accId) => setMute(mute, accId)}
              onSetDeaf={(deaf, accId) => setDeaf(deaf, accId)}
            />
          </div>

          {/* Right Column (7 Cols): Studio Broadcaster, Live Mic & GOD-X APEX DSP */}
          <div className="lg:col-span-7 space-y-5">
            {/* Studio Header Card with Volume & Overdrive Controls */}
            <div className="bg-[#18191c] border-2 border-[#2b2d31] rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24262b]">
                <div>
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {broadcastMode === 'individual'
                        ? `SLOT 0${selectedSlot} INDIVIDUAL STUDIO`
                        : 'JOINT SYNC STUDIO (ALL BOTS)'}
                    </span>
                  </span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {broadcastMode === 'individual'
                      ? 'Streaming audio only affects this account slot. Switch slots to stream different audios on each account.'
                      : `Combine Play Active: Speaking on mic plays from ALL ${accounts.length} connected bots together!`}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {broadcastMode === 'individual' ? `SLOT 0${selectedSlot} ACTIVE` : 'ALL BOTS SYNCED'}
                  </span>
                </div>
              </div>

              {/* Volume Slider & Presets (Matching Reference Image) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/30 shrink-0">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="500"
                      step="5"
                      value={volumePercent}
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
                      className="flex-1 h-2 bg-[#141518] rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <span className="text-xs font-black font-mono text-amber-400 w-12 text-right">
                      {volumePercent}%
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div className="flex items-center space-x-1.5">
                    {[50, 100, 200, 300].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleVolumeChange(preset)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          volumePercent === preset
                            ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20'
                            : 'bg-[#141518] hover:bg-[#202227] text-gray-300 border-[#2b2d31]'
                        }`}
                      >
                        {preset}% {preset >= 300 ? '🔥' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 300% PEAK OVERDRIVE Button */}
                <button
                  type="button"
                  onClick={() => handleVolumeChange(300)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 border shadow-lg cursor-pointer ${
                    volumePercent >= 300
                      ? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-300 shadow-amber-400/20 animate-pulse'
                      : 'bg-[#141518] hover:bg-[#202227] text-amber-400 border-amber-400/40 hover:border-amber-400'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span>🔥 300% PEAK OVERDRIVE</span>
                </button>
              </div>
            </div>

            {/* Big Interactive Push-To-Talk Button */}
            <PushToTalkButton
              isSpeaking={isSpeaking}
              onStartSpeaking={() => setSpeaking(true)}
              onStopSpeaking={() => setSpeaking(false)}
              onToggleSpeaking={toggleSpeaking}
              speakMode={speakMode}
              audioLevel={audioLevel}
              micActive={micActive}
              channelConnected={channelConnected}
              onStartMic={() => startMic()}
              broadcastMode={broadcastMode}
              accountsCount={accounts.length}
              activeAccountName={
                broadcastMode === 'individual'
                  ? selectedSlotAccount?.profile.username || `Slot 0${selectedSlot}`
                  : `${accounts.length} Bots`
              }
            />

            {/* Audio VU Meter & Frequency Spectrum */}
            <AudioVisualizer
              analyserNode={analyserNode}
              audioLevel={audioLevel}
              decibels={decibels}
              isSpeaking={isSpeaking}
              micActive={micActive}
            />

            {/* GOD-X APEX DSP Engine Controls */}
            <AudioSettings
              audioDevices={audioDevices}
              selectedDeviceId={selectedDeviceId}
              onDeviceChange={(devId) => {
                setSelectedDeviceId(devId);
                startMic(devId);
              }}
              params={params}
              onUpdateParam={updateParam}
              onApplyPreset={applyPreset}
              speakMode={speakMode}
              onModeChange={setSpeakMode}
              micActive={micActive}
              onStartMic={() => startMic()}
              onStopMic={stopMic}
              micError={micError}
            />

            {/* Latency & Telemetry */}
            <LatencyStats
              latencyMs={latencyMs}
              streamStats={streamStats}
              voiceState={selectedSlotAccount?.voiceState || voiceState}
            />
          </div>
        </div>

        {/* 3. HIGH-PITCH LOUD TEST BEEP (Respects Individual vs Combine Play) */}
        <TestBeepCard
          beepState={beepState}
          onStartBeep={startTestBeep}
          onStopBeep={stopTestBeep}
          voiceState={selectedSlotAccount?.voiceState || voiceState}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1f2024] py-4 px-6 text-center text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between">
        <div>
          Discord Live Voice Bot • Built with <strong className="text-gray-400">@discordjs/voice v0.19+</strong> & <strong className="text-gray-400">DAVE E2EE</strong>
        </div>
        <div className="flex items-center space-x-2 mt-2 sm:mt-0 font-mono text-[11px]">
          <span>Custom Slots: 5 Tabs</span>
          <span>•</span>
          <span>Joint Sync Combine Play</span>
          <span>•</span>
          <span className="text-amber-400">48kHz PCM Stereo</span>
        </div>
      </footer>
    </div>
  );
};

export default App;

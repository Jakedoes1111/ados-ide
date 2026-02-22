/********************************************************************************
 * Copyright (C) 2026 aDOs IDE contributors and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

export type VoicePolicyPreset = 'safe' | 'balanced' | 'power';
export type VoiceActivationMode = 'toggle';
export type VoiceProvider = 'whisper.cpp' | 'piper';
export type VoiceCommandPolicyPreset = 'safe' | 'balanced' | 'power';

export interface VoiceSessionState {
    modeEnabled: boolean;
    activationMode: VoiceActivationMode;
    policyPreset: VoicePolicyPreset;
    sttProvider: VoiceProvider;
    ttsProvider: VoiceProvider;
    commandConfirmationPreset: VoiceCommandPolicyPreset;
}


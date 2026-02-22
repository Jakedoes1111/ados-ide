/********************************************************************************
 * Copyright (C) 2026 aDOs IDE contributors and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { Event } from '@theia/core/lib/common/event';
import { VoicePolicyPreset, VoiceSessionState } from './voice-types';

export const VoiceSessionService = Symbol('VoiceSessionService');

export interface VoiceSessionService {
    readonly onDidChangeState: Event<VoiceSessionState>;
    getState(): VoiceSessionState;
    toggleMode(): Promise<void>;
    setPolicyPreset(preset: VoicePolicyPreset): Promise<void>;
}


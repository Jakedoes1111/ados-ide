/********************************************************************************
 * Copyright (C) 2026 aDOs IDE contributors and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { FrontendApplicationContribution, StatusBar, StorageService } from '@theia/core/lib/browser';
import { ContextKey, ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { StatusBarAlignment } from '@theia/core/lib/browser/status-bar/status-bar';
import { Emitter } from '@theia/core/lib/common/event';
import { inject, injectable } from '@theia/core/shared/inversify';
import { VoiceSessionService as VoiceSessionServiceToken, VoiceSessionService } from '../common/voice-session-service';
import { VoicePolicyPreset, VoiceSessionState } from '../common/voice-types';

const STORAGE_KEY = 'theia-ide.voice.state';
const STATUS_BAR_ID = 'theia-ide.voice.status';
const DEFAULT_STATE: VoiceSessionState = {
    modeEnabled: false,
    activationMode: 'toggle',
    policyPreset: 'balanced',
    sttProvider: 'whisper.cpp',
    ttsProvider: 'piper',
    commandConfirmationPreset: 'balanced'
};

@injectable()
export class VoiceFrontendService implements FrontendApplicationContribution, VoiceSessionService {
    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    protected readonly onDidChangeStateEmitter = new Emitter<VoiceSessionState>();
    readonly onDidChangeState = this.onDidChangeStateEmitter.event;

    protected state: VoiceSessionState = { ...DEFAULT_STATE };
    protected voiceModeEnabledContextKey: ContextKey<boolean> | undefined;
    protected voicePolicyPresetContextKey: ContextKey<string> | undefined;

    async onStart(): Promise<void> {
        await this.restoreState();
        this.voiceModeEnabledContextKey = this.contextKeyService.createKey<boolean>('ados.voiceModeEnabled', this.state.modeEnabled);
        this.voicePolicyPresetContextKey = this.contextKeyService.createKey<string>('ados.voicePolicyPreset', this.state.policyPreset);
        this.publishState();
    }

    onStop(): void {
        this.statusBar.removeElement(STATUS_BAR_ID);
    }

    getState(): VoiceSessionState {
        return { ...this.state };
    }

    async toggleMode(): Promise<void> {
        this.state.modeEnabled = !this.state.modeEnabled;
        await this.persistState();
        this.publishState();
    }

    async setPolicyPreset(preset: VoicePolicyPreset): Promise<void> {
        this.state.policyPreset = preset;
        this.state.commandConfirmationPreset = preset;
        await this.persistState();
        this.publishState();
    }

    protected publishState(): void {
        this.voiceModeEnabledContextKey?.set(this.state.modeEnabled);
        this.voicePolicyPresetContextKey?.set(this.state.policyPreset);

        const modeText = this.state.modeEnabled ? 'ON' : 'OFF';
        const policyText = this.state.policyPreset.toUpperCase();
        this.statusBar.setElement(STATUS_BAR_ID, {
            alignment: StatusBarAlignment.RIGHT,
            priority: 120,
            text: `$(mic) VOICE ${modeText} [${policyText}]`,
            tooltip: `Voice mode ${modeText}. Policy preset: ${policyText}.`
        });
        this.onDidChangeStateEmitter.fire({ ...this.state });
    }

    protected async restoreState(): Promise<void> {
        const state = await this.storageService.getData<Partial<VoiceSessionState>>(STORAGE_KEY, {});
        this.state = {
            ...DEFAULT_STATE,
            ...state,
            activationMode: 'toggle',
            sttProvider: 'whisper.cpp',
            ttsProvider: 'piper'
        };
        if (this.state.policyPreset !== 'safe' && this.state.policyPreset !== 'balanced' && this.state.policyPreset !== 'power') {
            this.state.policyPreset = DEFAULT_STATE.policyPreset;
        }
        if (this.state.commandConfirmationPreset !== 'safe'
            && this.state.commandConfirmationPreset !== 'balanced'
            && this.state.commandConfirmationPreset !== 'power') {
            this.state.commandConfirmationPreset = this.state.policyPreset;
        }
    }

    protected async persistState(): Promise<void> {
        await this.storageService.setData(STORAGE_KEY, this.state);
    }
}

export const VoiceSessionServiceBinding = VoiceSessionServiceToken;


/********************************************************************************
 * Copyright (C) 2026 aDOs IDE contributors and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { Command, CommandContribution, CommandRegistry, MessageService } from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';
import { VoiceSessionService } from '../common/voice-session-service';

export namespace VoiceCommands {
    const category = 'Voice';

    export const TOGGLE_MODE: Command = {
        id: 'voice.mode.toggle',
        label: 'Toggle Voice Mode',
        category
    };

    export const SET_POLICY_SAFE: Command = {
        id: 'voice.policy.safe',
        label: 'Set Voice Policy: Safe',
        category
    };

    export const SET_POLICY_BALANCED: Command = {
        id: 'voice.policy.balanced',
        label: 'Set Voice Policy: Balanced',
        category
    };

    export const SET_POLICY_POWER: Command = {
        id: 'voice.policy.power',
        label: 'Set Voice Policy: Power',
        category
    };
}

@injectable()
export class VoiceContribution implements CommandContribution, KeybindingContribution {
    @inject(VoiceSessionService)
    protected readonly voiceSessionService: VoiceSessionService;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(VoiceCommands.TOGGLE_MODE, {
            execute: async () => {
                await this.voiceSessionService.toggleMode();
                const state = this.voiceSessionService.getState();
                this.messageService.info(`Voice mode ${state.modeEnabled ? 'enabled' : 'disabled'}.`);
            }
        });

        registry.registerCommand(VoiceCommands.SET_POLICY_SAFE, {
            execute: async () => this.setPolicy('safe')
        });

        registry.registerCommand(VoiceCommands.SET_POLICY_BALANCED, {
            execute: async () => this.setPolicy('balanced')
        });

        registry.registerCommand(VoiceCommands.SET_POLICY_POWER, {
            execute: async () => this.setPolicy('power')
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: VoiceCommands.TOGGLE_MODE.id,
            keybinding: 'ctrlcmd+alt+space'
        });
    }

    protected async setPolicy(preset: 'safe' | 'balanced' | 'power'): Promise<void> {
        await this.voiceSessionService.setPolicyPreset(preset);
        this.messageService.info(`Voice policy preset set to ${preset}.`);
    }
}


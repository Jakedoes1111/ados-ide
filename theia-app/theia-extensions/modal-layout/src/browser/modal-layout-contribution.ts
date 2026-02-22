/********************************************************************************
 * Copyright (C) 2026 aDOs IDE contributors and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import {
    ApplicationShell,
    FrontendApplicationContribution,
    KeybindingContribution,
    KeybindingRegistry,
    StatusBar,
    StorageService
} from '@theia/core/lib/browser';
import { ContextKeyService } from '@theia/core/lib/browser/context-key-service';
import { StatusBarAlignment } from '@theia/core/lib/browser/status-bar/status-bar';
import { Command, CommandContribution, CommandRegistry, MessageService } from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';

const STORAGE_KEY = 'theia-ide.modal-layout.state';
const STATUS_BAR_ID = 'theia-ide.modal-layout.status';
const DEFAULT_PREFIX_TIMEOUT_MS = 1250;

type VimMode = 'normal' | 'insert' | 'visual' | 'command';

interface PersistedState {
    mode?: VimMode;
    layoutProfile?: unknown;
    prefixTimeoutMs?: number;
}

export namespace ModalLayoutCommands {
    const category = 'Modal Layout';

    export const PREFIX: Command = {
        id: 'modal-layout.prefix',
        label: 'Arm tmux Prefix',
        category
    };

    export const SPLIT_HORIZONTAL: Command = {
        id: 'modal-layout.split.horizontal',
        label: 'Split Pane Horizontal',
        category
    };

    export const SPLIT_VERTICAL: Command = {
        id: 'modal-layout.split.vertical',
        label: 'Split Pane Vertical',
        category
    };

    export const FOCUS_LEFT: Command = {
        id: 'modal-layout.focus.left',
        label: 'Focus Pane Left',
        category
    };

    export const FOCUS_RIGHT: Command = {
        id: 'modal-layout.focus.right',
        label: 'Focus Pane Right',
        category
    };

    export const FOCUS_UP: Command = {
        id: 'modal-layout.focus.up',
        label: 'Focus Pane Up',
        category
    };

    export const FOCUS_DOWN: Command = {
        id: 'modal-layout.focus.down',
        label: 'Focus Pane Down',
        category
    };

    export const CLOSE_PANE: Command = {
        id: 'modal-layout.close-pane',
        label: 'Close Current Pane',
        category
    };

    export const SAVE_LAYOUT_PROFILE: Command = {
        id: 'modal-layout.layout.save-profile',
        label: 'Save Layout Profile',
        category
    };

    export const LOAD_LAYOUT_PROFILE: Command = {
        id: 'modal-layout.layout.load-profile',
        label: 'Load Layout Profile',
        category
    };

    export const MODE_NORMAL: Command = {
        id: 'modal-layout.mode.normal',
        label: 'Switch to Normal Mode',
        category
    };

    export const MODE_INSERT: Command = {
        id: 'modal-layout.mode.insert',
        label: 'Switch to Insert Mode',
        category
    };

    export const MODE_VISUAL: Command = {
        id: 'modal-layout.mode.visual',
        label: 'Switch to Visual Mode',
        category
    };

    export const MODE_COMMAND: Command = {
        id: 'modal-layout.mode.command',
        label: 'Switch to Command Mode',
        category
    };
}

@injectable()
export class ModalLayoutContribution implements FrontendApplicationContribution, CommandContribution, KeybindingContribution {

    @inject(ApplicationShell)
    protected readonly shell: ApplicationShell;

    @inject(CommandRegistry)
    protected readonly commandRegistry: CommandRegistry;

    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(StatusBar)
    protected readonly statusBar: StatusBar;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(ContextKeyService)
    protected readonly contextKeyService: ContextKeyService;

    protected mode: VimMode = 'normal';
    protected prefixPending = false;
    protected prefixTimeoutHandle: number | undefined;
    protected prefixTimeoutMs = DEFAULT_PREFIX_TIMEOUT_MS;
    protected layoutProfile: unknown;
    protected keydownListener: ((event: KeyboardEvent) => void) | undefined;

    async onStart(): Promise<void> {
        await this.restoreState();
        this.keydownListener = event => this.handleGlobalKeyDown(event);
        window.addEventListener('keydown', this.keydownListener, true);
        this.updateStatusBar();
    }

    onStop(): void {
        if (this.keydownListener) {
            window.removeEventListener('keydown', this.keydownListener, true);
            this.keydownListener = undefined;
        }
        this.clearPrefixTimeout();
        this.statusBar.removeElement(STATUS_BAR_ID);
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(ModalLayoutCommands.PREFIX, {
            execute: () => this.armPrefix()
        });

        registry.registerCommand(ModalLayoutCommands.SPLIT_HORIZONTAL, {
            execute: () => this.splitHorizontal()
        });

        registry.registerCommand(ModalLayoutCommands.SPLIT_VERTICAL, {
            execute: () => this.splitVertical()
        });

        registry.registerCommand(ModalLayoutCommands.FOCUS_LEFT, {
            execute: () => this.focusLeft()
        });

        registry.registerCommand(ModalLayoutCommands.FOCUS_RIGHT, {
            execute: () => this.focusRight()
        });

        registry.registerCommand(ModalLayoutCommands.FOCUS_UP, {
            execute: () => this.focusUp()
        });

        registry.registerCommand(ModalLayoutCommands.FOCUS_DOWN, {
            execute: () => this.focusDown()
        });

        registry.registerCommand(ModalLayoutCommands.CLOSE_PANE, {
            execute: () => this.closePane()
        });

        registry.registerCommand(ModalLayoutCommands.SAVE_LAYOUT_PROFILE, {
            execute: () => this.saveLayoutProfile()
        });

        registry.registerCommand(ModalLayoutCommands.LOAD_LAYOUT_PROFILE, {
            execute: () => this.loadLayoutProfile()
        });

        registry.registerCommand(ModalLayoutCommands.MODE_NORMAL, {
            execute: () => this.setMode('normal')
        });

        registry.registerCommand(ModalLayoutCommands.MODE_INSERT, {
            execute: () => this.setMode('insert')
        });

        registry.registerCommand(ModalLayoutCommands.MODE_VISUAL, {
            execute: () => this.setMode('visual')
        });

        registry.registerCommand(ModalLayoutCommands.MODE_COMMAND, {
            execute: () => this.setMode('command')
        });
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        const when = 'editorTextFocus';
        registry.registerKeybinding({ command: ModalLayoutCommands.PREFIX.id, keybinding: 'ctrlcmd+b', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.SPLIT_HORIZONTAL.id, keybinding: 'ctrlcmd+alt+1', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.SPLIT_VERTICAL.id, keybinding: 'ctrlcmd+alt+2', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.FOCUS_LEFT.id, keybinding: 'ctrlcmd+alt+h', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.FOCUS_DOWN.id, keybinding: 'ctrlcmd+alt+j', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.FOCUS_UP.id, keybinding: 'ctrlcmd+alt+k', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.FOCUS_RIGHT.id, keybinding: 'ctrlcmd+alt+l', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.CLOSE_PANE.id, keybinding: 'ctrlcmd+alt+x', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.SAVE_LAYOUT_PROFILE.id, keybinding: 'ctrlcmd+alt+s', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.LOAD_LAYOUT_PROFILE.id, keybinding: 'ctrlcmd+alt+r', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.MODE_NORMAL.id, keybinding: 'escape', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.MODE_INSERT.id, keybinding: 'ctrlcmd+alt+i', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.MODE_VISUAL.id, keybinding: 'ctrlcmd+alt+v', when });
        registry.registerKeybinding({ command: ModalLayoutCommands.MODE_COMMAND.id, keybinding: 'ctrlcmd+alt+m', when });
    }

    protected handleGlobalKeyDown(event: KeyboardEvent): void {
        if (event.defaultPrevented) {
            return;
        }

        if (!this.shouldHandleModalEvent(event)) {
            return;
        }

        if (this.handlePrefixEvent(event)) {
            return;
        }

        this.handleModeEvent(event);
    }

    protected handlePrefixEvent(event: KeyboardEvent): boolean {
        if (this.isPrefixChord(event)) {
            this.consumeEvent(event);
            this.armPrefix();
            return true;
        }

        if (!this.prefixPending) {
            return false;
        }

        if (this.isModifierOnlyKey(event.key)) {
            return false;
        }

        const key = this.normalizeKey(event.key);
        this.disarmPrefix();
        this.consumeEvent(event);
        void this.executePrefixedAction(key);
        return true;
    }

    protected handleModeEvent(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            if (this.mode !== 'normal') {
                this.consumeEvent(event);
                this.setMode('normal');
            }
            return;
        }

        if (this.mode === 'insert' || this.hasCommandModifier(event)) {
            return;
        }

        const key = this.normalizeKey(event.key);

        if (this.mode === 'normal') {
            if (key === 'i') {
                this.consumeEvent(event);
                this.setMode('insert');
                return;
            }
            if (key === 'v') {
                this.consumeEvent(event);
                this.setMode('visual');
                return;
            }
            if (key === ':') {
                this.consumeEvent(event);
                this.setMode('command');
                return;
            }
            if (this.isNavigationKey(key)) {
                this.consumeEvent(event);
                void this.executeNavigationKey(key);
            }
            return;
        }

        if (this.mode === 'visual') {
            if (this.isNavigationKey(key)) {
                this.consumeEvent(event);
                void this.executeNavigationKey(key);
                return;
            }
            if (key === 'i') {
                this.consumeEvent(event);
                this.setMode('insert');
            }
            return;
        }

        if (this.mode === 'command') {
            if (event.key === 'Enter') {
                this.consumeEvent(event);
                this.setMode('normal');
                return;
            }

            if (key.length === 1) {
                this.consumeEvent(event);
            }
        }
    }

    protected isPrefixChord(event: KeyboardEvent): boolean {
        return event.ctrlKey && !event.altKey && !event.metaKey && this.normalizeKey(event.key) === 'b';
    }

    protected armPrefix(): void {
        this.prefixPending = true;
        this.clearPrefixTimeout();
        this.prefixTimeoutHandle = window.setTimeout(() => {
            this.disarmPrefix();
        }, this.prefixTimeoutMs);
        this.updateStatusBar();
    }

    protected disarmPrefix(): void {
        this.prefixPending = false;
        this.clearPrefixTimeout();
        this.updateStatusBar();
    }

    protected clearPrefixTimeout(): void {
        if (this.prefixTimeoutHandle !== undefined) {
            window.clearTimeout(this.prefixTimeoutHandle);
            this.prefixTimeoutHandle = undefined;
        }
    }

    protected async executePrefixedAction(key: string): Promise<void> {
        switch (key) {
            case '"':
            case '-':
                await this.splitHorizontal();
                break;
            case '%':
            case '\\':
                await this.splitVertical();
                break;
            case 'h':
                await this.focusLeft();
                break;
            case 'j':
                await this.focusDown();
                break;
            case 'k':
                await this.focusUp();
                break;
            case 'l':
                await this.focusRight();
                break;
            case 'x':
                await this.closePane();
                break;
            case 's':
                await this.saveLayoutProfile();
                break;
            case 'r':
                await this.loadLayoutProfile();
                break;
            case 'i':
                this.setMode('insert');
                break;
            case 'v':
                this.setMode('visual');
                break;
            case ':':
                this.setMode('command');
                break;
            case 'n':
                this.setMode('normal');
                break;
            default:
                break;
        }
    }

    protected async executeNavigationKey(key: string): Promise<void> {
        switch (key) {
            case 'h':
                await this.focusLeft();
                break;
            case 'j':
                await this.focusDown();
                break;
            case 'k':
                await this.focusUp();
                break;
            case 'l':
                await this.focusRight();
                break;
            default:
                break;
        }
    }

    protected async splitHorizontal(): Promise<void> {
        await this.executeFirstAvailableCommand([
            'workbench.action.splitEditorDown',
            'workbench.action.splitEditorOrthogonal',
            'workbench.action.splitEditor'
        ]);
    }

    protected async splitVertical(): Promise<void> {
        await this.executeFirstAvailableCommand([
            'workbench.action.splitEditorRight',
            'workbench.action.splitEditor'
        ]);
    }

    protected async focusLeft(): Promise<void> {
        await this.executeFirstAvailableCommand([
            'workbench.action.navigateLeft',
            'workbench.action.focusLeftGroup'
        ]);
    }

    protected async focusRight(): Promise<void> {
        await this.executeFirstAvailableCommand([
            'workbench.action.navigateRight',
            'workbench.action.focusRightGroup'
        ]);
    }

    protected async focusUp(): Promise<void> {
        await this.executeFirstAvailableCommand([
            'workbench.action.navigateUp',
            'workbench.action.focusAboveGroup'
        ]);
    }

    protected async focusDown(): Promise<void> {
        await this.executeFirstAvailableCommand([
            'workbench.action.navigateDown',
            'workbench.action.focusBelowGroup'
        ]);
    }

    protected async closePane(): Promise<void> {
        const executed = await this.executeFirstAvailableCommand([
            'workbench.action.closeEditorsInGroup',
            'workbench.action.closeActiveEditor'
        ]);

        if (executed) {
            return;
        }

        const shellLike = this.shell as ApplicationShell & {
            currentWidget?: { id: string };
            closeWidget?: (id: string) => void;
        };

        if (shellLike.currentWidget?.id && shellLike.closeWidget) {
            shellLike.closeWidget(shellLike.currentWidget.id);
        }
    }

    protected async saveLayoutProfile(): Promise<void> {
        const shellLike = this.shell as ApplicationShell & {
            getLayoutData?: () => unknown;
        };

        if (!shellLike.getLayoutData) {
            this.messageService.warn('Unable to save layout: layout data API is unavailable.');
            return;
        }

        this.layoutProfile = shellLike.getLayoutData();
        await this.persistState();
        this.messageService.info('Layout profile saved.');
    }

    protected async loadLayoutProfile(): Promise<void> {
        if (!this.layoutProfile) {
            this.messageService.info('No saved layout profile is available.');
            return;
        }

        const shellLike = this.shell as ApplicationShell & {
            setLayoutData?: (layoutData: unknown) => Promise<void> | void;
        };

        if (!shellLike.setLayoutData) {
            this.messageService.warn('Unable to load layout: layout restore API is unavailable.');
            return;
        }

        await Promise.resolve(shellLike.setLayoutData(this.layoutProfile));
        this.messageService.info('Layout profile loaded.');
    }

    protected async executeFirstAvailableCommand(commandIds: string[]): Promise<boolean> {
        for (const id of commandIds) {
            if (!this.commandRegistry.getCommand(id)) {
                continue;
            }
            await Promise.resolve(this.commandRegistry.executeCommand(id));
            return true;
        }
        return false;
    }

    protected setMode(mode: VimMode): void {
        if (this.mode === mode) {
            this.updateStatusBar();
            return;
        }

        this.mode = mode;
        void this.persistState();
        this.updateStatusBar();
    }

    protected normalizeKey(key: string): string {
        return key.length === 1 ? key.toLowerCase() : key;
    }

    protected hasCommandModifier(event: KeyboardEvent): boolean {
        return event.ctrlKey || event.metaKey || event.altKey;
    }

    protected isModifierOnlyKey(key: string): boolean {
        return key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta';
    }

    protected shouldHandleModalEvent(event: KeyboardEvent): boolean {
        const target = event.target instanceof HTMLElement ? event.target : undefined;
        if (this.contextKeyService.match('inQuickOpen', target)) {
            return false;
        }
        return this.contextKeyService.match('editorTextFocus', target);
    }

    protected isNavigationKey(key: string): boolean {
        return key === 'h' || key === 'j' || key === 'k' || key === 'l';
    }

    protected consumeEvent(event: KeyboardEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    protected updateStatusBar(): void {
        const modeLabel = this.mode.toUpperCase();
        const text = this.prefixPending ? `$(keyboard) ${modeLabel} [C-b]` : `$(keyboard) ${modeLabel}`;
        const tooltip = this.prefixPending
            ? `Vim mode: ${modeLabel}. tmux prefix is pending.`
            : `Vim mode: ${modeLabel}.`;

        this.statusBar.setElement(STATUS_BAR_ID, {
            text,
            tooltip,
            alignment: StatusBarAlignment.RIGHT,
            priority: 100
        });
    }

    protected async restoreState(): Promise<void> {
        const state = await this.storageService.getData<PersistedState>(STORAGE_KEY, {});
        if (state?.mode && this.isVimMode(state.mode)) {
            this.mode = state.mode;
        }
        if (state && typeof state.prefixTimeoutMs === 'number' && state.prefixTimeoutMs > 0) {
            this.prefixTimeoutMs = state.prefixTimeoutMs;
        }
        if (state?.layoutProfile) {
            this.layoutProfile = state.layoutProfile;
        }
    }

    protected async persistState(): Promise<void> {
        const state: PersistedState = {
            mode: this.mode,
            prefixTimeoutMs: this.prefixTimeoutMs,
            layoutProfile: this.layoutProfile
        };
        await this.storageService.setData(STORAGE_KEY, state);
    }

    protected isVimMode(mode: string): mode is VimMode {
        return mode === 'normal' || mode === 'insert' || mode === 'visual' || mode === 'command';
    }
}
